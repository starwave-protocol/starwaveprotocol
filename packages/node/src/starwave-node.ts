import { EventEmitter } from "node:events";
import {
  CreatePacketInput,
  Identity,
  PeerSession,
  StarwavePacket,
  createEnvelope,
  createForwardingHeader,
  getEnvelopeSigningPayload,
  recoverAddressFromPublicKey,
  signString,
  validatePacketShape,
  verifyStringSignature,
} from "@starwave/core";
import { PluginHost } from "./plugin-host.js";
import { ReplayCache } from "./replay-cache.js";
import { RouteStore } from "./route-store.js";
import { ConsoleLogger } from "./logger.js";
import {
  IncomingPacketContext,
  LoggerLike,
  PeerSessionRecord,
  ReceiveEvent,
  RegisteredTransport,
  StarwaveNodeRuntime,
  StarwaveNodeOptions,
} from "./types.js";

export class StarwaveNode extends EventEmitter implements StarwaveNodeRuntime {
  readonly address: string;
  readonly identity: Identity;
  readonly routeStore = new RouteStore();
  readonly replayCache = new ReplayCache();
  readonly pluginHost: PluginHost;
  readonly logger: LoggerLike;

  private readonly transports = new Map<string, RegisteredTransport>();
  private readonly sessions = new Map<string, PeerSessionRecord>();

  constructor(private readonly options: StarwaveNodeOptions) {
    super();
    this.identity = options.identity;
    this.address = options.identity.address;
    this.logger = options.logger ?? new ConsoleLogger("starwave-node");
    this.pluginHost = new PluginHost(this);
  }

  rememberSession(session: PeerSessionRecord): void {
    this.sessions.set(session.peerAddress.toLowerCase(), session);
    this.emit("sessionEstablished", {
      peerAddress: session.peerAddress,
      codec: session.selectedCodec,
      transportId: session.transportId,
    });
  }

  getSession(peerAddress: string): PeerSession | undefined {
    return this.sessions.get(peerAddress.toLowerCase());
  }

  async registerTransport(transport: RegisteredTransport): Promise<void> {
    this.transports.set(transport.id, transport);
    transport.onPacket(async (packet, context) => {
      await this.handleIncomingPacket(packet, context);
    });
    await transport.start();
    this.emit("transportRegistered", { transportId: transport.id, peerCount: transport.getPeers().length });
  }

  async loadTransportModule(modulePath: string): Promise<void> {
    const transport = await this.pluginHost.loadFromModule(modulePath);
    await this.registerTransport(transport);
  }

  async stop(): Promise<void> {
    await Promise.all([...this.transports.values()].map((transport) => transport.stop()));
  }

  async createSignedPacket<TPayload>(input: CreatePacketInput<TPayload>): Promise<StarwavePacket<TPayload>> {
    const envelope = createEnvelope(input);
    const forwarding = createForwardingHeader(input.expectedRoute ?? []);
    const originSignature = signString(getEnvelopeSigningPayload(envelope), this.identity.privateKey);
    return {
      envelope,
      forwarding,
      payload: input.payload,
      payloadEncoding: "json",
      originPublicKey: this.identity.publicKey,
      originSignature,
    };
  }

  async send<TPayload>(destination: string, payload: TPayload): Promise<StarwavePacket<TPayload>> {
    const routeHint = this.routeStore.get(destination);
    const packet = await this.createSignedPacket({
      source: this.address,
      destination,
      payload,
      expectedRoute: routeHint?.path ?? [],
    });
    await this.forwardPacket(packet, {});
    return packet;
  }

  private async handleIncomingPacket(packet: StarwavePacket, context: IncomingPacketContext): Promise<void> {
    this.emit("packetReceived", {
      packetId: packet.envelope.packetId,
      from: packet.envelope.source,
      to: packet.envelope.destination,
      transportId: context.transportId,
      peerAddress: context.peerAddress,
      deliveryMode: packet.forwarding.deliveryMode,
    });

    const validation = validatePacketShape(packet);
    if (!validation.ok) {
      this.emit("warning", validation.reason);
      return;
    }

    if (recoverAddressFromPublicKey(packet.originPublicKey) !== packet.envelope.source) {
      this.emit("warning", "Origin public key does not match source address");
      return;
    }

    if (
      !verifyStringSignature(
        getEnvelopeSigningPayload(packet.envelope),
        packet.originSignature,
        packet.originPublicKey,
      )
    ) {
      this.emit("warning", "Invalid origin signature");
      return;
    }

    if (this.replayCache.has(packet.envelope.packetId)) {
      return;
    }
    this.replayCache.add(packet.envelope.packetId);

    if (context.peerAddress) {
      this.routeStore.remember(context.peerAddress, [this.address, context.peerAddress], 0.9);
    }

    const trace = [...packet.forwarding.trace, this.address];
    packet.forwarding.trace = trace;
    packet.forwarding.previousHop = context.peerAddress;
    packet.forwarding.hopCount += 1;

    if (packet.forwarding.expectedRoute.includes(this.address)) {
      this.routeStore.remember(packet.envelope.destination, packet.forwarding.expectedRoute, 0.6);
    }

    if (packet.envelope.destination === this.address) {
      this.emit("message", { packet } satisfies ReceiveEvent);
      return;
    }

    await this.forwardPacket(packet, {
      excludePeerAddresses: context.peerAddress ? [context.peerAddress] : [],
    });
  }

  private async forwardPacket(packet: StarwavePacket, options: { excludePeerAddresses?: string[] }): Promise<void> {
    const guidedNextHop = this.resolveGuidedNextHop(packet);
    if (guidedNextHop) {
      this.emit("packetForwarded", {
        packetId: packet.envelope.packetId,
        destination: packet.envelope.destination,
        nextHop: guidedNextHop,
        mode: "guided",
      });
      await this.sendToPeer(guidedNextHop, packet);
      this.routeStore.markUsed(packet.envelope.destination);
      return;
    }

    packet.forwarding.deliveryMode = "discovery";
    packet.forwarding.routeBroken = packet.forwarding.expectedRoute.length > 0;
    packet.forwarding.nextHopHint = undefined;
    if (packet.forwarding.routeBroken) {
      this.routeStore.markBroken(packet.envelope.destination);
    }
    this.emit("packetBroadcast", {
      packetId: packet.envelope.packetId,
      destination: packet.envelope.destination,
      mode: "discovery",
      routeBroken: packet.forwarding.routeBroken,
    });
    await Promise.all(
      [...this.transports.values()].map((transport) =>
        transport.broadcast(packet, { excludePeerAddresses: options.excludePeerAddresses }),
      ),
    );
  }

  private resolveGuidedNextHop(packet: StarwavePacket): string | undefined {
    const route = packet.forwarding.expectedRoute;
    if (route.length === 0) {
      return this.findDirectPeer(packet.envelope.destination);
    }

    const currentIndex = route.indexOf(this.address);
    if (currentIndex === -1) {
      return this.findDirectPeer(packet.envelope.destination);
    }

    const nextHop = route[currentIndex + 1];
    if (!nextHop) {
      return undefined;
    }

    packet.forwarding.nextHopHint = nextHop;
    return this.findDirectPeer(nextHop);
  }

  private findDirectPeer(address: string): string | undefined {
    for (const transport of this.transports.values()) {
      if (transport.hasPeer(address)) {
        return address.toLowerCase();
      }
    }
    return undefined;
  }

  private async sendToPeer(peerAddress: string, packet: StarwavePacket): Promise<void> {
    for (const transport of this.transports.values()) {
      if (transport.hasPeer(peerAddress)) {
        await transport.send(peerAddress, packet);
        return;
      }
    }
    throw new Error(`No active transport for peer ${peerAddress}`);
  }
}
