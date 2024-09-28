import Web3Utils from "../Web3Utils.mjs";
import EncodingUtils from "../EncodingUtils.mjs";
import Crypto from "../Crypto.mjs";
import {MESSAGE_TYPES} from "../ProtocolMessages.mjs";

export default class UnencryptedSignedMessage {
    constructor({message, signature, from, to, protocolVersion, timestamp, expectedRoute}) {

        if (!from || !to) {
            throw new Error('Invalid message');
        }

        if (Number.isNaN(protocolVersion)) {
            throw new Error('Invalid protocol version');
        }

        if (!timestamp) {
            timestamp = +Date.now();
        }

        this.message = message;
        this.signature = signature;
        this.from = from;
        this.to = to;
        this.protocolVersion = protocolVersion || 1;
        this.timestamp = timestamp || +Date.now();
        this.type = MESSAGE_TYPES.UNENCRYPTED;
        this.hops = [];
        this.expectedRoute = expectedRoute || [];

    }

    addHop(hop) {
        if (Number(process.env.MAX_HOPS) < this.hops.length) {
            throw new Error('Max hops reached');
        }

        if (this.hasHop(hop)) {
            throw new Error('Hop already exists');
        }

        this.hops.push(hop);
    }

    isExpired() {
        return this.timestamp < (+Date.now() - Number(process.env.MESSAGE_EXPIRY));
    }

    hasHop(hop) {
        return this.hops.includes(hop);
    }

    hasExpectedRoute(route) {
        return this.expectedRoute.includes(route);
    }

    clearExpectedRoute() {
        this.expectedRoute = [];
    }

    updateExpectedRoute(route) {
        this.expectedRoute = route;
    }

    nextExpectedRoute(current) {
        return this.expectedRoute[this.expectedRoute.indexOf(current) + 1];
    }

    #formatHashString() {
        return `${EncodingUtils.serializeMessage(this.message)}-${this.from}-${this.to}-${this.protocolVersion}-${this.timestamp}`;
    }

    get hash() {
        return Crypto.hash(this.#formatHashString());
    }

    getHash() {
        return this.hash;
    }

    static fromObject(object) {
        let message = new UnencryptedSignedMessage(object);
        message.hops = object.hops || [];
        return message;
    }

    async verifySignature() {
        try {
            await Web3Utils.verifySignature({
                address: this.from,
                message: this.hash,
                signature: this.signature
            });
            return true;
        } catch (e) {
            throw new Error('Invalid signature');
        }
    }

    async sign(privateKey) {
        let signResult = await Web3Utils.signMessage({message: this.hash, privateKey});
        this.signature = String(signResult.signature).replace('0x', '');
    }

    getFullMessage() {
        return {
            message: this.message,
            signature: this.signature,
            from: this.from,
            to: this.to,
            protocolVersion: this.protocolVersion,
            timestamp: this.timestamp,
            type: this.type,
            hops: this.hops,
            expectedRoute: this.expectedRoute
        };
    }
}
