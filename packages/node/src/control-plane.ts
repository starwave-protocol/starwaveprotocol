import { StarwavePacket } from "@starwave/core";
import { PeerRecord } from "./types.js";

export const PEER_EXCHANGE_CONTROL_TYPE = "peer_exchange";
export const ROUTE_REPLY_CONTROL_TYPE = "route_reply";

export interface PeerAnnouncement {
  address: string;
  transportType: string;
  hops: number;
  trust: "trusted" | "untrusted";
  reachability: "connected" | "discovered";
}

export interface PeerExchangeControlPayload {
  type: typeof PEER_EXCHANGE_CONTROL_TYPE;
  generatedAt: number;
  ttlMs: number;
  advertisedBy: string;
  peers: PeerAnnouncement[];
}

export interface RouteReplyControlPayload {
  type: typeof ROUTE_REPLY_CONTROL_TYPE;
  generatedAt: number;
  discoveredFor: string;
  path: string[];
  ttlMs: number;
}

export function isPeerExchangeControlPayload(payload: unknown): payload is PeerExchangeControlPayload {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { type?: string }).type === PEER_EXCHANGE_CONTROL_TYPE &&
      Array.isArray((payload as { peers?: unknown[] }).peers),
  );
}

export function isRouteReplyControlPayload(payload: unknown): payload is RouteReplyControlPayload {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { type?: string }).type === ROUTE_REPLY_CONTROL_TYPE &&
      Array.isArray((payload as { path?: unknown[] }).path),
  );
}

export function buildPeerExchangePayload(address: string, peers: PeerRecord[]): PeerExchangeControlPayload {
  return {
    type: PEER_EXCHANGE_CONTROL_TYPE,
    generatedAt: Date.now(),
    ttlMs: 60_000,
    advertisedBy: address.toLowerCase(),
    peers: peers.map((peer) => ({
      address: peer.address,
      transportType: peer.transportType,
      hops: peer.hops,
      trust: peer.trust,
      reachability: peer.reachability,
    })),
  };
}

export function buildRouteReplyPayload(path: string[]): RouteReplyControlPayload {
  return {
    type: ROUTE_REPLY_CONTROL_TYPE,
    generatedAt: Date.now(),
    discoveredFor: path[path.length - 1]?.toLowerCase() ?? "",
    path: path.map((hop) => hop.toLowerCase()),
    ttlMs: 60_000,
  };
}

export function isControlPacket(packet: StarwavePacket): boolean {
  return packet.envelope.kind === "control";
}
