import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
// Key should be 32 bytes (64 hex characters)
const key = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.randomBytes(32); // Fallback for dev/test if env not set

const ivLength = 16;

export function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

export function decrypt(text) {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return original text or null if decryption fails? 
    // Safer to throw or return null to avoid exposing raw data if it was somehow mixed.
    // But here we assume input is encrypted string.
    return null;
  }
}

/**
 * Calculates SHA-256 hash of a buffer or string.
 * Used for file integrity verification (Tamper-Proofing).
 * @param {Buffer|string} data 
 * @returns {string} Hex string of the hash
 */
export function calculateHash(data) {
    if (!data) return null;
    try {
        const hash = crypto.createHash('sha256');
        hash.update(data);
        return hash.digest('hex');
    } catch (error) {
        console.error('Hashing failed:', error);
        throw new Error('Hashing failed');
    }
}
