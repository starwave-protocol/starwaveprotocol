import { PreferredCodec } from "@starwave/core";

export interface WebSocketTransportConfig {
  type: "websocket";
  id?: string;
  listenPort?: number;
  peers?: string[];
  codecPreferences?: PreferredCodec[];
  protectFrames?: boolean;
}

export interface ExternalTransportPluginConfig {
  type: "external";
  modulePath: string;
}

export interface StartupMessageConfig {
  destination: string;
  payload: unknown;
  delayMs?: number;
}

export interface StandaloneNodeConfig {
  node: {
    privateKey?: string;
    codecPreferences?: PreferredCodec[];
  };
  transports?: WebSocketTransportConfig[];
  plugins?: ExternalTransportPluginConfig[];
  startupMessages?: StartupMessageConfig[];
}
