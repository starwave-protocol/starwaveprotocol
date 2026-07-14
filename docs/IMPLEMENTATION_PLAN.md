# StarWave 2 Rework Plan

This branch introduces a new TypeScript reference implementation for StarWave 2 while preserving the original PoC as historical context.

## Goals

1. Build a new protocol v2 implementation in TypeScript.
2. Split the codebase into packages inside the same repository.
3. Preserve node and client origin signatures.
4. Replace raw JSON packets with negotiated `CBOR` or `JSON`.
5. Separate immutable packet identity from mutable forwarding metadata.
6. Add stronger routing, TTL, deduplication, and recovery semantics.
7. Document each subsystem and provide smoke tests and examples.

## Package Layout

- `packages/core`
  Shared protocol types, codecs, origin signatures, session handshake helpers, and packet validation.
- `packages/node`
  Node runtime, route store, replay cache, plugin host, and forwarding logic.
- `packages/transport-websocket`
  Reference WebSocket transport plugin with transport handshake and codec negotiation.
- `bin/starwave-node.ts`
  Standalone bootstrap that reads config, instantiates node runtime, registers transports, and prints logs.

## Protocol Rework Decisions

### Packet model

Every packet now has:

- `envelope`
  Immutable, signed metadata for source, destination, timing, protocol version, payload hash, and packet intent.
- `forwarding`
  Mutable overlay metadata such as `expectedRoute`, `hopCount`, `previousHop`, and delivery mode.
- `payload`
  User or control payload.
- `originSignature`
  Signature created by the sender node or client over the immutable envelope.

### Routing model

- `expectedRoute` remains in the protocol as a route hint.
- Nodes follow it when the next hop is available.
- If a route hint breaks, the node marks the packet as broken and falls back to discovery broadcast.
- Routes learned from transit packets are treated as weak hints instead of unquestioned truth.

### Serialization

- Nodes start with a JSON transport hello for interoperability and debugging.
- After the first handshake, peers negotiate `CBOR` or `JSON`.
- `CBOR` is preferred in production; `JSON` remains available for debugging and inspection.

### Crypto

- Source signatures remain part of the design for node and client generated packets.
- Identity signatures use `secp256k1`.
- Peer session handshakes use `x25519` and `HKDF-SHA256`.
- Transport protection can use the derived session key while keeping the source signature concept intact.

## Implementation Sequence

1. Scaffold TypeScript packages and repository scripts.
2. Implement protocol v2 core.
3. Implement node runtime and forwarding policy.
4. Implement reference WebSocket transport.
5. Add examples, smoke tests, and docs.
6. Expand with more transports and stronger control-plane protocols.
