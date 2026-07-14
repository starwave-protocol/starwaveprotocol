import { Encoder, decode as cborDecode } from "cbor-x";
import { PreferredCodec, StarwavePacket } from "../protocol/types.js";

const cborEncoder = new Encoder({ structuredClone: true });

export interface PacketCodec {
  readonly name: PreferredCodec;
  encode(packet: StarwavePacket): Uint8Array;
  decode(bytes: Uint8Array): StarwavePacket;
}

export class JsonPacketCodec implements PacketCodec {
  readonly name = "json" as const;

  encode(packet: StarwavePacket): Uint8Array {
    return Buffer.from(JSON.stringify(packet), "utf8");
  }

  decode(bytes: Uint8Array): StarwavePacket {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as StarwavePacket;
  }
}

export class CborPacketCodec implements PacketCodec {
  readonly name = "cbor" as const;

  encode(packet: StarwavePacket): Uint8Array {
    return new Uint8Array(cborEncoder.encode(packet));
  }

  decode(bytes: Uint8Array): StarwavePacket {
    return cborDecode(Buffer.from(bytes)) as StarwavePacket;
  }
}

export const PACKET_CODECS: Record<PreferredCodec, PacketCodec> = {
  cbor: new CborPacketCodec(),
  json: new JsonPacketCodec(),
};

export function negotiateCodec(
  localPreferences: PreferredCodec[],
  remotePreferences: PreferredCodec[],
): PreferredCodec {
  for (const codec of localPreferences) {
    if (remotePreferences.includes(codec)) {
      return codec;
    }
  }

  return "json";
}
