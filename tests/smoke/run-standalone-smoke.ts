import assert from "node:assert/strict";
import { createIdentity } from "@starwave/core";
import { createStandaloneRuntime, StandaloneNodeConfig } from "@starwave/node";

async function run(): Promise<void> {
  const nodeAIdentity = createIdentity("0x1111111111111111111111111111111111111111111111111111111111111111");
  const nodeBIdentity = createIdentity("0x2222222222222222222222222222222222222222222222222222222222222222");
  const port = 3800 + Math.floor(Math.random() * 1000);

  const configA: StandaloneNodeConfig = {
    node: {
      privateKey: nodeAIdentity.privateKey,
      codecPreferences: ["cbor", "json"],
    },
    transports: [
      {
        type: "websocket",
        listenPort: port,
        codecPreferences: ["cbor", "json"],
        protectFrames: false,
      },
    ],
  };

  const configB: StandaloneNodeConfig = {
    node: {
      privateKey: nodeBIdentity.privateKey,
      codecPreferences: ["json", "cbor"],
    },
    transports: [
      {
        type: "websocket",
        peers: [`ws://127.0.0.1:${port}`],
        codecPreferences: ["json", "cbor"],
        protectFrames: false,
      },
    ],
  };

  const runtimeA = await createStandaloneRuntime(configA);
  const runtimeB = await createStandaloneRuntime(configB);

  try {
    const received = new Promise<{ text: string }>((resolve) => {
      runtimeA.node.on("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    await runtimeB.node.send(runtimeA.node.address, { text: "standalone-smoke" });

    const payload = await Promise.race([
      received,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for standalone packet delivery")), 5_000);
      }),
    ]);

    assert.equal(payload.text, "standalone-smoke");
    console.log("Standalone smoke OK: config bootstrap delivered a packet.");
  } finally {
    await runtimeA.stop();
    await runtimeB.stop();
  }
}

void run();
