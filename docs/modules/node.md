# Node Module

`packages/node` contains the reference StarWave 2 node runtime.

## Responsibilities

- Route hint lookup and maintenance
- Replay protection and TTL enforcement
- Packet validation and forwarding policy
- Delivery fallback from guided routing to discovery broadcast
- Plugin registration and dynamic transport loading

## Important design points

- Nodes prefer direct peers first, then route hints, then broadcast recovery.
- The route store keeps confidence and freshness metadata.
- External transport modules implement the shared transport interface and can be loaded dynamically at runtime.
