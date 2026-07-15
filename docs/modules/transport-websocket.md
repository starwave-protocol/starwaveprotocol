# WebSocket Transport Module

`packages/transport-websocket` is the reference network plugin for StarWave 2.

## Responsibilities

- Peer discovery via configured WebSocket endpoints
- Initial JSON hello for interop and debugging
- Post-handshake codec negotiation to `CBOR` or `JSON`
- Optional session key derivation for protected transport frames
- Delivery of overlay packets to the node runtime

## Important design points

- The transport always begins with a plain JSON hello.
- Peers select the first mutually supported codec.
- The transport exposes peer connectivity to the node so guided routing can prefer established links.
- Outbound bootstrap connections can optionally use `config.proxyUrl` with standard proxy URLs such as `http://`, `https://`, or `socks5://`.
