import { Identity, PeerSession, PreferredCodec, StarwavePacket } from "@starwave/core";

export interface RouteHintRecord {
  destination: string;
  path: string[];
  confidence: number;
  learnedAt: number;
  lastUsedAt: number;
}

export interface IncomingPacketContext {
  transportId: string;
  peerAddress?: string;
}

export interface OutgoingPacketContext {
  excludePeerAddresses?: string[];
}

export interface TransportPeerSnapshot {
  address: string;
}

export interface RegisteredTransport {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(peerAddress: string, packet: StarwavePacket): Promise<void>;
  broadcast(packet: StarwavePacket, options?: OutgoingPacketContext): Promise<void>;
  hasPeer(peerAddress: string): boolean;
  getPeers(): TransportPeerSnapshot[];
  onPacket(handler: (packet: StarwavePacket, context: IncomingPacketContext) => Promise<void> | void): void;
}

export interface TransportPluginFactory {
  create(node: StarwaveNodeRuntime): RegisteredTransport | Promise<RegisteredTransport>;
}

export interface StarwaveNodeOptions {
  identity: Identity;
  codecPreferences?: PreferredCodec[];
  enableTransportProtection?: boolean;
}

export interface ReceiveEvent<TPayload = unknown> {
  packet: StarwavePacket<TPayload>;
}

export interface PeerSessionRecord extends PeerSession {
  transportId: string;
}

// Forward declaration for plugin factories.
export interface StarwaveNodeRuntime {
  readonly address: string;
  readonly identity: Identity;
  rememberSession(session: PeerSessionRecord): void;
}
