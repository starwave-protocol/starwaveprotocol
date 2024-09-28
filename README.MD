# StarWave Network Protocol

Read this in other languages: [English](README.MD), [Русский](README_RU.MD)

## Introduction
### What is StarWave?
Previously released as a part of iZ³ blockchain platform, StarWave is a messaging protocol provides you ability to create encrypted hi-speed channels between the nodes in p2p way.

The network is designed to be unbreakable and secure, and it is based on the principles of automatic routes building and data encryption. One of the main feature - the network works on top of plenty of other networks such as web2, Tor network and etc., so it can be used in any environment.

This is a reference implementation of the StarWave protocol node in Node.js.

### How it works?

![protocolScheme.svg](docs/protocolScheme.svg)

### Addresses and keys
StarWave 2 uses a addresses and encryption keys based on Ethereum cryptography. The address is a 20 bytes long string, and the key is a 32 bytes long string. The address is used to identify the node in the network, and the key is used to encrypt the data.

## Installation

### As service
```bash
npm install -g @starwave/starwave-protocol-node
```

You can start the service with the following command:
```bash
starwave-node
```

Also you can configure the service with the following command:
```bash
starwave-node .dotenvConfig
```
