// GetToIt web — quiz-progress contract tests.
//
// tb-WF-12 — the web invitee resume (web-01 §B / decision doc §Q5).
// `members.quiz_progress` is the server-side working copy that lets a
// re-clicking invitee pick up at their last-answered question. These
// tests pin the pack / unpack contract: a quiz state round-trips
// through the jsonb shape without loss, and a malformed / empty column
// decodes to a safe "start at Q1" default rather than throwing.

import { describe, expect, it } from "vitest";

import { QUIZ_DEFAULTS } from "./quiz";
import {
  packQuizProgress,
  unpackQuizProgress,
  type QuizProgressState,
} from "./quiz-progress";

const SAMPLE: QuizProgressState = {
  lastIndex: 3,
  cuisines: ["italian", "thai"],
  noPreference: false,
  budget: 2,
  reputation: "hidden_gem",
  vibe: 4,
};

describe("packQuizProgress", () => {
  it("produces a jsonb object carrying last_index and the typed answers", () => {
    const packed = packQuizProgress(SAMPLE);
    expect(packed.last_index).toBe(3);
    expect(packed.answers).toMatchObject({
      cuisines: ["italian", "thai"],
      no_preference: false,
      budget: 2,
      reputation: "hidden_gem",
      vibe: 4,
    });
  });
});

describe("unpackQuizProgress", () => {
  it("round-trips a packed progress payload back to the same state", () => {
    expect(unpackQuizProgress(packQuizProgress(SAMPLE))).toEqual(SAMPLE);
  });

  it("decodes the empty-object column default to a fresh start at Q1", () => {
    const fresh = unpackQuizProgress({});
    expect(fresh.lastIndex).toBe(1);
    expect(fresh.cuisines).toEqual([]);
    expect(fresh.noPreference).toBe(false);
    expect(fresh.budget).toBe(QUIZ_DEFAULTS.budget);
    expect(fresh.reputation).toBe(QUIZ_DEFAULTS.reputation);
    expect(fresh.vibe).toBe(QUIZ_DEFAULTS.vibe);
  });

  it("decodes a null / undefined column to a fresh start at Q1", () => {
    expect(unpackQuizProgress(null).lastIndex).toBe(1);
    expect(unpackQuizProgress(undefined).lastIndex).toBe(1);
  });

  it("clamps an out-of-range last_index into the 1..5 quiz range", () => {
    expect(unpackQuizProgress({ last_index: 0 }).lastIndex).toBe(1);
    expect(unpackQuizProgress({ last_index: 99 }).lastIndex).toBe(5);
    expect(unpackQuizProgress({ last_index: -3 }).lastIndex).toBe(1);
  });

  it("falls back to quiz defaults for malformed answer fields", () => {
    const decoded = unpackQuizProgress({
      last_index: 2,
      answers: {
        cuisines: "not-an-array",
        budget: "huge",
        reputation: 42,
        vibe: "loud",
      },
    });
    expect(decoded.lastIndex).toBe(2);
    expect(decoded.cuisines).toEqual([]);
    expect(decoded.budget).toBe(QUIZ_DEFAULTS.budget);
    expect(decoded.reputation).toBe(QUIZ_DEFAULTS.reputation);
    expect(decoded.vibe).toBe(QUIZ_DEFAULTS.vibe);
  });

  it("drops non-string cuisine entries but keeps the valid ones", () => {
    const decoded = unpackQuizProgress({
      last_index: 1,
      answers: { cuisines: ["italian", 7, null, "thai"] },
    });
    expect(decoded.cuisines).toEqual(["italian", "thai"]);
  });

  it("clamps an out-of-range numeric budget tier into the 1..4 range", () => {
    expect(unpackQuizProgress({ answers: { budget: 9 } }).budget).toBe(4);
    expect(unpackQuizProgress({ answers: { budget: -2 } }).budget).toBe(1);
    expect(unpackQuizProgress({ answers: { budget: 3 } }).budget).toBe(3);
  });

  it("clamps an out-of-range numeric vibe index into the 0..4 range", () => {
    expect(unpackQuizProgress({ answers: { vibe: 9 } }).vibe).toBe(4);
    expect(unpackQuizProgress({ answers: { vibe: -1 } }).vibe).toBe(0);
    expect(unpackQuizProgress({ answers: { vibe: 0 } }).vibe).toBe(0);
  });
});
