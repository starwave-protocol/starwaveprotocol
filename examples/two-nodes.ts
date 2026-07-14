import { createIdentity } from "@starwave/core";
import { StarwaveNode } from "@starwave/node";
import { WebSocketTransport } from "@starwave/transport-websocket";

async function main(): Promise<void> {
  const alice = new StarwaveNode({ identity: createIdentity() });
  const bob = new StarwaveNode({ identity: createIdentity() });

  bob.on("message", ({ packet }) => {
    console.log("Bob received:", packet.payload);
  });

  await alice.registerTransport(new WebSocketTransport({
    node: alice,
    listenPort: 3401,
    codecPreferences: ["json", "cbor"],
    protectFrames: false,
  }));

  await bob.registerTransport(new WebSocketTransport({
    node: bob,
    peers: ["ws://127.0.0.1:3401"],
    codecPreferences: ["cbor", "json"],
    protectFrames: false,
  }));

  setTimeout(async () => {
    await bob.send(alice.address, { text: "hello from bob over StarWave 2" });
  }, 500);

  setTimeout(async () => {
    await alice.stop();
    await bob.stop();
  }, 2_000);
}

void main();
