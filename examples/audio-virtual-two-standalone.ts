import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createIdentity } from "@starwave/core";
import { ConsoleLogger, StandaloneNodeConfig, createStandaloneRuntime } from "@starwave/node";

async function main(): Promise<void> {
  const pluginPath = resolveAudioPluginPath();
  const channel = "virtual-audio-demo";
  const aliceIdentity = createIdentity("0x1111111111111111111111111111111111111111111111111111111111111111");
  const bobIdentity = createIdentity("0x2222222222222222222222222222222222222222222222222222222222222222");

  const aliceConfig = buildConfig(aliceIdentity.privateKey, pluginPath, channel);
  const bobConfig = buildConfig(bobIdentity.privateKey, pluginPath, channel);

  const alice = await createStandaloneRuntime(aliceConfig, {
    logger: new ConsoleLogger("audio-virtual-alice"),
    baseDir: process.cwd(),
  });
  const bob = await createStandaloneRuntime(bobConfig, {
    logger: new ConsoleLogger("audio-virtual-bob"),
    baseDir: process.cwd(),
  });

  try {
    await waitForSessions(alice.node.address, bob.node.address, alice, bob);

    console.log("Virtual audio handshake OK.");
    console.log(`Alice: ${alice.node.address}`);
    console.log(`Bob:   ${bob.node.address}`);

    const aliceReceived = new Promise<{ text: string }>((resolve) => {
      alice.node.once("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });
    const bobReceived = new Promise<{ text: string }>((resolve) => {
      bob.node.once("message", ({ packet }) => resolve(packet.payload as { text: string }));
    });

    await alice.node.send(bob.node.address, { text: "hello from alice over virtual audio" });
    await bob.node.send(alice.node.address, { text: "hello from bob over virtual audio" });

    const [forAlice, forBob] = await Promise.all([aliceReceived, bobReceived]);
    console.log("Alice received:", forAlice.text);
    console.log("Bob received:", forBob.text);
    console.log("Virtual audio message exchange OK.");
  } finally {
    await alice.stop();
    await bob.stop();
  }
}

function buildConfig(privateKey: string, pluginPath: string, channel: string): StandaloneNodeConfig {
  return {
    node: {
      privateKey,
      codecPreferences: ["cbor", "json"],
      peerExchangeEnabled: false,
    },
    transports: [
      {
        type: "plugin",
        id: "audio-virtual",
        source: {
          kind: "path",
          path: pluginPath,
        },
        config: {
          codec: "cbor",
          protocol: "audible-fastest",
          backend: {
            kind: "mock",
            channel,
          },
          framing: {
            maxPayloadBytes: 32,
            waveformVolume: 10,
          },
          slowLink: {
            ackTimeoutMs: 400,
            retryLimit: 1,
            interFrameDelayMs: 0,
            discoveryInterFrameDelayMs: 0,
            playbackTailMs: 0,
            warnWhenTtlBelowMs: 1,
          },
          link: {
            advertiseIntervalMs: 300,
            advertiseJitterMs: 0,
            heartbeatIntervalMs: 1500,
            staleTimeoutMs: 5000,
          },
        },
      },
    ],
  };
}

function resolveAudioPluginPath(): string {
  const fromEnv = process.env.STARWAVE_AUDIO_PLUGIN_PATH;
  if (fromEnv) {
    const absolute = resolve(fromEnv);
    if (existsSync(absolute)) {
      return absolute;
    }
    throw new Error(`STARWAVE_AUDIO_PLUGIN_PATH does not exist: ${absolute}`);
  }

  const siblingRepoPath = resolve("..", "sw2-transport-audio-ggwave", "src", "index.ts");
  if (existsSync(siblingRepoPath)) {
    return siblingRepoPath;
  }

  throw new Error(
    "Audio transport plugin was not found. Set STARWAVE_AUDIO_PLUGIN_PATH to sw2-transport-audio-ggwave/src/index.ts",
  );
}

async function waitForSessions(
  aliceAddress: string,
  bobAddress: string,
  alice: Awaited<ReturnType<typeof createStandaloneRuntime>>,
  bob: Awaited<ReturnType<typeof createStandaloneRuntime>>,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    const aliceHasBob = alice.node.getPeerSessionsSnapshot().some((session) => session.peerAddress === bobAddress);
    const bobHasAlice = bob.node.getPeerSessionsSnapshot().some((session) => session.peerAddress === aliceAddress);
    if (aliceHasBob && bobHasAlice) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for virtual audio handshake");
}

void main();
