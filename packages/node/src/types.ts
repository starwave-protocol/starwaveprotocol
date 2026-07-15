import { Identity, PeerSession, PreferredCodec, StarwavePacket } from "@starwave/core";

export interface RouteHintRecord {
  destination: string;
  path: string[];
  confidence: number;
  learnedAt: number;
  lastUsedAt: number;
}

export interface DiscoveryPolicy {
  ttlMs: number;
  minBroadcastIntervalMs: number;
  initialBroadcastDelayMs: number;
  rebroadcastDelayMs: number;
}

export type PeerTrustLevel = "trusted" | "untrusted";
export type PeerReachability = "connected" | "discovered";

export interface PeerRecord {
  address: string;
  transportType: string;
  reachability: PeerReachability;
  trust: PeerTrustLevel;
  hops: number;
  via?: string;
  learnedAt: number;
  lastSeenAt: number;
  expiresAt: number;
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
  transportType: string;
}

export interface RegisteredTransport {
  id: string;
  transportType: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(peerAddress: string, packet: StarwavePacket): Promise<void>;
  broadcast(packet: StarwavePacket, options?: OutgoingPacketContext): Promise<void>;
  hasPeer(peerAddress: string): boolean;
  getPeers(): TransportPeerSnapshot[];
  onPacket(handler: (packet: StarwavePacket, context: IncomingPacketContext) => Promise<void> | void): void;
}

export interface LoggerLike {
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export interface TransportPluginFactory {
  create(node: StarwaveNodeRuntime): RegisteredTransport | Promise<RegisteredTransport>;
}

export interface StarwaveNodeOptions {
  identity: Identity;
  codecPreferences?: PreferredCodec[];
  enableTransportProtection?: boolean;
  peerExchangeEnabled?: boolean;
  discovery?: Partial<DiscoveryPolicy>;
  logger?: LoggerLike;
}

export interface ReceiveEvent<TPayload = unknown> {
  packet: StarwavePacket<TPayload>;
}

export interface PeerSessionRecord extends PeerSession {
  transportId: string;
  transportType: string;
}

// Forward declaration for plugin factories.
export interface StarwaveNodeRuntime {
  readonly address: string;
  readonly identity: Identity;
  rememberSession(session: PeerSessionRecord): void;
}
