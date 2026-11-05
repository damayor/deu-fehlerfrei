// Run once: node generate-keys.mjs. Prints the private VAPID key (JWK) to store as a Worker secret.
// The public key is served by the Worker itself, so nothing is pasted into the app.
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
console.log(JSON.stringify(jwk));
console.error('\nStore the line above with:  npx wrangler secret put VAPID_PRIVATE_JWK   (paste it when asked)');
