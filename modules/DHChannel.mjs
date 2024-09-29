import EventEmitter from "events";
import crypto from "crypto";
import UnencryptedSignedMessage from "./messages/UnencryptedSignedMessage.mjs";
import Crypto from "./Crypto.mjs";
import EncryptedSignedMessage from "./messages/EncryptedSignedMessage.mjs";
import Logger from "./Logger.mjs";

const DH_PRIME_LENGTH = 512;

export const DH_CHANNEL_SERVICE_MESSAGE_TYPES = {
    HANDSHAKE: 'handshake',
    HANDSHAKE_RESPONSE: 'handshake_response',
    INVALID: 'invalid'
};

class DHMessage {
    constructor({type, data}) {
        this.type = type;
        this.data = data;

    }

    json() {
        return JSON.stringify(this);
    }

    static fromJson(json) {
        return new DHMessage(JSON.parse(json));
    }

    static createHandshake(address, dh) {
        return new DHMessage({type: DH_CHANNEL_SERVICE_MESSAGE_TYPES.HANDSHAKE, data: {address, dh}});
    }

    static createHandshakeResponse(address, dh) {
        return new DHMessage({type: DH_CHANNEL_SERVICE_MESSAGE_TYPES.HANDSHAKE_RESPONSE, data: {address, dh}});
    }

}

export class DecryptedDHMessage {
    constructor({from, message, source}) {
        this.from = from;
        this.message = message;
        this.source = source;
    }

    static fromObject(obj) {
        return new DecryptedDHMessage(obj);
    }

    json() {
        return JSON.stringify(this);
    }
}

export default class DHChannel extends EventEmitter {

    constructor({myAddress, myPrivateKey, protocolMessages}) {
        super();
        this.knownSecrets = {};
        this.dh = crypto.createDiffieHellman(DH_PRIME_LENGTH);
        this.keys = this.dh.generateKeys();
        this.myAddress = myAddress;
        this.myPrivateKey = myPrivateKey;
        this.protocolMessages = protocolMessages;
        this.testSecret = Crypto.randomBytesString(32);
        this._connectionPromises = {};
    }

    async init() {

        this.protocolMessages.on('message', async (message, options) => {
            let from = message.from;
            let to = message.to;

            if (to !== this.myAddress) {
                return;
            }

          //  console.log('Received message', message);

            if (EncryptedSignedMessage.isEncryptedSignedMessage(message)) {
                await this.#processEncryptedMessage(message);
                return;
            }

            try {
                let dhMessage = DHMessage.fromJson(message.message);

                switch (dhMessage.type) {
                    case DH_CHANNEL_SERVICE_MESSAGE_TYPES.HANDSHAKE:
                        await this.processHandshake(from, dhMessage.data);
                        break;
                    case DH_CHANNEL_SERVICE_MESSAGE_TYPES.HANDSHAKE_RESPONSE:
                        await this.processHandshakeResponse(from, dhMessage.data);
                        break;
                }
            }catch (e) {
                //Logger.error('Invalid DH message', e);
            }
        });
    }

    async connect(address) {
        Logger.log('DH: Connecting to', address);

        if (this.knownSecrets[address]) { //Now we start handshake again
            delete this.knownSecrets[address];
            //return this.knownSecrets[address];
        }

        let prime = this.dh.getPrime();
        let generator = this.dh.getGenerator();

        //console.log(generator);

        let handshakeMessage = DHMessage.createHandshake(this.myAddress, {
            prime: prime.toString('hex'),
            generator: generator.toString('hex'),
            publicKey: this.keys.toString('hex')
        });

        let message = new UnencryptedSignedMessage({
            from: this.myAddress,
            to: address,
            message: handshakeMessage.json()
        });

        await message.sign(this.myPrivateKey);

        //   console.log('Sending handshake', message);

        await this.protocolMessages.broadcastMessage(message);

        return new Promise((resolve, reject) => {
            this._connectionPromises[address] = {resolve, reject}
        });

    }

    async processHandshake(from, data) {
        //   console.log('Processing handshake from', from, data);


        let prime = Buffer.from(data.dh.prime, 'hex');
        let generator = Buffer.from(data.dh.generator, 'hex');
        let publicKey = Buffer.from(data.dh.publicKey, 'hex');

        let dh = crypto.createDiffieHellman(prime, generator);
        let keys = dh.generateKeys();
        let secret = dh.computeSecret(publicKey);


        this.knownSecrets[from] = secret;

        //   console.log('ALICE Secret', secret.toString('hex'));

        let handshakeResponse = DHMessage.createHandshakeResponse(this.myAddress, {publicKey: keys.toString('hex')});
        let message = new UnencryptedSignedMessage({
            from: this.myAddress,
            to: from,
            message: handshakeResponse.json()
        });

        await message.sign(this.myPrivateKey);


        await this.protocolMessages.broadcastMessage(message);
    }

    async processHandshakeResponse(from, data) {

        let publicKey = Buffer.from(data.dh.publicKey, 'hex');

        let secret = this.dh.computeSecret(publicKey);

        this.knownSecrets[from] = secret;

        this._connectionPromises[from].resolve(secret);
    }

    async sendEncryptedMessage(message) {

        /** @type {EncryptedSignedMessage} */
        let messageObject = EncryptedSignedMessage.fromObject(message);

        let address = message.to;

        //  console.log('Sending encrypted message to', address, this.knownSecrets);

        let secret = this.knownSecrets[address];

        if (!secret) {
            throw new Error('Address not connected with DH');
        }

        //Set encrypted body
        await messageObject.setBody(message.message, secret);

        //Sign message
        await messageObject.sign(this.myPrivateKey);

      //  console.log('Sending encrypted message', messageObject);

        await this.protocolMessages.broadcastMessage(messageObject);

        return messageObject;

    }

    async #processEncryptedMessage(message) {
        let from = message.from;
        let secret = this.knownSecrets[from];

        if (!secret) {
            throw new Error('Address not connected with DH');
        }

        let messageObject = EncryptedSignedMessage.fromObject(message);
        let body = await messageObject.getBody(secret);

        this.emit('message', DecryptedDHMessage.fromObject({from, message: body, source: messageObject}));

    }

}
