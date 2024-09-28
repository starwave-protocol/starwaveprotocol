import EventEmitter from 'events';

export default class DemoNetworkingPlugin extends EventEmitter {

    constructor({myAddress, myPrivateKey, utils:{logger, dhChannel, networkMap}}) {
        super();
        this.myAddress = myAddress;
        this.myPrivateKey = myPrivateKey
        this.logger = logger;
        this.dhChannel = dhChannel;
        this.networkMap = networkMap;
    }

    async init() {
        this.logger.log('Demo network provider initialized');
    }

    async hasConnection(address) {
        return false;
    }

    async broadcast(message, options = {exclude: []}) {
        this.logger.log('DEMO PLUGIN: Broadcast message', message, options);
    }

    async send(address, message) {
        this.logger.log('DEMO PLUGIN: Send message', address, message);
    }

    /**
     * Process incoming message
     * @param message
     * @param options {nodeAddress: string|null}
     * @returns {Promise<void>}
     */
    async processMessage(message, options = {nodeAddress: null}) {
        this.emit('message', message, options);
    }

}
