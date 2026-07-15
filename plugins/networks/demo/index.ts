import { StarwavePacket } from "@starwave/core";
import { LoggerLike, RegisteredTransport, StarwaveNodeRuntime, TransportPluginFactory } from "@starwave/node";

class DemoLogger implements LoggerLike {
  debug(message: string, details?: Record<string, unknown>): void {
    console.debug(`[demo-plugin] ${message}`, details ?? {});
  }

  info(message: string, details?: Record<string, unknown>): void {
    console.log(`[demo-plugin] ${message}`, details ?? {});
  }

  warn(message: string, details?: Record<string, unknown>): void {
    console.warn(`[demo-plugin] ${message}`, details ?? {});
  }

  error(message: string, details?: Record<string, unknown>): void {
    console.error(`[demo-plugin] ${message}`, details ?? {});
  }
}

class DemoTransport implements RegisteredTransport {
  readonly id = "demo-network";
  readonly transportType = "demo";

  private readonly logger: LoggerLike;
  private readonly node: StarwaveNodeRuntime;
  private readonly packetHandlers: Array<
    (packet: StarwavePacket, context: { transportId: string; peerAddress?: string }) => Promise<void> | void
  > = [];

  constructor(node: StarwaveNodeRuntime, logger: LoggerLike) {
    this.node = node;
    this.logger = logger;
  }

  async start(): Promise<void> {
    this.logger.info("Demo transport started", {
      nodeAddress: this.node.address,
      behavior: "logs packets but does not provide real network connectivity",
    });
  }

  async stop(): Promise<void> {
    this.logger.info("Demo transport stopped", { nodeAddress: this.node.address });
  }

  async send(peerAddress: string, packet: StarwavePacket): Promise<void> {
    this.logger.info("Demo transport send", {
      peerAddress,
      packetId: packet.envelope.packetId,
      destination: packet.envelope.destination,
      deliveryMode: packet.forwarding.deliveryMode,
    });
  }

  async broadcast(packet: StarwavePacket, options?: { excludePeerAddresses?: string[] }): Promise<void> {
    this.logger.info("Demo transport broadcast", {
      packetId: packet.envelope.packetId,
      destination: packet.envelope.destination,
      deliveryMode: packet.forwarding.deliveryMode,
      excludes: options?.excludePeerAddresses ?? [],
    });
  }

  hasPeer(_peerAddress: string): boolean {
    return false;
  }

  getPeers(): { address: string; transportType: string }[] {
    return [];
  }

  onPacket(
    handler: (packet: StarwavePacket, context: { transportId: string; peerAddress?: string }) => Promise<void> | void,
  ): void {
    this.packetHandlers.push(handler);
  }

  async injectPacket(packet: StarwavePacket, peerAddress = "demo-injected-peer"): Promise<void> {
    this.logger.info("Demo transport injected packet", {
      from: packet.envelope.source,
      to: packet.envelope.destination,
      packetId: packet.envelope.packetId,
    });
    for (const handler of this.packetHandlers) {
      await handler(packet, { transportId: this.id, peerAddress });
    }
  }
}

const factory: TransportPluginFactory = {
  async create(node: StarwaveNodeRuntime): Promise<RegisteredTransport> {
    return new DemoTransport(node, new DemoLogger());
  },
};

export default factory;
