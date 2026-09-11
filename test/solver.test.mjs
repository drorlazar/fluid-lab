import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FluidSolver } = require('../fluid.js');

function maxAbs(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
  return m;
}

test('projection makes the velocity field nearly divergence-free', () => {
  const s = new FluidSolver(48, 48);
  s.params.pressureIters = 40;
  // a diverging blob: push outward from the center in all directions
  s.addVelocity(24, 24, 6, 3, 0);
  s.addVelocity(20, 24, 6, -3, 0);
  s.addVelocity(24, 28, 6, 0, 3);
  s.addVelocity(24, 20, 6, 0, -3);
  const before = maxAbs(s.divergence());
  s.step();
  const after = maxAbs(s.divergence());
  assert.ok(before > 0.05, `expected a divergent start, got ${before}`);
  assert.ok(after < before * 0.1, `divergence should drop by 10x: before ${before}, after ${after}`);
});

test('dye is conserved when dissipation is zero and there are no solids', () => {
  const s = new FluidSolver(32, 32);
  s.params.dissipation = 0;
  s.params.diffusion = 0.0001;
  s.addDye(12, 12, 4, 1, 0.5, 0.2, 1);
  s.addVelocity(12, 12, 6, 1.5, 0.7);
  const before = s.totalDye();
  for (let i = 0; i < 50; i++) s.step();
  const after = s.totalDye();
  assert.ok(before > 0);
  assert.ok(Math.abs(after - before) / before < 0.01, `dye drifted: ${before} -> ${after}`);
});

test('diffusion lowers the peak and widens a dye spike', () => {
  const s = new FluidSolver(32, 32);
  s.params.diffusion = 0.001;
  s.params.dissipation = 0;
  s.params.advect = false;
  s.addDye(16, 16, 1, 1, 0, 0, 5);
  const peakBefore = maxAbs(s.r);
  const countBefore = s.r.filter((v) => v > 0.01).length;
  for (let i = 0; i < 20; i++) s.step();
  const peakAfter = maxAbs(s.r);
  const countAfter = s.r.filter((v) => v > 0.01).length;
  assert.ok(peakAfter < peakBefore * 0.8, `peak should drop: ${peakBefore} -> ${peakAfter}`);
  assert.ok(countAfter > countBefore * 1.5, `support should widen: ${countBefore} -> ${countAfter}`);
});

test('a hot blob rises: buoyancy produces upward (negative v) velocity', () => {
  const s = new FluidSolver(32, 32);
  s.params.buoyancy = 1;
  s.addHeat(16, 20, 3, 5);
  for (let i = 0; i < 5; i++) s.step();
  const idx = s.index(16, 17);
  assert.ok(s.v[idx] < 0, `expected upward velocity above the blob, got ${s.v[idx]}`);
});

test('dye never enters a solid cell', () => {
  const s = new FluidSolver(48, 48);
  s.setSolid(24, 24, 4, true);
  s.addDye(10, 24, 3, 1, 1, 1, 2);
  s.addVelocity(10, 24, 5, 4, 0);
  for (let i = 0; i < 60; i++) {
    s.addVelocity(10, 24, 5, 4, 0);
    s.step();
  }
  const idx = s.index(24, 24);
  assert.equal(s.solid[idx], 1);
  assert.equal(s.r[idx], 0);
  assert.equal(s.g[idx], 0);
  assert.equal(s.b[idx], 0);
});

test('addVortex creates curl of the requested sign at its center', () => {
  const pos = new FluidSolver(32, 32);
  pos.addVortex(16, 16, 6, 2);
  const neg = new FluidSolver(32, 32);
  neg.addVortex(16, 16, 6, -2);
  const cp = pos.curl()[pos.index(16, 16)];
  const cn = neg.curl()[neg.index(16, 16)];
  assert.ok(cp > 0, `positive vortex should have positive curl, got ${cp}`);
  assert.ok(cn < 0, `negative vortex should have negative curl, got ${cn}`);
});

test('mixedness is 0 for a split field and near 1 for a uniform blend', () => {
  const split = new FluidSolver(16, 16);
  for (let y = 1; y <= 16; y++) for (let x = 1; x <= 16; x++) {
    const i = split.index(x, y);
    if (y <= 8) split.r[i] = 1; else split.b[i] = 1;
  }
  const blend = new FluidSolver(16, 16);
  for (let y = 1; y <= 16; y++) for (let x = 1; x <= 16; x++) {
    const i = blend.index(x, y);
    blend.r[i] = 0.5; blend.b[i] = 0.5;
  }
  assert.ok(split.mixedness() < 0.05, `split should be unmixed, got ${split.mixedness()}`);
  assert.ok(blend.mixedness() > 0.95, `blend should be mixed, got ${blend.mixedness()}`);
});

test('reset clears velocity, dye, heat and solids', () => {
  const s = new FluidSolver(16, 16);
  s.addDye(8, 8, 3, 1, 1, 1, 1);
  s.addVelocity(8, 8, 3, 1, 1);
  s.addHeat(8, 8, 3, 1);
  s.setSolid(4, 4, 1, true);
  s.reset();
  assert.equal(s.totalDye(), 0);
  assert.equal(maxAbs(s.u), 0);
  assert.equal(maxAbs(s.v), 0);
  assert.equal(maxAbs(s.temp), 0);
  assert.equal(maxAbs(s.solid), 0);
});
