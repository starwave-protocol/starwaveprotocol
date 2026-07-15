import { fileURLToPath } from "node:url";
import { createIdentity } from "@starwave/core";
import { ConsoleLogger, StarwaveNode } from "@starwave/node";

async function main(): Promise<void> {
  const node = new StarwaveNode({ identity: createIdentity() });
  await node.loadTransportModule(fileURLToPath(new URL("../plugins/networks/demo/index.ts", import.meta.url)), {
    transportId: "demo-local",
    config: { label: "manual load example" },
    logger: new ConsoleLogger("demo-local"),
  });
  console.log(`External plugin loaded for node ${node.address}`);

  setTimeout(async () => {
    await node.stop();
  }, 2_000);
}

void main();
