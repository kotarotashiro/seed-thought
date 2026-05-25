import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(keyOverride?: string): Buffer {
  const key =
    keyOverride ?? process.env.TOKEN_ENCRYPTION_KEY ?? process.env.XAI_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY or XAI_ENCRYPTION_KEY is not set");
  // Derive a 32-byte key from the provided string
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptToken(plaintext: string, keyOverride?: string): string {
  const key = getEncryptionKey(keyOverride);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(ciphertext: string, keyOverride?: string): string {
  const key = getEncryptionKey(keyOverride);
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
