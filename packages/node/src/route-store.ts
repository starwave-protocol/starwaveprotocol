import { RouteHintRecord } from "./types.js";

export class RouteStore {
  private readonly records = new Map<string, RouteHintRecord>();

  remember(destination: string, path: string[], confidence = 0.5): void {
    const key = destination.toLowerCase();
    const now = Date.now();
    const existing = this.records.get(key);
    this.records.set(key, {
      destination: key,
      path,
      confidence: Math.max(existing?.confidence ?? 0, confidence),
      learnedAt: existing?.learnedAt ?? now,
      lastUsedAt: now,
    });
  }

  get(destination: string): RouteHintRecord | undefined {
    return this.records.get(destination.toLowerCase());
  }

  markUsed(destination: string): void {
    const record = this.get(destination);
    if (!record) {
      return;
    }
    record.lastUsedAt = Date.now();
  }

  markBroken(destination: string): void {
    const record = this.get(destination);
    if (!record) {
      return;
    }
    record.confidence = Math.max(0, record.confidence - 0.3);
  }

  snapshot(): RouteHintRecord[] {
    return [...this.records.values()];
  }
}
