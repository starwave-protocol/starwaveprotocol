# StarWave Network Protocol

This repository now contains two layers of history:

- the original JavaScript PoC at the repository root
- the new TypeScript rework for the StarWave 2 reference node in `packages/*`

## Rework status

The `rework` branch introduces a new protocol v2 implementation with:

- protocol version `2` packets
- immutable signed envelopes plus mutable forwarding metadata
- route-hint based forwarding with discovery fallback
- negotiated `CBOR` or `JSON` packet serialization after the first peer handshake
- `secp256k1` origin signatures plus `x25519` peer session primitives
- package split for `core`, `node`, and `transport-websocket`
- docs, examples, and smoke tests
- standalone node bootstrap from config with transport/plugin loading and logs

## Workspace packages

- `packages/core`
- `packages/node`
- `packages/transport-websocket`

## Documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Core module](docs/modules/core.md)
- [Node module](docs/modules/node.md)
- [WebSocket transport module](docs/modules/transport-websocket.md)

## Quick start

```bash
npm install
npm run typecheck
npm run smoke
npm run example:two-nodes
npm run example:standalone
```

## Examples

- [Two nodes over WebSocket](examples/two-nodes.ts)
- [Loading an external transport module](examples/load-external-plugin.ts)
- [Standalone node demo](examples/standalone-demo.ts)

## Standalone Node

The repository now includes a standalone bootstrap entrypoint:

```bash
npm run start:node -- --config ./examples/config/node-a.json
```

It:

- reads a JSON config file
- creates or restores the node identity
- instantiates built-in transports from config
- loads external transport plugin modules
- prints runtime logs for startup, handshake, packet forwarding, and delivery
