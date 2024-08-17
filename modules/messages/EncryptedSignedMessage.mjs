import EncodingUtils from "../EncodingUtils.mjs";
import Crypto from "../Crypto.mjs";
import UnencryptedSignedMessage from "./UnencryptedSignedMessage.mjs";
import {MESSAGE_TYPES} from "../ProtocolMessages.mjs";

export default class EncryptedSignedMessage extends UnencryptedSignedMessage {
    constructor({message, signature, from, to, protocolVersion, timestamp}) {
        super({message, signature, from, to, protocolVersion, timestamp});
        this.type = MESSAGE_TYPES.ENCRYPTED;
    }

    async getBody(encryptionKey) {
        return EncodingUtils.deserializeMessage(await Crypto.decryptMessage(this.message.d, this.message.iv, encryptionKey));
    }

    async setBody(body, encryptionKey) {
        this.message = await Crypto.encryptMessage(EncodingUtils.serializeMessage(body), encryptionKey);
        return this;
    }


}