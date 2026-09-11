/*
  VolumeFluid — a real 3D grid fluid (smoke) on the GPU, WebGL2.

  The N x N x N volume is a 2D texture atlas of N slices (TX x TY tiles), so plain fragment
  passes do 3D work. Fields: velocity (RGBA16F xyz), smoke (RGBA16F: rgb tint * density, a = density),
  temperature (R16F), pressure (R32F), divergence (R32F), curl (RGBA16F xyz + magnitude).
  Steps per tick: advect velocity, curl + confinement + buoyancy, boundaries (walls, inflow, outlet
  sponge, speed cap), divergence, Jacobi pressure, gradient subtraction, advect smoke and heat,
  then the spark particles (a P x P RGBA32F texture: position + life) ride the velocity field.
  Rendering: half-resolution raymarch with a 3-sample shadow ray, fire emission from temperature,
  obstacles as signed-distance shapes (ball, column, wall with a hole), an optional cross-section
  ("cut it open") that shows the boxes, sky gradient, floor grid and the box outline; sparks are
  drawn as additive points on top. Orbit camera; picking on the plane through the centre facing
  the camera. Coordinates: x right, y up, z toward the viewer at yaw 0. Units: cells, cells/step.
*/
(function (root) {
  'use strict';

  const DEFAULTS = {
    dt: 1, buoyancy: 0.08, vorticity: 0.35, dissipation: 0.008, tempCooling: 0.03,
    windX: 0, pressureIters: 24, maxSpeed: 3, smokeWeight: 0,
    shape: 0,             // 0 none, 1 ball, 2 column, 3 wall with a hole
    shapeSize: 9,         // radius in reference cells (64-cube)
  };

  const VERT = `#version 300 es
  precision highp float;
  out vec2 vUv;
  void main() {
    vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

  const COMMON = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 vUv;
  out vec4 o;
  const float N = __N__.0;
  const int NI = __N__;
  const int TX = __TX__;
  const vec2 ATLAS = vec2(__AW__.0, __AH__.0);
  uniform float uShape, uShapeR;
  uniform vec3 uShapeC;
  ivec3 cellOf() {
    ivec2 a = ivec2(gl_FragCoord.xy);
    int tx = a.x / NI, ty = a.y / NI;
    return ivec3(a.x - tx * NI, a.y - ty * NI, ty * TX + tx);
  }
  bool inBox(ivec3 c) { return c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < NI && c.y < NI && c.z < NI; }
  // signed distance to the obstacle in cells (negative inside)
  float sdf(vec3 p) {
    if (uShape < 0.5) return 1e5;
    if (uShape < 1.5) return distance(p, uShapeC) - uShapeR;
    if (uShape < 2.5) return distance(p.xz, uShapeC.xz) - uShapeR;
    // wall at x = C.x with a round hole: solid where thick slab and outside the hole radius
    float slab = abs(p.x - uShapeC.x) - 1.6;
    float hole = uShapeR - distance(p.yz, uShapeC.yz);
    return max(slab, hole);
  }
  bool isSolid(vec3 p) { return sdf(p) < 0.0; }
  bool isSolidC(ivec3 c) { return isSolid(vec3(c) + 0.5); }
  ivec2 atlasTexel(ivec3 c) { int tx = c.z % TX, ty = c.z / TX; return ivec2(tx * NI + c.x, ty * NI + c.y); }
  vec4 fetch(sampler2D t, ivec3 c) { return texelFetch(t, atlasTexel(c), 0); }
  vec4 fetchC(sampler2D t, ivec3 c) { return fetch(t, clamp(c, ivec3(0), ivec3(NI - 1))); }
  vec2 tileUV(int z, vec2 xy) { int tx = z % TX, ty = z / TX; return (vec2(tx * NI, ty * NI) + xy) / ATLAS; }
  vec4 sampleTri(sampler2D t, vec3 p) {
    p = clamp(p, vec3(0.5), vec3(N - 0.5));
    float zf = p.z - 0.5;
    float z0 = clamp(floor(zf), 0.0, N - 2.0);
    float fz = clamp(zf - z0, 0.0, 1.0);
    int iz = int(z0);
    return mix(texture(t, tileUV(iz, p.xy)), texture(t, tileUV(iz + 1, p.xy)), fz);
  }`;

  const FRAG = {
    clear: `uniform vec4 uValue; void main() { o = uValue; }`,

    splat: `uniform sampler2D uSrc; uniform vec3 uPoint; uniform float uRadius; uniform vec4 uAmount;
    void main() {
      ivec3 c = cellOf(); vec4 base = texture(uSrc, vUv);
      if (c.z >= NI) { o = base; return; }
      vec3 p = vec3(c) + 0.5;
      if (isSolid(p)) { o = base; return; }
      float d2 = dot(p - uPoint, p - uPoint);
      float f = max(0.0, 1.0 - d2 / (uRadius * uRadius));
      o = base + uAmount * f;
    }`,

    // a spinning column of air (tornado) or a ring push (smoke ring launcher)
    swirl: `uniform sampler2D uSrc; uniform vec3 uPoint; uniform float uRadius, uSpin, uLift, uRing; uniform vec3 uAxis;
    void main() {
      ivec3 c = cellOf(); vec4 base = texture(uSrc, vUv);
      if (c.z >= NI) { o = base; return; }
      vec3 p = vec3(c) + 0.5;
      if (isSolid(p)) { o = base; return; }
      vec3 d = p - uPoint;
      if (uRing > 0.5) {
        // push along the axis inside a disc: a puff through a ring becomes a travelling vortex ring
        float along = dot(d, uAxis); vec3 radial = d - along * uAxis;
        float r = length(radial);
        float f = (abs(along) < 3.0 && r < uRadius) ? (1.0 - r / uRadius) : 0.0;
        o = vec4(base.xyz + uAxis * uSpin * f, 1.0); return;
      }
      vec2 h = d.xz; float r = length(h);
      float f = exp(-r * r / (uRadius * uRadius)) * (1.0 - abs(d.y) / (N * 0.7));
      vec2 t = vec2(-h.y, h.x) / max(r, 1e-3);
      vec3 v = base.xyz;
      v.xz += t * uSpin * f * min(r / 3.0, 1.0);
      v.y += uLift * f;
      o = vec4(v, 1.0);
    }`,

    advect: `uniform sampler2D uVel, uSrc; uniform float uDt, uDecay;
    void main() {
      ivec3 c = cellOf();
      if (c.z >= NI) { o = vec4(0.0); return; }
      vec3 p = vec3(c) + 0.5;
      if (isSolid(p)) { o = vec4(0.0); return; }
      vec3 v = fetch(uVel, c).xyz;
      vec3 q = p - uDt * v;
      if (isSolid(q)) q = p;
      o = uDecay * sampleTri(uSrc, q);
    }`,

    curl: `uniform sampler2D uVel;
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      vec3 L = fetchC(uVel, c + ivec3(-1, 0, 0)).xyz, R = fetchC(uVel, c + ivec3(1, 0, 0)).xyz;
      vec3 D = fetchC(uVel, c + ivec3(0, -1, 0)).xyz, U = fetchC(uVel, c + ivec3(0, 1, 0)).xyz;
      vec3 B = fetchC(uVel, c + ivec3(0, 0, -1)).xyz, F = fetchC(uVel, c + ivec3(0, 0, 1)).xyz;
      vec3 w = 0.5 * vec3((U.z - D.z) - (F.y - B.y), (F.x - B.x) - (R.z - L.z), (R.y - L.y) - (U.x - D.x));
      o = vec4(w, length(w));
    }`,

    forces: `uniform sampler2D uVel, uCurl, uTemp, uDens; uniform float uBuoy, uVort, uDt, uWeight;
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      vec3 p = vec3(c) + 0.5;
      if (isSolid(p)) { o = vec4(0.0); return; }
      vec3 v = fetch(uVel, c).xyz;
      if (uVort > 0.0) {
        vec3 g = 0.5 * vec3(
          fetchC(uCurl, c + ivec3(1, 0, 0)).w - fetchC(uCurl, c + ivec3(-1, 0, 0)).w,
          fetchC(uCurl, c + ivec3(0, 1, 0)).w - fetchC(uCurl, c + ivec3(0, -1, 0)).w,
          fetchC(uCurl, c + ivec3(0, 0, 1)).w - fetchC(uCurl, c + ivec3(0, 0, -1)).w);
        g /= length(g) + 1e-5;
        v += uVort * cross(g, fetch(uCurl, c).xyz) * uDt;
      }
      float t = fetch(uTemp, c).x, d = fetch(uDens, c).a;
      v.y += (uBuoy * t - uWeight * d) * uDt;
      o = vec4(v, 1.0);
    }`,

    bound: `uniform sampler2D uVel; uniform float uWind, uMax;
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      vec3 p = vec3(c) + 0.5;
      if (isSolid(p)) { o = vec4(0.0); return; }
      vec3 v = fetch(uVel, c).xyz;
      bool wind = uWind != 0.0;
      if (c.x == 0) v = wind ? vec3(uWind, 0.0, 0.0) : vec3(0.0, v.y, v.z);
      if (c.x == NI - 1 && !wind) v.x = 0.0;
      if (c.y == 0 || c.y == NI - 1) v.y = 0.0;
      if (c.z == 0 || c.z == NI - 1) v.z = 0.0;
      if (wind) v = mix(v, vec3(uWind, 0.0, 0.0), smoothstep(0.84, 1.0, p.x / N) * 0.25);
      float sp = length(v); if (sp > uMax) v *= uMax / sp;
      o = vec4(v, 1.0);
    }`,

    divergence: `uniform sampler2D uVel;
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      if (isSolidC(c)) { o = vec4(0.0); return; }
      float L = fetchC(uVel, c + ivec3(-1, 0, 0)).x, R = fetchC(uVel, c + ivec3(1, 0, 0)).x;
      float D = fetchC(uVel, c + ivec3(0, -1, 0)).y, U = fetchC(uVel, c + ivec3(0, 1, 0)).y;
      float B = fetchC(uVel, c + ivec3(0, 0, -1)).z, F = fetchC(uVel, c + ivec3(0, 0, 1)).z;
      o = vec4(0.5 * (R - L + U - D + F - B), 0.0, 0.0, 1.0);
    }`,

    jacobi: `uniform sampler2D uP, uDiv; uniform float uOutlet;
    float pAt(ivec3 c, float pc) { if (!inBox(c) || isSolidC(c)) return pc; return fetch(uP, c).x; }
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      if (isSolidC(c)) { o = vec4(0.0); return; }
      float pc = fetch(uP, c).x;
      float s = pAt(c + ivec3(-1, 0, 0), pc) + pAt(c + ivec3(0, -1, 0), pc) + pAt(c + ivec3(0, 0, -1), pc)
              + pAt(c + ivec3(0, 1, 0), pc) + pAt(c + ivec3(0, 0, 1), pc);
      float r = (uOutlet > 0.5 && c.x == NI - 1) ? 0.0 : pAt(c + ivec3(1, 0, 0), pc);
      o = vec4((s + r - fetch(uDiv, c).x) / 6.0, 0.0, 0.0, 1.0);
    }`,

    gradient: `uniform sampler2D uP, uVel;
    float pAt(ivec3 c, float pc) { if (!inBox(c) || isSolidC(c)) return pc; return fetch(uP, c).x; }
    void main() {
      ivec3 c = cellOf(); if (c.z >= NI) { o = vec4(0.0); return; }
      if (isSolidC(c)) { o = vec4(0.0); return; }
      float pc = fetch(uP, c).x;
      vec3 g = 0.5 * vec3(pAt(c + ivec3(1, 0, 0), pc) - pAt(c + ivec3(-1, 0, 0), pc),
                          pAt(c + ivec3(0, 1, 0), pc) - pAt(c + ivec3(0, -1, 0), pc),
                          pAt(c + ivec3(0, 0, 1), pc) - pAt(c + ivec3(0, 0, -1), pc));
      o = vec4(fetch(uVel, c).xyz - g, 1.0);
    }`,

    relax: `uniform sampler2D uSrc; uniform float uK, uCap;
    void main() { vec4 x = texture(uSrc, vUv); o = min(x - x * uK, vec4(uCap)); }`,

    // sparks: position.xyz + life in a small texture; they ride the flow, drift up, and respawn
    particles: `uniform sampler2D uPart, uVel; uniform vec3 uEmit; uniform float uEmitR, uDt, uSeed, uLift, uMode;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main() {
      vec4 s = texture(uPart, vUv);
      vec3 p = s.xyz; float life = s.w;
      vec2 h = vUv * 977.0;
      if (life <= 0.0) {
        if (hash(h) > 0.06) { o = vec4(p, 0.0); return; }   // respawn a few per frame, not all at once
        vec3 r = vec3(hash(h + 1.0), hash(h + 2.0), hash(h + 3.0)) * 2.0 - 1.0;
        p = uEmit + r * uEmitR;
        life = 0.6 + hash(h + 4.0) * 0.8;
        o = vec4(p, life); return;
      }
      vec3 v = sampleTri(uVel, p).xyz;
      p += (v * 1.15 + vec3(0.0, uLift, 0.0)) * uDt;
      p += (vec3(hash(h + 5.0), hash(h + 6.0), hash(h + 7.0)) - 0.5) * 0.15;
      life -= uDt * (uMode > 0.5 ? 0.008 : 0.012);
      if (p.x < 1.0 || p.y < 1.0 || p.z < 1.0 || p.x > N - 1.0 || p.y > N - 1.0 || p.z > N - 1.0 || isSolid(p)) life = 0.0;
      o = vec4(p, life);
    }`,

    // Raymarch. Volume occupies the unit cube [-1,1]^3 in world space.
    render: `uniform sampler2D uDens, uTemp;
    uniform mat4 uInvPV; uniform vec3 uEye;
    uniform vec3 uBgTop, uBgBot, uSmoke; uniform float uFire, uDensScale, uSteps, uPaper, uCut;
    const vec3 LIGHT = normalize(vec3(0.4, 0.9, 0.35));
    vec3 toCell(vec3 w) { return (w * 0.5 + 0.5) * N; }
    vec4 smoke(vec3 w) { return sampleTri(uDens, toCell(w)); }
    vec3 fire(float t) {
      t = clamp(t * uFire, 0.0, 1.0);
      return vec3(smoothstep(0.02, 0.4, t), smoothstep(0.2, 0.75, t) * 0.75, smoothstep(0.55, 1.0, t) * 0.55) * 2.6;
    }
    vec2 boxHit(vec3 ro, vec3 rd) {
      vec3 inv = 1.0 / rd;
      vec3 t0 = (vec3(-1.0) - ro) * inv, t1 = (vec3(1.0) - ro) * inv;
      vec3 tmin = min(t0, t1), tmax = max(t0, t1);
      return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
    }
    vec3 shade(vec3 p, vec3 base) {
      // numerical normal of the obstacle
      vec3 c = toCell(p); float e = 0.6;
      vec3 n = normalize(vec3(sdf(c + vec3(e, 0, 0)) - sdf(c - vec3(e, 0, 0)), sdf(c + vec3(0, e, 0)) - sdf(c - vec3(0, e, 0)), sdf(c + vec3(0, 0, e)) - sdf(c - vec3(0, 0, e))));
      float dl = max(dot(n, LIGHT), 0.0);
      float rim = pow(1.0 - max(dot(n, normalize(uEye - p)), 0.0), 3.0);
      return base * (0.3 + 0.7 * dl) + rim * 0.18;
    }
    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec4 a = uInvPV * vec4(ndc, -1.0, 1.0), b = uInvPV * vec4(ndc, 1.0, 1.0);
      a /= a.w; b /= b.w;
      vec3 ro = a.xyz, rd = normalize(b.xyz - a.xyz);
      vec3 bg = mix(uBgBot, uBgTop, clamp(rd.y * 0.5 + 0.55, 0.0, 1.0));
      if (rd.y < -1e-4) {
        float tf = (-1.0 - ro.y) / rd.y;
        vec3 fp = ro + rd * tf;
        float dist = length(fp.xz);
        vec2 g = abs(fract(fp.xz * 2.0 + 0.5) - 0.5) / fwidth(fp.xz * 2.0);
        float line = 1.0 - smoothstep(0.0, 1.5, min(g.x, g.y));
        float fade = exp(-dist * 0.35);
        vec3 floorCol = mix(uBgBot * 0.9, uBgBot * 1.25, line * 0.8);
        bg = mix(bg, floorCol, fade * (uPaper > 0.5 ? 0.9 : 0.7));
      }
      vec2 h = boxHit(ro, rd);
      float t0 = max(h.x, 0.0), t1 = h.y;
      if (t1 <= t0) { o = vec4(bg, 1.0); return; }
      // cut view: throw away the half between the camera and the z = 0 plane; the plane shows the boxes
      bool cutFace = false;
      if (uCut > 0.5) {
        // remove the half of the box on the camera's side of the z = 0 plane; the plane itself shows the boxes
        float tp = (0.0 - ro.z) / rd.z;
        if (tp > t0 && tp < t1) { t0 = tp; cutFace = true; }
        else if (sign((ro + rd * t0).z) == sign(ro.z)) { o = vec4(bg, 1.0); return; }
      }
      vec3 col = vec3(0.0); float alpha = 0.0;
      float n = uSteps, dt = (t1 - t0) / n;
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * dt;
      vec3 p = ro + rd * (t0 + jitter);
      float shadowStep = 0.14;
      vec3 hitCol = vec3(0.0); bool hit = false;
      if (cutFace) {
        // the cross-section: each box painted by its smoke and heat, with grid lines
        vec3 cp = toCell(ro + rd * t0);
        ivec3 cc = ivec3(clamp(cp, vec3(0.0), vec3(N - 0.01)));
        vec4 s = fetch(uDens, cc); float t = fetch(uTemp, cc).x;
        float d = clamp(s.a * 1.6, 0.0, 1.0);
        vec3 tint = s.a > 1e-3 ? s.rgb / s.a : uSmoke;
        vec3 face = mix(uPaper > 0.5 ? vec3(0.9, 0.93, 0.97) : vec3(0.1, 0.1, 0.16), tint, d) + fire(t) * 0.35;
        vec2 gf = abs(fract(cp.xy) - 0.5) / max(fwidth(cp.xy), vec2(1e-4));
        float gl = 1.0 - smoothstep(0.0, 1.2, min(gf.x, gf.y) - 0.0);   // one-pixel box outlines, antialiased
        gl = 1.0 - smoothstep(0.0, 1.2, (0.5 - max(abs(fract(cp.x) - 0.5), abs(fract(cp.y) - 0.5))) / max(max(fwidth(cp.x), fwidth(cp.y)), 1e-4));
        face = mix(face * 1.15, uPaper > 0.5 ? vec3(0.55, 0.6, 0.7) : vec3(0.3, 0.34, 0.46), gl * 0.55);
        o = vec4(face, 1.0); return;
      }
      for (float i = 0.0; i < 160.0; i += 1.0) {
        if (i >= n || alpha > 0.985) break;
        vec3 c = toCell(p);
        if (uShape > 0.5 && sdf(c) < 0.0) {
          // refine the surface, shade the obstacle, stop marching
          vec3 q = p; float step = dt;
          for (int k = 0; k < 4; k++) { step *= 0.5; q += (sdf(toCell(q)) < 0.0 ? -1.0 : 1.0) * rd * step; }
          hitCol = shade(q, uPaper > 0.5 ? vec3(0.62, 0.6, 0.66) : vec3(0.7, 0.68, 0.74)); hit = true; break;
        }
        vec4 s = smoke(p); float d = s.a;
        if (d > 0.002) {
          float occ = smoke(p + LIGHT * shadowStep).a + smoke(p + LIGHT * shadowStep * 2.0).a * 0.7 + smoke(p + LIGHT * shadowStep * 3.0).a * 0.5;
          float lit = exp(-occ * uDensScale * 0.9);
          float t = sampleTri(uTemp, c).x;
          vec3 tint = s.rgb / max(d, 1e-4);
          vec3 cs = tint * (0.24 + 0.76 * lit) + fire(t);
          float aa = 1.0 - exp(-d * uDensScale * dt * 2.0);
          col += (1.0 - alpha) * aa * cs;
          alpha += (1.0 - alpha) * aa;
        }
        p += rd * dt;
      }
      vec3 back = hit ? hitCol : bg;
      vec3 ex = ro + rd * t1;
      vec3 e = 1.0 - abs(ex);
      float edge = (hit || uCut > 0.5) ? 0.0 : 1.0 - smoothstep(0.0, 0.02, min(min(max(e.x, e.y), max(e.y, e.z)), max(e.x, e.z)));
      vec3 outCol = col + (1.0 - alpha) * back;
      outCol = mix(outCol, vec3(uPaper > 0.5 ? 0.35 : 0.85), edge * 0.35);
      o = vec4(outCol, 1.0);
    }`,

    upscale: `uniform sampler2D uSrc; void main() { o = texture(uSrc, vUv); }`,
  };

  const PART_VERT = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  uniform sampler2D uPart, uDens;
  uniform mat4 uPV; uniform float uSide, uN, uPointScale, uMode;
  uniform vec2 uAtlas; uniform float uTX;
  out float vLife; out float vOcc;
  vec2 tileUV(int z, vec2 xy) { int ni = int(uN); int tx = z - (z / int(uTX)) * int(uTX), ty = z / int(uTX); return (vec2(float(tx) * uN, float(ty) * uN) + xy) / uAtlas; }
  void main() {
    int id = gl_VertexID;
    int side = int(uSide);
    vec2 uv = (vec2(float(id % side), float(id / side)) + 0.5) / uSide;
    vec4 s = texture(uPart, uv);
    vLife = s.w;
    vec3 c = clamp(s.xyz, vec3(0.5), vec3(uN - 0.5));
    vOcc = texture(uDens, tileUV(int(c.z - 0.5), c.xy)).a;
    vec3 w = s.xyz / uN * 2.0 - 1.0;
    gl_Position = uPV * vec4(w, 1.0);
    gl_PointSize = (vLife > 0.0 ? uPointScale / max(gl_Position.w, 0.2) : 0.0) * (uMode > 0.5 ? 0.8 : 1.0);
  }`;
  const PART_FRAG = `#version 300 es
  precision highp float;
  in float vLife; in float vOcc;
  uniform float uMode, uDensScale;
  out vec4 o;
  void main() {
    if (vLife <= 0.0) discard;
    vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float soft = 1.0 - smoothstep(0.05, 0.25, r2);
    float l = clamp(vLife, 0.0, 1.0);
    vec3 col = uMode > 0.5 ? mix(vec3(0.5, 0.8, 1.0), vec3(1.0), l) : mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.85, 0.35), l);
    float hide = exp(-vOcc * uDensScale * 0.8);
    o = vec4(col * soft * l * hide * 1.6, 1.0);
  }`;

  const M4 = () => root.M4;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh) + '\n' + src);
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    const v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
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
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    }
    dispose() { this.gl.deleteTexture(this.tex); this.gl.deleteFramebuffer(this.fb); }
  }
  class PingPong {
    constructor(gl, w, h, internal, format, type, filter) { this.a = new Target(gl, w, h, internal, format, type, filter); this.b = new Target(gl, w, h, internal, format, type, filter); this.w = w; this.h = h; }
    get read() { return this.a; }
    get write() { return this.b; }
    swap() { const t = this.a; this.a = this.b; this.b = t; }
    dispose() { this.a.dispose(); this.b.dispose(); }
  }

  class VolumeFluid {
    constructor(canvas, N) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 unavailable');
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets unavailable');
      gl.getExtension('OES_texture_float_linear');
      this.gl = gl;
      this.isGpu = true; this.isVolume = true;
      this.params = Object.assign({}, DEFAULTS);
      this.N = N;
      this.TX = Math.ceil(Math.sqrt(N)); this.TY = Math.ceil(N / this.TX);
      this.AW = this.TX * N; this.AH = this.TY * N;
      this.W = 16; this.H = 10;
      this.k = N / 64;
      this.cam = { yaw: -Math.PI / 2 + 0.5, pitch: 0.42, dist: 3.3 };
      this.look = 'glow';
      this.time = 0; this.frame = 0;
      this.shapes = [];
      this.sparks = { on: true, mode: 0, emit: [32, 6, 32], radius: 3, lift: 0.05, side: 64 };
      this.cut = false;

      const head = COMMON.replace(/__N__/g, String(N)).replace(/__TX__/g, String(this.TX)).replace(/__AW__/g, String(this.AW)).replace(/__AH__/g, String(this.AH));
      this.prog = {};
      for (const k of Object.keys(FRAG)) this.prog[k] = program(gl, VERT, head + '\n' + FRAG[k]);
      this.prog.partDraw = program(gl, PART_VERT, PART_FRAG);
      this.vao = gl.createVertexArray();
      this._alloc();
    }

    _alloc() {
      const gl = this.gl, HF = gl.HALF_FLOAT, F = gl.FLOAT, L = gl.LINEAR, NN = gl.NEAREST;
      const w = this.AW, h = this.AH;
      this.vel = new PingPong(gl, w, h, gl.RGBA16F, gl.RGBA, HF, L);
      this.dens = new PingPong(gl, w, h, gl.RGBA16F, gl.RGBA, HF, L);
      this.temp = new PingPong(gl, w, h, gl.R16F, gl.RED, HF, L);
      this.pressure = new PingPong(gl, w, h, gl.R32F, gl.RED, F, NN);
      this.div = new Target(gl, w, h, gl.R32F, gl.RED, F, NN);
      this.curlT = new Target(gl, w, h, gl.RGBA16F, gl.RGBA, HF, NN);
      const side = this.sparks.side;
      this.part = new PingPong(gl, side, side, gl.RGBA32F, gl.RGBA, F, NN);
      this._clear(this.part.read, [0, 0, 0, 0]);
      this.half = null;
    }
    _ensureHalf() {
      const gl = this.gl, w = Math.max(64, this.canvas.width >> 1), h = Math.max(64, this.canvas.height >> 1);
      if (this.half && this.half.w === w && this.half.h === h) return;
      if (this.half) this.half.dispose();
      this.half = new Target(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    }

    // ---------- helpers ----------
    _use(name) { const pr = this.prog[name]; this.gl.useProgram(pr.p); this._unit = 0; this._shapeUniforms(pr); return pr; }
    _shapeUniforms(pr) {
      const gl = this.gl, P = this.params;
      if (pr.u.uShape) gl.uniform1f(pr.u.uShape, P.shape || 0);
      if (pr.u.uShapeR) gl.uniform1f(pr.u.uShapeR, (P.shapeSize || 9) * this.k);
      if (pr.u.uShapeC) gl.uniform3f(pr.u.uShapeC, this.N * 0.36, this.N * 0.5, this.N * 0.5);
    }
    _tex(pr, name, tex) { const gl = this.gl, u = this._unit++; gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(pr.u[name], u); }
    _draw(target) {
      const gl = this.gl;
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); }
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    _clear(t, v) { const pr = this._use('clear'); this.gl.uniform4f(pr.u.uValue, v[0], v[1], v[2], v[3]); this._draw(t); }

    // ---------- sources (reference 64-cube units) ----------
    _splat(pp, x, y, z, r, amount) {
      const gl = this.gl, pr = this._use('splat');
      this._tex(pr, 'uSrc', pp.read.tex);
      gl.uniform3f(pr.u.uPoint, x * this.k, y * this.k, z * this.k);
      gl.uniform1f(pr.u.uRadius, Math.max(0.75, r * this.k));
      gl.uniform4f(pr.u.uAmount, amount[0], amount[1], amount[2], amount[3]);
      this._draw(pp.write); pp.swap();
    }
    // color: [r,g,b] tint (default soft grey-white)
    addSmoke(x, y, z, r, amount, heat, color) {
      const c = color || [0.82, 0.84, 0.9];
      this._splat(this.dens, x, y, z, r, [c[0] * amount, c[1] * amount, c[2] * amount, amount]);
      if (heat) this._splat(this.temp, x, y, z, r, [heat, 0, 0, 0]);
    }
    addVelocity(x, y, z, r, vx, vy, vz) { this._splat(this.vel, x, y, z, r, [vx * this.k, vy * this.k, vz * this.k, 0]); }
    // a spinning updraft column centred at (x, z)
    addTornado(x, z, r, spin, lift) {
      const gl = this.gl, pr = this._use('swirl');
      this._tex(pr, 'uSrc', this.vel.read.tex);
      gl.uniform3f(pr.u.uPoint, x * this.k, this.N * 0.5, z * this.k);
      gl.uniform1f(pr.u.uRadius, r * this.k); gl.uniform1f(pr.u.uSpin, spin * this.k); gl.uniform1f(pr.u.uLift, lift * this.k);
      gl.uniform1f(pr.u.uRing, 0); gl.uniform3f(pr.u.uAxis, 0, 1, 0);
      this._draw(this.vel.write); this.vel.swap();
    }
    // a disc-shaped push along an axis: launches a vortex ring
    launchRing(x, y, z, r, axis, speed) {
      const gl = this.gl, pr = this._use('swirl');
      this._tex(pr, 'uSrc', this.vel.read.tex);
      gl.uniform3f(pr.u.uPoint, x * this.k, y * this.k, z * this.k);
      gl.uniform1f(pr.u.uRadius, r * this.k); gl.uniform1f(pr.u.uSpin, speed * this.k); gl.uniform1f(pr.u.uLift, 0);
      gl.uniform1f(pr.u.uRing, 1); gl.uniform3f(pr.u.uAxis, axis[0], axis[1], axis[2]);
      this._draw(this.vel.write); this.vel.swap();
    }
    // an explosion: hot smoke plus an outward burst
    boom(x, y, z, size) {
      const s = size || 1;
      this.addSmoke(x, y, z, 7 * s, 3.0, 4.0, [1.0, 0.7, 0.4]);
      const pr = this._use('splat');
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        this._splat(this.vel, x + dx * 4 * s, y + dy * 4 * s, z + dz * 4 * s, 6 * s, [dx * 2.2 * this.k, dy * 2.2 * this.k, dz * 2.2 * this.k, 0]);
      }
      void pr;
    }
    clearDye() { this._clear(this.dens.read, [0, 0, 0, 0]); this._clear(this.part.read, [0, 0, 0, 0]); }
    clearHeat() { this._clear(this.temp.read, [0, 0, 0, 0]); }
    clearVelocity() { this._clear(this.vel.read, [0, 0, 0, 0]); this._clear(this.pressure.read, [0, 0, 0, 0]); }
    clearSolids() { }
    setUniformFlow(u) { this._clear(this.vel.read, [u * this.k, 0, 0, 0]); this._clear(this.pressure.read, [0, 0, 0, 0]); }
    reset() { this.clearDye(); this.clearHeat(); this.clearVelocity(); this.time = 0; this.frame = 0; }
    mixedness() { return 0; }
    get solidCount() { return this.params.shape ? 1 : 0; }

    // ---------- step ----------
    _advect(field, decay) {
      const gl = this.gl, pr = this._use('advect');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uSrc', field.read.tex);
      gl.uniform1f(pr.u.uDt, this.params.dt); gl.uniform1f(pr.u.uDecay, decay);
      this._draw(field.write); field.swap();
    }
    _bound() {
      const gl = this.gl, P = this.params, pr = this._use('bound');
      this._tex(pr, 'uVel', this.vel.read.tex);
      gl.uniform1f(pr.u.uWind, P.windX * this.k); gl.uniform1f(pr.u.uMax, P.maxSpeed * this.k);
      this._draw(this.vel.write); this.vel.swap();
    }
    step() {
      const gl = this.gl, P = this.params;
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      this._advect(this.vel, 1);
      if (P.vorticity > 0) { const c = this._use('curl'); this._tex(c, 'uVel', this.vel.read.tex); this._draw(this.curlT); }
      let pr = this._use('forces');
      this._tex(pr, 'uVel', this.vel.read.tex); this._tex(pr, 'uCurl', this.curlT.tex); this._tex(pr, 'uTemp', this.temp.read.tex); this._tex(pr, 'uDens', this.dens.read.tex);
      gl.uniform1f(pr.u.uBuoy, P.buoyancy * this.k); gl.uniform1f(pr.u.uVort, P.vorticity * this.k); gl.uniform1f(pr.u.uDt, P.dt); gl.uniform1f(pr.u.uWeight, (P.smokeWeight || 0) * this.k);
      this._draw(this.vel.write); this.vel.swap();
      this._bound();
      pr = this._use('divergence'); this._tex(pr, 'uVel', this.vel.read.tex); this._draw(this.div);
      for (let i = 0; i < P.pressureIters; i++) {
        pr = this._use('jacobi'); this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uDiv', this.div.tex);
        gl.uniform1f(pr.u.uOutlet, P.windX ? 1 : 0);
        this._draw(this.pressure.write); this.pressure.swap();
      }
      pr = this._use('gradient'); this._tex(pr, 'uP', this.pressure.read.tex); this._tex(pr, 'uVel', this.vel.read.tex);
      this._draw(this.vel.write); this.vel.swap();
      this._bound();
      this._advect(this.dens, Math.max(0, 1 - P.dissipation * P.dt));
      this._advect(this.temp, 1);
      pr = this._use('relax'); this._tex(pr, 'uSrc', this.temp.read.tex); gl.uniform1f(pr.u.uK, Math.min(1, P.tempCooling * P.dt)); gl.uniform1f(pr.u.uCap, 2.0);
      this._draw(this.temp.write); this.temp.swap();
      if (this.sparks.on) {
        const sp = this.sparks;
        pr = this._use('particles');
        this._tex(pr, 'uPart', this.part.read.tex); this._tex(pr, 'uVel', this.vel.read.tex);
        gl.uniform3f(pr.u.uEmit, sp.emit[0] * this.k, sp.emit[1] * this.k, sp.emit[2] * this.k);
        gl.uniform1f(pr.u.uEmitR, sp.radius * this.k); gl.uniform1f(pr.u.uDt, P.dt); gl.uniform1f(pr.u.uSeed, (this.frame % 1000) * 0.37);
        gl.uniform1f(pr.u.uLift, sp.lift * this.k); gl.uniform1f(pr.u.uMode, sp.mode);
        this._draw(this.part.write); this.part.swap();
      }
      this.time += P.dt; this.frame++;
    }

    // ---------- camera / picking ----------
    _cameraMatrix() {
      const M = M4(), c = this.cam, aspect = this.canvas.width / this.canvas.height;
      const pitch = Math.min(1.35, Math.max(-0.15, c.pitch));
      const eye = [Math.cos(pitch) * Math.cos(c.yaw) * c.dist, Math.sin(pitch) * c.dist, Math.cos(pitch) * Math.sin(c.yaw) * c.dist];
      const view = M.lookAt(eye, [0, -0.1, 0], [0, 1, 0]);
      const proj = M.perspective(0.72, aspect, 0.1, 30);
      this._eye = eye;
      this._pv = M.mul(proj, view);
      this._inv = M.invert(this._pv);
      return this._pv;
    }
    pick(nx, ny) {
      if (!this._inv) this._cameraMatrix();
      const M = M4();
      const a = M.apply(this._inv, [nx, ny, -1, 1]), b = M.apply(this._inv, [nx, ny, 1, 1]);
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e = this._eye, n = [-e[0], -e[1], -e[2]];
      const nl = Math.hypot(n[0], n[1], n[2]); n[0] /= nl; n[1] /= nl; n[2] /= nl;
      const denom = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      if (Math.abs(denom) < 1e-6) return null;
      const t = -(a[0] * n[0] + a[1] * n[1] + a[2] * n[2]) / denom;
      const w = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
      const inside = Math.max(Math.abs(w[0]), Math.abs(w[1]), Math.abs(w[2])) <= 1.02;
      const cell = (v) => (v * 0.5 + 0.5) * 64;
      return { x: cell(w[0]), y: cell(w[1]), z: cell(w[2]), inside, world: w };
    }

    // ---------- render ----------
    render(opts) {
      const gl = this.gl;
      this._ensureHalf();
      const glow = this.look === 'glow';
      let pr = this._use('render');
      this._tex(pr, 'uDens', this.dens.read.tex); this._tex(pr, 'uTemp', this.temp.read.tex);
      this._cameraMatrix();
      gl.uniformMatrix4fv(pr.u.uInvPV, false, new Float32Array(this._inv));
      gl.uniform3f(pr.u.uEye, this._eye[0], this._eye[1], this._eye[2]);
      if (glow) { gl.uniform3f(pr.u.uBgTop, 0.09, 0.08, 0.2); gl.uniform3f(pr.u.uBgBot, 0.03, 0.03, 0.08); gl.uniform3f(pr.u.uSmoke, 0.8, 0.82, 0.9); }
      else { gl.uniform3f(pr.u.uBgTop, 0.93, 0.96, 1.0); gl.uniform3f(pr.u.uBgBot, 0.78, 0.84, 0.9); gl.uniform3f(pr.u.uSmoke, 0.42, 0.45, 0.5); }
      gl.uniform1f(pr.u.uPaper, glow ? 0 : 1);
      gl.uniform1f(pr.u.uFire, opts && opts.fire != null ? opts.fire : 1.0);
      const densScale = (opts && opts.densScale) || 3.4;
      gl.uniform1f(pr.u.uDensScale, densScale);
      gl.uniform1f(pr.u.uSteps, (opts && opts.steps) || 96);
      gl.uniform1f(pr.u.uCut, this.cut ? 1 : 0);
      this._draw(this.half);
      pr = this._use('upscale'); this._tex(pr, 'uSrc', this.half.tex); this._draw(null);
      if (this.sparks.on) {
        const pp = this.prog.partDraw;
        gl.useProgram(pp.p);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.part.read.tex); gl.uniform1i(pp.u.uPart, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dens.read.tex); gl.uniform1i(pp.u.uDens, 1);
        gl.uniformMatrix4fv(pp.u.uPV, false, new Float32Array(this._pv));
        gl.uniform1f(pp.u.uSide, this.sparks.side); gl.uniform1f(pp.u.uN, this.N);
        gl.uniform1f(pp.u.uPointScale, this.canvas.height * 0.012); gl.uniform1f(pp.u.uMode, this.sparks.mode);
        gl.uniform2f(pp.u.uAtlas, this.AW, this.AH); gl.uniform1f(pp.u.uTX, this.TX);
        gl.uniform1f(pp.u.uDensScale, densScale);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.POINTS, 0, this.sparks.side * this.sparks.side);
        gl.disable(gl.BLEND);
      }
    }

    dispose() {
      for (const t of [this.vel, this.dens, this.temp, this.pressure, this.div, this.curlT, this.part]) t.dispose();
      if (this.half) this.half.dispose();
      const gl = this.gl;
      for (const k of Object.keys(this.prog)) gl.deleteProgram(this.prog[k].p);
      gl.deleteVertexArray(this.vao);
    }
  }

  VolumeFluid.DEFAULTS = DEFAULTS;
  root.VolumeFluid = VolumeFluid;
})(window);
