# Core Module

`packages/core` contains protocol-level primitives shared by nodes, clients, and transports.

## Responsibilities

- Protocol v2 packet types
- Immutable envelope hashing and origin signatures
- `CBOR` and `JSON` packet codecs
- Codec negotiation metadata
- Session handshake helpers for peer-to-peer links
- Basic packet validation helpers

## Important design points

- The protocol version in new packets is fixed at `2`.
- `expectedRoute` lives in mutable forwarding metadata and is not part of the origin signature.
- The signed envelope preserves sender identity even when routing metadata changes in flight.
