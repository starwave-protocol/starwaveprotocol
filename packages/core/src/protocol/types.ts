export const STARWAVE_PROTOCOL_VERSION = 2;

export const DEFAULT_TTL_MS = 30_000;
export const DEFAULT_HOP_LIMIT = 16;

export type PacketKind = "data" | "control";
export type DeliveryMode = "guided" | "discovery";
export type PreferredCodec = "cbor" | "json";
export type PayloadEncoding = "json";

export interface PacketEnvelope {
  protocolVersion: typeof STARWAVE_PROTOCOL_VERSION;
  packetId: string;
  source: string;
  destination: string;
  kind: PacketKind;
  createdAt: number;
  ttlMs: number;
  hopLimit: number;
  payloadHash: string;
  sessionId?: string | null;
  flags: string[];
}

export interface ForwardingHeader {
  deliveryMode: DeliveryMode;
  hopCount: number;
  previousHop?: string;
  nextHopHint?: string;
  expectedRoute: string[];
  routeVersion: number;
  routeBroken: boolean;
  trace: string[];
}

export interface StarwavePacket<TPayload = unknown> {
  envelope: PacketEnvelope;
  forwarding: ForwardingHeader;
  payload: TPayload;
  payloadEncoding: PayloadEncoding;
  originPublicKey: string;
  originSignature: string;
}

export interface CodecNegotiationHello {
  kind: "sw2-hello";
  nodeAddress: string;
  publicKey: string;
  timestamp: number;
  codecPreferences: PreferredCodec[];
  ephemeralPublicKey: string;
  signature: string;
}

export interface CodecNegotiationAck {
  kind: "sw2-hello-ack";
  nodeAddress: string;
  publicKey: string;
  timestamp: number;
  selectedCodec: PreferredCodec;
  ephemeralPublicKey: string;
  signature: string;
}

export interface PeerSession {
  peerAddress: string;
  selectedCodec: PreferredCodec;
  sharedKey: Uint8Array;
  establishedAt: number;
}

export interface CreatePacketInput<TPayload = unknown> {
  source: string;
  destination: string;
  payload: TPayload;
  kind?: PacketKind;
  ttlMs?: number;
  hopLimit?: number;
  expectedRoute?: string[];
  flags?: string[];
}

export interface PacketValidationResult {
  ok: boolean;
  reason?: string;
}
