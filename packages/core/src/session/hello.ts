import { CodecNegotiationAck, CodecNegotiationHello, PreferredCodec } from "../protocol/types.js";
import { signString } from "../crypto/identity.js";
import { stableStringify } from "../protocol/canonical.js";

function signingPayload(data: Omit<CodecNegotiationHello, "signature"> | Omit<CodecNegotiationAck, "signature">): string {
  return stableStringify(data);
}

export function createHello(input: {
  nodeAddress: string;
  publicKey: string;
  timestamp?: number;
  codecPreferences: PreferredCodec[];
  ephemeralPublicKey: string;
  privateKey: string;
}): CodecNegotiationHello {
  const unsigned = {
    kind: "sw2-hello" as const,
    nodeAddress: input.nodeAddress.toLowerCase(),
    publicKey: input.publicKey,
    timestamp: input.timestamp ?? Date.now(),
    codecPreferences: input.codecPreferences,
    ephemeralPublicKey: input.ephemeralPublicKey,
  };
  return {
    ...unsigned,
    signature: signString(signingPayload(unsigned), input.privateKey),
  };
}

export function createHelloAck(input: {
  nodeAddress: string;
  publicKey: string;
  timestamp?: number;
  selectedCodec: PreferredCodec;
  ephemeralPublicKey: string;
  privateKey: string;
}): CodecNegotiationAck {
  const unsigned = {
    kind: "sw2-hello-ack" as const,
    nodeAddress: input.nodeAddress.toLowerCase(),
    publicKey: input.publicKey,
    timestamp: input.timestamp ?? Date.now(),
    selectedCodec: input.selectedCodec,
    ephemeralPublicKey: input.ephemeralPublicKey,
  };
  return {
    ...unsigned,
    signature: signString(signingPayload(unsigned), input.privateKey),
  };
}

export function getHelloSigningPayload(data: Omit<CodecNegotiationHello, "signature">): string {
  return signingPayload(data);
}

export function getHelloAckSigningPayload(data: Omit<CodecNegotiationAck, "signature">): string {
  return signingPayload(data);
}
