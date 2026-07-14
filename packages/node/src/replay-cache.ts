export class ReplayCache {
  private readonly seen = new Map<string, number>();

  constructor(private readonly windowMs = 60_000) {}

  has(packetId: string): boolean {
    this.gc();
    return this.seen.has(packetId);
  }

  add(packetId: string): void {
    this.gc();
    this.seen.set(packetId, Date.now() + this.windowMs);
  }

  private gc(): void {
    const now = Date.now();
    for (const [packetId, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(packetId);
      }
    }
  }
}
