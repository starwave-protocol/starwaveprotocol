const crypto = require('crypto');

// Создание экземпляров Diffie-Hellman для двух сторон
const alice = crypto.createDiffieHellman(512);
const bob = crypto.createDiffieHellman(alice.getPrime(), alice.getGenerator());

// Генерация ключей
const aliceKey = alice.generateKeys();
const bobKey = bob.generateKeys();

// Обмен публичными ключами и генерация общего секретного ключа
const aliceSecret = alice.computeSecret(bobKey);
const bobSecret = bob.computeSecret(aliceKey);

console.log('Alice\'s secret:', aliceSecret.toString('hex'));
console.log('Bob\'s secret:', bobSecret.toString('hex'));

// Проверка, что секретные ключи совпадают
console.log('Secrets match:', aliceSecret.equals(bobSecret));
