import "server-only";
import crypto from "node:crypto";

function secret(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new Error(`${name} must be set to a random string of at least 32 characters`);
  }
  return v;
}

/** 32-byte key derived from ENCRYPTION_KEY (for refresh tokens and TOTP secrets). */
function encKey(): Buffer {
  return crypto.createHash("sha256").update(secret("ENCRYPTION_KEY")).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Keyed hash for short secrets (access codes) so a database leak can't be brute-forced offline. */
export function hmac(value: string): string {
  return crypto.createHmac("sha256", secret("AUTH_SECRET")).update(value).digest("hex");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Uniformly random 6-digit code (000000–999999). */
export function randomSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
