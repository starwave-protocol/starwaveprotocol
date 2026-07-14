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
- codec preferences
- built-in WebSocket transports
- external plugin module paths
- optional startup messages for demos and smoke tests

## Logging

The bootstrap prints:

- startup and shutdown
- transport registration
- codec negotiation and session establishment
- packet receive, forward, and discovery fallback
- warning and error events
