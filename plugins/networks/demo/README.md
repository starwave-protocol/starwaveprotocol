# Demo Network Plugin

This is the StarWave 2 external transport demo plugin for the reworked runtime.

## What it is

It is a minimal external transport module that implements the new `RegisteredTransport` contract and can be loaded through:

- `node.loadTransportModule(...)`
- the standalone bootstrap `transports` config with `type: "plugin"`

## What it does

- starts and stops cleanly
- logs `send(...)` and `broadcast(...)` calls
- exposes the shape expected from an external transport
- includes an optional `injectPacket(...)` helper for manual experiments

## What it does not do

- it does not create real peer connections
- it does not perform transport handshakes
- it does not deliver packets over any actual network

## Load it from standalone config

```json
{
  "transports": [
    {
      "type": "plugin",
      "id": "demo-local",
      "source": {
        "kind": "path",
        "path": "../../plugins/networks/demo/index.ts"
      },
      "config": {
        "label": "demo transport"
      }
    }
  ]
}
```
