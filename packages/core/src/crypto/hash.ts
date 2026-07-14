import { createHash } from "node:crypto";

export function sha256(data: string | Uint8Array): Uint8Array {
  return createHash("sha256").update(data).digest();
}

export function sha256Hex(data: string | Uint8Array): string {
  return Buffer.from(sha256(data)).toString("hex");
}
