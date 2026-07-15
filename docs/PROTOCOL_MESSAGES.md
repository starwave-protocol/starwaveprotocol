# StarWave 2 Built-in Messages

This document lists the built-in message and frame types in the current StarWave 2 reference implementation.

The order below follows the rough lifecycle of a peer session:

1. transport handshake
2. session setup
3. overlay packet exchange
4. control-plane assistance for routing and peer discovery

## 1. WebSocket Transport Service Messages

These messages exist at the transport framing layer before normal overlay packets are exchanged.

| Order | Message | Direction | Layer | Purpose | Main fields |
| --- | --- | --- | --- | --- | --- |
| 1 | `sw2-hello` | initiator -> peer | transport service | Announces node identity, codec preferences, and ephemeral session key | `kind`, `nodeAddress`, `publicKey`, `timestamp`, `codecPreferences`, `ephemeralPublicKey`, `signature` |
| 2 | `sw2-hello-ack` | peer -> initiator | transport service | Confirms handshake, selects codec, and returns peer ephemeral key | `kind`, `nodeAddress`, `publicKey`, `timestamp`, `selectedCodec`, `ephemeralPublicKey`, `signature` |
| 3 | `sw2-frame` | either direction | transport service | Carries an encrypted transport frame when frame protection is enabled | `kind`, `iv`, `ciphertext`, `tag` |

## 2. Overlay Packet Container

All overlay traffic after transport setup is represented as a `StarwavePacket`.

| Part | Purpose | Main fields |
| --- | --- | --- |
| `envelope` | Immutable sender-signed packet identity and delivery budget | `protocolVersion`, `packetId`, `source`, `destination`, `kind`, `createdAt`, `ttlMs`, `hopLimit`, `payloadHash`, `sessionId`, `flags` |
| `forwarding` | Mutable forwarding metadata used by intermediate nodes | `deliveryMode`, `hopCount`, `previousHop`, `nextHopHint`, `expectedRoute`, `routeVersion`, `routeBroken`, `trace` |
| `payload` | User payload or control-plane payload | arbitrary JSON |
| `payloadEncoding` | Payload serialization tag inside the packet structure | currently `json` |
| `originPublicKey` | Public key used to verify the immutable envelope signature | secp256k1 public key |
| `originSignature` | Signature over the immutable envelope | compact secp256k1 signature |

## 3. Overlay Packet Classes

| Packet class | `envelope.kind` | Typical sender | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Data packet | `data` | application or standalone API | Carries ordinary user payload | Can move in `guided` or `discovery` mode |
| Control packet | `control` | node runtime | Carries routing or topology assistance payloads | Used for `peer_exchange` and `route_reply` |

## 4. Delivery Modes

| Delivery mode | Meaning | Typical entry condition | Typical exit condition |
| --- | --- | --- | --- |
| `guided` | Packet follows a known route hint or direct next hop | Existing route hint or known direct peer | Delivered, route breaks, or next hop becomes unavailable |
| `discovery` | Packet is broadcast to discover reachability or recover from a broken route | Unknown destination or route failure | Delivered, expires, or later route hint is learned |

## 5. Control-plane Payloads

These payloads live inside control packets.

| Order | Payload type | Direction | Purpose | Main fields |
| --- | --- | --- | --- | --- |
| 1 | `peer_exchange` | trusted direct peers -> trusted direct peers | Shares nearby known peers and their transport types | `type`, `generatedAt`, `ttlMs`, `advertisedBy`, `peers[]` |
| 2 | `route_reply` | destination -> original sender | Sends back a learned route after successful discovery delivery | `type`, `generatedAt`, `discoveredFor`, `path[]`, `ttlMs` |

## 6. `peer_exchange` Peer Announcement Entries

Each `peer_exchange` payload contains a list of peer announcements.

| Field | Meaning |
| --- | --- |
| `address` | Peer node address |
| `transportType` | Transport name used to reach that peer, for example `websocket` or `demo` |
| `hops` | Distance from the advertising node |
| `trust` | Current trust class, `trusted` or `untrusted` |
| `reachability` | Whether the peer is `connected` directly or only `discovered` |

## 7. Approximate Message Order by Scenario

### 7.1 Direct peer session over WebSocket

| Step | Message |
| --- | --- |
| 1 | `sw2-hello` |
| 2 | `sw2-hello-ack` |
| 3 | optional `peer_exchange` control packet |
| 4 | guided data packets |

### 7.2 Discovery delivery to an unknown destination

| Step | Message |
| --- | --- |
| 1 | data packet created with `deliveryMode = discovery` |
| 2 | discovery broadcast to connected peers |
| 3 | intermediate node either keeps broadcasting or switches to guided forwarding if it knows the next hop |
| 4 | destination receives the data packet |
| 5 | destination sends `route_reply` control packet back along the reverse path |
| 6 | original sender stores the learned route |
| 7 | next packet to the same destination is sent in guided mode |

### 7.3 Peer exchange assisted two-hop routing

| Step | Message |
| --- | --- |
| 1 | A and B complete `sw2-hello` / `sw2-hello-ack` |
| 2 | B and C complete `sw2-hello` / `sw2-hello-ack` |
| 3 | B sends `peer_exchange` to A describing C |
| 4 | A stores C as a discovered two-hop peer and learns route hint `A -> B -> C` |
| 5 | A sends future packets to C in guided mode |

### 7.4 Route break and recovery

| Step | Message |
| --- | --- |
| 1 | packet arrives at an intermediate node in guided mode |
| 2 | node cannot reach the next guided hop |
| 3 | node switches packet to `discovery` |
| 4 | node broadcasts to connected peers excluding addresses already present in `trace` |
| 5 | network either rediscovers a path or packet expires by TTL / hop limit |

## 8. Summary Table

| Name | Layer | Kind / tag | Sent by | Sent when |
| --- | --- | --- | --- | --- |
| `sw2-hello` | transport | `kind = "sw2-hello"` | connection initiator | at WebSocket session start |
| `sw2-hello-ack` | transport | `kind = "sw2-hello-ack"` | accepting peer | after validating hello |
| `sw2-frame` | transport | `kind = "sw2-frame"` | either peer | when protected transport framing is enabled |
| Data packet | overlay | `envelope.kind = "data"` | application / standalone API | for ordinary payload delivery |
| Control packet | overlay | `envelope.kind = "control"` | node runtime | for topology or route assistance |
| `peer_exchange` | control payload | `type = "peer_exchange"` | trusted direct peer | after handshake or topology refresh |
| `route_reply` | control payload | `type = "route_reply"` | destination node | after successful discovery delivery |
