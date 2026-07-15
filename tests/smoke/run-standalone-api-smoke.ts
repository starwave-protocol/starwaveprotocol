import assert from "node:assert/strict";
import { createIdentity } from "@starwave/core";
import { createStandaloneRuntime, StandaloneNodeConfig } from "@starwave/node";

async function run(): Promise<void> {
  const nodeAIdentity = createIdentity("0x1111111111111111111111111111111111111111111111111111111111111111");
  const nodeBIdentity = createIdentity("0x2222222222222222222222222222222222222222222222222222222222222222");
  const wsPort = 4200 + Math.floor(Math.random() * 500);
  const apiPort = 4700 + Math.floor(Math.random() * 500);

  const configA: StandaloneNodeConfig = {
    node: {
      privateKey: nodeAIdentity.privateKey,
      codecPreferences: ["cbor", "json"],
    },
    api: {
      enabled: true,
      host: "127.0.0.1",
      port: apiPort,
    },
    transports: [
      {
        type: "websocket",
        config: {
          listenPort: wsPort,
          codecPreferences: ["cbor", "json"],
          protectFrames: false,
        },
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
        config: {
          peers: [`ws://127.0.0.1:${wsPort}`],
          codecPreferences: ["json", "cbor"],
          protectFrames: false,
        },
      },
    ],
  };

  const runtimeA = await createStandaloneRuntime(configA);
  const runtimeB = await createStandaloneRuntime(configB);

  try {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const healthResponse = await fetch(`http://127.0.0.1:${apiPort}/health`);
    const health = await healthResponse.json() as { ok: boolean; address: string };
    assert.equal(health.ok, true);
    assert.equal(health.address, runtimeA.node.address);

    const sendResponse = await fetch(`http://127.0.0.1:${apiPort}/packets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: runtimeB.node.address,
        payload: { text: "api-smoke" },
      }),
    });
    const created = await sendResponse.json() as { packet: { envelope: { destination: string } } };
    assert.equal(created.packet.envelope.destination, runtimeB.node.address);

    const delivered = new Promise<{ text: string }>((resolve) => {
      runtimeB.node.on("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });

    const publishResponse = await fetch(`http://127.0.0.1:${apiPort}/packets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: runtimeB.node.address,
        payload: { text: "api-smoke" },
        publish: true,
      }),
    });
    const published = await publishResponse.json() as { published: boolean };
    assert.equal(published.published, true);

    const payload = await Promise.race([
      delivered,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for API-delivered packet")), 5_000);
      }),
    ]);

    assert.equal(payload.text, "api-smoke");
    console.log("Standalone API smoke OK: API created and published a packet.");
  } finally {
    await runtimeA.stop();
    await runtimeB.stop();
  }
}

void run();
