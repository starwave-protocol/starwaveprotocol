import {createHash, createCipheriv, createDecipheriv, randomBytes} from 'crypto';

const algorithm = 'aes-256-cbc';

export default class Crypto {
    static hash(message) {
        return createHash('sha256').update(message).digest('hex');
    }

    static string2EncryptionKey(string) {
        return createHash('sha256').update(string).digest();
    }

    static async encryptMessage(message, key) {
        const iv = randomBytes(16);
        const cipher = createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(message, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return { iv: iv.toString('base64'),  d: encrypted };
    }

    static async decryptMessage(encryptedData, iv, key) {
        const decipher = createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    static randomBytesString(length) {
        return randomBytes(length).toString('hex');
    }
}
