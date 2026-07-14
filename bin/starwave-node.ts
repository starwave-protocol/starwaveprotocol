import { once } from "node:events";
import { resolve } from "node:path";
import { ConsoleLogger, createStandaloneRuntimeFromFile } from "@starwave/node";

function readConfigPath(argv: string[]): string {
  const configIndex = argv.findIndex((arg) => arg === "--config");
  if (configIndex === -1 || !argv[configIndex + 1]) {
    throw new Error("Usage: npm run start:node -- --config <path-to-config.json>");
  }
  return resolve(argv[configIndex + 1]);
}

async function main(): Promise<void> {
  const configPath = readConfigPath(process.argv.slice(2));
  const logger = new ConsoleLogger("standalone");
  const runtime = await createStandaloneRuntimeFromFile(configPath, { logger });

  logger.info("Standalone node started", {
    configPath,
    address: runtime.node.address,
  });

  const shutdown = async (signal: string) => {
    logger.info("Shutdown signal received", { signal });
    await runtime.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await once(process, "beforeExit");
}

void main();
