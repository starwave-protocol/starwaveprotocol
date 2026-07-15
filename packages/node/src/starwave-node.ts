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
import { PeerStore } from "./peer-store.js";
import {
  buildPeerExchangePayload,
  buildRouteReplyPayload,
  isControlPacket,
  isPeerExchangeControlPayload,
  isRouteReplyControlPayload,
} from "./control-plane.js";
import {
  DiscoveryPolicy,
  IncomingPacketContext,
  LoggerLike,
  PeerRecord,
  PeerSessionRecord,
  ReceiveEvent,
  RegisteredTransport,
  StarwaveNodeRuntime,
  StarwaveNodeOptions,
} from "./types.js";

const DEFAULT_DISCOVERY_POLICY: DiscoveryPolicy = {
  ttlMs: 90_000,
  minBroadcastIntervalMs: 200,
  initialBroadcastDelayMs: 40,
  rebroadcastDelayMs: 120,
};

export class StarwaveNode extends EventEmitter implements StarwaveNodeRuntime {
  readonly address: string;
  readonly identity: Identity;
  readonly routeStore = new RouteStore();
  readonly peerStore = new PeerStore();
  readonly replayCache = new ReplayCache();
  readonly pluginHost: PluginHost;
  readonly logger: LoggerLike;
  readonly discoveryPolicy: DiscoveryPolicy;
  readonly peerExchangeEnabled: boolean;

  private readonly transports = new Map<string, RegisteredTransport>();
  private readonly sessions = new Map<string, PeerSessionRecord>();
  private lastDiscoveryBroadcastAt = 0;

  constructor(private readonly options: StarwaveNodeOptions) {
    super();
    this.identity = options.identity;
    this.address = options.identity.address;
    this.logger = options.logger ?? new ConsoleLogger("starwave-node");
    this.discoveryPolicy = { ...DEFAULT_DISCOVERY_POLICY, ...(options.discovery ?? {}) };
    this.peerExchangeEnabled = options.peerExchangeEnabled ?? true;
    this.pluginHost = new PluginHost(this);
  }

  rememberSession(session: PeerSessionRecord): void {
    this.sessions.set(session.peerAddress.toLowerCase(), session);
    this.peerStore.rememberConnected(session.peerAddress, session.transportType);
    this.routeStore.remember(session.peerAddress, [this.address, session.peerAddress], 0.95);
    this.emit("sessionEstablished", {
      peerAddress: session.peerAddress,
      codec: session.selectedCodec,
      transportId: session.transportId,
      transportType: session.transportType,
    });
    if (this.peerExchangeEnabled) {
      void this.advertisePeerTopology();
    }
  }

  getSession(peerAddress: string): PeerSession | undefined {
    return this.sessions.get(peerAddress.toLowerCase());
  }

  getPeerSessionsSnapshot(): PeerSessionRecord[] {
    return [...this.sessions.values()];
  }

  getPeerSnapshot(): PeerRecord[] {
    return this.peerStore.snapshot();
  }

  getTransportSnapshot(): Array<{ id: string; transportType: string; peers: string[] }> {
    return [...this.transports.values()].map((transport) => ({
      id: transport.id,
      transportType: transport.transportType,
      peers: transport.getPeers().map((peer) => peer.address),
    }));
  }

  async registerTransport(transport: RegisteredTransport): Promise<void> {
    this.transports.set(transport.id, transport);
    transport.onPacket(async (packet, context) => {
      await this.handleIncomingPacket(packet, context);
    });
    await transport.start();
    this.emit("transportRegistered", { transportId: transport.id, peerCount: transport.getPeers().length });
  }

  async loadTransportModule(
    modulePath: string,
    options?: { transportId?: string; config?: Record<string, unknown>; logger?: LoggerLike },
  ): Promise<void> {
    const transport = await this.pluginHost.loadFromModule(modulePath, options);
    await this.registerTransport(transport);
  }

  async loadTransportPackage(
    packageName: string,
    options?: { transportId?: string; config?: Record<string, unknown>; logger?: LoggerLike },
  ): Promise<void> {
    const transport = await this.pluginHost.loadFromPackage(packageName, options);
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

  async publishPacket(packet: StarwavePacket): Promise<void> {
    await this.forwardPacket(packet, {});
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
      if (await this.tryHandleControlPacket(packet, context)) {
        return;
      }
      if (packet.forwarding.deliveryMode === "discovery") {
        await this.sendRouteReply(packet);
      }
      this.emit("message", { packet } satisfies ReceiveEvent);
      return;
    }

    await this.forwardPacket(packet, {
      excludePeerAddresses: [...new Set(packet.forwarding.trace.map((address) => address.toLowerCase()))],
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

    const enteringDiscovery = packet.forwarding.deliveryMode !== "discovery";
    packet.forwarding.deliveryMode = "discovery";
    packet.forwarding.routeBroken = packet.forwarding.expectedRoute.length > 0;
    packet.forwarding.nextHopHint = undefined;
    packet.envelope.ttlMs = Math.max(packet.envelope.ttlMs, this.discoveryPolicy.ttlMs);
    if (packet.forwarding.routeBroken) {
      this.routeStore.markBroken(packet.envelope.destination);
    }
    this.emit("packetBroadcast", {
      packetId: packet.envelope.packetId,
      destination: packet.envelope.destination,
      mode: "discovery",
      routeBroken: packet.forwarding.routeBroken,
      excludedPeers: options.excludePeerAddresses ?? [],
    });
    await this.waitForDiscoveryWindow(enteringDiscovery ? this.discoveryPolicy.initialBroadcastDelayMs : this.discoveryPolicy.rebroadcastDelayMs);
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

  private async tryHandleControlPacket(packet: StarwavePacket, context: IncomingPacketContext): Promise<boolean> {
    if (!isControlPacket(packet)) {
      return false;
    }

    if (!isPeerExchangeControlPayload(packet.payload)) {
      if (isRouteReplyControlPayload(packet.payload)) {
        const destination = packet.payload.discoveredFor.toLowerCase();
        if (packet.payload.path[0]?.toLowerCase() === this.address && packet.payload.path.length >= 2) {
          this.routeStore.remember(destination, packet.payload.path, 0.85);
          this.peerStore.rememberDiscovered({
            address: destination,
            transportType: "multi-hop",
            via: packet.payload.path[1],
            hops: packet.payload.path.length - 1,
            ttlMs: packet.payload.ttlMs,
          });
          this.emit("routeReplyProcessed", {
            destination,
            path: packet.payload.path,
          });
        }
        return true;
      }

      this.emit("warning", "Unknown control payload received");
      return true;
    }

    const fromPeer = context.peerAddress?.toLowerCase();
    if (!fromPeer || !this.sessions.has(fromPeer)) {
      this.emit("warning", "Ignored peer exchange from untrusted or non-direct peer");
      return true;
    }

    for (const announced of packet.payload.peers) {
      const announcedAddress = announced.address.toLowerCase();
      if (announcedAddress === this.address || announcedAddress === fromPeer) {
        continue;
      }

      const resultingHops = announced.hops + 1;
      if (resultingHops > 2) {
        continue;
      }

      this.peerStore.rememberDiscovered({
        address: announcedAddress,
        transportType: announced.transportType,
        via: fromPeer,
        hops: resultingHops,
        ttlMs: packet.payload.ttlMs,
      });
      this.routeStore.remember(announcedAddress, [this.address, fromPeer, announcedAddress], 0.45);
    }

    this.emit("peerExchangeProcessed", {
      fromPeer,
      announcedPeers: packet.payload.peers.length,
      knownPeers: this.peerStore.snapshot().length,
    });
    return true;
  }

  private async advertisePeerTopology(): Promise<void> {
    const peers = this.peerStore.getAdvertisablePeers();
    if (peers.length === 0) {
      return;
    }

    const directPeers = this.peerStore.getConnectedTrustedPeers();
    for (const peer of directPeers) {
      const advertisedPeers = peers.filter((item) => item.address !== peer.address);
      if (advertisedPeers.length === 0) {
        continue;
      }

      const packet = await this.createSignedPacket({
        source: this.address,
        destination: peer.address,
        kind: "control",
        ttlMs: 15_000,
        hopLimit: 4,
        payload: buildPeerExchangePayload(this.address, advertisedPeers),
        expectedRoute: [this.address, peer.address],
        flags: ["control:peer-exchange"],
      });
      await this.publishPacket(packet);
    }
  }

  private async sendRouteReply(packet: StarwavePacket): Promise<void> {
    const forwardPath = [packet.envelope.source, ...packet.forwarding.trace];
    const reversePath = [this.address, ...packet.forwarding.trace.slice(0, -1).reverse(), packet.envelope.source];
    if (reversePath.length < 2 || forwardPath.length < 2) {
      return;
    }

    const reply = await this.createSignedPacket({
      source: this.address,
      destination: packet.envelope.source,
      kind: "control",
      ttlMs: Math.max(15_000, this.discoveryPolicy.ttlMs),
      hopLimit: Math.max(4, reversePath.length + 1),
      payload: buildRouteReplyPayload(forwardPath),
      expectedRoute: reversePath,
      flags: ["control:route-reply"],
    });
    await this.publishPacket(reply);
  }

  private async waitForDiscoveryWindow(delayMs: number): Promise<void> {
    const now = Date.now();
    const notBefore = Math.max(this.lastDiscoveryBroadcastAt + this.discoveryPolicy.minBroadcastIntervalMs, now + delayMs);
    const sleepFor = Math.max(0, notBefore - now);
    if (sleepFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepFor));
    }
    this.lastDiscoveryBroadcastAt = Date.now();
  }
}
