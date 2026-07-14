import assert from "node:assert/strict";
import { createIdentity } from "@starwave/core";
import { StarwaveNode } from "@starwave/node";
import { WebSocketTransport } from "@starwave/transport-websocket";

async function run(): Promise<void> {
  const alice = new StarwaveNode({ identity: createIdentity() });
  const bob = new StarwaveNode({ identity: createIdentity() });
  const port = 3400 + Math.floor(Math.random() * 1000);

  try {
    const received = new Promise<{ text: string }>((resolve) => {
      alice.on("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });

    await alice.registerTransport(new WebSocketTransport({
      node: alice,
      listenPort: port,
      codecPreferences: ["json", "cbor"],
      protectFrames: false,
    }));

    await bob.registerTransport(new WebSocketTransport({
      node: bob,
      peers: [`ws://127.0.0.1:${port}`],
      codecPreferences: ["cbor", "json"],
      protectFrames: false,
    }));

    await new Promise((resolve) => setTimeout(resolve, 500));
    await bob.send(alice.address, { text: "smoke-test" });

    const payload = await Promise.race([
      received,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for smoke packet delivery")), 5_000);
      }),
    ]);

    assert.equal(payload.text, "smoke-test");
    console.log("Smoke OK: packet delivered between two StarWave 2 nodes.");
  } finally {
    await alice.stop();
    await bob.stop();
  }
}

void run();
