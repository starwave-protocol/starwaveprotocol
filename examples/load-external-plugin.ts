import { createIdentity } from "@starwave/core";
import { StarwaveNode } from "@starwave/node";

async function main(): Promise<void> {
  const node = new StarwaveNode({ identity: createIdentity() });
  await node.loadTransportModule(new URL("../plugins/networks/demo/index.ts", import.meta.url).pathname);
  console.log(`External plugin loaded for node ${node.address}`);

  setTimeout(async () => {
    await node.stop();
  }, 2_000);
}

void main();
