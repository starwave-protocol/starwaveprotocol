import EventEmitter from 'events';

export default class AbstractNetworkingProvider extends EventEmitter {

    constructor() {
        super();
    }

    async init() {
    }

    async hasConnection(address) {
        throw new Error('Not implemented');
        return false;
    }

    async active() {
        throw new Error('Not implemented');
    }

    async broadcast(message, options = {exclude: []}) {
        throw new Error('Not implemented');
    }

    async send(address, message) {
        throw new Error('Not implemented');
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
