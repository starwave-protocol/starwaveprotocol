import assert from "node:assert/strict";
import { createIdentity } from "@starwave/core";
import { createStandaloneRuntime, StandaloneNodeConfig } from "@starwave/node";

async function run(): Promise<void> {
  const nodeAIdentity = createIdentity("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const nodeBIdentity = createIdentity("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  const nodeCIdentity = createIdentity("0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
  const portA = 5800 + Math.floor(Math.random() * 150);
  const portB = 6000 + Math.floor(Math.random() * 150);

  const commonDiscovery = {
    ttlMs: 20_000,
    minBroadcastIntervalMs: 50,
    initialBroadcastDelayMs: 10,
    rebroadcastDelayMs: 20,
  };

  const configA: StandaloneNodeConfig = {
    node: {
      privateKey: nodeAIdentity.privateKey,
      codecPreferences: ["cbor", "json"],
      peerExchangeEnabled: false,
      discovery: commonDiscovery,
    },
    transports: [{ type: "websocket", listenPort: portA, codecPreferences: ["cbor", "json"], protectFrames: false }],
  };
  const configB: StandaloneNodeConfig = {
    node: {
      privateKey: nodeBIdentity.privateKey,
      codecPreferences: ["json", "cbor"],
      peerExchangeEnabled: false,
      discovery: commonDiscovery,
    },
    transports: [{
      type: "websocket",
      listenPort: portB,
      peers: [`ws://127.0.0.1:${portA}`],
      codecPreferences: ["json", "cbor"],
      protectFrames: false,
    }],
  };
  const configC: StandaloneNodeConfig = {
    node: {
      privateKey: nodeCIdentity.privateKey,
      codecPreferences: ["cbor", "json"],
      peerExchangeEnabled: false,
      discovery: commonDiscovery,
    },
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
    await new Promise((resolve) => setTimeout(resolve, 900));

    assert.equal(runtimeA.node.routeStore.get(runtimeC.node.address), undefined, "Node A should start without a route to node C");

    const firstDelivery = new Promise<{ text: string }>((resolve) => {
      runtimeC.node.once("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });
    await runtimeA.node.send(runtimeC.node.address, { text: "route-reply-first" });
    const firstPayload = await Promise.race([
      firstDelivery,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for first discovery delivery")), 5_000)),
    ]);
    assert.equal(firstPayload.text, "route-reply-first");

    await new Promise((resolve) => setTimeout(resolve, 400));

    const learnedRoute = runtimeA.node.routeStore.get(runtimeC.node.address);
    assert.ok(learnedRoute, "Node A should learn a route to node C from route reply");
    assert.deepEqual(learnedRoute?.path, [runtimeA.node.address, runtimeB.node.address, runtimeC.node.address]);

    const secondDelivery = new Promise<{ text: string }>((resolve) => {
      runtimeC.node.once("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });
    await runtimeA.node.send(runtimeC.node.address, { text: "route-reply-second" });
    const secondPayload = await Promise.race([
      secondDelivery,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for second guided delivery")), 5_000)),
    ]);
    assert.equal(secondPayload.text, "route-reply-second");

    console.log("Route reply smoke OK: discovery learned a return route and the next send used the cached path.");
  } finally {
    await runtimeA.stop();
    await runtimeB.stop();
    await runtimeC.stop();
  }
}

void run();
