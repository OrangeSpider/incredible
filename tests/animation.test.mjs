import assert from "node:assert/strict";
import test from "node:test";
import { resolveGadgetAnimation } from "../engine/animation.ts";

test("sprite frames advance across rows and loop", () => {
  const first = resolveGadgetAnimation("hamsterWheel", "running", 0);
  const fourth = resolveGadgetAnimation("hamsterWheel", "running", 270);
  const looped = resolveGadgetAnimation("hamsterWheel", "running", 540);
  assert.deepEqual([first.row, first.column], [0, 0]);
  assert.deepEqual([fourth.row, fourth.column], [1, 0]);
  assert.deepEqual([looped.row, looped.column], [0, 0]);
});

test("one-shot animation holds its final frame", () => {
  const firing = resolveGadgetAnimation("cannon", "firing", 10_000);
  assert.equal(firing.frame, 5);
  assert.equal(firing.definition.kind, "sprite");
});

test("unknown transition state falls back to default animation", () => {
  const fallback = resolveGadgetAnimation("balloon", "unknown", 0);
  assert.equal(fallback.state, "free");
});
