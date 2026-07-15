import { EventEmitter } from "node:events";
import {
  CodecNegotiationAck,
  CodecNegotiationHello,
  PACKET_CODECS,
  PeerSession,
  PreferredCodec,
  ProtectedFrame,
  StarwavePacket,
  createHello,
  createHelloAck,
  createSessionKeyPair,
  deriveSharedKey,
  getHelloAckSigningPayload,
  getHelloSigningPayload,
  negotiateCodec,
  protectFrame,
  recoverAddressFromPublicKey,
  unprotectFrame,
  verifyStringSignature,
} from "@starwave/core";
import { LoggerLike, RegisteredTransport, StarwaveNode } from "@starwave/node";
import { ProxyAgent } from "proxy-agent";
import { RawData, WebSocket, WebSocketServer } from "ws";

export interface WebSocketTransportOptions {
  id?: string;
  node: StarwaveNode;
  listenPort?: number;
  peers?: string[];
  proxyUrl?: string;
  codecPreferences?: PreferredCodec[];
  protectFrames?: boolean;
  logger?: LoggerLike;
}

interface ActivePeer {
  socket: WebSocket;
  address: string;
  codec: PreferredCodec;
  session?: PeerSession;
}

type HandshakeMessage = CodecNegotiationHello | CodecNegotiationAck;

function isHello(message: HandshakeMessage): message is CodecNegotiationHello {
  return message.kind === "sw2-hello";
}

function encodePlainPacket(codec: PreferredCodec, packet: StarwavePacket): Buffer {
  return Buffer.from(PACKET_CODECS[codec].encode(packet));
}

function decodePlainPacket(codec: PreferredCodec, bytes: Uint8Array): StarwavePacket {
  return PACKET_CODECS[codec].decode(bytes);
}

function wrapProtectedFrame(frame: ProtectedFrame): string {
  return JSON.stringify({ kind: "sw2-frame", ...frame });
}

function unwrapProtectedFrame(raw: string): ProtectedFrame {
  const parsed = JSON.parse(raw) as { kind: string } & ProtectedFrame;
  return {
    iv: parsed.iv,
    ciphertext: parsed.ciphertext,
    tag: parsed.tag,
  };
}

export class WebSocketTransport extends EventEmitter implements RegisteredTransport {
  readonly id: string;
  readonly transportType = "websocket";

  private readonly node: StarwaveNode;
  private readonly peers = new Map<string, ActivePeer>();
  private readonly socketIndex = new Map<WebSocket, ActivePeer>();
  private readonly onPacketHandlers: Array<(packet: StarwavePacket, context: { transportId: string; peerAddress?: string }) => Promise<void> | void> = [];
  private readonly codecPreferences: PreferredCodec[];
  private readonly protectFrames: boolean;
  private readonly sessionKeyPair = createSessionKeyPair();
  private readonly bootstrapPeers: string[];
  private readonly proxyUrl?: string;
  private readonly listenPort?: number;
  private readonly logger?: LoggerLike;
  private readonly proxyAgent?: ProxyAgent;
  private server?: WebSocketServer;

  constructor(options: WebSocketTransportOptions) {
    super();
    this.id = options.id ?? "websocket";
    this.node = options.node;
    this.listenPort = options.listenPort;
    this.bootstrapPeers = options.peers ?? [];
    this.proxyUrl = options.proxyUrl;
    this.codecPreferences = options.codecPreferences ?? ["cbor", "json"];
    this.protectFrames = options.protectFrames ?? false;
    this.logger = options.logger;
    this.proxyAgent = this.proxyUrl
      ? new ProxyAgent({
        getProxyForUrl: () => this.proxyUrl as string,
      })
      : undefined;
  }

  async start(): Promise<void> {
    if (this.listenPort) {
      this.server = new WebSocketServer({ port: this.listenPort });
      this.logger?.info("WebSocket server listening", { port: this.listenPort });
      this.server.on("connection", (socket: WebSocket) => {
        void this.attachSocket(socket, false);
      });
    }

    for (const peer of this.bootstrapPeers) {
      this.logger?.info("Connecting to bootstrap peer", {
        peer,
        viaProxy: Boolean(this.proxyUrl),
      });
      const socket = this.proxyAgent
        ? new WebSocket(peer, { agent: this.proxyAgent })
        : new WebSocket(peer);
      socket.on("open", () => {
        void this.attachSocket(socket, true);
      });
    }
  }

  async stop(): Promise<void> {
    await Promise.all(
      [...this.socketIndex.keys()].map(
        (socket) =>
          new Promise<void>((resolve) => {
            socket.close();
            resolve();
          }),
      ),
    );
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
    }
  }

  onPacket(handler: (packet: StarwavePacket, context: { transportId: string; peerAddress?: string }) => Promise<void> | void): void {
    this.onPacketHandlers.push(handler);
  }

  async send(peerAddress: string, packet: StarwavePacket): Promise<void> {
    const peer = this.peers.get(peerAddress.toLowerCase());
    if (!peer) {
      throw new Error(`Peer ${peerAddress} is not connected`);
    }

    this.sendPacketOnSocket(peer, packet);
  }

  async broadcast(packet: StarwavePacket, options?: { excludePeerAddresses?: string[] }): Promise<void> {
    const excludes = new Set((options?.excludePeerAddresses ?? []).map((item) => item.toLowerCase()));
    for (const peer of this.peers.values()) {
      if (!excludes.has(peer.address)) {
        this.sendPacketOnSocket(peer, packet);
      }
    }
  }

  hasPeer(peerAddress: string): boolean {
    return this.peers.has(peerAddress.toLowerCase());
  }

  getPeers(): { address: string; transportType: string }[] {
    return [...this.peers.values()].map((peer) => ({ address: peer.address, transportType: this.transportType }));
  }

  private async attachSocket(socket: WebSocket, initiator: boolean): Promise<void> {
    socket.on("message", async (raw: RawData) => {
      if (typeof raw === "string") {
        await this.handleStringMessage(socket, raw);
        return;
      }

      if (raw instanceof ArrayBuffer) {
        await this.handleBinaryMessage(socket, Buffer.from(raw));
        return;
      }

      if (Array.isArray(raw)) {
        await this.handleBinaryMessage(socket, Buffer.concat(raw.map((item) => Buffer.from(item))));
        return;
      }

      if (Buffer.isBuffer(raw)) {
        await this.handleBinaryMessage(socket, raw);
      }
    });

    socket.on("close", () => {
      const peer = this.socketIndex.get(socket);
      if (peer) {
        this.logger?.info("Peer disconnected", { peerAddress: peer.address, codec: peer.codec });
        this.peers.delete(peer.address);
        this.socketIndex.delete(socket);
      }
    });

    if (initiator) {
      const hello = createHello({
        nodeAddress: this.node.address,
        publicKey: this.node.identity.publicKey,
        codecPreferences: this.codecPreferences,
        ephemeralPublicKey: this.sessionKeyPair.publicKey,
        privateKey: this.node.identity.privateKey,
      });
      socket.send(JSON.stringify(hello));
    }
  }

  private async handleStringMessage(socket: WebSocket, raw: string): Promise<void> {
    if (raw.startsWith("{\"kind\":\"sw2-hello")) {
      const message = JSON.parse(raw) as HandshakeMessage;
      await this.handleHandshake(socket, message);
      return;
    }

    if (raw.startsWith("{\"kind\":\"sw2-frame")) {
      const peer = this.socketIndex.get(socket);
      if (!peer?.session) {
        return;
      }
      const bytes = unprotectFrame(unwrapProtectedFrame(raw), peer.session.sharedKey);
      const packet = decodePlainPacket(peer.codec, bytes);
      await this.dispatchPacket(packet, peer.address);
      return;
    }

    const peer = this.socketIndex.get(socket);
    if (!peer) {
      return;
    }
    const packet = decodePlainPacket(peer.codec, Buffer.from(raw));
    await this.dispatchPacket(packet, peer.address);
  }

  private async handleBinaryMessage(socket: WebSocket, raw: Buffer): Promise<void> {
    const maybeText = raw.toString("utf8");
    if (maybeText.startsWith("{\"kind\":\"sw2-hello")) {
      await this.handleStringMessage(socket, maybeText);
      return;
    }

    const peer = this.socketIndex.get(socket);
    if (!peer) {
      return;
    }

    const bytes = this.protectFrames && peer.session
      ? unprotectFrame(JSON.parse(raw.toString("utf8")) as ProtectedFrame, peer.session.sharedKey)
      : raw;
    const packet = decodePlainPacket(peer.codec, bytes);
    await this.dispatchPacket(packet, peer.address);
  }

  private async handleHandshake(socket: WebSocket, message: HandshakeMessage): Promise<void> {
    if (isHello(message)) {
      const sourceAddress = recoverAddressFromPublicKey(message.publicKey);
      const valid = verifyStringSignature(
        getHelloSigningPayload({
          kind: message.kind,
          nodeAddress: message.nodeAddress,
          publicKey: message.publicKey,
          timestamp: message.timestamp,
          codecPreferences: message.codecPreferences,
          ephemeralPublicKey: message.ephemeralPublicKey,
        }),
        message.signature,
        message.publicKey,
      );

      if (!valid || sourceAddress !== message.nodeAddress.toLowerCase()) {
        socket.close();
        return;
      }

      const selectedCodec = negotiateCodec(this.codecPreferences, message.codecPreferences);
      const session = {
        peerAddress: message.nodeAddress.toLowerCase(),
        selectedCodec,
        sharedKey: deriveSharedKey(this.sessionKeyPair.privateKey, message.ephemeralPublicKey),
        establishedAt: Date.now(),
      } satisfies PeerSession;

      const peer: ActivePeer = {
        socket,
        address: session.peerAddress,
        codec: selectedCodec,
        session,
      };
      this.peers.set(peer.address, peer);
      this.socketIndex.set(socket, peer);
      this.node.rememberSession({ ...session, transportId: this.id, transportType: this.transportType });
      this.logger?.info("Inbound peer handshake completed", {
        peerAddress: peer.address,
        codec: selectedCodec,
      });

      const ack = createHelloAck({
        nodeAddress: this.node.address,
        publicKey: this.node.identity.publicKey,
        selectedCodec,
        ephemeralPublicKey: this.sessionKeyPair.publicKey,
        privateKey: this.node.identity.privateKey,
      });
      socket.send(JSON.stringify(ack));
      return;
    }

    const session = {
      peerAddress: message.nodeAddress.toLowerCase(),
      selectedCodec: message.selectedCodec,
      sharedKey: deriveSharedKey(this.sessionKeyPair.privateKey, message.ephemeralPublicKey),
      establishedAt: Date.now(),
    } satisfies PeerSession;

    const peer: ActivePeer = {
      socket,
      address: session.peerAddress,
      codec: message.selectedCodec,
      session,
    };
    this.peers.set(peer.address, peer);
    this.socketIndex.set(socket, peer);
    this.node.rememberSession({ ...session, transportId: this.id, transportType: this.transportType });
    this.logger?.info("Outbound peer handshake acknowledged", {
      peerAddress: peer.address,
      codec: message.selectedCodec,
    });

    // Ack verification is intentionally lightweight in this first reference pass.
    const ackIsValid = verifyStringSignature(
      getHelloAckSigningPayload({
        kind: message.kind,
        nodeAddress: message.nodeAddress,
        publicKey: message.publicKey,
        timestamp: message.timestamp,
        selectedCodec: message.selectedCodec,
        ephemeralPublicKey: message.ephemeralPublicKey,
      }),
      message.signature,
      message.publicKey,
    );
    if (!ackIsValid || recoverAddressFromPublicKey(message.publicKey) !== message.nodeAddress.toLowerCase()) {
      socket.close();
    }
  }

  private sendPacketOnSocket(peer: ActivePeer, packet: StarwavePacket): void {
    const encoded = encodePlainPacket(peer.codec, packet);
    if (this.protectFrames && peer.session) {
      const frame = protectFrame(encoded, peer.session.sharedKey);
      peer.socket.send(wrapProtectedFrame(frame));
      return;
    }

    if (peer.codec === "json") {
      peer.socket.send(Buffer.from(encoded).toString("utf8"));
      return;
    }
    peer.socket.send(Buffer.from(encoded));
  }

  private async dispatchPacket(packet: StarwavePacket, peerAddress?: string): Promise<void> {
    for (const handler of this.onPacketHandlers) {
      await handler(packet, { transportId: this.id, peerAddress });
    }
  }
}

export function createWebSocketTransportFactory(options: Omit<WebSocketTransportOptions, "node">) {
  return {
    async create(node: StarwaveNode): Promise<RegisteredTransport> {
      return new WebSocketTransport({ ...options, node });
    },
  };
}
