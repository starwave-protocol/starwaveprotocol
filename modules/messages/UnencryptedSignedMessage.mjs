import Web3Utils from "../Web3Utils.mjs";
import EncodingUtils from "../EncodingUtils.mjs";
import Crypto from "../Crypto.mjs";

export default class UnencryptedSignedMessage {
    constructor({message, signature, from, to, protocolVersion, timestamp}) {

        if ( !from || !to || !protocolVersion || !timestamp) {
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
        this.protocolVersion = protocolVersion;
        this.timestamp = timestamp;

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
        return new UnencryptedSignedMessage(object);
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
}
