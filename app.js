require('dotenv').config();
const qrcode = require('qrcode-terminal');
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows');

const express = require('express');
const cors = require('cors');

// Handlers
const { hasTestWord, generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle');
const { saveMedia } = require('./controllers/save');
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send');

// Require library with LocalAuth strtagey
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

const server = require('http').Server(app);
const port = process.env.PORT || 3000;
// var client;
app.use('/', require('./routes/web'));

/**
 * Listen to incoming message
 */
 const listenToMessage = () => client.on('message', async message => {

    let messageBody = message.body.toLowerCase();
    const messageFrom = message.from;
    const messageHasMedia = message.hasMedia;

    if(!isValidNumber(message.from)){
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (message.from === 'status@broadcast') {
        return
    }

    // console.log('message');
    // console.log(message);
    
    if(messageBody === 'ping') {

        // Answer as a WhatsApp reply
		message.reply('pong');

        // Answer as a new message
        client.sendMessage(message.from, 'pong2');

        return;
	}

    console.log('BODY',messageBody)
    const number = cleanNumber(message.from);
    await readChat(number, messageBody);
    
    /**
     * Guardamos el archivo multimedia que envia
     */
     if (process.env.SAVE_MEDIA && message.hasMedia) {
        const media = await message.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

     if (process.env.DATABASE === 'dialogflow') {
        if(!messageBody.length) return;

        if (process.env.TEST_MODE == 'true') {

            // Test word
            const testWord = process.env.TEST_MODE_WORD;

            // If messageBody starts with test word
            if(!hasTestWord(messageBody)) {
                
                // client.sendMessage(message.from, `Gracias por escribirme. Si quieres probar el bot, inicia tus mensajes con la palabra "${testWord}". Ejemplo: "${testWord} Hola" `);
                
                return;
            }

            // Remove test word
            messageBody = messageBody.replace(testWord, '');
        }

        // console.log('MESSAGEBODY: ', messageBody);
        
        const response = await bothResponse(messageBody);

        const trigger = process.env.DIALOGFLOW_AGENT

        await sendMessage(client, message.from, response.replyMessage, trigger);
        if (response.media) {
            sendMedia(client, message.from, response.media);
        }
        return;
    }
});


/**
 * Start the action
 */

 const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
    
    // Start listening
    listenToMessage();
});

client.on('auth_failure', (e) => {
    // console.log(e)
    // connectionLost()
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED'); 
});

client.initialize();

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
});
checkEnvFile();