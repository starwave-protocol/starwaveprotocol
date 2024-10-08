import Web3Utils from "./modules/Web3Utils.mjs";

import dotenv from "dotenv";
import Logger from "./modules/Logger.mjs";
import NetworkMap from "./modules/NetworkMap.mjs";
import ProtocolMessages from "./modules/ProtocolMessages.mjs";
import UnencryptedSignedMessage from "./modules/messages/UnencryptedSignedMessage.mjs";
import WebsocketNetwork from "./modules/networkings/websocket/WebsocketNetwork.mjs";
import DHChannel from "./modules/DHChannel.mjs";
import * as fs from "node:fs";
import API from "./modules/API.mjs";

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

//Initialize networks, plugins and addons
await messagesProcessor.initNetworks();
Logger.log('Networks initialized');

await dhChannel.init();
Logger.log('DH Channel initialized');

if(process.env.API_ENABLE?.toLowerCase() === 'true') {
    const api = new API({
        protocolMessages: messagesProcessor,
        dhChannel,
        networkMap,
        nodeAddress: nodeAddress,
        utils: {
            logger: Logger
        }
    });

    await api.init();
}
