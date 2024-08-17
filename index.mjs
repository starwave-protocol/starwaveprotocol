import Web3Utils from "./modules/Web3Utils.mjs";

import dotenv from "dotenv";
import Logger from "./modules/Logger.mjs";

dotenv.config();

Logger.logMessage('StarWave 2 Protocol node');

const nodePrivateKey = process.env.NODE_PRIVATE_KEY;
const nodeAddress = (await Web3Utils.privateKeyToAddress(nodePrivateKey)).toLowerCase();

Logger.logMessage(`Node address: ${nodeAddress}`);

