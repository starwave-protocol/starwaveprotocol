import { pathToFileURL } from "node:url";
import { StarwaveNode } from "./starwave-node.js";
import { RegisteredTransport, TransportPluginFactory } from "./types.js";

export class PluginHost {
  constructor(private readonly node: StarwaveNode) {}

  async load(factory: TransportPluginFactory): Promise<RegisteredTransport> {
    return factory.create(this.node);
  }

  async loadFromModule(modulePath: string): Promise<RegisteredTransport> {
    const loaded = await import(pathToFileURL(modulePath).href);
    const factory = (loaded.default ?? loaded) as TransportPluginFactory;
    return this.load(factory);
  }
}
