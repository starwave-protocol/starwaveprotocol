import UnencryptedSignedMessage from "./messages/UnencryptedSignedMessage.mjs";
import Logger from "./Logger.mjs";
import EncryptedSignedMessage from "./messages/EncryptedSignedMessage.mjs";
import EventEmitter from "events";

export const MESSAGE_TYPES = {
    UNENCRYPTED: 'u',
    ENCRYPTED: 'e'
};

export default class ProtocolMessages extends EventEmitter {

    NETWORK_PROVIDERS = [];

    constructor({myAddress, myPrivateKey, networkMap}) {
        super();
        this.myAddress = myAddress;
        this.myPrivateKey = myPrivateKey;
        /** @type {NetworkMap} */
        this.networkMap = networkMap;
        this.debounce = {};
    }

    #clearDebounce() {
        let now = +Date.now();
        for (let key in this.debounce) {
            if (this.debounce[key] < now) {
                delete this.debounce[key];
            }
        }
    }

    async process(message, options = {nodeAddress: null}) {
        let from = message.from;
        let to = message.to;

          //console.log('RAW',message)

        //Address of node (socket) that sent message. Not the sender of message
        let nodeAddress = options.nodeAddress || null;

        /** @type {UnencryptedSignedMessage | EncryptedSignedMessage} */
        let messageObject;
        switch (message.type) {
            case MESSAGE_TYPES.UNENCRYPTED:
                messageObject = UnencryptedSignedMessage.fromObject(message);
                break;
            case MESSAGE_TYPES.ENCRYPTED:
                messageObject = EncryptedSignedMessage.fromObject(message);
                break;
        }


        if (messageObject.isExpired()) {
            Logger.log(`Drop message from ${from} cuz it's expired`);
            return;
        }

        if (this.debounce[messageObject.id]) {
            Logger.log(`Drop message from ${from} cuz it's duplicate`);
            return;
        }

        this.debounce[messageObject.id] = messageObject.timestamp;

        try {
            await messageObject.verifySignature();
        } catch (e) {
            Logger.log(`Drop message from ${from} cuz `, e.message);
            return;
        }


        if (from === this.myAddress) {
            Logger.error('Received message from myself. Possible loop?', messageObject);
            return;
        }


        //Update routing table
        let hops = messageObject.hops;
        if (!messageObject.hasHop(from)) {
            hops = [from, ...hops];
        }
        if (!messageObject.hasHop(this.myAddress)) {
            hops = [...hops, this.myAddress];
        }
        await this.networkMap.addRoutes(hops);
        //console.log('Routes updated', hops);

        //Message received for our address
        if (to === this.myAddress) {
            // Message is for me
            Logger.log(`Received message from ${from}`);
            this.emit('message', messageObject);
            return;
        }


        try {

            if (messageObject.expectedRoute.length === 0) { //There is no route, so we need to find it
                messageObject.addHop(this.myAddress); //Add hop
                //Broadcast
                // console.log('Broadcast message1');
                await this.#broadcastMessage(messageObject.getFullMessage(), {exclude: [nodeAddress]});
            } else { //We have expected route
                // console.log('Expected route', messageObject);
                if (messageObject.hasExpectedRoute(this.myAddress)) { //If routing going ok
                    //Just send to next hop with network module that has current connection

                    let nextHop = messageObject.nextExpectedRoute(this.myAddress);

                    // console.log('Send to next hop', nextHop);
                    await this.sendMessage(nextHop, messageObject.getFullMessage());
                } else { //Oops, routing is broken
                    messageObject.clearExpectedRoute(); //Clear expected route

                    const shortestRoutes = await this.networkMap.findShortestRoutes(this.myAddress, to);

                    // console.log('Shortest routes', shortestRoutes, this.myAddress, to);

                    if (shortestRoutes.length > 0) { //We have route to destination
                        messageObject.updateExpectedRoute(shortestRoutes);
                        messageObject.addHop(this.myAddress);
                        //Send to next hop with connections
                        let nextHop = messageObject.nextExpectedRoute(this.myAddress);
                        // console.log('Send to next hop', nextHop);

                        await this.sendMessage(nextHop, messageObject.getFullMessage());

                        return;
                    }

                    //So, we don't know that recipient is and routing is broken - we need to broadcast message to find it

                    //Broadcast
                    //  console.log('Broadcast message2');
                    messageObject.addHop(this.myAddress);
                    console.log(messageObject.getFullMessage());
                    await this.#broadcastMessage(messageObject.getFullMessage(), {exclude: [nodeAddress]});
                }

            }


            //Broadcast message next
        } catch (e) {
            Logger.log(`Drop message from ${from} cuz `, e.message);
            throw e;
            return;
        }


        this.#clearDebounce();

        //TODO: Forward message to next hop
    }

    registerNetworkProvider(provider) {
        this.NETWORK_PROVIDERS.push(provider);
    }

    async initNetworks() {
        for (let provider of this.NETWORK_PROVIDERS) {
            try {
                await provider.init();
                provider.on('message', async (message, options) => {
                    try {
                        await this.process(message, options);
                    }catch (e) {
                        Logger.error('Failed to process message', e);
                    }
                });
            }catch (e) {
                Logger.error(`Failed to init network provider ${provider}`, e);
            }
        }
    }

    async broadcastMessage(message, options = {exclude: []}) {
        switch (message.type) {
            case MESSAGE_TYPES.UNENCRYPTED:
                message = UnencryptedSignedMessage.fromObject(message);
                break;
            case MESSAGE_TYPES.ENCRYPTED:
                message = EncryptedSignedMessage.fromObject(message);
                break;
        }

        message.updateExpectedRoute(await this.networkMap.findShortestRoutes(message.from, message.to));
        await this.#broadcastMessage(message.getFullMessage(), options);
    }

    async #broadcastMessage(message, options = {exclude: []}) {
        //console.log('Broadcast message', message, options);
        for (let provider of this.NETWORK_PROVIDERS) {
            await provider.broadcast(message, options);
        }
    }

    async #sendMessage(address, message) {
        for (let provider of this.NETWORK_PROVIDERS) {
            if (provider.hasConnection(address)) {
                await provider.send(address, message);
            }
        }
    }

    async sendMessage(address, message) {
        for (let provider of this.NETWORK_PROVIDERS) {
            if (provider.hasConnection(address)) {
                await provider.send(address, message);
            }
        }
    }
}
