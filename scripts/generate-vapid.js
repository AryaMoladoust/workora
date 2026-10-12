// Prints a new VAPID key pair for push notifications:   npm run vapid
const crypto = require("node:crypto");
const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
console.log("\nAdd these to .env.local and to Vercel → Environment Variables:\n");
console.log(`VAPID_PUBLIC_KEY=${pub.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:you@example.com\n");
