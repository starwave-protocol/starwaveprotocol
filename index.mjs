import Web3Utils from "./modules/Web3Utils.mjs";

import dotenv from "dotenv";
import Logger from "./modules/Logger.mjs";
import NetworkMap from "./modules/NetworkMap.mjs";
import ProtocolMessages from "./modules/ProtocolMessages.mjs";
import UnencryptedSignedMessage from "./modules/messages/UnencryptedSignedMessage.mjs";
import WebsocketNetwork from "./modules/networkings/websocket/WebsocketNetwork.mjs";

dotenv.config({path: process.argv[2] || '.env'});

Logger.logMessage('StarWave 2 Protocol node');

const nodePrivateKey = process.env.NODE_PRIVATE_KEY;
const nodeAddress = (await Web3Utils.privateKeyToAddress(nodePrivateKey)).toLowerCase();

Logger.logMessage(`Node address: ${nodeAddress}`);

let networkMap = new NetworkMap();
let messagesProcessor = new ProtocolMessages({myAddress: nodeAddress, myPrivateKey: nodePrivateKey, networkMap});

//Add network providers
messagesProcessor.registerNetworkProvider(new WebsocketNetwork({myAddress: nodeAddress, myPrivateKey: nodePrivateKey}));

messagesProcessor.on('message', async (message) => {
    Logger.log('Received message', message);
    console.log(await networkMap.findShortestRoutes(nodeAddress, message.from));
});

await messagesProcessor.initNetworks();

/*
let message = new UnencryptedSignedMessage({
    message: 'Hello world',
    from: nodeAddress,
    to: '0xd9a3c386398ef21358a727a5ba9e01f39460755d',
    protocolVersion: 1,
    timestamp: +new Date()
});

//await networkMap.addRoutes([nodeAddress,'a']);
//await networkMap.addRoutes(['a', '0x1234567890123456789012345678901234567890']);

await message.sign(nodePrivateKey);

if(String(process.argv[2]).includes('3') ) {
    setInterval(async () => {
        await messagesProcessor.broadcastMessage(message);
    }, 5000);
}*/
