/*
  GpuFluid — a WebGL2 fluid engine with the same public surface as the CPU FluidSolver
  (fluid.js), so chapters and the Lab can drive either one.

  Coordinates: chapters speak in "reference cells" (refW x refH, e.g. 128 x 80) with y down,
  exactly like the CPU solver. Internally the simulation runs at simW x simH cells
  (quality tier) and the dye at dyeW x dyeH (usually 2x the simulation). Velocity is stored
  in simulation cells per step, y up (GL convention); the API flips y for you.

  Requires WebGL2 + EXT_color_buffer_float. `GpuFluid.supported(canvas)` tells you.
*/
(function (root) {
  'use strict';

  const DEFAULTS = {
    dt: 1, viscosity: 0, diffusion: 0, dissipation: 0, vorticity: 0,
    buoyancy: 0, ambientTemp: 0, tempCooling: 0.02, inkWeight: 0,
    windX: 0, windY: 0, pressureIters: 40, diffuseIters: 8,
    advect: true, project: true, diffuse: true,
    sharpAdvection: true, sharpVelocity: false, conserveDye: true,
  };

  const VERT = `#version 300 es
  precision highp float;
  out vec2 vUv;
  void main() {
    vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

  const HEAD = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 vUv;
  out vec4 o;`;

  const FRAG = {
    copy: HEAD + `
    uniform sampler2D uSrc;
    void main() { o = texture(uSrc, vUv); }`,

    copyScale: HEAD + `
    uniform sampler2D uSrc;
    uniform float uMul;
    void main() { o = texture(uSrc, vUv) * uMul; }`,

    clear: HEAD + `
    uniform vec4 uValue;
    void main() { o = uValue; }`,

    // Adds amount*(1-d^2/r^2) of uColor inside a radius measured in simulation cells.
    splat: HEAD + `
    uniform sampler2D uSrc, uSolid;
    uniform vec2 uPoint, uSize;   // uv center, field size in cells
    uniform float uRadius;        // cells
    uniform vec4 uColor;
    void main() {
      vec4 base = texture(uSrc, vUv);
      if (texture(uSolid, vUv).r > 0.5) { o = base; return; }
      vec2 d = (vUv - uPoint) * uSize;
      float f = max(0.0, 1.0 - dot(d, d) / (uRadius * uRadius));
      o = base + uColor * f;
    }`,

    // A vortex: solid-body core of radius rc, 1/r tail everywhere else.
    vortex: HEAD + `
    uniform sampler2D uSrc, uSolid;
    uniform vec2 uPoint, uSize;
    uniform float uRadius, uStrength;
    void main() {
      vec2 base = texture(uSrc, vUv).xy;
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec2 d = (vUv - uPoint) * uSize;
      float len = length(d);
      if (len < 1e-4) { o = vec4(base, 0.0, 1.0); return; }
      float mag = len < uRadius ? uStrength * (len / uRadius) : uStrength * (uRadius / len);
      vec2 t = vec2(-d.y, d.x) / len;
      o = vec4(base + t * mag, 0.0, 1.0);
    }`,

    // Semi-Lagrangian advection. Velocity in cells/step of the *simulation* grid.
    advect: HEAD + `
    uniform sampler2D uVel, uSrc, uSolid;
    uniform vec2 uSimTexel;
    uniform float uDt, uDecay;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec2 v = texture(uVel, vUv).xy;
      vec2 pos = vUv - uDt * v * uSimTexel;
      if (texture(uSolid, pos).r > 0.5) pos = vUv;
      o = uDecay * texture(uSrc, pos);
    }`,

    // MacCormack corrector: src = original, fwd = advected, bwd = advected back. Clamped to the
    // min/max of the 4 texels around the forward sample point.
    maccormack: HEAD + `
    uniform sampler2D uVel, uSrc, uFwd, uBwd, uSolid;
    uniform vec2 uSimTexel, uSrcTexel;
    uniform float uDt, uDecay;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec2 v = texture(uVel, vUv).xy;
      vec2 pos = vUv - uDt * v * uSimTexel;
      if (texture(uSolid, pos).r > 0.5) pos = vUv;
      vec2 st = pos / uSrcTexel - 0.5;
      vec2 i0 = floor(st);
      vec2 f0 = (i0 + 0.5) * uSrcTexel, f1 = (i0 + 1.5) * uSrcTexel;
      vec4 a = texture(uSrc, vec2(f0.x, f0.y)), b = texture(uSrc, vec2(f1.x, f0.y));
      vec4 c = texture(uSrc, vec2(f0.x, f1.y)), d = texture(uSrc, vec2(f1.x, f1.y));
      vec4 lo = min(min(a, b), min(c, d)), hi = max(max(a, b), max(c, d));
      vec4 fwd = texture(uFwd, vUv);
      vec4 val = fwd + 0.5 * (texture(uSrc, vUv) - texture(uBwd, vUv));
      o = uDecay * clamp(val, lo, hi);
    }`,

    // Velocity boundary conditions: walls (or wind inflow/outflow) on the border, zero inside solids.
    velBoundary: HEAD + `
    uniform sampler2D uVel, uSolid;
    uniform vec2 uSize, uWind;
    void main() {
      vec2 v = texture(uVel, vUv).xy;
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec2 c = floor(vUv * uSize);
      bool wind = (uWind.x != 0.0 || uWind.y != 0.0);
      if (c.x < 1.0) v = wind ? uWind : vec2(0.0, v.y);
      if (c.x > uSize.x - 2.0) { if (!wind) v = vec2(0.0, v.y); }
      if (c.y < 1.0 || c.y > uSize.y - 2.0) v = vec2(v.x, 0.0);
      o = vec4(v, 0.0, 1.0);
    }`,

    curl: HEAD + `
    uniform sampler2D uVel;
    uniform vec2 uTexel;
    void main() {
      float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
      float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
      float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
      float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
      o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,

    // Vorticity confinement, buoyancy, ink weight in one pass.
    forces: HEAD + `
    uniform sampler2D uVel, uCurl, uTemp, uDye, uSolid;
    uniform vec2 uTexel;
    uniform float uVort, uBuoy, uAmbient, uInk, uDt;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec2 v = texture(uVel, vUv).xy;
      if (uVort > 0.0) {
        float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
        float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
        float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
        float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
        float C = texture(uCurl, vUv).x;
        vec2 n = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        n /= length(n) + 1e-5;
        vec2 f = uVort * C * vec2(n.x, -n.y);
        v += f * uDt;
      }
      float t = texture(uTemp, vUv).x;
      if (uBuoy != 0.0) v.y += uBuoy * (t - uAmbient) * uDt;
      if (uInk != 0.0) { vec3 d = texture(uDye, vUv).rgb; v.y -= uInk * (d.r + d.g + d.b) * uDt; }
      o = vec4(v, 0.0, 1.0);
    }`,

    divergence: HEAD + `
    uniform sampler2D uVel, uSolid;
    uniform vec2 uTexel;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
      float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
      float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
      float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
      o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,

    // Jacobi pressure iteration. Solid neighbours and closed walls are Neumann (use centre value);
    // the right edge is a pressure outlet (p = 0) when wind is on.
    jacobi: HEAD + `
    uniform sampler2D uP, uDiv, uSolid;
    uniform vec2 uTexel, uSize;
    uniform float uOutlet;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      float pc = texture(uP, vUv).x;
      vec2 uL = vUv - vec2(uTexel.x, 0.0), uR = vUv + vec2(uTexel.x, 0.0);
      vec2 uB = vUv - vec2(0.0, uTexel.y), uT = vUv + vec2(0.0, uTexel.y);
      float L = texture(uSolid, uL).r > 0.5 ? pc : texture(uP, uL).x;
      float R = texture(uSolid, uR).r > 0.5 ? pc : texture(uP, uR).x;
      float B = texture(uSolid, uB).r > 0.5 ? pc : texture(uP, uB).x;
      float T = texture(uSolid, uT).r > 0.5 ? pc : texture(uP, uT).x;
      if (uOutlet > 0.5 && uR.x > 1.0) R = 0.0;
      float div = texture(uDiv, vUv).x;
      o = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
    }`,

    gradient: HEAD + `
    uniform sampler2D uP, uVel, uSolid;
    uniform vec2 uTexel;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      float pc = texture(uP, vUv).x;
      vec2 uL = vUv - vec2(uTexel.x, 0.0), uR = vUv + vec2(uTexel.x, 0.0);
      vec2 uB = vUv - vec2(0.0, uTexel.y), uT = vUv + vec2(0.0, uTexel.y);
      float L = texture(uSolid, uL).r > 0.5 ? pc : texture(uP, uL).x;
      float R = texture(uSolid, uR).r > 0.5 ? pc : texture(uP, uR).x;
      float B = texture(uSolid, uB).r > 0.5 ? pc : texture(uP, uB).x;
      float T = texture(uSolid, uT).r > 0.5 ? pc : texture(uP, uT).x;
      vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
      o = vec4(v, 0.0, 1.0);
    }`,

    // Implicit diffusion, Jacobi: x = (x0 + a*sum(nb)) / (1 + 4a). Solid neighbours: zero flux.
    diffuse: HEAD + `
    uniform sampler2D uX, uX0, uSolid;
    uniform vec2 uTexel;
    uniform float uA;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      vec4 xc = texture(uX, vUv);
      vec2 uL = vUv - vec2(uTexel.x, 0.0), uR = vUv + vec2(uTexel.x, 0.0);
      vec2 uB = vUv - vec2(0.0, uTexel.y), uT = vUv + vec2(0.0, uTexel.y);
      vec4 L = texture(uSolid, uL).r > 0.5 ? xc : texture(uX, uL);
      vec4 R = texture(uSolid, uR).r > 0.5 ? xc : texture(uX, uR);
      vec4 B = texture(uSolid, uB).r > 0.5 ? xc : texture(uX, uB);
      vec4 T = texture(uSolid, uT).r > 0.5 ? xc : texture(uX, uT);
      o = (texture(uX0, vUv) + uA * (L + R + B + T)) / (1.0 + 4.0 * uA);
    }`,

    // Relax a field toward a target: x += (target - x) * k   (temperature cooling)
    relax: HEAD + `
    uniform sampler2D uSrc;
    uniform float uTarget, uK;
    void main() { vec4 x = texture(uSrc, vUv); o = min(x + (vec4(uTarget) - x) * uK, vec4(1.5)); }`,

    // 2x2 box downsample (reduction pyramid)
    down: HEAD + `
    uniform sampler2D uSrc;
    uniform vec2 uTexel;   // texel size of the *source*
    void main() {
      vec2 c = vUv;
      o = 0.25 * (texture(uSrc, c + uTexel * vec2(-0.5, -0.5)) + texture(uSrc, c + uTexel * vec2(0.5, -0.5))
                + texture(uSrc, c + uTexel * vec2(-0.5, 0.5)) + texture(uSrc, c + uTexel * vec2(0.5, 0.5)));
    }`,

    // scale dye channels by before/after means (mass conservation)
    scale: HEAD + `
    uniform sampler2D uSrc, uBefore, uAfter;
    void main() {
      vec4 b = texture(uBefore, vec2(0.5)), a = texture(uAfter, vec2(0.5));
      vec3 k = clamp(b.rgb / max(a.rgb, vec3(1e-6)), 0.67, 1.5);
      k = mix(vec3(1.0), k, step(vec3(1e-5), b.rgb));
      vec4 s = texture(uSrc, vUv);
      o = vec4(s.rgb * k, s.a);
    }`,

    // |R-B| and R+B for the mixing meter, solids excluded
    mixprep: HEAD + `
    uniform sampler2D uSrc, uSolid;
    void main() {
      vec4 s = texture(uSrc, vUv);
      float w = s.r + s.b;
      if (texture(uSolid, vUv).r > 0.5 || w < 1e-4) { o = vec4(0.0); return; }
      o = vec4(abs(s.r - s.b), w, 0.0, 1.0);
    }`,

    // |field| magnitude prep for the 3D auto-scale: pressure (x) or speed (y)
    magprep: HEAD + `
    uniform sampler2D uP, uVel, uSolid, uMeanP;
    uniform float uMean;
    void main() {
      if (texture(uSolid, vUv).r > 0.5) { o = vec4(0.0); return; }
      float p = texture(uP, vUv).x - texture(uMeanP, vec2(0.5)).x;
      o = vec4(abs(p), length(texture(uVel, vUv).xy), 0.0, 1.0);
    }`,
    encodeMag: HEAD + `
    uniform sampler2D uSrc;
    void main() {
      vec4 s = texture(uSrc, vec2(0.5));
      // pack two magnitudes (0..4) into 16 bits each
      float a = clamp(s.x / 4.0, 0.0, 1.0), b = clamp(s.y / 4.0, 0.0, 1.0);
      o = vec4(floor(a * 255.0) / 255.0, fract(a * 255.0), floor(b * 255.0) / 255.0, fract(b * 255.0));
    }`,

    // encode a 0..1 ratio from a 1x1 float texture into bytes
    encode: HEAD + `
    uniform sampler2D uSrc;
    void main() {
      vec4 s = texture(uSrc, vec2(0.5));
      float m = s.y > 1e-6 ? clamp(1.0 - s.x / s.y, 0.0, 1.0) : 0.0;
      o = vec4(m, fract(m * 255.0), 0.0, 1.0);
    }`,

    // fill: horizontal bands (kind 0), top/bottom halves (kind 1) — colors in uA / uB, band in cells (y down)
    fill: HEAD + `
    uniform vec4 uA, uB, uC, uD;
    uniform vec2 uSize;
    uniform float uKind, uBand, uCount;
    void main() {
      float yDown = (1.0 - vUv.y) * uSize.y;
      float pick = uKind < 0.5 ? mod(floor(yDown / uBand), uCount) : step(uSize.y * 0.5, yDown);
      o = pick < 0.5 ? uA : pick < 1.5 ? uB : pick < 2.5 ? uC : uD;
    }`,

    // wave force (comb): axis 0 -> u += amp*sin(y*freq+phase); axis 1 -> v += amp*sin(x*freq+phase)
    wave: HEAD + `
    uniform sampler2D uSrc;
    uniform float uAxis, uFreq, uPhase, uAmp;
    void main() {
      vec2 v = texture(uSrc, vUv).xy;
      if (uAxis < 0.5) v.x += uAmp * sin(vUv.y * uFreq + uPhase);
      else v.y -= uAmp * sin(vUv.x * uFreq + uPhase);
      o = vec4(v, 0.0, 1.0);
    }`,

    // ---------- display ----------
    // mode 0 ink, 1 speed, 2 curl, 3 pressure. look 0 glow (dark), 1 paper (light).
    display: HEAD + `
    uniform sampler2D uDye, uVel, uCurl, uP, uTemp, uSolid, uBloom, uSolidHi;
    uniform float uMode, uLook, uSpeedScale, uCurlScale, uPScale, uBloomAmt, uDim, uTempGlow;
    uniform vec3 uBg, uStone;
    vec3 inkTone(vec3 c) {
      // hue-preserving soft clip: keep the ratio between channels, compress the peak
      float m = max(c.r, max(c.g, c.b));
      if (m <= 1e-5) return vec3(0.0);
      float k = 1.0 - exp(-3.0 * m);      // filmic exposure: thin ink still reads, thick ink saturates gently
      k = k * (2.0 - k) * 0.5 + k * 0.5;  // light midtone lift
      return c * (k / m);
    }
    void main() {
      float solid = texture(uSolidHi, vUv).r;
      vec3 col;
      if (uMode < 0.5) {
        vec3 d = texture(uDye, vUv).rgb * uDim;
        float t = texture(uTemp, vUv).x;
        if (uTempGlow > 0.5 && t > 0.01) d += vec3(0.9, 0.45, 0.08) * t;
        vec3 ink = inkTone(d);
        if (uLook < 0.5) {
          col = uBg + ink * (1.0 - uBg);
          col += texture(uBloom, vUv).rgb * uBloomAmt;
        } else {
          // ink on paper: subtractive. density darkens the paper toward the ink hue
          float dens = clamp(max(ink.r, max(ink.g, ink.b)) * 1.3, 0.0, 1.0);
          vec3 hue = dens > 1e-4 ? ink / max(ink.r, max(ink.g, ink.b)) : vec3(1.0);
          col = uBg * mix(vec3(1.0), hue * 0.82, dens);
        }
      } else if (uMode < 1.5) {
        vec2 v = texture(uVel, vUv).xy;
        float s = clamp(length(v) / uSpeedScale, 0.0, 1.0);
        vec3 amber = vec3(0.96, 0.62, 0.04);
        col = s < 0.6 ? mix(uBg, amber, s / 0.6) : mix(amber, vec3(1.0), (s - 0.6) / 0.4);
      } else {
        float f = uMode < 2.5 ? texture(uCurl, vUv).x / uCurlScale : texture(uP, vUv).x / uPScale;
        f = clamp(f, -1.0, 1.0);
        vec3 c = f > 0.0 ? vec3(0.98, 0.45, 0.09) : vec3(0.23, 0.51, 0.96);
        col = mix(uBg, c, abs(f));
      }
      col = mix(col, uStone, smoothstep(0.35, 0.65, solid));
      o = vec4(col, 1.0);
    }`,

    // bright pass + blur for bloom (run at quarter resolution)
    bright: HEAD + `
    uniform sampler2D uSrc;
    uniform float uThreshold;
    void main() {
      vec3 c = texture(uSrc, vUv).rgb;
      float m = max(c.r, max(c.g, c.b));
      o = vec4(c * smoothstep(uThreshold, uThreshold + 0.6, m), 1.0);
    }`,

    blur: HEAD + `
    uniform sampler2D uSrc;
    uniform vec2 uDir;   // texel * (1,0) or (0,1)
    void main() {
      vec3 s = texture(uSrc, vUv).rgb * 0.227;
      s += (texture(uSrc, vUv + uDir * 1.385).rgb + texture(uSrc, vUv - uDir * 1.385).rgb) * 0.316;
      s += (texture(uSrc, vUv + uDir * 3.231).rgb + texture(uSrc, vUv - uDir * 3.231).rgb) * 0.070;
      o = vec4(s, 1.0);
    }`,
  };

  // arrows: instanced lines sampling the velocity texture in the vertex shader
  const ARROW_VERT = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  uniform sampler2D uVel;
  uniform vec2 uGridN;      // arrows across / down
  uniform float uScale, uMaxLen;   // clip-space length per cell/step, max length
  uniform vec2 uAspect;     // clip units per texel-ish correction (1, w/h)
  out float vAlpha;
  void main() {
    int id = gl_InstanceID;
    float gx = float(id % int(uGridN.x)), gy = float(id / int(uGridN.x));
    vec2 uv = (vec2(gx, gy) + 0.5) / uGridN;
    vec2 v = texture(uVel, uv).xy;
    float len = length(v);
    vAlpha = smoothstep(0.02, 0.15, len);
    vec2 dir = len > 1e-5 ? v / len : vec2(1.0, 0.0);
    float L = min(uMaxLen, len * uScale);
    vec2 c = uv * 2.0 - 1.0;
    vec2 p;
    int k = gl_VertexID;
    vec2 n = vec2(-dir.y, dir.x);
    vec2 tail = c - dir * L * 0.5 * uAspect, head = c + dir * L * 0.5 * uAspect;
    if (k == 0) p = tail; else if (k == 1) p = head;
    else if (k == 2) p = head; else if (k == 3) p = head - (dir * 0.35 + n * 0.2) * L * uAspect;
    else if (k == 4) p = head; else p = head - (dir * 0.35 - n * 0.2) * L * uAspect;
    gl_Position = vec4(p, 0.0, 1.0);
  }`;
  const ARROW_FRAG = `#version 300 es
  precision highp float;
  in float vAlpha;
  uniform vec4 uColor;
  out vec4 o;
  void main() { o = vec4(uColor.rgb, uColor.a * vAlpha); }`;

  // ---------- 3D "mountains" view: the field drawn as a lit heightfield ----------
  const MOUNT_VERT = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 aUv;
  uniform sampler2D uP, uDye, uVel, uMeanP;
  uniform mat4 uPV;
  uniform float uSrc, uGain, uAspect, uK;
  uniform vec2 uTexel;
  out vec2 vUv; out vec3 vNormal; out float vH;
  float heightAt(vec2 uv) {
    float h;
    if (uSrc < 0.5) h = (texture(uP, uv).x - texture(uMeanP, vec2(0.5)).x) * uGain;
    else if (uSrc < 1.5) { vec3 d = texture(uDye, uv).rgb; float m = max(d.r, max(d.g, d.b)); h = (1.0 - exp(-2.0 * m)) * uGain; }
    else h = length(texture(uVel, uv).xy) / uK * uGain;
    return 0.7 * tanh(h / 0.7);   // soft: big values still grow, but never into cliffs
  }
  void main() {
    vec2 dx = vec2(uTexel.x * 2.0, 0.0), dy = vec2(0.0, uTexel.y * 2.0);
    float h = heightAt(aUv);
    float gx = heightAt(aUv + dx) - heightAt(aUv - dx);
    float gy = heightAt(aUv + dy) - heightAt(aUv - dy);
    vNormal = normalize(vec3(-gx / (4.0 * uTexel.x * 2.0 * uAspect), -gy / (4.0 * uTexel.y * 2.0), 1.0));
    vUv = aUv; vH = h;
    vec3 pos = vec3((aUv.x - 0.5) * 2.0 * uAspect, (aUv.y - 0.5) * 2.0, h);
    gl_Position = uPV * vec4(pos, 1.0);
  }`;
  const MOUNT_FRAG = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 vUv; in vec3 vNormal; in float vH;
  uniform sampler2D uDye, uSolidHi;
  uniform float uSrc;
  uniform vec3 uStone;
  out vec4 o;
  void main() {
    vec3 base;
    vec3 d = texture(uDye, vUv).rgb; float m = max(d.r, max(d.g, d.b));
    if (uSrc < 0.5) {
      float t = clamp(vH / 0.45, -1.0, 1.0);
      vec3 hi = vec3(0.99, 0.55, 0.15), lo = vec3(0.22, 0.5, 0.98), mid = vec3(0.62, 0.58, 0.7);
      base = t > 0.0 ? mix(mid, hi, t) : mix(mid, lo, -t);
      base = mix(base, d / max(m, 1e-3), clamp(m, 0.0, 0.7) * 0.4);
    } else if (uSrc < 1.5) {
      base = m > 2e-3 ? d / m * (0.3 + 0.7 * clamp(m, 0.0, 1.0)) : vec3(0.16, 0.14, 0.2);
    } else {
      float t = clamp(vH / 0.5, 0.0, 1.0);
      base = mix(vec3(0.18, 0.16, 0.28), vec3(1.0, 0.82, 0.25), t);
    }
    float solid = texture(uSolidHi, vUv).r;
    base = mix(base, uStone, smoothstep(0.35, 0.65, solid));
    vec3 L = normalize(vec3(0.45, 0.35, 0.8));
    float diff = max(dot(normalize(vNormal), L), 0.0);
    vec3 col = base * (0.38 + 0.72 * diff);
    float f = vH * 10.0;
    float g = abs(fract(f) - 0.5) / max(fwidth(f), 1e-4);
    float line = 1.0 - smoothstep(0.5, 1.3, g);
    col = mix(col, col * 0.62, line * 0.7);
    o = vec4(col, 1.0);
  }`;

  const M4 = {
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    },
    lookAt(eye, c, up) {
      let zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1];
    },
    mul(a, b) {
      const o = new Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      return o;
    },
    invert(m) {
      const a = m, o = new Array(16);
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
      const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
      const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null; det = 1 / det;
      o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
      o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
      o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
      o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
      o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
      o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
      o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
      o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
      return o;
    },
    apply(m, v) {
      const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
      const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3], w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
      return [x / w, y / w, z / w];
    },
  };

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh) + '\n' + src);
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    const v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uniforms[u.name] = gl.getUniformLocation(p, u.name); }
    return { p, u: uniforms };
  }

  class Target {
    constructor(gl, w, h, internal, format, type, filter) {
      this.gl = gl; this.w = w; this.h = h;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      this.fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete: ' + st);
      this.texel = [1 / w, 1 / h];
    }
    dispose() { this.gl.deleteTexture(this.tex); this.gl.deleteFramebuffer(this.fb); }
  }
  class PingPong {
    constructor(gl, w, h, internal, format, type, filter) {
      this.a = new Target(gl, w, h, internal, format, type, filter);
      this.b = new Target(gl, w, h, internal, format, type, filter);
      this.w = w; this.h = h; this.texel = this.a.texel;
    }
    get read() { return this.a; }
    get write() { return this.b; }
    swap() { const t = this.a; this.a = this.b; this.b = t; }
    dispose() { this.a.dispose(); this.b.dispose(); }
  }

  class GpuFluid {
    static supported(canvas) {
      try {
        const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
        if (!gl) return false;
        if (!gl.getExtension('EXT_color_buffer_float')) return false;
        return true;
      } catch (e) { return false; }
    }

    // refW x refH: the coordinate system chapters use. simWidth: quality tier (cells across).
    constructor(canvas, refW, refH, simWidth, dyeMul) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 unavailable');
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets unavailable');
      this.linearFloat = !!gl.getExtension('OES_texture_float_linear');
      this.gl = gl;
      this.isGpu = true;
      this.params = Object.assign({}, DEFAULTS);
      this.W = refW; this.H = refH;
      this.simW = Math.round(simWidth);
      this.simH = Math.max(8, Math.round(simWidth * refH / refW));
      this.dyeW = Math.round(this.simW * (dyeMul || 2));
      this.dyeH = Math.round(this.simH * (dyeMul || 2));
      this.k = this.simW / refW;              // sim cells per reference cell
      this.time = 0;
      this.frame = 0;
      this._mixed = 0;
      this._mixPending = false;

      this.prog = {};
      for (const k of Object.keys(FRAG)) this.prog[k] = program(gl, VERT, FRAG[k]);
      this.prog.arrows = program(gl, ARROW_VERT, ARROW_FRAG);
      this.prog.mount = program(gl, MOUNT_VERT, MOUNT_FRAG);
      this.vao = gl.createVertexArray();
      this.cam = { yaw: -Math.PI / 2, pitch: 1.0, dist: 3.6 };
      this._hGain = { pressure: null, ink: 1, speed: null };
      this.shapes = [];
      this._buildMesh();

      this._alloc();
      this.solidMask = new Uint8Array(this.simW * this.simH);
      this.solidCount = 0;
      this._solidDirty = true;
      this._maskHi = document.createElement('canvas'); this._maskHi.width = this.dyeW; this._maskHi.height = this.dyeH;
      this._maskSim = document.createElement('canvas'); this._maskSim.width = this.simW; this._maskSim.height = this.simH;
      this._hiCtx = this._maskHi.getContext('2d'); this._simCtx = this._maskSim.getContext('2d', { willReadFrequently: true });
      this._hiDirty = true;
      this.look = 'glow';
      this.bg = [0.055, 0.04, 0.07];
      this.paper = [0.97, 0.95, 0.90];
      this.stone = [0.45, 0.42, 0.40];
    }

    _alloc() {
      const gl = this.gl;
      const HF = gl.HALF_FLOAT, F = gl.FLOAT;
      const L = gl.LINEAR, N = gl.NEAREST;
      const sw = this.simW, sh = this.simH, dw = this.dyeW, dh = this.dyeH;
      this.vel = new PingPong(gl, sw, sh, gl.RG16F, gl.RG, HF, L);
      this.temp = new PingPong(gl, sw, sh, gl.R16F, gl.RED, HF, L);
      this.dye = new PingPong(gl, dw, dh, gl.RGBA16F, gl.RGBA, HF, L);
      this.dyeFwd = new Target(gl, dw, dh, gl.RGBA16F, gl.RGBA, HF, L);
      this.dyeBwd = new Target(gl, dw, dh, gl.RGBA16F, gl.RGBA, HF, L);
      this.velFwd = new Target(gl, sw, sh, gl.RG16F, gl.RG, HF, L);
      this.velBwd = new Target(gl, sw, sh, gl.RG16F, gl.RG, HF, L);
      const PF = this.linearFloat ? L : N;   // linear float sampling makes the 3D surface smooth; the solver samples texel centres either way
      this.pressure = new PingPong(gl, sw, sh, gl.R32F, gl.RED, F, PF);
      this.div = new Target(gl, sw, sh, gl.R32F, gl.RED, F, N);
      this.curlT = new Target(gl, sw, sh, gl.R16F, gl.RED, HF, L);
      this.solidT = new Target(gl, sw, sh, gl.R8, gl.RED, gl.UNSIGNED_BYTE, N);        // solver occupancy (coarse, conservative)
      this.solidHiT = new Target(gl, dw, dh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, L);   // display silhouette (ink resolution, antialiased)
      this.scratchD = new Target(gl, dw, dh, gl.RGBA16F, gl.RGBA, HF, L);
      // reduction pyramids (two: before / after) down to 1x1
      this.pyrA = this._pyramid(dw, dh);
      this.pyrB = this._pyramid(dw, dh);
      this.encodeT = new Target(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, N);
      // bloom at half res (proper 2x2 downsample first, so fine ink doesn't alias into grain)
      this.bloomHalf = new Target(gl, Math.max(4, dw >> 1), Math.max(4, dh >> 1), gl.RGBA16F, gl.RGBA, HF, L);
      this.bloomA = new Target(gl, this.bloomHalf.w, this.bloomHalf.h, gl.RGBA16F, gl.RGBA, HF, L);
      this.bloomB = new Target(gl, this.bloomHalf.w, this.bloomHalf.h, gl.RGBA16F, gl.RGBA, HF, L);
    }

    _pyramid(w, h) {
      const gl = this.gl, levels = [];
      while (w > 1 || h > 1) {
        w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2));
        levels.push(new Target(gl, w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST));
      }
      return levels;
    }

    // ---------- drawing helpers ----------

    _use(name) {
      const pr = this.prog[name];
      this.gl.useProgram(pr.p);
      this._unit = 0;
      return pr;
    }
    _tex(pr, uname, tex) {
      const gl = this.gl, unit = this._unit++;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(pr.u[uname], unit);
    }
    _draw(target) {
      const gl = this.gl;
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); }
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    _copy(src, dst) { const pr = this._use('copy'); this._tex(pr, 'uSrc', src.tex); this._draw(dst); }
    _clear(target, v) { const pr = this._use('clear'); this.gl.uniform4f(pr.u.uValue, v[0], v[1], v[2], v[3]); this._draw(target); }

    _syncSolids() {
      if (!this._solidDirty) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.solidT.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simW, this.simH, gl.RED, gl.UNSIGNED_BYTE, this.solidMask);
      let n = 0; for (let i = 0; i < this.solidMask.length; i++) if (this.solidMask[i]) n++;
      this.solidCount = n;
      this._solidDirty = false;
      if (this._hiDirty) {
        gl.bindTexture(gl.TEXTURE_2D, this.solidHiT.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this._maskHi);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this._hiDirty = false;
      }
    }

    // ---------- obstacles as geometry, rasterized twice ----------
    // Shapes live in reference cells (y down). The display mask is antialiased at ink resolution; the
    // solver mask is a conservative bitmap at simulation resolution (walls grow by half a cell).
    _paintShape(ctx, scale, sh, pad) {
      ctx.globalCompositeOperation = sh.erase ? 'destination-out' : 'source-over';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const X = (x) => (x - 0.5) * scale, Y = (y) => (y - 0.5) * scale;
      const grow = sh.erase ? 0 : pad;
      if (sh.kind === 'circle') { ctx.beginPath(); ctx.arc(X(sh.x), Y(sh.y), Math.max(0.5, sh.r * scale + grow), 0, Math.PI * 2); ctx.fill(); }
      else if (sh.kind === 'rect') { ctx.fillRect(X(sh.x0) - grow, Y(sh.y0) - grow, (sh.x1 - sh.x0) * scale + 2 * grow, (sh.y1 - sh.y0) * scale + 2 * grow); }
      else if (sh.kind === 'capsule') { ctx.lineWidth = Math.max(1, 2 * sh.r * scale + 2 * grow); ctx.beginPath(); ctx.moveTo(X(sh.x0), Y(sh.y0)); ctx.lineTo(X(sh.x1), Y(sh.y1)); ctx.stroke(); }
      else if (sh.kind === 'poly') {
        ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.closePath(); ctx.fill();
        if (grow > 0) { ctx.lineWidth = 2 * grow; ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    _addShape(sh) {
      this.shapes.push(sh);
      this._paintShape(this._hiCtx, this.dyeW / this.W, sh, 0);
      this._paintShape(this._simCtx, this.simW / this.W, sh, 0.5);
      this._readSimMask();
      this._hiDirty = true; this._solidDirty = true;
    }
    _readSimMask() {
      const px = this._simCtx.getImageData(0, 0, this.simW, this.simH).data;
      const W = this.simW, H = this.simH, m = this.solidMask;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[x + (H - 1 - y) * W] = px[(y * W + x) * 4 + 3] > 127 ? 255 : 0;
    }
    _replayShapes() {
      const list = this.shapes; this.shapes = [];
      this._hiCtx.clearRect(0, 0, this.dyeW, this.dyeH); this._simCtx.clearRect(0, 0, this.simW, this.simH);
      for (const sh of list) this._addShape(sh);
    }
    addSolidStroke(x0, y0, x1, y1, r, on) { this._addShape({ kind: 'capsule', x0, y0, x1, y1, r: Math.max(r, 0.5), erase: !on }); }
    addSolidPolygon(pts, on) { if (pts.length > 2) this._addShape({ kind: 'poly', pts: pts.map((q) => [q[0], q[1]]), erase: !on }); }

    // reference (x, y down) -> uv
    _uv(x, y) { return [(x - 0.5) / this.W, 1 - (y - 0.5) / this.H]; }

    // ---------- public API (reference units, y down) ----------

    _splat(pp, x, y, radius, color) {
      this._syncSolids();
      const gl = this.gl, pr = this._use('splat');
      const uv = this._uv(x, y);
      this._tex(pr, 'uSrc', pp.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uPoint, uv[0], uv[1]);
      gl.uniform2f(pr.u.uSize, this.W, this.H);            // distances measured in reference cells
      gl.uniform1f(pr.u.uRadius, Math.max(radius, 0.5));
      gl.uniform4f(pr.u.uColor, color[0], color[1], color[2], color[3]);
      this._draw(pp.write); pp.swap();
    }
    addDye(x, y, radius, r, g, b, amount) { this._splat(this.dye, x, y, radius, [r * amount, g * amount, b * amount, 0]); }
    // du, dv in reference cells per step (y down) -> sim cells per step (y up)
    addVelocity(x, y, radius, du, dv) { this._splat(this.vel, x, y, radius, [du * this.k, -dv * this.k, 0, 0]); }
    addHeat(x, y, radius, amount) { this._hasHeat = true; this._splat(this.temp, x, y, radius, [amount, 0, 0, 0]); }

    addVortex(x, y, radius, strength) {
      this._syncSolids();
      const gl = this.gl, pr = this._use('vortex');
      const uv = this._uv(x, y);
      this._tex(pr, 'uSrc', this.vel.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uPoint, uv[0], uv[1]);
      gl.uniform2f(pr.u.uSize, this.W, this.H);
      gl.uniform1f(pr.u.uRadius, Math.max(radius, 1));
      // screen-space positive curl (CPU convention) is clockwise on screen = negative in GL (y up)
      gl.uniform1f(pr.u.uStrength, -strength * this.k);
      this._draw(this.vel.write); this.vel.swap();
    }

    setSolid(cx, cy, radius, on) { this._addShape({ kind: 'circle', x: cx, y: cy, r: Math.max(radius, 0.5), erase: !on }); }
    setSolidCell(x, y, on) { this._addShape({ kind: 'rect', x0: x - 0.5, y0: y - 0.5, x1: x + 0.5, y1: y + 0.5, erase: !on }); }
    // Fill the whole velocity field (reference cells/step, y down). Used to start a wind tunnel already blowing.
    setUniformFlow(u, v) { this._clear(this.vel.read, [u * this.k, -v * this.k, 0, 0]); this._clear(this.pressure.read, [0, 0, 0, 0]); }
    clearSolids() {
      this.shapes = []; this.solidMask.fill(0);
      this._hiCtx.clearRect(0, 0, this.dyeW, this.dyeH); this._simCtx.clearRect(0, 0, this.simW, this.simH);
      this._hiDirty = true; this._solidDirty = true;
    }
    clearDye() { this._clear(this.dye.read, [0, 0, 0, 0]); }
    clearVelocity() { this._clear(this.vel.read, [0, 0, 0, 0]); this._clear(this.pressure.read, [0, 0, 0, 0]); }
    clearHeat() { this._clear(this.temp.read, [0, 0, 0, 0]); }
    reset() { this.clearDye(); this.clearVelocity(); this.clearHeat(); this.clearSolids(); this.time = 0; this._mixed = 0; }

    // colors as [r,g,b]; band in reference cells
    // colors: array of 2..4 [r,g,b]; band height in reference cells
    fillBands(colors, band, amount) {
      const gl = this.gl, pr = this._use('fill');
      const names = ['uA', 'uB', 'uC', 'uD'];
      for (let i = 0; i < 4; i++) { const c = colors[Math.min(i, colors.length - 1)]; gl.uniform4f(pr.u[names[i]], c[0] * amount, c[1] * amount, c[2] * amount, 0); }
      gl.uniform2f(pr.u.uSize, this.W, this.H);
      gl.uniform1f(pr.u.uKind, 0); gl.uniform1f(pr.u.uBand, band); gl.uniform1f(pr.u.uCount, Math.min(4, colors.length));
      this._draw(this.dye.read);
    }
    fillHalves(top, bottom) {
      const gl = this.gl, pr = this._use('fill');
      gl.uniform4f(pr.u.uA, top[0], top[1], top[2], 0);
      gl.uniform4f(pr.u.uB, bottom[0], bottom[1], bottom[2], 0);
      gl.uniform4f(pr.u.uC, 0, 0, 0, 0); gl.uniform4f(pr.u.uD, 0, 0, 0, 0);
      gl.uniform2f(pr.u.uSize, this.W, this.H);
      gl.uniform1f(pr.u.uKind, 1); gl.uniform1f(pr.u.uBand, 1); gl.uniform1f(pr.u.uCount, 2);
      this._draw(this.dye.read);
    }
    // comb: axis 'x' pushes sideways in bands along y; waves per field, amp in reference cells/step
    comb(axis, waves, phase, amp) {
      const gl = this.gl, pr = this._use('wave');
      this._tex(pr, 'uSrc', this.vel.read.tex);
      gl.uniform1f(pr.u.uAxis, axis === 'x' ? 0 : 1);
      gl.uniform1f(pr.u.uFreq, waves * Math.PI * 2);
      gl.uniform1f(pr.u.uPhase, phase);
      gl.uniform1f(pr.u.uAmp, amp * this.k);
      this._draw(this.vel.write); this.vel.swap();
    }

    mixedness() { return this._mixed; }

    // Inherit another engine's state (same GL context): fields are stretched onto the new grid,
    // velocity rescaled to the new cell size, obstacle geometry replayed.
    copyFrom(other) {
      const gl = this.gl;
      const stretch = (src, dst, mul) => {
        const pr = this._use('copyScale');
        this._tex(pr, 'uSrc', src.tex); gl.uniform1f(pr.u.uMul, mul);
        this._draw(dst);
      };
      stretch(other.dye.read, this.dye.read, 1);
      stretch(other.temp.read, this.temp.read, 1);
      stretch(other.vel.read, this.vel.read, this.k / other.k);
      stretch(other.pressure.read, this.pressure.read, 1);
      this.shapes = [];
      this._hiCtx.clearRect(0, 0, this.dyeW, this.dyeH); this._simCtx.clearRect(0, 0, this.simW, this.simH);
      for (const sh of other.shapes) this._addShape(sh);
      this.cam = Object.assign({}, other.cam);
      this._hGain = Object.assign({}, other._hGain);
      this.time = other.time; this.frame = other.frame; this._mixed = other._mixed; this._hasHeat = other._hasHeat;
    }

    // ---------- the step ----------

    _advect(field, sharp, decay, fwd, bwd) {
      const gl = this.gl, P = this.params;
      const dt = P.dt;
      let pr = this._use('advect');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSrc', field.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uSimTexel, 1 / this.simW, 1 / this.simH);
      gl.uniform1f(pr.u.uDt, dt); gl.uniform1f(pr.u.uDecay, sharp ? 1 : decay);
      if (!sharp) { this._draw(field.write); field.swap(); return; }
      this._draw(fwd);
      // backward
      pr = this._use('advect');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSrc', fwd.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uSimTexel, 1 / this.simW, 1 / this.simH);
      gl.uniform1f(pr.u.uDt, -dt); gl.uniform1f(pr.u.uDecay, 1);
      this._draw(bwd);
      pr = this._use('maccormack');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSrc', field.read.tex);
      this._tex(pr, 'uFwd', fwd.tex); this._tex(pr, 'uBwd', bwd.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uSimTexel, 1 / this.simW, 1 / this.simH);
      gl.uniform2f(pr.u.uSrcTexel, field.texel[0], field.texel[1]);
      gl.uniform1f(pr.u.uDt, dt); gl.uniform1f(pr.u.uDecay, decay);
      this._draw(field.write); field.swap();
    }

    _diffuse(field, rate, iters) {
      // a = dt * rate * refW * refH  (CPU convention, in reference cells^2) -> sim cells: * k^2 for sim fields
      const gl = this.gl, P = this.params;
      const cells = field.w * field.h;
      const a = P.dt * rate * cells;
      if (a <= 0) return;
      // x0 = current field (copy), iterate x
      this._copy(field.read, this.scratchD.w === field.w ? this.scratchD : this._scratchFor(field));
      const x0 = this.scratchD.w === field.w ? this.scratchD : this._scratchFor(field);
      for (let i = 0; i < iters; i++) {
        const pr = this._use('diffuse');
        this._tex(pr, 'uX', field.read.tex); this._tex(pr, 'uX0', x0.tex); this._tex(pr, 'uSolid', this.solidT.tex);
        gl.uniform2f(pr.u.uTexel, field.texel[0], field.texel[1]);
        gl.uniform1f(pr.u.uA, a);
        this._draw(field.write); field.swap();
      }
    }
    _scratchFor(field) {
      if (!this._scratchSim) this._scratchSim = new Target(this.gl, this.simW, this.simH, this.gl.RGBA16F, this.gl.RGBA, this.gl.HALF_FLOAT, this.gl.LINEAR);
      return this._scratchSim;
    }

    _fade(field, k) {
      const gl = this.gl, pr = this._use('advect');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSrc', field.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uSimTexel, 0, 0); gl.uniform1f(pr.u.uDt, 0); gl.uniform1f(pr.u.uDecay, k);
      this._draw(field.write); field.swap();
    }

    _velBoundary() {
      const gl = this.gl, P = this.params, pr = this._use('velBoundary');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uSize, this.simW, this.simH);
      gl.uniform2f(pr.u.uWind, P.windX * this.k, -P.windY * this.k);
      this._draw(this.vel.write); this.vel.swap();
    }

    _project() {
      const gl = this.gl, P = this.params;
      const wind = P.windX !== 0 || P.windY !== 0;
      let pr = this._use('divergence');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
      this._draw(this.div);
      // warm start from last pressure
      for (let i = 0; i < P.pressureIters; i++) {
        pr = this._use('jacobi');
        this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uDiv', this.div.tex); this._tex(pr, 'uSolid', this.solidT.tex);
        gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
        gl.uniform2f(pr.u.uSize, this.simW, this.simH);
        gl.uniform1f(pr.u.uOutlet, wind ? 1 : 0);
        this._draw(this.pressure.write); this.pressure.swap();
      }
      pr = this._use('gradient');
      this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
      this._draw(this.vel.write); this.vel.swap();
      this._velBoundary();
    }

    _reduce(src, pyr) {
      const gl = this.gl;
      let from = src;
      for (const lvl of pyr) {
        const pr = this._use('down');
        this._tex(pr, 'uSrc', from.tex);
        gl.uniform2f(pr.u.uTexel, 1 / from.w, 1 / from.h);
        this._draw(lvl);
        from = lvl;
      }
      return from;
    }

    step() {
      const gl = this.gl, P = this.params, dt = P.dt;
      gl.disable(gl.BLEND);
      this._syncSolids();
      const closed = P.windX === 0 && P.windY === 0;

      // forces (vorticity confinement, buoyancy, ink weight)
      if (P.vorticity > 0 || P.buoyancy !== 0 || P.inkWeight !== 0) {
        if (P.vorticity > 0) {
          const pr = this._use('curl');
          this._tex(pr, 'uVel', this.vel.read.tex);
          gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
          this._draw(this.curlT);
        }
        const pr = this._use('forces');
        this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uCurl', this.curlT.tex); this._tex(pr, 'uTemp', this.temp.read.tex);
        this._tex(pr, 'uDye', this.dye.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
        gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
        gl.uniform1f(pr.u.uVort, P.vorticity * this.k); gl.uniform1f(pr.u.uBuoy, P.buoyancy * this.k);
        gl.uniform1f(pr.u.uAmbient, P.ambientTemp); gl.uniform1f(pr.u.uInk, P.inkWeight * this.k); gl.uniform1f(pr.u.uDt, dt);
        this._draw(this.vel.write); this.vel.swap();
      }

      if (P.diffuse && P.viscosity > 0) this._diffuse(this.vel, P.viscosity, P.diffuseIters);
      this._velBoundary();
      if (P.advect) this._advect(this.vel, P.sharpVelocity, 1, this.velFwd, this.velBwd);
      if (P.project) this._project(); else this._velBoundary();

      // dye
      let before = null;
      if (P.conserveDye && closed && P.advect) before = this._reduce(this.dye.read, this.pyrA);
      if (P.diffuse && P.diffusion > 0) this._diffuse(this.dye, P.diffusion, P.diffuseIters);
      const decay = Math.max(0, 1 - P.dissipation * dt);
      if (P.advect) this._advect(this.dye, P.sharpAdvection, before ? 1 : decay, this.dyeFwd, this.dyeBwd);
      if (before) {
        const after = this._reduce(this.dye.read, this.pyrB);
        const pr = this._use('scale');
        this._tex(pr, 'uSrc', this.dye.read.tex); this._tex(pr, 'uBefore', before.tex); this._tex(pr, 'uAfter', after.tex);
        this._draw(this.dye.write); this.dye.swap();
      }
      if (decay < 1 && (before || !P.advect)) this._fade(this.dye, decay);

      // temperature
      if (P.buoyancy !== 0 || this._hasHeat) {
        if (P.advect) this._advect(this.temp, false, 1, null, null);
        const pr = this._use('relax');
        this._tex(pr, 'uSrc', this.temp.read.tex);
        gl.uniform1f(pr.u.uTarget, P.ambientTemp); gl.uniform1f(pr.u.uK, Math.min(1, P.tempCooling * dt));
        this._draw(this.temp.write); this.temp.swap();
      }

      this.time += dt;
      this.frame++;
    }
    set hasHeat(v) { this._hasHeat = v; }

    // Mixing meter: cheap 1x1 readback, call every few frames.
    updateMixedness() {
      const gl = this.gl;
      let pr = this._use('mixprep');
      this._tex(pr, 'uSrc', this.dye.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      this._draw(this.scratchD);
      const top = this._reduce(this.scratchD, this.pyrB);
      pr = this._use('encode');
      this._tex(pr, 'uSrc', top.tex);
      this._draw(this.encodeT);
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      this._mixed = (px[0] + px[1] / 255) / 255;
      return this._mixed;
    }

    // ---------- display ----------

    render(opts) {
      const gl = this.gl, P = this.params;
      if (opts.view === 'mountains') { this._syncSolids(); this.renderMountains(opts); return; }
      const mode = { dye: 0, arrows: 0, grid: 0, speed: 1, curl: 2, pressure: 3 }[opts.view] || 0;
      const glow = this.look === 'glow';
      this._syncSolids();
      if (mode === 0 && glow && opts.bloom !== false) {
        let pr = this._use('down');
        this._tex(pr, 'uSrc', this.dye.read.tex); gl.uniform2f(pr.u.uTexel, this.dye.texel[0], this.dye.texel[1]);
        this._draw(this.bloomHalf);
        pr = this._use('bright');
        this._tex(pr, 'uSrc', this.bloomHalf.tex); gl.uniform1f(pr.u.uThreshold, 0.55);
        this._draw(this.bloomA);
        pr = this._use('blur'); this._tex(pr, 'uSrc', this.bloomA.tex); gl.uniform2f(pr.u.uDir, this.bloomA.texel[0], 0); this._draw(this.bloomB);
        pr = this._use('blur'); this._tex(pr, 'uSrc', this.bloomB.tex); gl.uniform2f(pr.u.uDir, 0, this.bloomA.texel[1]); this._draw(this.bloomA);
      }
      if (mode === 2) { const c = this._use('curl'); this._tex(c, 'uVel', this.vel.read.tex); gl.uniform2f(c.u.uTexel, this.vel.texel[0], this.vel.texel[1]); this._draw(this.curlT); }
      const pr = this._use('display');
      this._tex(pr, 'uDye', this.dye.read.tex); this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uCurl', this.curlT.tex);
      this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uTemp', this.temp.read.tex); this._tex(pr, 'uSolid', this.solidT.tex);
      this._tex(pr, 'uBloom', this.bloomA.tex); this._tex(pr, 'uSolidHi', this.solidHiT.tex);
      gl.uniform1f(pr.u.uMode, mode);
      gl.uniform1f(pr.u.uLook, glow ? 0 : 1);
      gl.uniform1f(pr.u.uSpeedScale, (opts.speedScale || 1.5) * this.k);
      gl.uniform1f(pr.u.uCurlScale, 0.25 * this.k);
      gl.uniform1f(pr.u.uPScale, 0.6 * this.k);
      gl.uniform1f(pr.u.uBloomAmt, (mode === 0 && glow && opts.bloom !== false) ? 0.7 : 0);
      gl.uniform1f(pr.u.uDim, opts.view === 'arrows' ? 0.6 : 1);
      gl.uniform1f(pr.u.uTempGlow, opts.tempGlow === false ? 0 : 1);
      const bg = glow ? this.bg : this.paper;
      gl.uniform3f(pr.u.uBg, bg[0], bg[1], bg[2]);
      const st = glow ? this.stone : [0.55, 0.5, 0.47];
      gl.uniform3f(pr.u.uStone, st[0], st[1], st[2]);
      this._draw(null);

      if (opts.view === 'arrows') this.renderArrows(opts.arrowsAcross || 32);
    }

    _buildMesh() {
      const gl = this.gl;
      const nx = 128, ny = Math.max(8, Math.round(128 * this.H / this.W));
      const verts = new Float32Array((nx + 1) * (ny + 1) * 2);
      let k = 0;
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { verts[k++] = i / nx; verts[k++] = j / ny; }
      const idx = new Uint32Array(nx * ny * 6);
      k = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = i + j * (nx + 1), b = a + 1, c = a + nx + 1, d = c + 1;
        idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
      }
      this.meshVao = gl.createVertexArray();
      gl.bindVertexArray(this.meshVao);
      this.meshVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.prog.mount.p, 'aUv');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.meshIbo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIbo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.meshCount = idx.length;
    }

    _cameraMatrix() {
      const c = this.cam, aspect = this.canvas.width / this.canvas.height;
      const pitch = Math.min(1.45, Math.max(0.25, c.pitch));
      const eye = [Math.cos(pitch) * Math.cos(c.yaw) * c.dist, Math.cos(pitch) * Math.sin(c.yaw) * c.dist, Math.sin(pitch) * c.dist];
      const view = M4.lookAt(eye, [0, 0, 0.05], [0, 0, 1]);
      const proj = M4.perspective(0.75, aspect, 0.1, 20);
      this._pv = M4.mul(proj, view);
      return this._pv;
    }

    // Map a pointer (NDC -1..1) to reference cells by intersecting the camera ray with the flat water plane.
    pick(nx, ny) {
      const pv = this._pv || this._cameraMatrix();
      const inv = M4.invert(pv);
      if (!inv) return null;
      const a = M4.apply(inv, [nx, ny, -1, 1]), b = M4.apply(inv, [nx, ny, 1, 1]);
      const dz = b[2] - a[2];
      if (Math.abs(dz) < 1e-6) return null;
      const t = -a[2] / dz;
      if (t < 0) return null;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const aspect = this.W / this.H;
      const u = x / (2 * aspect) + 0.5, v = y / 2 + 0.5;
      return { x: u * this.W + 0.5, y: (1 - v) * this.H + 0.5, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
    }

    renderMountains(opts) {
      const gl = this.gl, P = this.params;
      const which = opts.height || 'pressure';
      const src = { pressure: 0, ink: 1, speed: 2 }[which];
      const mean = src === 0 ? this._reduce(this.pressure.read, this.pyrB) : null;
      // auto-scale: every few frames read back the mean |pressure| and mean speed (one pixel) and ease the gain
      this._magTick = (this._magTick || 0) + 1;
      if (src !== 1 && (this._magTick % 6 === 1 || this._hGain[which] == null)) {
        let m = this._use('magprep');
        this._tex(m, 'uP', this.pressure.read.tex); this._tex(m, 'uVel', this.vel.read.tex); this._tex(m, 'uSolid', this.solidT.tex);
        this._tex(m, 'uMeanP', (mean || this.pressure.read).tex);
        gl.uniform1f(m.u.uMean, 0);
        const scratch = this._scratchFor(this.vel);
        this._draw(scratch);
        const top = this._reduce(scratch, this.pyrA);
        m = this._use('encodeMag'); this._tex(m, 'uSrc', top.tex); this._draw(this.encodeT);
        const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const meanP = (px[0] + px[1] / 255) / 255 * 4, meanV = (px[2] + px[3] / 255) / 255 * 4;
        const target = src === 0 ? 0.16 / Math.max(meanP, 1e-3) : 0.3 / Math.max(meanV, 1e-3);
        const cur = this._hGain[which];
        this._hGain[which] = cur == null ? target : cur + (target - cur) * 0.15;
      }
      const pr = this.prog.mount;
      gl.useProgram(pr.p);
      this._unit = 0;
      this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uDye', this.dye.read.tex); this._tex(pr, 'uVel', this.vel.read.tex);
      this._tex(pr, 'uMeanP', (mean || this.pressure.read).tex); this._tex(pr, 'uSolidHi', this.solidHiT.tex);
      gl.uniformMatrix4fv(pr.u.uPV, false, new Float32Array(this._cameraMatrix()));
      gl.uniform1f(pr.u.uSrc, src);
      const gain = (src === 1 ? 0.5 : Math.min(this._hGain[which] || 1, 400)) * (opts.heightGain || 1);
      gl.uniform1f(pr.u.uGain, gain);
      gl.uniform1f(pr.u.uAspect, this.W / this.H);
      gl.uniform1f(pr.u.uK, this.k);
      gl.uniform2f(pr.u.uTexel, this.vel.texel[0], this.vel.texel[1]);
      const st = this.look === 'glow' ? this.stone : [0.55, 0.5, 0.47];
      gl.uniform3f(pr.u.uStone, st[0], st[1], st[2]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const bg = this.look === 'glow' ? this.bg : this.paper;
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.bindVertexArray(this.meshVao);
      gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(this.vao);
      gl.disable(gl.DEPTH_TEST);
    }

    renderArrows(across) {
      const gl = this.gl, pr = this.prog.arrows;
      gl.useProgram(pr.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.vel.read.tex); gl.uniform1i(pr.u.uVel, 0);
      const down = Math.max(2, Math.round(across * this.simH / this.simW));
      gl.uniform2f(pr.u.uGridN, across, down);
      const cell = 2 / across;                       // clip width of one arrow cell
      gl.uniform1f(pr.u.uScale, cell * 0.45 / this.k);  // per reference cell/step
      gl.uniform1f(pr.u.uMaxLen, cell * 1.1);
      gl.uniform2f(pr.u.uAspect, 1, this.canvas.width / this.canvas.height);
      gl.uniform4f(pr.u.uColor, 1, 1, 1, 0.85);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.LINES, 0, 6, across * down);
      gl.disable(gl.BLEND);
    }

    dispose() {
      for (const t of [this.vel, this.temp, this.dye, this.pressure]) t.dispose();
      for (const t of [this.dyeFwd, this.dyeBwd, this.velFwd, this.velBwd, this.div, this.curlT, this.solidT, this.scratchD, this.encodeT, this.bloomHalf, this.bloomA, this.bloomB]) t.dispose();
      for (const t of this.pyrA) t.dispose(); for (const t of this.pyrB) t.dispose();
      if (this._scratchSim) this._scratchSim.dispose();
      this.solidHiT.dispose();
      const gl = this.gl;
      for (const k of Object.keys(this.prog)) gl.deleteProgram(this.prog[k].p);
      gl.deleteVertexArray(this.vao); gl.deleteVertexArray(this.meshVao);
      gl.deleteBuffer(this.meshVbo); gl.deleteBuffer(this.meshIbo);
    }
  }

  GpuFluid.DEFAULTS = DEFAULTS;
  root.GpuFluid = GpuFluid;
})(window);
