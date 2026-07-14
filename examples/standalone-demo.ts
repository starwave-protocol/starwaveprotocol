import { resolve } from "node:path";
import { ConsoleLogger, createStandaloneRuntimeFromFile } from "@starwave/node";

async function main(): Promise<void> {
  const nodeA = await createStandaloneRuntimeFromFile(
    resolve("examples/config/node-a.json"),
    { logger: new ConsoleLogger("demo-node-a") },
  );
  const nodeB = await createStandaloneRuntimeFromFile(
    resolve("examples/config/node-b.json"),
    { logger: new ConsoleLogger("demo-node-b") },
  );

  setTimeout(async () => {
    await nodeA.stop();
    await nodeB.stop();
  }, 3_500);
}

void main();
