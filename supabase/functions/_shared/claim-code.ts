// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// Shared claim-code primitives for the web-invitee account-claim bridge
// (ADR 0015). Two concerns live here:
//
//   1. The claim-code generator + validator â€” an 8-character code drawn
//      from an unambiguous alphabet (no O/0, no I/1/l) so a user can
//      read it off the web "Getting the app?" affordance and type it
//      into the iOS S00a "Voted on the web?" field without misreads.
//
//   2. AES-GCM encrypt/decrypt for the web anonymous session's refresh
//      token. The `claim_codes` row stores the token encrypted at rest
//      (ADR 0015 Â§Consequences "The server briefly holds a refresh
//      token"); `mint-claim-code` encrypts before the INSERT and
//      `redeem-claim-code` (tb-WF-14) decrypts after the lookup. The
//      encryption is application-layer so the key never lives in the
//      database â€” it is a runtime Edge Function secret.
//
// Pure functions, no Deno globals beyond WebCrypto + `crypto.getRandom-
// Values` (available in the Deno + Supabase Edge runtimes). Tests live
// next door in `claim-code.test.ts`.

// â”€â”€ Claim-code alphabet + length â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** The unambiguous alphabet for claim codes. Every visually confusable
 *  character is excluded:
 *    * `O` and `0` â€” round shapes.
 *    * `I`, `1`, `L` â€” vertical strokes.
 *  What remains: 23 uppercase letters + 8 digits = 31 symbols. The code
 *  is uppercase-only; the redeem side uppercases the user's input before
 *  comparison so a lowercase paste still matches. */
export const CLAIM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Claim codes are 8 characters. 31^8 â‰ˆ 8.5e11 â€” ample entropy for a
 *  short-TTL, single-use, rate-limited token. */
export const CLAIM_CODE_LENGTH = 8;

/** Generate a single claim code. Uses `crypto.getRandomValues` for a
 *  cryptographically strong draw, with rejection sampling so the
 *  alphabet distribution stays uniform (a plain modulo over 256 would
 *  bias the first `256 % 31` symbols).
 *
 *  Uniqueness against existing rows is the table primary key's job â€”
 *  `mint-claim-code` retries on the rare INSERT collision. This
 *  function only guarantees a well-formed, uniformly random code. */
export function generateClaimCode(): string {
  const alphabet = CLAIM_CODE_ALPHABET;
  const n = alphabet.length;
  // The largest multiple of `n` that fits in a byte â€” bytes at or above
  // this are rejected so the modulo is unbiased.
  const limit = Math.floor(256 / n) * n;
  let out = "";
  const buf = new Uint8Array(1);
  while (out.length < CLAIM_CODE_LENGTH) {
    crypto.getRandomValues(buf);
    const b = buf[0];
    if (b >= limit) continue; // reject â€” would bias the distribution
    out += alphabet[b % n];
  }
  return out;
}

/** True iff `code` is a structurally valid claim code â€” exactly
 *  `CLAIM_CODE_LENGTH` characters, every one drawn from the unambiguous
 *  alphabet. A cheap pre-check before a database round-trip; it does NOT
 *  prove the code exists, is unredeemed, or is unexpired. */
export function isWellFormedClaimCode(code: string): boolean {
  if (typeof code !== "string" || code.length !== CLAIM_CODE_LENGTH) {
    return false;
  }
  for (const ch of code) {
    if (!CLAIM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

// â”€â”€ AES-GCM token encryption â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Wire format (all base64, standard alphabet):
//   `<iv-b64>:<ciphertext+tag-b64>`
// The 12-byte IV is random per call (a reused IV under one key is a
// catastrophic AES-GCM failure); the ciphertext segment includes the
// 16-byte GCM auth tag that WebCrypto appends, so tampering and a wrong
// key both surface as a thrown `decrypt`.

const IV_BYTE_LENGTH = 12;

/** Coerce a `Uint8Array` to a tight `ArrayBuffer` slice â€” newer Deno
 *  DOM typings reject `Uint8Array<ArrayBufferLike>` against the
 *  `BufferSource` overloads of `crypto.subtle.*`. Mirrors the same
 *  helper in `apns-jwt.ts`. */
function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** Import a base64-encoded 32-byte key as an AES-GCM `CryptoKey`. */
async function importAesKey(keyB64: string): Promise<CryptoKey> {
  if (!keyB64) {
    throw new Error("claim-code encryption key is empty");
  }
  const raw = base64ToBytes(keyB64);
  if (raw.length !== 32) {
    throw new Error(
      `claim-code encryption key must be 32 bytes (got ${raw.length})`,
    );
  }
  return await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt `token` under the base64 `keyB64` key. Returns
 *  `<iv-b64>:<ciphertext-b64>` â€” safe to store in a `text` column.
 *  Throws on an empty / wrong-length key. */
export async function encryptToken(
  token: string,
  keyB64: string,
): Promise<string> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const plaintext = new TextEncoder().encode(token);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(plaintext),
  );
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

/** Decrypt a `<iv-b64>:<ciphertext-b64>` blob produced by
 *  `encryptToken`. Throws if the key is wrong, the blob is malformed, or
 *  the GCM auth tag fails (tampered ciphertext). */
export async function decryptToken(
  blob: string,
  keyB64: string,
): Promise<string> {
  const sep = blob.indexOf(":");
  if (sep < 0) {
    throw new Error("claim-code ciphertext is malformed (no IV separator)");
  }
  const iv = base64ToBytes(blob.slice(0, sep));
  const cipher = base64ToBytes(blob.slice(sep + 1));
  if (iv.length !== IV_BYTE_LENGTH) {
    throw new Error("claim-code ciphertext has a bad IV length");
  }
  const key = await importAesKey(keyB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(cipher),
  );
  return new TextDecoder().decode(plainBuf);
}

// â”€â”€ base64 helpers (standard alphabet) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
