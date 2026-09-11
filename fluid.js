/*
  FluidSolver — a 2D grid fluid solver in the style of Jos Stam's
  "Real-Time Fluid Dynamics for Games", extended with:
    - solid (obstacle) cells
    - a temperature field with buoyancy
    - three-channel colored dye
    - vorticity confinement
    - wind inflow/outflow boundaries
  Pure numerics, no DOM. Works in the browser (global FluidSolver) and in Node (module.exports).

  Grid layout: (W+2) x (H+2) cells including a one-cell border. index(x, y) = x + y * (W+2).
  Velocities are measured in cells per unit time; params.dt scales one step.
  Screen convention: y grows downward, so "up" is negative v.
*/
(function (root) {
  'use strict';

  const DEFAULTS = {
    dt: 1,
    viscosity: 0,        // velocity diffusion
    diffusion: 0,        // dye diffusion
    dissipation: 0,      // dye fade per unit time
    vorticity: 0,        // vorticity confinement strength
    buoyancy: 0,         // upward force per unit temperature
    ambientTemp: 0,
    tempCooling: 0.02,   // temperature relaxes toward ambient at this rate
    inkWeight: 0,        // downward force per unit dye (heavy ink sinks; negative floats)
    windX: 0,
    windY: 0,
    pressureIters: 20,
    diffuseIters: 6,
    advect: true,
    project: true,
    diffuse: true,
    sharpAdvection: true,  // MacCormack corrector pass for dye: crisper swirls, far less mass loss
    sharpVelocity: false,  // same pass for velocity; off by default because it keeps grid-scale noise alive
    conserveDye: true,     // rescale dye after advection so the total is preserved (closed box only)
  };

  class FluidSolver {
    constructor(width, height) {
      this.W = width;
      this.H = height;
      this.stride = width + 2;
      const n = (width + 2) * (height + 2);
      this.size = n;
      this.params = Object.assign({}, DEFAULTS);

      this.u = new Float32Array(n); this.v = new Float32Array(n);
      this.u0 = new Float32Array(n); this.v0 = new Float32Array(n);
      this.r = new Float32Array(n); this.g = new Float32Array(n); this.b = new Float32Array(n);
      this.r0 = new Float32Array(n); this.g0 = new Float32Array(n); this.b0 = new Float32Array(n);
      this.temp = new Float32Array(n); this.temp0 = new Float32Array(n);
      this.p = new Float32Array(n); this.div = new Float32Array(n);
      this.solid = new Uint8Array(n);
      this.solidList = new Int32Array(0);
      this.solidCount = 0;
      this._solidsDirty = false;
      this._curl = new Float32Array(n);
      this._absCurl = new Float32Array(n);
      this._scratch = new Float32Array(n);
      this._m1 = new Float32Array(n); this._m2 = new Float32Array(n);
      this._lo = new Float32Array(n); this._hi = new Float32Array(n);
    }

    index(x, y) { return x + y * this.stride; }

    // ---------- sources ----------

    _splat(field, cx, cy, radius, amount) {
      const rr = Math.max(radius, 0.5);
      const x0 = Math.max(1, Math.floor(cx - rr)), x1 = Math.min(this.W, Math.ceil(cx + rr));
      const y0 = Math.max(1, Math.floor(cy - rr)), y1 = Math.min(this.H, Math.ceil(cy + rr));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy;
          const f = 1 - (dx * dx + dy * dy) / (rr * rr);
          if (f <= 0) continue;
          const i = this.index(x, y);
          if (this.solid[i]) continue;
          field[i] += amount * f;
        }
      }
    }

    addDye(x, y, radius, r, g, b, amount) {
      if (r) this._splat(this.r, x, y, radius, r * amount);
      if (g) this._splat(this.g, x, y, radius, g * amount);
      if (b) this._splat(this.b, x, y, radius, b * amount);
    }

    addVelocity(x, y, radius, du, dv) {
      if (du) this._splat(this.u, x, y, radius, du);
      if (dv) this._splat(this.v, x, y, radius, dv);
    }

    addHeat(x, y, radius, amount) { this._splat(this.temp, x, y, radius, amount); }

    // A vortex with a solid-body core of the given radius and a 1/r tail beyond it,
    // so its circulation reaches across the field and vortices interact like real ones.
    addVortex(cx, cy, radius, strength) {
      const rc = Math.max(radius, 1), W = this.W, H = this.H, S = this.stride, solid = this.solid;
      const reach = Math.max(W, H);
      for (let y = 1; y <= H; y++) {
        for (let x = 1; x <= W; x++) {
          const dx = x - cx, dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 1e-6 || d > reach) continue;
          const i = x + y * S;
          if (solid[i]) continue;
          let mag = d < rc ? strength * (d / rc) : strength * (rc / d);
          this.u[i] += -dy / d * mag;
          this.v[i] += dx / d * mag;
        }
      }
    }

    _syncSolids() {
      if (!this._solidsDirty) return;
      const idx = [];
      for (let i = 0; i < this.size; i++) if (this.solid[i]) idx.push(i);
      this.solidList = Int32Array.from(idx);
      this.solidCount = idx.length;
      this._solidsDirty = false;
    }

    setSolid(cx, cy, radius, on) {
      this._solidsDirty = true;
      const rr = Math.max(radius, 0.5);
      const x0 = Math.max(1, Math.floor(cx - rr)), x1 = Math.min(this.W, Math.ceil(cx + rr));
      const y0 = Math.max(1, Math.floor(cy - rr)), y1 = Math.min(this.H, Math.ceil(cy + rr));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > rr * rr) continue;
          const i = this.index(x, y);
          this.solid[i] = on ? 1 : 0;
          if (on) { this.u[i] = this.v[i] = 0; this.r[i] = this.g[i] = this.b[i] = 0; this.temp[i] = 0; }
        }
      }
    }

    setSolidCell(x, y, on) {
      if (x < 1 || x > this.W || y < 1 || y > this.H) return;
      this._solidsDirty = true;
      const i = this.index(x, y);
      this.solid[i] = on ? 1 : 0;
      if (on) { this.u[i] = this.v[i] = 0; this.r[i] = this.g[i] = this.b[i] = 0; this.temp[i] = 0; }
    }

    clearSolids() { this.solid.fill(0); this._solidsDirty = true; }
    setUniformFlow(u, v) { this.u.fill(u); this.v.fill(v); this.p.fill(0); }
    clearDye() { this.r.fill(0); this.g.fill(0); this.b.fill(0); }
    clearVelocity() { this.u.fill(0); this.v.fill(0); }
    clearHeat() { this.temp.fill(0); }

    reset() {
      this.clearVelocity(); this.clearDye(); this.clearHeat(); this.clearSolids();
      this.p.fill(0); this.div.fill(0);
    }

    // ---------- boundaries ----------

    // b: 0 = scalar, 1 = x-velocity, 2 = y-velocity
    setBnd(b, x) {
      const W = this.W, H = this.H, S = this.stride, P = this.params;
      const wind = P.windX !== 0 || P.windY !== 0;
      for (let j = 1; j <= H; j++) {
        const L = j * S, R = (W + 1) + j * S;
        if (wind) {
          x[L] = b === 1 ? P.windX : b === 2 ? P.windY : x[L + 1];
          x[R] = x[R - 1];
        } else {
          x[L] = b === 1 ? -x[L + 1] : x[L + 1];
          x[R] = b === 1 ? -x[R - 1] : x[R - 1];
        }
      }
      for (let i = 1; i <= W; i++) {
        const T = i, B = i + (H + 1) * S;
        x[T] = b === 2 ? -x[T + S] : x[T + S];
        x[B] = b === 2 ? -x[B - S] : x[B - S];
      }
      x[0] = 0.5 * (x[1] + x[S]);
      x[W + 1] = 0.5 * (x[W] + x[W + 1 + S]);
      x[(H + 1) * S] = 0.5 * (x[1 + (H + 1) * S] + x[H * S]);
      x[W + 1 + (H + 1) * S] = 0.5 * (x[W + (H + 1) * S] + x[W + 1 + H * S]);
      this._syncSolids();
      const list = this.solidList;
      for (let k = 0; k < list.length; k++) x[list[k]] = 0;
    }

    // Gauss-Seidel / SOR solve of  x = (x0 + a * sum(neighbors)) / c
    // neumann: solid neighbors contribute the cell's own value (zero flux) instead of 0.
    linSolve(b, x, x0, a, c, iters, neumann, omega) {
      const W = this.W, H = this.H, S = this.stride, solid = this.solid;
      const w = omega || 1;
      this._syncSolids();
      if (this.solidCount === 0) {
        // fast path: no obstacles, no per-cell checks
        const invc = 1 / c;
        for (let k = 0; k < iters; k++) {
          for (let j = 1; j <= H; j++) {
            let i = 1 + j * S;
            const end = i + W;
            if (w === 1) {
              for (; i < end; i++) x[i] = (x0[i] + a * (x[i - 1] + x[i + 1] + x[i - S] + x[i + S])) * invc;
            } else {
              for (; i < end; i++) {
                const next = (x0[i] + a * (x[i - 1] + x[i + 1] + x[i - S] + x[i + S])) * invc;
                x[i] += w * (next - x[i]);
              }
            }
          }
          this.setBnd(b, x);
        }
        return;
      }
      for (let k = 0; k < iters; k++) {
        for (let j = 1; j <= H; j++) {
          let i = 1 + j * S;
          for (let ii = 1; ii <= W; ii++, i++) {
            if (solid[i]) continue;
            let sum = 0, cc = c;
            if (neumann) {
              if (solid[i - 1]) cc -= a; else sum += x[i - 1];
              if (solid[i + 1]) cc -= a; else sum += x[i + 1];
              if (solid[i - S]) cc -= a; else sum += x[i - S];
              if (solid[i + S]) cc -= a; else sum += x[i + S];
            } else {
              sum = x[i - 1] + x[i + 1] + x[i - S] + x[i + S];
            }
            const next = (x0[i] + a * sum) / cc;
            x[i] = w === 1 ? next : x[i] + w * (next - x[i]);
          }
        }
        this.setBnd(b, x);
      }
    }

    diffuseField(b, x, x0, rate, neumann) {
      const a = this.params.dt * rate * this.W * this.H;
      if (a <= 0) { x.set(x0); this.setBnd(b, x); return; }
      this.linSolve(b, x, x0, a, 1 + 4 * a, this.params.diffuseIters, neumann, 1);
    }

    // Plain semi-Lagrangian gather. sign = +1 traces backward in time, -1 forward.
    // When lo/hi are given, records the min/max of the four sampled cells (for MacCormack clamping).
    _semiLagrangian(d, d0, u, v, sign, lo, hi) {
      const W = this.W, H = this.H, S = this.stride, dt = this.params.dt * sign, solid = this.solid;
      const xmax = W + 0.5, ymax = H + 0.5;
      for (let j = 1; j <= H; j++) {
        for (let i = 1; i <= W; i++) {
          const idx = i + j * S;
          if (solid[idx]) { d[idx] = 0; if (lo) { lo[idx] = 0; hi[idx] = 0; } continue; }
          let x = i - dt * u[idx], y = j - dt * v[idx];
          if (x < 0.5) x = 0.5; else if (x > xmax) x = xmax;
          if (y < 0.5) y = 0.5; else if (y > ymax) y = ymax;
          const i0 = Math.floor(x), j0 = Math.floor(y);
          const i1 = i0 + 1, j1 = j0 + 1;
          const s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1;
          const a = d0[i0 + j0 * S], bb = d0[i0 + j1 * S], c = d0[i1 + j0 * S], e = d0[i1 + j1 * S];
          d[idx] = s0 * (t0 * a + t1 * bb) + s1 * (t0 * c + t1 * e);
          if (lo) {
            lo[idx] = Math.min(a, bb, c, e);
            hi[idx] = Math.max(a, bb, c, e);
          }
        }
      }
    }

    advectField(b, d, d0, u, v) {
      const sharp = b === 0 ? this.params.sharpAdvection : this.params.sharpVelocity;
      if (!sharp) {
        this._semiLagrangian(d, d0, u, v, 1, null, null);
        this.setBnd(b, d);
        return;
      }
      // MacCormack: advect forward, advect the result back, use the round-trip error to correct.
      const m1 = this._m1, m2 = this._m2, lo = this._lo, hi = this._hi, solid = this.solid;
      this._semiLagrangian(m1, d0, u, v, 1, lo, hi);
      this.setBnd(b, m1);
      this._semiLagrangian(m2, m1, u, v, -1, null, null);
      this.setBnd(b, m2);
      for (let i = 0; i < d.length; i++) {
        if (solid[i]) { d[i] = 0; continue; }
        let val = m1[i] + 0.5 * (d0[i] - m2[i]);
        if (val < lo[i]) val = lo[i]; else if (val > hi[i]) val = hi[i];
        d[i] = val;
      }
      this.setBnd(b, d);
    }

    _hasContent(x, eps) {
      const e = eps || 1e-4;
      for (let i = 0; i < x.length; i++) if (x[i] > e) return true;
      return false;
    }

    _sumInterior(x) {
      let t = 0;
      const W = this.W, H = this.H, S = this.stride;
      for (let j = 1; j <= H; j++) {
        let i = 1 + j * S;
        for (let ii = 1; ii <= W; ii++, i++) t += x[i];
      }
      return t;
    }

    // Semi-Lagrangian advection is not mass-conserving; in a closed box rescale so ink never fades on its own.
    _conserve(x, before) {
      if (before <= 1e-6) return;
      const after = this._sumInterior(x);
      if (after <= 1e-6) return;
      let k = before / after;
      if (k > 1.5) k = 1.5; else if (k < 0.67) k = 0.67;
      if (Math.abs(k - 1) < 1e-6) return;
      for (let i = 0; i < x.length; i++) x[i] *= k;
    }

    project(u, v, p, div) {
      const W = this.W, H = this.H, S = this.stride, solid = this.solid;
      for (let j = 1; j <= H; j++) {
        for (let i = 1; i <= W; i++) {
          const idx = i + j * S;
          div[idx] = -0.5 * (u[idx + 1] - u[idx - 1] + v[idx + S] - v[idx - S]);
          p[idx] = 0;
        }
      }
      this.setBnd(0, div); this.setBnd(0, p);
      this.linSolve(0, p, div, 1, 4, this.params.pressureIters, true, 1.6);
      for (let j = 1; j <= H; j++) {
        for (let i = 1; i <= W; i++) {
          const idx = i + j * S;
          if (solid[idx]) continue;
          const pl = solid[idx - 1] ? p[idx] : p[idx - 1];
          const pr = solid[idx + 1] ? p[idx] : p[idx + 1];
          const pt = solid[idx - S] ? p[idx] : p[idx - S];
          const pb = solid[idx + S] ? p[idx] : p[idx + S];
          u[idx] -= 0.5 * (pr - pl);
          v[idx] -= 0.5 * (pb - pt);
        }
      }
      this.setBnd(1, u); this.setBnd(2, v);
    }

    applyForces() {
      const P = this.params, dt = P.dt, n = this.size, solid = this.solid;
      const buoy = P.buoyancy, amb = P.ambientTemp, ink = P.inkWeight;
      if (buoy === 0 && ink === 0) return;
      for (let i = 0; i < n; i++) {
        if (solid[i]) continue;
        let f = 0;
        if (buoy !== 0) f -= buoy * (this.temp[i] - amb);
        if (ink !== 0) f += ink * (this.r[i] + this.g[i] + this.b[i]);
        this.v[i] += f * dt;
      }
    }

    computeCurl(out) {
      const W = this.W, H = this.H, S = this.stride, u = this.u, v = this.v;
      out.fill(0);
      for (let j = 1; j <= H; j++) {
        for (let i = 1; i <= W; i++) {
          const idx = i + j * S;
          out[idx] = 0.5 * (v[idx + 1] - v[idx - 1] - (u[idx + S] - u[idx - S]));
        }
      }
      return out;
    }

    vorticityConfinement() {
      const eps = this.params.vorticity;
      if (eps <= 0) return;
      const W = this.W, H = this.H, S = this.stride, dt = this.params.dt, solid = this.solid;
      const curl = this.computeCurl(this._curl);
      const ac = this._absCurl;
      for (let i = 0; i < curl.length; i++) ac[i] = Math.abs(curl[i]);
      for (let j = 2; j < H; j++) {
        for (let i = 2; i < W; i++) {
          const idx = i + j * S;
          if (solid[idx]) continue;
          let nx = 0.5 * (ac[idx + 1] - ac[idx - 1]);
          let ny = 0.5 * (ac[idx + S] - ac[idx - S]);
          const len = Math.sqrt(nx * nx + ny * ny) + 1e-5;
          nx /= len; ny /= len;
          const w = curl[idx];
          this.u[idx] += eps * ny * w * dt;
          this.v[idx] += -eps * nx * w * dt;
        }
      }
    }

    // ---------- the time step ----------

    step() {
      const P = this.params, dt = P.dt;

      // forces
      this.applyForces();
      this.vorticityConfinement();

      // velocity
      if (P.diffuse && P.viscosity > 0) {
        this.u0.set(this.u); this.v0.set(this.v);
        this.diffuseField(1, this.u, this.u0, P.viscosity, false);
        this.diffuseField(2, this.v, this.v0, P.viscosity, false);
      }
      if (P.project) this.project(this.u, this.v, this.p, this.div);
      if (P.advect) {
        this.u0.set(this.u); this.v0.set(this.v);
        this.advectField(1, this.u, this.u0, this.u0, this.v0);
        this.advectField(2, this.v, this.v0, this.u0, this.v0);
      }
      if (P.project) this.project(this.u, this.v, this.p, this.div);
      else { this.setBnd(1, this.u); this.setBnd(2, this.v); }

      // dye and temperature
      const scalars = [[this.r, this.r0], [this.g, this.g0], [this.b, this.b0]];
      const closedBox = P.windX === 0 && P.windY === 0;
      for (const [x, x0] of scalars) {
        if (!this._hasContent(x)) continue;
        if (P.diffuse && P.diffusion > 0) { x0.set(x); this.diffuseField(0, x, x0, P.diffusion, true); }
        if (P.advect) {
          const before = (P.conserveDye && closedBox) ? this._sumInterior(x) : -1;
          x0.set(x); this.advectField(0, x, x0, this.u, this.v);
          if (before >= 0) this._conserve(x, before);
        } else this.setBnd(0, x);
      }
      if (this._hasContent(this.temp, 1e-3)) {
        this.temp0.set(this.temp);
        this.diffuseField(0, this.temp, this.temp0, 0.00005, true);
        if (P.advect) { this.temp0.set(this.temp); this.advectField(0, this.temp, this.temp0, this.u, this.v); }
      }

      // fades
      if (P.dissipation > 0) {
        const k = Math.max(0, 1 - P.dissipation * dt);
        for (let i = 0; i < this.size; i++) { this.r[i] *= k; this.g[i] *= k; this.b[i] *= k; }
      }
      if (P.tempCooling > 0 && this._hasContent(this.temp, 1e-3)) {
        const k = Math.min(1, P.tempCooling * dt), amb = P.ambientTemp;
        for (let i = 0; i < this.size; i++) this.temp[i] += (amb - this.temp[i]) * k;
      }
      this._time = (this._time || 0) + dt;
    }

    // ---------- pattern helpers (same interface as the GPU engine) ----------

    fillBands(colors, band, amount) {
      const W = this.W, H = this.H;
      for (let y = 1; y <= H; y++) {
        const c = colors[Math.floor((y - 1) / band) % colors.length];
        for (let x = 1; x <= W; x++) { const i = this.index(x, y); this.r[i] = c[0] * amount; this.g[i] = c[1] * amount; this.b[i] = c[2] * amount; }
      }
    }
    fillHalves(top, bottom) {
      const W = this.W, H = this.H;
      for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) {
        const i = this.index(x, y), c = y <= H / 2 ? top : bottom;
        this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2];
      }
    }
    comb(axis, waves, phase, amp) {
      const W = this.W, H = this.H;
      for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) {
        const i = this.index(x, y);
        if (axis === 'x') this.u[i] += amp * Math.sin((y / H) * waves * Math.PI * 2 + phase);
        else this.v[i] += amp * Math.sin((x / W) * waves * Math.PI * 2 + phase);
      }
    }
    get isGpu() { return false; }
    get time() { return this._time || 0; }

    // ---------- diagnostics ----------

    curl() { return this.computeCurl(this._curl); }

    speed() {
      const out = this._scratch, u = this.u, v = this.v;
      for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(u[i] * u[i] + v[i] * v[i]);
      return out;
    }

    divergence() {
      const W = this.W, H = this.H, S = this.stride, u = this.u, v = this.v, out = this._scratch;
      out.fill(0);
      for (let j = 1; j <= H; j++) {
        for (let i = 1; i <= W; i++) {
          const idx = i + j * S;
          if (this.solid[idx]) continue;
          out[idx] = 0.5 * (u[idx + 1] - u[idx - 1] + v[idx + S] - v[idx - S]);
        }
      }
      return out;
    }

    totalDye() {
      let t = 0;
      const W = this.W, H = this.H, S = this.stride;
      for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
        const idx = i + j * S;
        t += this.r[idx] + this.g[idx] + this.b[idx];
      }
      return t;
    }

    // 0 = red and blue fully separated, 1 = every cell has the same red:blue ratio
    mixedness() {
      const W = this.W, H = this.H, S = this.stride;
      let wsum = 0, dev = 0;
      for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
        const idx = i + j * S;
        const w = this.r[idx] + this.b[idx];
        if (w < 1e-4) continue;
        const f = this.r[idx] / w;
        wsum += w; dev += w * Math.abs(f - 0.5);
      }
      if (wsum === 0) return 0;
      return Math.max(0, Math.min(1, 1 - 2 * dev / wsum));
    }
  }

  FluidSolver.DEFAULTS = DEFAULTS;

  if (typeof module !== 'undefined' && module.exports) module.exports = { FluidSolver };
  else root.FluidSolver = FluidSolver;
})(typeof window !== 'undefined' ? window : globalThis);
