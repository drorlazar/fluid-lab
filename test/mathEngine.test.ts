import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMathHack, generateProblem } from '../src/math/mathEngine.ts';

test('generateMathHack produces Make-10 strategy for single-digit bridging addition (e.g. 8 + 5)', () => {
  const hack = generateMathHack('+', 8, 5);
  assert.equal(hack.id, 'make10');
  assert.equal(hack.transformedEquation, '10 + 3 = 13');
  assert.equal(hack.steps.length, 3);
});

test('generateMathHack produces Friendly-10 Turbo Swap for near-ten 2-digit addition (e.g. 58 + 25)', () => {
  const hack = generateMathHack('+', 58, 25);
  assert.equal(hack.id, 'friendlyTen');
  assert.equal(hack.transformedEquation, '60 + 23 = 83');
});

test('generateMathHack produces Tens-First Laser Split for general 2-digit addition (e.g. 44 + 35)', () => {
  const hack = generateMathHack('+', 44, 35);
  assert.equal(hack.id, 'splitTensOnes');
  assert.equal(hack.transformedEquation, '70 + 9 = 79');
});

test('generateMathHack produces Equal Shift (No Borrow) for 2-digit subtraction ending in 7/8/9 (e.g. 73 - 39)', () => {
  const hack = generateMathHack('-', 73, 39);
  assert.equal(hack.id, 'equalShift');
  assert.equal(hack.transformedEquation, '74 - 40 = 34');
});

test('generateMathHack produces Ninja Bridge Jump for subtraction across tens (e.g. 82 - 65)', () => {
  const hack = generateMathHack('-', 82, 65);
  assert.equal(hack.id, 'bridgeJump');
  assert.equal(hack.transformedEquation, '+5 + 12 = 17');
});

test('generateMathHack produces Cyber-9 Finger Scanner for 9x multiplication (e.g. 9 × 7)', () => {
  const hack = generateMathHack('×', 9, 7);
  assert.equal(hack.id, 'finger9');
  assert.equal(hack.visualData.fingerFolded, 7);
  assert.equal(hack.visualData.tensA, 60);
  assert.equal(hack.visualData.onesA, 3);
});

test('generateMathHack produces Half-of-10x trick for 5x multiplication (e.g. 5 × 8)', () => {
  const hack = generateMathHack('×', 5, 8);
  assert.equal(hack.id, 'halfTen');
  assert.equal(hack.transformedEquation, '80 ÷ 2 = 40');
});

test('generateMathHack produces Double-Double / Triple-Double for 4x and 8x multiplication', () => {
  const hack4 = generateMathHack('×', 4, 7);
  assert.equal(hack4.id, 'doubleChain');
  assert.equal(hack4.transformedEquation, '14 + 14 = 28');

  const hack8 = generateMathHack('×', 8, 6);
  assert.equal(hack8.id, 'doubleChain');
  assert.equal(hack8.transformedEquation, '24 + 24 = 48');
});

test('generateProblem generates valid problems with 4 unique choices including the exact answer across all tiers', () => {
  for (const tier of ['rookie', 'pro', 'master'] as const) {
    for (const op of ['+', '-', '×'] as const) {
      for (let i = 0; i < 15; i++) {
        const p = generateProblem({ tier, forcedOp: op });
        assert.equal(p.op, op);
        const expected = op === '+' ? p.a + p.b : op === '-' ? p.a - p.b : p.a * p.b;
        assert.equal(p.answer, expected);
        assert.ok(p.answer > 0, 'Answer must be positive');
        assert.equal(p.choices.length, 4);
        assert.ok(p.choices.includes(p.answer), 'Choices must include the correct answer');
        assert.ok(p.hack.steps.length >= 2, 'Hack must have at least 2 steps');
      }
    }
  }
});
