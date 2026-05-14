// Tests for APNs ES256 JWT signer. Generates an ephemeral P-256 key
// via WebCrypto, signs a token, verifies signature + header + payload
// shape, and confirms IEEE P1363 (raw r||s) signature form per RFC 7518.
//
// References:
//   * Apple, "Establishing a Token-Based Connection to APNs"
//   * RFC 7515 §3 (JWS), RFC 7518 §3.4 (ECDSA using P-256 + SHA-256)

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decodeJwtUnverified, signApnsJwt } from "./apns-jwt.ts";

/** Generate an ephemeral P-256 key pair, export the private half as
 *  PEM (PKCS#8) — same shape as Apple's `.p8` — and return the public
 *  half as a `CryptoKey` we can use for in-test signature verification. */
async function generateTestKey(): Promise<{
  privateKeyPem: string;
  publicKey: CryptoKey;
}> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    /* extractable */ true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8));
  const pem = formatPem(b64);
  return { privateKeyPem: pem, publicKey: kp.publicKey };
}

function formatPem(b64: string): string {
  // 64-char lines, standard PEM block wrapping.
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }
  return [
    "-----BEGIN PRIVATE KEY-----",
    ...lines,
    "-----END PRIVATE KEY-----",
    "",
  ].join("\n");
}

function b64UrlDecode(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── tests ─────────────────────────────────────────────────────────────

Deno.test("signApnsJwt — produces a three-segment JWT", async () => {
  const { privateKeyPem } = await generateTestKey();
  const { jwt } = await signApnsJwt({
    teamId: "TEAM123456",
    keyId: "KEYID12345",
    privateKeyPem,
    iat: 1747000000,
  });
  const segs = jwt.split(".");
  assertEquals(segs.length, 3, "JWT must have three segments");
});

Deno.test("signApnsJwt — header carries alg=ES256, kid, typ", async () => {
  const { privateKeyPem } = await generateTestKey();
  const { jwt } = await signApnsJwt({
    teamId: "TEAM123456",
    keyId: "KEYIDABCDE",
    privateKeyPem,
    iat: 1747000000,
  });
  const { header } = decodeJwtUnverified(jwt);
  assertEquals(header.alg, "ES256", "APNs requires ES256");
  assertEquals(header.kid, "KEYIDABCDE", "kid header carries the APNs key id");
  assertEquals(header.typ, "JWT", "typ should be JWT per RFC 7519");
});

Deno.test("signApnsJwt — payload carries iss=teamId and iat", async () => {
  const { privateKeyPem } = await generateTestKey();
  const { jwt, iat } = await signApnsJwt({
    teamId: "TEAMABCDEF",
    keyId: "KEYIDXYZAB",
    privateKeyPem,
    iat: 1747001234,
  });
  const { payload } = decodeJwtUnverified(jwt);
  assertEquals(payload.iss, "TEAMABCDEF", "iss claim must equal team id");
  assertEquals(payload.iat, 1747001234);
  assertEquals(iat, 1747001234, "returned iat mirrors the input");
});

Deno.test("signApnsJwt — signature is IEEE P1363 64 bytes and verifies against the public key", async () => {
  const { privateKeyPem, publicKey } = await generateTestKey();
  const { jwt } = await signApnsJwt({
    teamId: "TEAMID9999",
    keyId: "KEYID99999",
    privateKeyPem,
    iat: 1747000000,
  });
  const segs = jwt.split(".");
  const signingInput = `${segs[0]}.${segs[1]}`;
  const sig = b64UrlDecode(segs[2]);
  assertEquals(sig.length, 64, "P1363 ES256 signature is exactly 64 bytes (r||s)");
  // Cast both BufferSource args to ArrayBuffer slices — Deno's newer
  // DOM typings reject `Uint8Array<ArrayBufferLike>` against the
  // BufferSource overload of `crypto.subtle.verify`.
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer,
    new TextEncoder().encode(signingInput),
  );
  assertEquals(ok, true, "signature must verify against the matching public key");
});

Deno.test("signApnsJwt — default iat is roughly now()", async () => {
  const { privateKeyPem } = await generateTestKey();
  const before = Math.floor(Date.now() / 1000);
  const { iat } = await signApnsJwt({
    teamId: "TEAM000001",
    keyId: "KEY0000001",
    privateKeyPem,
  });
  const after = Math.floor(Date.now() / 1000);
  // Wide tolerance — slow CI or sub-second drift.
  if (iat < before - 2 || iat > after + 2) {
    throw new Error(`iat ${iat} drifted from [${before},${after}]`);
  }
});

Deno.test("signApnsJwt — rejects an empty PEM", async () => {
  await assertRejects(
    () =>
      signApnsJwt({
        teamId: "TEAM",
        keyId: "KEY",
        privateKeyPem: "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
      }),
    Error,
  );
});

Deno.test("signApnsJwt — tolerates CR/LF and stray whitespace in PEM body", async () => {
  const { privateKeyPem } = await generateTestKey();
  // Inject CRLF + tabs into the body to simulate Windows-pasted PEM
  // payloads. The signer should canonicalise via `replace(/\s+/g, "")`.
  const mangled = privateKeyPem
    .replace(/\n/g, "\r\n")
    .replace(/^(.{20})/gm, "$1\t");
  const { jwt } = await signApnsJwt({
    teamId: "TEAM",
    keyId: "KEY",
    privateKeyPem: mangled,
    iat: 1747000000,
  });
  assertExists(jwt);
});
