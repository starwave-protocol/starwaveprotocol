import { createWebSocketTransportFactory } from "@starwave/transport-websocket";

export default createWebSocketTransportFactory({
  id: "external-websocket",
  listenPort: 3601,
  codecPreferences: ["cbor", "json"],
  protectFrames: false,
});
