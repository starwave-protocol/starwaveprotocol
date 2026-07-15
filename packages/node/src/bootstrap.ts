import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createIdentity, PreferredCodec } from "@starwave/core";
import { WebSocketTransport } from "@starwave/transport-websocket";
import { ConsoleLogger, childLogger } from "./logger.js";
import { StandaloneApiServer } from "./standalone-api.js";
import { StarwaveNode } from "./starwave-node.js";
import { LoggerLike } from "./types.js";
import { StandaloneNodeConfig } from "./config.js";

export interface StandaloneRuntime {
  config: StandaloneNodeConfig;
  node: StarwaveNode;
  api?: StandaloneApiServer;
  stop(): Promise<void>;
}

export async function readStandaloneConfig(configPath: string): Promise<StandaloneNodeConfig> {
  const absolutePath = resolve(configPath);
  const contents = await readFile(absolutePath, "utf8");
  return JSON.parse(contents) as StandaloneNodeConfig;
}

export async function createStandaloneRuntime(
  config: StandaloneNodeConfig,
  options?: { logger?: LoggerLike; baseDir?: string },
): Promise<StandaloneRuntime> {
  const logger = options?.logger ?? new ConsoleLogger("starwave-node");
  const identity = createIdentity(config.node.privateKey);
  const node = new StarwaveNode({
    identity,
    codecPreferences: config.node.codecPreferences as PreferredCodec[] | undefined,
    peerExchangeEnabled: config.node.peerExchangeEnabled,
    discovery: config.node.discovery,
    logger,
  });
  let api: StandaloneApiServer | undefined;

  attachNodeLogging(node, logger);

  logger.info("Node identity ready", { address: node.address });

  for (const transportConfig of config.transports ?? []) {
    if (transportConfig.type !== "websocket") {
      continue;
    }

    const transport = new WebSocketTransport({
      node,
      id: transportConfig.id,
      listenPort: transportConfig.listenPort,
      peers: transportConfig.peers,
      codecPreferences: transportConfig.codecPreferences,
      protectFrames: transportConfig.protectFrames,
      logger: childLogger(logger, `transport:${transportConfig.id ?? "websocket"}`),
    });
    await node.registerTransport(transport);
  }

  for (const plugin of config.plugins ?? []) {
    if (plugin.type !== "external") {
      continue;
    }

    const modulePath = options?.baseDir ? resolve(options.baseDir, plugin.modulePath) : resolve(plugin.modulePath);
    logger.info("Loading external transport plugin", { modulePath });
    await node.loadTransportModule(modulePath);
  }

  for (const message of config.startupMessages ?? []) {
    setTimeout(() => {
      void node.send(message.destination, message.payload);
    }, message.delayMs ?? 500);
  }

  if (config.api?.enabled) {
    api = new StandaloneApiServer(node, config.api, childLogger(logger, "api"));
    await api.start();
  }

  return {
    config,
    node,
    api,
    async stop() {
      logger.info("Stopping standalone node", { address: node.address });
      await api?.stop();
      await node.stop();
    },
  };
}

export async function createStandaloneRuntimeFromFile(
  configPath: string,
  options?: { logger?: LoggerLike },
): Promise<StandaloneRuntime> {
  const config = await readStandaloneConfig(configPath);
  return createStandaloneRuntime(config, {
    logger: options?.logger,
    baseDir: dirname(resolve(configPath)),
  });
}

function attachNodeLogging(node: StarwaveNode, logger: LoggerLike): void {
  node.on("warning", (warning) => {
    logger.warn("Node warning", { warning: String(warning) });
  });
  node.on("message", ({ packet }) => {
    logger.info("Packet delivered to local node", {
      from: packet.envelope.source,
      packetId: packet.envelope.packetId,
      type: packet.envelope.kind,
      trace: packet.forwarding.trace,
    });
  });
  node.on("transportRegistered", (details) => {
    logger.info("Transport registered", details as Record<string, unknown>);
  });
  node.on("sessionEstablished", (details) => {
    logger.info("Peer session established", details as Record<string, unknown>);
  });
  node.on("packetReceived", (details) => {
    logger.debug("Packet received", details as Record<string, unknown>);
  });
  node.on("packetForwarded", (details) => {
    logger.info("Packet forwarded", details as Record<string, unknown>);
  });
  node.on("packetBroadcast", (details) => {
    logger.info("Packet broadcast in discovery mode", details as Record<string, unknown>);
  });
  node.on("peerExchangeProcessed", (details) => {
    logger.info("Peer exchange processed", details as Record<string, unknown>);
  });
  node.on("routeReplyProcessed", (details) => {
    logger.info("Route reply processed", details as Record<string, unknown>);
  });
}
