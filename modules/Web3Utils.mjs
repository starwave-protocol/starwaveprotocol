import {Web3} from "web3";

const web3 = new Web3();
export default class Web3Utils {
    static async verifySignature({address, message, signature}) {
        let web3Address;
        try {
            web3Address = web3.eth.accounts.recover(message, `0x${signature}`);
        } catch (e) {
            throw new Error('Invalid signature');
        }
        if (address.toLowerCase() !== web3Address.toLowerCase()) {
            throw new Error('Wrong signature provided');
        }

        return true;
    }

    static async signMessage({message, privateKey}) {
        return web3.eth.accounts.sign(message, privateKey);
    }

    static async privateKeyToAddress(privateKey) {
        return web3.eth.accounts.privateKeyToAccount(privateKey).address;
    }

}
