import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { x25519 } from "@noble/curves/ed25519";

export interface SessionKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface ProtectedFrame {
  iv: string;
  ciphertext: string;
  tag: string;
}

export function createSessionKeyPair(): SessionKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}

export function deriveSharedKey(privateKeyHex: string, peerPublicKeyHex: string): Uint8Array {
  const sharedSecret = x25519.getSharedSecret(
    hexToBytes(privateKeyHex.replace(/^0x/, "")),
    hexToBytes(peerPublicKeyHex.replace(/^0x/, "")),
  );
  const key = hkdfSync("sha256", Buffer.from(sharedSecret), Buffer.alloc(0), Buffer.from("starwave2-session"), 32);
  return new Uint8Array(key);
}

export function protectFrame(bytes: Uint8Array, sharedKey: Uint8Array): ProtectedFrame {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(sharedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function unprotectFrame(frame: ProtectedFrame, sharedKey: Uint8Array): Uint8Array {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(sharedKey),
    Buffer.from(frame.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(frame.tag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(frame.ciphertext, "hex")),
    decipher.final(),
  ]);
  return new Uint8Array(plaintext);
}
