import assert from "node:assert/strict";
import { createIdentity } from "@starwave/core";
import { createStandaloneRuntime, StandaloneNodeConfig } from "@starwave/node";

async function run(): Promise<void> {
  const nodeAIdentity = createIdentity("0x1111111111111111111111111111111111111111111111111111111111111111");
  const nodeBIdentity = createIdentity("0x2222222222222222222222222222222222222222222222222222222222222222");
  const nodeCIdentity = createIdentity("0x3333333333333333333333333333333333333333333333333333333333333333");
  const portA = 5200 + Math.floor(Math.random() * 200);
  const portB = 5400 + Math.floor(Math.random() * 200);

  const configA: StandaloneNodeConfig = {
    node: { privateKey: nodeAIdentity.privateKey, codecPreferences: ["cbor", "json"] },
    transports: [{ type: "websocket", listenPort: portA, codecPreferences: ["cbor", "json"], protectFrames: false }],
  };
  const configB: StandaloneNodeConfig = {
    node: { privateKey: nodeBIdentity.privateKey, codecPreferences: ["json", "cbor"] },
    transports: [{
      type: "websocket",
      listenPort: portB,
      peers: [`ws://127.0.0.1:${portA}`],
      codecPreferences: ["json", "cbor"],
      protectFrames: false,
    }],
  };
  const configC: StandaloneNodeConfig = {
    node: { privateKey: nodeCIdentity.privateKey, codecPreferences: ["cbor", "json"] },
    transports: [{
      type: "websocket",
      peers: [`ws://127.0.0.1:${portB}`],
      codecPreferences: ["cbor", "json"],
      protectFrames: false,
    }],
  };

  const runtimeA = await createStandaloneRuntime(configA);
  const runtimeB = await createStandaloneRuntime(configB);
  const runtimeC = await createStandaloneRuntime(configC);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const discoveredAtA = runtimeA.node.getPeerSnapshot().find((peer) => peer.address === runtimeC.node.address);
    assert.ok(discoveredAtA, "Node A should discover node C through node B");
    assert.equal(discoveredAtA.transportType, "websocket");
    assert.equal(discoveredAtA.hops, 2);
    assert.equal(discoveredAtA.trust, "untrusted");
    assert.equal(discoveredAtA.reachability, "discovered");

    const routeToC = runtimeA.node.routeStore.get(runtimeC.node.address);
    assert.ok(routeToC, "Node A should learn a 2-hop route to node C");
    assert.deepEqual(routeToC?.path, [runtimeA.node.address, runtimeB.node.address, runtimeC.node.address]);

    const delivered = new Promise<{ text: string }>((resolve) => {
      runtimeC.node.on("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });

    await runtimeA.node.send(runtimeC.node.address, { text: "peer-exchange-smoke" });
    const payload = await Promise.race([
      delivered,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for 2-hop packet delivery")), 5_000);
      }),
    ]);

    assert.equal(payload.text, "peer-exchange-smoke");
    console.log("Peer exchange smoke OK: discovered 2-hop peer and delivered over learned route.");
  } finally {
    await runtimeA.stop();
    await runtimeB.stop();
    await runtimeC.stop();
  }
}

void run();
