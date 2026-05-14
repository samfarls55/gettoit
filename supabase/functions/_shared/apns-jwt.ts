// APNs JWT signer (ES256) — pure functions, no Deno globals beyond WebCrypto.
//
// APNs HTTP/2 provider authentication uses a short-lived ES256 JWT
// signed with the team's `.p8` private key (Apple Developer Console →
// Keys → APNs auth key). The token's `iss` claim is the team id, and
// the `kid` JWS header is the key id. Per Apple's documentation:
//
//   * Token must be no older than ~60 minutes (Apple drops anything
//     older; provider servers regenerate before then).
//   * Alg must be ES256 (P-256 / SHA-256). Apple rejects everything
//     else for APNs auth keys.
//   * The header includes `alg: "ES256"`, `kid: "<key id>"`, `typ: "JWT"`
//     (typ is recommended but not required).
//   * The payload includes `iss: "<team id>"` and `iat: <unix seconds>`.
//     No `aud`, no `sub`.
//
// We sign with WebCrypto's SubtleCrypto (`crypto.subtle`) — available
// in Deno + Edge runtimes. The `.p8` payload is a PEM-encoded PKCS#8
// EC private key; we decode the base64 body, import as `ECDSA P-256`
// for `sign`, and produce a JWS in IEEE P1363 "raw r||s" form (which
// is what RFC 7515 / RFC 7518 §3.4 require for ES256 JWTs — NOT the
// DER-wrapped form WebCrypto emits by default; we convert).
//
// Used by the apns-sender Edge Function. Tests live next door in
// `apns-jwt.test.ts`.

/** Input shape for `signApnsJwt`. */
export interface ApnsJwtInput {
  /** Apple team id. 10 chars. Becomes `iss` in the payload. */
  teamId: string;
  /** APNs auth key id. 10 chars. Becomes `kid` in the JWS header. */
  keyId: string;
  /** PEM-encoded PKCS#8 EC private key (`.p8` contents — full
   *  `-----BEGIN PRIVATE KEY-----` block including newlines). */
  privateKeyPem: string;
  /** Issued-at unix seconds. Override only for tests; the real signer
   *  uses `Math.floor(Date.now() / 1000)`. */
  iat?: number;
}

/** A signed JWT plus the iat that went into it. The iat is surfaced so
 *  the caller can cache + reuse the token until it nears expiry. */
export interface ApnsJwt {
  jwt: string;
  iat: number;
}

/** Sign an APNs provider JWT (ES256). The returned token authenticates
 *  every APNs `POST` until the iat is ~50 minutes old; cache + reuse. */
export async function signApnsJwt(input: ApnsJwtInput): Promise<ApnsJwt> {
  const iat = input.iat ?? Math.floor(Date.now() / 1000);

  const header = {
    alg: "ES256",
    kid: input.keyId,
    typ: "JWT",
  };
  const payload = {
    iss: input.teamId,
    iat,
  };

  const headerB64 = b64UrlEncodeJson(header);
  const payloadB64 = b64UrlEncodeJson(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importEcPrivateKeyP8(input.privateKeyPem);
  const sigDer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  // WebCrypto returns IEEE P1363 (r||s) for ECDSA, not DER — the JWS
  // ES256 spec also wants IEEE P1363, so no conversion needed.
  const sigBytes = new Uint8Array(sigDer);
  const sigB64 = b64UrlEncodeBytes(sigBytes);

  return {
    jwt: `${signingInput}.${sigB64}`,
    iat,
  };
}

/** Decode a `.p8` PEM into a WebCrypto `CryptoKey` (P-256, sign). */
async function importEcPrivateKeyP8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (body.length === 0) {
    throw new Error("APNs private key PEM body is empty");
  }
  const der = base64DecodeToBytes(body);
  // Cast to BufferSource via the underlying ArrayBuffer slice — Deno's
  // newer DOM typings reject `Uint8Array<ArrayBufferLike>` against the
  // BufferSource overload of `importKey`.
  return await crypto.subtle.importKey(
    "pkcs8",
    asArrayBuffer(der),
    { name: "ECDSA", namedCurve: "P-256" },
    /* extractable */ false,
    ["sign"],
  );
}

// ── encoding helpers ──────────────────────────────────────────────────

function b64UrlEncodeJson(obj: unknown): string {
  return b64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function b64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Decode base64 (standard, not URL-safe) into a byte array. The PEM
 *  body uses standard base64 with newlines — those are stripped before
 *  this is called. */
function base64DecodeToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Coerce a `Uint8Array` to a tight `ArrayBuffer` slice — newer Deno
 *  DOM typings reject `Uint8Array<ArrayBufferLike>` against the
 *  `BufferSource` overloads of `crypto.subtle.*`. */
function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

// ── JWT helpers exposed for tests ─────────────────────────────────────

/** Decode a JWT's header + payload (no signature verification). For
 *  tests only — production code on the APNs side validates the
 *  signature against the trust chain. */
export function decodeJwtUnverified(
  jwt: string,
): { header: Record<string, unknown>; payload: Record<string, unknown>; signature: Uint8Array } {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT must have 3 segments");
  }
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(parts[1])));
  const signature = base64UrlDecodeToBytes(parts[2]);
  return { header, payload, signature };
}

function base64UrlDecodeToBytes(b64url: string): Uint8Array {
  // restore padding + URL-safe → standard alphabet
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return base64DecodeToBytes(b64);
}
