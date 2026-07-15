import { PreferredCodec } from "@starwave/core";

export interface WebSocketTransportConfig {
  type: "websocket";
  id?: string;
  config?: {
    listenPort?: number;
    peers?: string[];
    codecPreferences?: PreferredCodec[];
    protectFrames?: boolean;
  };
}

export interface PluginTransportSourceByPath {
  kind: "path";
  path: string;
}

export interface PluginTransportSourceByPackage {
  kind: "package";
  name: string;
}

export interface PluginTransportConfig {
  type: "plugin";
  id?: string;
  source: PluginTransportSourceByPath | PluginTransportSourceByPackage;
  config?: Record<string, unknown>;
}

export interface StartupMessageConfig {
  destination: string;
  payload: unknown;
  delayMs?: number;
}

export interface StandaloneApiConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
}

export interface StandaloneNodeConfig {
  node: {
    privateKey?: string;
    codecPreferences?: PreferredCodec[];
    peerExchangeEnabled?: boolean;
    discovery?: {
      ttlMs?: number;
      minBroadcastIntervalMs?: number;
      initialBroadcastDelayMs?: number;
      rebroadcastDelayMs?: number;
    };
  };
  api?: StandaloneApiConfig;
  transports?: Array<WebSocketTransportConfig | PluginTransportConfig>;
  startupMessages?: StartupMessageConfig[];
}
