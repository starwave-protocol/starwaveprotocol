import { randomUUID } from "node:crypto";
import { sha256Hex } from "../crypto/hash.js";
import { stableStringify } from "./canonical.js";
import {
  CreatePacketInput,
  DEFAULT_HOP_LIMIT,
  DEFAULT_TTL_MS,
  ForwardingHeader,
  PacketEnvelope,
  PacketValidationResult,
  STARWAVE_PROTOCOL_VERSION,
  StarwavePacket,
} from "./types.js";

export function computePayloadHash(payload: unknown): string {
  return sha256Hex(stableStringify(payload));
}

export function createEnvelope(input: CreatePacketInput): PacketEnvelope {
  return {
    protocolVersion: STARWAVE_PROTOCOL_VERSION,
    packetId: randomUUID(),
    source: input.source.toLowerCase(),
    destination: input.destination.toLowerCase(),
    kind: input.kind ?? "data",
    createdAt: Date.now(),
    ttlMs: input.ttlMs ?? DEFAULT_TTL_MS,
    hopLimit: input.hopLimit ?? DEFAULT_HOP_LIMIT,
    payloadHash: computePayloadHash(input.payload),
    sessionId: null,
    flags: input.flags ?? [],
  };
}

export function createForwardingHeader(expectedRoute: string[] = []): ForwardingHeader {
  return {
    deliveryMode: expectedRoute.length > 0 ? "guided" : "discovery",
    hopCount: 0,
    previousHop: undefined,
    nextHopHint: expectedRoute.length > 1 ? expectedRoute[1] : undefined,
    expectedRoute,
    routeVersion: 1,
    routeBroken: false,
    trace: [],
  };
}

export function getEnvelopeSigningPayload(envelope: PacketEnvelope): string {
  return stableStringify(envelope);
}

export function validatePacketShape(packet: StarwavePacket): PacketValidationResult {
  if (packet.envelope.protocolVersion !== STARWAVE_PROTOCOL_VERSION) {
    return { ok: false, reason: `Unsupported protocol version ${packet.envelope.protocolVersion}` };
  }

  if (packet.envelope.hopLimit < packet.forwarding.hopCount) {
    return { ok: false, reason: "Hop limit exceeded" };
  }

  if (packet.envelope.createdAt + packet.envelope.ttlMs < Date.now()) {
    return { ok: false, reason: "Packet TTL expired" };
  }

  if (packet.envelope.payloadHash !== computePayloadHash(packet.payload)) {
    return { ok: false, reason: "Payload hash mismatch" };
  }

  return { ok: true };
}
