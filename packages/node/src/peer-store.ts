import { PeerRecord, PeerReachability, PeerTrustLevel } from "./types.js";

const DEFAULT_PEER_TTL_MS = 5 * 60_000;

export class PeerStore {
  private readonly records = new Map<string, PeerRecord>();

  rememberConnected(address: string, transportType: string): PeerRecord {
    return this.upsert({
      address: address.toLowerCase(),
      transportType,
      reachability: "connected",
      trust: "trusted",
      hops: 1,
      via: address.toLowerCase(),
    });
  }

  rememberDiscovered(input: {
    address: string;
    transportType: string;
    via: string;
    hops: number;
    trust?: PeerTrustLevel;
    reachability?: PeerReachability;
    ttlMs?: number;
  }): PeerRecord {
    return this.upsert({
      address: input.address.toLowerCase(),
      transportType: input.transportType,
      reachability: input.reachability ?? "discovered",
      trust: input.trust ?? "untrusted",
      hops: input.hops,
      via: input.via.toLowerCase(),
      ttlMs: input.ttlMs,
    });
  }

  get(address: string): PeerRecord | undefined {
    this.gc();
    return this.records.get(address.toLowerCase());
  }

  snapshot(): PeerRecord[] {
    this.gc();
    return [...this.records.values()].sort((left, right) => left.hops - right.hops);
  }

  getConnectedTrustedPeers(): PeerRecord[] {
    return this.snapshot().filter((record) => record.reachability === "connected" && record.trust === "trusted");
  }

  getAdvertisablePeers(): PeerRecord[] {
    return this.getConnectedTrustedPeers();
  }

  private upsert(input: {
    address: string;
    transportType: string;
    reachability: PeerReachability;
    trust: PeerTrustLevel;
    hops: number;
    via?: string;
    ttlMs?: number;
  }): PeerRecord {
    this.gc();
    const now = Date.now();
    const existing = this.records.get(input.address);
    const expiresAt = now + (input.ttlMs ?? DEFAULT_PEER_TTL_MS);

    const next: PeerRecord = {
      address: input.address,
      transportType: input.transportType,
      reachability: this.pickReachability(existing?.reachability, input.reachability),
      trust: this.pickTrust(existing?.trust, input.trust),
      hops: Math.min(existing?.hops ?? Number.MAX_SAFE_INTEGER, input.hops),
      via: input.via ?? existing?.via,
      learnedAt: existing?.learnedAt ?? now,
      lastSeenAt: now,
      expiresAt: Math.max(existing?.expiresAt ?? 0, expiresAt),
    };

    if (existing && existing.reachability === "connected") {
      next.transportType = existing.transportType;
      next.via = existing.via;
      next.hops = 1;
    }

    this.records.set(input.address, next);
    return next;
  }

  private gc(): void {
    const now = Date.now();
    for (const [address, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(address);
      }
    }
  }

  private pickTrust(current: PeerTrustLevel | undefined, next: PeerTrustLevel): PeerTrustLevel {
    return current === "trusted" || next === "trusted" ? "trusted" : "untrusted";
  }

  private pickReachability(current: PeerReachability | undefined, next: PeerReachability): PeerReachability {
    return current === "connected" || next === "connected" ? "connected" : "discovered";
  }
}
