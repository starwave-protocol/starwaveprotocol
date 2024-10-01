import EncodingUtils from "../EncodingUtils.mjs";
import Crypto from "../Crypto.mjs";
import UnencryptedSignedMessage from "./UnencryptedSignedMessage.mjs";
import {MESSAGE_TYPES} from "../ProtocolMessages.mjs";

export default class EncryptedSignedMessage extends UnencryptedSignedMessage {
    constructor({signature, from, to, protocolVersion, timestamp, message, id}) {
        super({message: message || '', signature, from, to, protocolVersion, timestamp, id});
        this.type = MESSAGE_TYPES.ENCRYPTED;
    }

    async getBody(encryptionKey) {
        return EncodingUtils.deserializeMessage(await Crypto.decryptMessage(this.message.d, this.message.iv, Crypto.string2EncryptionKey(encryptionKey)));
    }

    async setBody(body, encryptionKey) {
        this.message = await Crypto.encryptMessage(EncodingUtils.serializeMessage(body), Crypto.string2EncryptionKey(encryptionKey));
        return this;
    }

    static fromObject(obj) {
        let message = new EncryptedSignedMessage(obj);
        message.hops = obj.hops || [];
        return message;
    }

    static isEncryptedSignedMessage(obj) {
        return obj.type === MESSAGE_TYPES.ENCRYPTED;
    }


}
