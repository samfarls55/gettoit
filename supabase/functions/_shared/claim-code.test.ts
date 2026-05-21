// Tests for the shared claim-code primitives — the unambiguous-alphabet
// code generator and the AES-GCM encrypt/decrypt round-trip used by the
// mint-claim-code (and, in tb-WF-14, redeem-claim-code) Edge Functions.

import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  CLAIM_CODE_ALPHABET,
  CLAIM_CODE_LENGTH,
  decryptToken,
  encryptToken,
  generateClaimCode,
  isWellFormedClaimCode,
} from "./claim-code.ts";

// ── generateClaimCode ──────────────────────────────────────────────

Deno.test("generateClaimCode — produces an 8-character code", () => {
  const code = generateClaimCode();
  assertEquals(code.length, CLAIM_CODE_LENGTH);
  assertEquals(CLAIM_CODE_LENGTH, 8);
});

Deno.test("generateClaimCode — uses only the unambiguous alphabet", () => {
  // No O/0, no I/1/l — the alphabet must exclude every visually
  // ambiguous character per the issue spec.
  for (const banned of ["O", "0", "I", "1", "L"]) {
    assert(
      !CLAIM_CODE_ALPHABET.includes(banned),
      `alphabet must not contain '${banned}'`,
    );
  }
  // 500 codes, every character drawn from the alphabet.
  for (let i = 0; i < 500; i++) {
    const code = generateClaimCode();
    for (const ch of code) {
      assert(
        CLAIM_CODE_ALPHABET.includes(ch),
        `code '${code}' contains out-of-alphabet char '${ch}'`,
      );
    }
  }
});

Deno.test("generateClaimCode — codes are unique across a large batch", () => {
  // Uniqueness is probabilistic at the generator level (the table PK is
  // the hard guarantee), but a 1000-code batch must not collide — a
  // collision here would mean the generator is not actually random.
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    seen.add(generateClaimCode());
  }
  assertEquals(seen.size, 1000);
});

Deno.test("generateClaimCode — output is uppercase", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateClaimCode();
    assertEquals(code, code.toUpperCase());
  }
});

// ── isWellFormedClaimCode ──────────────────────────────────────────

Deno.test("isWellFormedClaimCode — accepts a freshly generated code", () => {
  for (let i = 0; i < 50; i++) {
    assert(isWellFormedClaimCode(generateClaimCode()));
  }
});

Deno.test("isWellFormedClaimCode — rejects wrong length / bad chars", () => {
  assert(!isWellFormedClaimCode(""));
  assert(!isWellFormedClaimCode("ABCDEFG")); // 7 chars
  assert(!isWellFormedClaimCode("ABCDEFGHI")); // 9 chars
  assert(!isWellFormedClaimCode("ABCDEFG0")); // contains 0
  assert(!isWellFormedClaimCode("ABCDEFGO")); // contains O
  assert(!isWellFormedClaimCode("ABCDEFG1")); // contains 1
});

// ── encryptToken / decryptToken round-trip ─────────────────────────

const TEST_KEY =
  // 32-byte key, base64-encoded (an AES-256-GCM key).
  "tra6MS8XlmiBodn9NKnRdgEI1ohXtHTkbgnDJZkeaik=";

Deno.test("encryptToken/decryptToken — round-trips a refresh token", async () => {
  const token = "v1.rt_abcdefghijklmnopqrstuvwxyz0123456789";
  const ciphertext = await encryptToken(token, TEST_KEY);
  // The ciphertext must not be the plaintext.
  assertNotEquals(ciphertext, token);
  assert(!ciphertext.includes(token));
  const recovered = await decryptToken(ciphertext, TEST_KEY);
  assertEquals(recovered, token);
});

Deno.test("encryptToken — two encryptions of the same token differ (random IV)", async () => {
  const token = "v1.rt_samevalue";
  const a = await encryptToken(token, TEST_KEY);
  const b = await encryptToken(token, TEST_KEY);
  // A fresh IV per call means the ciphertext differs even for identical
  // plaintext — a non-random IV would be a real crypto bug.
  assertNotEquals(a, b);
  // Both still decrypt back to the same plaintext.
  assertEquals(await decryptToken(a, TEST_KEY), token);
  assertEquals(await decryptToken(b, TEST_KEY), token);
});

Deno.test("decryptToken — rejects ciphertext under the wrong key", async () => {
  const token = "v1.rt_secret";
  const ciphertext = await encryptToken(token, TEST_KEY);
  const wrongKey = "N8TZXUZT67H3dC7YYx+LTUzcSzKb3NcE4fONMIsO8bw=";
  await assertRejects(() => decryptToken(ciphertext, wrongKey));
});

Deno.test("decryptToken — rejects tampered ciphertext", async () => {
  const token = "v1.rt_secret";
  const ciphertext = await encryptToken(token, TEST_KEY);
  // Flip a character in the middle of the ciphertext — AES-GCM's auth
  // tag must catch it.
  const mid = Math.floor(ciphertext.length / 2);
  const flipped =
    ciphertext.slice(0, mid) +
    (ciphertext[mid] === "A" ? "B" : "A") +
    ciphertext.slice(mid + 1);
  await assertRejects(() => decryptToken(flipped, TEST_KEY));
});

Deno.test("encryptToken — throws on an empty key", async () => {
  await assertRejects(() => encryptToken("token", ""));
});
