import express from 'express';
import UnencryptedSignedMessage from "./messages/UnencryptedSignedMessage.mjs";

export default class API {
    constructor({protocolMessages, dhChannel, networkMap, nodeAddress, utils: {logger}}) {
        this.protocolMessages = protocolMessages;
        this.dhChannel = dhChannel;
        this.networkMap = networkMap;
        this.logger = logger;
        this.app = express();
        //Doby parser
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: true}));
        this.nodeAddress = nodeAddress
    }

    async init() {

        this.app.get('/', async (req, res) => {
            res.send('Starwave 2 protocol API. If you see this message, API is working. Don\'t forget to secure it!');
        });

        this.app.get('/routes/:address', async (req, res) => {
            let routes = await this.networkMap.findShortestRoutes(this.nodeAddress, req.params.address);
            res.json(routes);
        });

        this.app.get('/routes/:from/:to', async (req, res) => {
            let routes = await this.networkMap.findShortestRoutes(req.params.from, req.params.to);
            res.json(routes);
        });


        this.app.post('/broadcastMessage', async (req, res) => {
            try {
                let message = req.body;
                let result = await this.protocolMessages.broadcastMessage(message);
                res.json(result);
            } catch (e) {
                res.status(500).json({error: e.message});
            }
        });

        this.app.post('/sendMessage/:address', async (req, res) => {
            try {
                let message = req.body;
                let result = await this.protocolMessages.sendMessage(req.params.address, message);
                res.json(result);
            } catch (e) {
                res.status(500).json({error: e.message});
            }
        });

        this.app.post('/createDHChannel/:address', async (req, res) => {
            try {
                let secret = await this.dhChannel.connect(req.params.address);
                res.json({secret});
            } catch (e) {
                res.status(500).json({error: e.message});
            }
        });

        this.app.post('/encryptAndSendMessage', async (req, res) => {


            try {

                if(process.env.API_ALLOW_NODE_ENCRYPTION?.toLowerCase() !== 'true') {
                    throw new Error('Node encryption is disabled');
                }

                let message = req.body;
                let result = await this.dhChannel.sendEncryptedMessage(message);
                res.json(result);
            } catch (e) {
                res.status(500).json({error: e.message});
            }
        });

        this.app.post('/createMessage', async (req, res) => {
            try {
                let message = req.body;
                let encryptedMessage = new UnencryptedSignedMessage({
                    message: message.data,
                    from: this.nodeAddress,
                    to: message.to,
                    protocolVersion: 1,
                    timestamp: +new Date()
                });

                res.json({message: encryptedMessage.getFullMessage()});
            } catch (e) {
                res.status(500).json({error: e.message});
            }
        });

        this.app.listen(process.env.API_PORT || 3090, process.env.API_HOST || 'localhost', () => {
            this.logger.log(`API listening on ${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || 3090}`);
        });

    }
}
