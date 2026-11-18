import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for CW tokens at rest.
 * Output format: base64(iv).base64(authTag).base64(ciphertext)
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

function decodeKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes encoded in base64.`);
  }
  return key;
}

export function encryptSecret(plainText: string, base64Key: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, decodeKey(base64Key), iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), cipherText].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload: string, base64Key: string): string {
  const [iv, authTag, cipherText] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !authTag || !cipherText) throw new Error("Malformed encrypted payload.");
  const decipher = createDecipheriv(ALGORITHM, decodeKey(base64Key), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
}
