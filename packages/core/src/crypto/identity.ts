import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "./hash.js";

export interface Identity {
  privateKey: string;
  publicKey: string;
  address: string;
}

export function createIdentity(privateKeyHex?: string): Identity {
  const privateKeyBytes = privateKeyHex
    ? hexToBytes(privateKeyHex.replace(/^0x/, ""))
    : secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
  const address = `0x${bytesToHex(keccak_256(publicKey.slice(1)).slice(-20))}`.toLowerCase();
  return {
    privateKey: `0x${bytesToHex(privateKeyBytes)}`,
    publicKey: `0x${bytesToHex(publicKey)}`,
    address,
  };
}

export function signString(payload: string, privateKeyHex: string): string {
  const digest = sha256(payload);
  const signature = secp256k1.sign(digest, privateKeyHex.replace(/^0x/, ""));
  return signature.toCompactHex();
}

export function verifyStringSignature(payload: string, signatureHex: string, publicKeyHex: string): boolean {
  const digest = sha256(payload);
  return secp256k1.verify(
    hexToBytes(signatureHex.replace(/^0x/, "")),
    digest,
    hexToBytes(publicKeyHex.replace(/^0x/, "")),
  );
}

export function recoverAddressFromPublicKey(publicKeyHex: string): string {
  const publicKeyBytes = hexToBytes(publicKeyHex.replace(/^0x/, ""));
  return `0x${bytesToHex(keccak_256(publicKeyBytes.slice(1)).slice(-20))}`.toLowerCase();
}
