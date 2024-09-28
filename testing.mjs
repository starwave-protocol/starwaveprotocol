import Web3Utils from "./modules/Web3Utils.mjs";

import dotenv from "dotenv";
import Logger from "./modules/Logger.mjs";
import NetworkMap from "./modules/NetworkMap.mjs";
import ProtocolMessages from "./modules/ProtocolMessages.mjs";
import UnencryptedSignedMessage from "./modules/messages/UnencryptedSignedMessage.mjs";
import WebsocketNetwork from "./modules/networkings/websocket/WebsocketNetwork.mjs";
import DHChannel from "./modules/DHChannel.mjs";
import * as fs from "node:fs";

dotenv.config({path: process.argv[2] || '.env'});

Logger.logMessage('StarWave 2 Protocol node');

const nodePrivateKey = process.env.NODE_PRIVATE_KEY;
const nodeAddress = (await Web3Utils.privateKeyToAddress(nodePrivateKey)).toLowerCase();

Logger.logMessage(`Node address: ${nodeAddress}`);

let networkMap = new NetworkMap();
let messagesProcessor = new ProtocolMessages({myAddress: nodeAddress, myPrivateKey: nodePrivateKey, networkMap});

//Create DH Channel
const dhChannel = new DHChannel({
    myAddress: nodeAddress,
    myPrivateKey: nodePrivateKey,
    protocolMessages: messagesProcessor
});

//Add network providers
messagesProcessor.registerNetworkProvider(new WebsocketNetwork({myAddress: nodeAddress, myPrivateKey: nodePrivateKey}));


//Load networks plugins providers
let NETWORK_PLUGINS = process.env.NETWORK_PLUGINS ? process.env.NETWORK_PLUGINS.split(',') : [];

if(process.env.AUTOLOAD_PLUGINS?.toLowerCase() === 'true') {
    let networkingPlugins = fs.readdirSync('./plugins/networks');
    for (let plugin of networkingPlugins) {
        //Check is dir
        let stat = fs.statSync(`./plugins/networks/${plugin}`);
        if (!stat.isDirectory()) {
            continue;
        }
        NETWORK_PLUGINS.push(`./plugins/networks/${plugin}/index.mjs`);
    }
}

for (let plugin of NETWORK_PLUGINS) {
    try {
        const pluginModule = (await import(plugin)).default;
        messagesProcessor.registerNetworkProvider(new pluginModule({
            myAddress: nodeAddress,
            myPrivateKey: nodePrivateKey,
            utils: {
                logger: Logger,
                dhChannel,
                networkMap,
            }
        }));
    } catch (e) {
        Logger.error(`Failed to load plugin ${plugin}`, e);
    }
}


/*
messagesProcessor.on('message', async (message) => {
    Logger.log('Received message', message);
    console.log(await networkMap.findShortestRoutes(nodeAddress, message.from));
});*/

await messagesProcessor.initNetworks();

Logger.log('Networks initialized');

await dhChannel.init();
Logger.log('DH Channel initialized');

let sended = false;
dhChannel.on('message', async (message) => {
    console.log('!!!DH Received message', message);


    if (sended) {
        return
    }
    let sMessage = new UnencryptedSignedMessage({
        message: 'Hello to you, my world!',
        from: nodeAddress,
        to: message.from,

    });

    await dhChannel.sendEncryptedMessage(sMessage);

    sended = true;


});

//if (String(process.argv[2]).includes('3')) {
setTimeout(async () => {
    let secret = await dhChannel.connect('0xa75502d567ab67ff94e875015cee4440372aab10');

    console.log('Secret', secret.toString('hex'));

    let message = new UnencryptedSignedMessage({
        message: 'Hello world',
        from: nodeAddress,
        to: '0xa75502d567ab67ff94e875015cee4440372aab10',
        protocolVersion: 1,
        timestamp: +new Date()
    });


    await dhChannel.sendEncryptedMessage(message);


}, 5000);

//}
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
