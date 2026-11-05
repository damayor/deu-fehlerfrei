// VAPID (RFC 8292) request headers for Web Push without payload. WebCrypto only, no dependencies.

export const b64urlEncode = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const b64urlDecode = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const enc = (obj) => b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));

/** Uncompressed P-256 public key (65 bytes, base64url) from a private JWK. This is what browsers subscribe with. */
export function publicKeyOf(jwk) {
  return b64urlEncode(new Uint8Array([4, ...b64urlDecode(jwk.x), ...b64urlDecode(jwk.y)]));
}

/**
 * @param {string} endpoint push service URL of the subscription
 * @param {JsonWebKey} jwk private VAPID key (ECDSA P-256)
 * @param {string} subject mailto: or https: contact
 * @param {number} now ms
 */
export async function vapidHeaders(endpoint, jwk, subject, now) {
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const body = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body));
  return { Authorization: `vapid t=${body}.${b64urlEncode(sig)}, k=${publicKeyOf(jwk)}`, TTL: '14400', Urgency: 'normal' };
}
