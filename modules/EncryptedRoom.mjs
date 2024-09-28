import EventEmitter from "events";
import crypto from "crypto";
import UnencryptedSignedMessage from "./messages/UnencryptedSignedMessage.mjs";
import Crypto from "./Crypto.mjs";
import EncryptedSignedMessage from "./messages/EncryptedSignedMessage.mjs";



export default class EncryptedRoom extends EventEmitter {

    constructor({myAddress, myPrivateKey, protocolMessages}) {
        super();

        this.myAddress = myAddress;
        this.myPrivateKey = myPrivateKey;
        this.protocolMessages = protocolMessages;
        this.roomKey = null;
    }

    async init() {

    }

    async rotateRoomKey() {
        this.roomKey = crypto.randomBytes(32).toString('hex');
    }

}
