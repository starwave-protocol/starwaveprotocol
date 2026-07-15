import { pathToFileURL } from "node:url";
import { StarwaveNode } from "./starwave-node.js";
import { LoggerLike, RegisteredTransport, TransportPluginFactory } from "./types.js";

export class PluginHost {
  constructor(private readonly node: StarwaveNode) {}

  async load(
    factory: TransportPluginFactory,
    options?: { transportId?: string; config?: Record<string, unknown>; logger?: LoggerLike },
  ): Promise<RegisteredTransport> {
    return factory.create({
      node: this.node,
      transportId: options?.transportId,
      config: options?.config,
      logger: options?.logger,
    });
  }

  async loadFromModule(
    modulePath: string,
    options?: { transportId?: string; config?: Record<string, unknown>; logger?: LoggerLike },
  ): Promise<RegisteredTransport> {
    const loaded = await import(pathToFileURL(modulePath).href);
    const factory = (loaded.default ?? loaded) as TransportPluginFactory;
    return this.load(factory, options);
  }

  async loadFromPackage(
    packageName: string,
    options?: { transportId?: string; config?: Record<string, unknown>; logger?: LoggerLike },
  ): Promise<RegisteredTransport> {
    const loaded = await import(packageName);
    const factory = (loaded.default ?? loaded) as TransportPluginFactory;
    return this.load(factory, options);
  }
}
