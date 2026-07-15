# Standalone Node

The standalone bootstrap turns the StarWave 2 runtime into a daemon-style process.

## Responsibilities

- Read a JSON config file
- Initialize identity from a configured private key or generate one
- Build built-in transports from config
- Load external transport plugin modules
- Attach structured logs to node and transport lifecycle events

## Config model

The standalone config supports:

- node identity
- optional HTTP API
- discovery policy tuning
- peer exchange enable/disable
- codec preferences
- built-in WebSocket transports
- external plugin module paths
- optional startup messages for demos and smoke tests

The repository ships with a simple external demo transport at [plugins/networks/demo](C:/Users/jhony/Documents/StarwaveProtocol/plugins/networks/demo) that shows the plugin contract without creating a real network.

## Logging

The bootstrap prints:

- startup and shutdown
- transport registration
- codec negotiation and session establishment
- packet receive, forward, and discovery fallback
- warning and error events

## HTTP API

When `api.enabled` is set in config, the standalone node starts a small JSON HTTP API.

Current endpoints:

- `GET /`
- `GET /health`
- `GET /node`
- `GET /routes`
- `GET /routes/:destination`
- `POST /messages/:destination`
- `POST /packets`

## Discovery controls

The node config can tune discovery behavior:

- `node.discovery.ttlMs`
- `node.discovery.minBroadcastIntervalMs`
- `node.discovery.initialBroadcastDelayMs`
- `node.discovery.rebroadcastDelayMs`

This lets discovery packets live longer while still reducing flood pressure by spacing out broadcast attempts.
