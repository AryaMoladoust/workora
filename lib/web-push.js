// Minimal Web Push implementation (RFC 8030 + RFC 8291 aes128gcm + RFC 8292 VAPID) on top of node:crypto.
// No external dependency. Pure functions only – database / scheduling live in lib/push.js.
import crypto from "node:crypto";

export const b64u = (buf) => Buffer.from(buf).toString("base64url");
export const fromB64u = (s) => Buffer.from(String(s), "base64url");

/* ------------------------------------------------------------------ VAPID keys */
export function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([0x04]), fromB64u(jwk.x), fromB64u(jwk.y)]);
  void publicKey;
  return { publicKey: b64u(pub), privateKey: jwk.d };
}

function privateKeyObject(publicKeyB64, privateKeyB64) {
  const pub = fromB64u(publicKeyB64);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privateKeyB64 },
    format: "jwk",
  });
}

export function vapidAuthHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const input = `${header}.${claims}`;
  const signature = crypto.sign("sha256", Buffer.from(input), { key: privateKeyObject(publicKey, privateKey), dsaEncoding: "ieee-p1363" });
  return `vapid t=${input}.${b64u(signature)}, k=${publicKey}`;
}

/* ------------------------------------------------------------------ payload encryption (RFC 8291) */
export function encryptPayload({ p256dh, auth }, plaintext, { salt, senderPrivateKey } = {}) {
  const uaPublic = fromB64u(p256dh); // 65 bytes, uncompressed P-256 point
  const authSecret = fromB64u(auth); // 16 bytes
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("invalid p256dh");
  if (authSecret.length < 16) throw new Error("invalid auth secret");

  const ecdh = crypto.createECDH("prime256v1");
  if (senderPrivateKey) ecdh.setPrivateKey(fromB64u(senderPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65 bytes
  const sharedSecret = ecdh.computeSecret(uaPublic);
  const recordSalt = salt ? fromB64u(salt) : crypto.randomBytes(16);

  const hkdf = (ikm, saltBuf, info, length) => Buffer.from(crypto.hkdfSync("sha256", ikm, saltBuf, info, length));
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, recordSalt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, recordSalt, Buffer.from("Content-Encoding: nonce\0"), 12);

  const data = Buffer.concat([Buffer.from(plaintext), Buffer.from([0x02])]); // 0x02 = last (only) record
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([recordSalt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

/* ------------------------------------------------------------------ delivery */
// Only real browser push services are contacted (prevents the server from being used as a request proxy).
const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function isAllowedEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && ALLOWED_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

// Resolves to { ok, status, gone } – never throws.
export async function sendEncrypted(subscription, payload, vapid, { ttl = 3600, urgency = "normal", topic } = {}) {
  try {
    if (!isAllowedEndpoint(subscription.endpoint)) return { ok: false, status: 0, gone: true, error: "endpoint not allowed" };
    const body = encryptPayload(subscription, payload);
    const headers = {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: vapidAuthHeader(subscription.endpoint, vapid),
    };
    if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined;
    const res = await fetch(subscription.endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    const status = res.status;
    return { ok: status >= 200 && status < 300, status, gone: status === 404 || status === 410 };
  } catch (error) {
    return { ok: false, status: 0, gone: false, error: error?.message || String(error) };
  }
}
