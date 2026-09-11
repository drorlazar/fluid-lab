/*
  Chapter lab configurations. All visible text lives in content.js (CONTENT.ui / CONTENT.chapters);
  control labels here are '@key' references into CONTENT.ui.
*/
(function (root) {
  'use strict';

  // Curated ink sets: they stay vivid when they mix (no muddy complements)
  const PLAYGROUND = ['#ff4f9a', '#22e3d1', '#b656ff', '#ffd23f', '#3d7dff'];
  const DROPS = ['#ff4f9a', '#22e3d1', '#b656ff', '#ffffff'];   // analogous-ish set: stays vivid when it mixes
  const CANDY = ['#ff4f9a', '#ff8a3d', '#ffd23f', '#ffffff'];
  const OCEAN = ['#22e3d1', '#3d7dff', '#b656ff', '#ff4f9a'];
  const rgb = (hex) => Lab.hexToRgb(hex);

  // ---------- shared helpers ----------

  function placeShape(lab, shape) {
    const s = lab.engine;
    s.clearSolids();
    const cx = Math.round(s.W * 0.28), cy = Math.round(s.H * 0.5), R = Math.round(s.H * 0.11);
    if (shape === 'circle') s.setSolid(cx, cy, R, true);
    else if (shape === 'square') {
      if (s.addSolidPolygon) s.addSolidPolygon([[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R]], true);
      else for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) s.setSolidCell(x, y, true);
    } else if (shape === 'wing') {
      // NACA-style teardrop, sampled finely as a closed outline (top edge left to right, bottom edge back)
      const len = R * 5.2, top = [], bot = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const half = R * 1.05 * (1.45 * Math.sqrt(t) - 0.63 * t - 1.76 * t * t + 1.42 * t * t * t - 0.5 * t * t * t * t) / 0.29;
        const yc = cy + t * R * 0.15, x = cx - R + t * len;
        top.push([x, yc - half]); bot.push([x, yc + half]);
      }
      if (s.addSolidPolygon) s.addSolidPolygon(top.concat(bot.reverse()), true);
      else for (let i = 0; i < top.length; i++) for (let y = Math.round(top[i][1]); y <= Math.round(bot[top.length - 1 - i][1]); y++) s.setSolidCell(Math.round(top[i][0]), y, true);
    }
    lab.state.shape = shape;
    if (s.params.windX && s.setUniformFlow) s.setUniformFlow(s.params.windX, 0);
  }

  function smokeStripes(lab, color, gap, amount) {
    const s = lab.engine;
    for (let y = Math.round(gap / 2); y <= s.H; y += gap) s.addDye(2, y, 0.9, color[0], color[1], color[2], amount);
  }

  function fanJet(lab, strength) {
    const s = lab.engine;
    if (!strength) return;
    const y = Math.round(s.H * 0.5);
    s.addVelocity(3, y, 5, strength * 0.35, 0);
    for (let k = -3; k <= 3; k += 3) s.addDye(3, y + k, 0.9, 0.6, 0.78, 0.95, 0.12);
  }

  function seedStripes(lab) {
    lab.engine.fillBands([rgb('#ffb02e'), rgb('#3fb6ff')], Math.max(3, Math.round(lab.engine.H / 14)), 0.7);
  }

  const playback = (extra) => Object.assign({ type: 'playback' }, extra || {});

  // One shared vocabulary of knobs. Each chapter lists the ones worth playing with first; the rest follow.
  const KNOB = {
    thickness: { type: 'slider', key: 'viscosity', label: '@thickness', icon: '🍯', min: 0, max: 0.0003, format: (v, lab) => lab.t(v < 0.00002 ? 'thick_water' : v < 0.0001 ? 'thick_syrup' : 'thick_honey'), hint: '@hint_thickness' },
    spread: { type: 'slider', key: 'diffusion', label: '@spread', icon: '🌫️', min: 0, max: 0.00015, format: () => '', ends: ['@spread_sharp', '@spread_out'], hint: '@hint_spread' },
    swirls: { type: 'slider', key: 'vorticity', label: '@extraSwirls', icon: '🌀', min: 0, max: 1.2, format: () => '', ends: ['@swirl_none', '@swirl_wild'], hint: '@hint_swirls' },
    weight: { type: 'slider', key: 'inkWeight', label: '@inkWeight', icon: '⚖️', min: -0.3, max: 0.3, curve: 'squad', format: (v, lab) => lab.t(v < -0.02 ? 'weight_float' : v > 0.02 ? 'weight_sink' : 'weight_stay'), ends: ['@weight_float', '@weight_sink'], hint: '@hint_weight' },
    wind: { type: 'slider', key: 'windX', label: '@wind', icon: '🌬️', min: 0, max: 1.5, format: () => '', ends: ['@wind_off', '@wind_strong'], hint: '@hint_wind', after: (lab, v) => { lab.state.smoke = v > 0; if (lab.engine.setUniformFlow) lab.engine.setUniformFlow(v, 0); } },
    lift: { type: 'slider', key: 'buoyancy', label: '@lift', icon: '🎈', min: 0, max: 2, format: () => '', ends: ['@lift_none', '@lift_strong'], hint: '@hint_lift' },
    fade: { type: 'slider', key: 'dissipation', label: '@fade', icon: '🫥', min: 0, max: 0.05, format: () => '', ends: ['@fade_stays', '@fade_fast'], hint: '@hint_fade' },
    brush: { type: 'slider', label: '@brushSize', icon: '🖌️', min: 1, max: 12, get: (lab) => lab.brushSize, set: (lab, v) => { lab.brushSize = v; }, format: () => '', ends: ['@brush_fine', '@brush_broad'] },
    push: { type: 'slider', label: '@pushStrength', icon: '💪', min: 0.1, max: 2, curve: 'lin', get: (lab) => lab.pushStrength, set: (lab, v) => { lab.pushStrength = v; }, format: () => '' },
    quality: { type: 'slider', key: 'pressureIters', label: '@pressureQuality', icon: '🎯', min: 1, max: 60, curve: 'lin', integer: true, ends: ['@press_rough', '@press_careful'], hint: '@hint_pressure' },
    time: { type: 'slider', key: 'dt', label: '@timeSpeed', icon: '⏱️', min: 0.1, max: 2, curve: 'lin', format: (v) => v.toFixed(1) + 'x', ends: ['@time_slow', '@time_fast'], hint: '@hint_time' },
    carry: { type: 'toggle', key: 'advect', label: '@recipe_carry', icon: '🍃' },
    room: { type: 'toggle', key: 'project', label: '@recipe_room', icon: '🫧' },
    diffuse: { type: 'toggle', key: 'diffuse', label: '@recipe_spread', icon: '🌫️' },
    sharp: { type: 'toggle', key: 'sharpAdvection', label: '@sharpSwirls', icon: '🔪' },
  };
  const ALL_KNOBS = ['thickness', 'spread', 'swirls', 'weight', 'wind', 'lift', 'fade', 'brush', 'push', 'quality', 'time'];
  // The "Play with the rules" drawer: the chapter's own knobs first, then everything else, then views and restore.
  function rules(first, views) {
    const order = first.concat(ALL_KNOBS.filter((k) => !first.includes(k)));
    return [{ type: 'drawer', label: '@rules' }, { type: 'section', label: '@sec_knobs' }]
      .concat(order.map((k) => KNOB[k]))
      .concat([{ type: 'section', label: '@sec_recipe' }, KNOB.carry, KNOB.room, KNOB.diffuse, KNOB.sharp])
      .concat([{ type: 'section', label: '@sec_view' }, { type: 'views', modes: views }, { type: 'height' },
        { type: 'button', icon: '↩️', label: '@restore', action: (lab) => lab.restoreParams() }]);
  }
  const VIEWS = ['dye', 'mountains', 'speed', 'curl', 'pressure', 'arrows'];
  const thickFmt = (v, lab) => lab.t(v < 0.00002 ? 'thick_water' : v < 0.0001 ? 'thick_syrup' : 'thick_honey');
  const weightFmt = (v, lab) => lab.t(v < -0.03 ? 'weight_float' : v > 0.03 ? 'weight_sink' : 'weight_stay');
  const pct = (max) => (v) => Math.round(v / max * 100) + '%';
  const noVal = () => '';

  // ---------- chapters ----------

  const CHAPTERS = [
    {
      id: 'intro',
      lab: {
        grid: [144, 90], brush: 'push', brushSize: 5, rainbow: true, colors: PLAYGROUND,
        params: { vorticity: 0.18, dissipation: 0.0035, diffusion: 0 },
        onFrame: (lab) => {
          const s = lab.engine;
          const every = lab.touched ? 120 : 70;
          if (lab.frame % every === 30) {
            const c = rgb(DROPS[lab.state.drop = ((lab.state.drop || 0) + 1) % DROPS.length]);
            const x = 16 + Math.random() * (s.W - 32), y = 12 + Math.random() * (s.H - 24);
            const ang = Math.random() * Math.PI * 2, sp = 1.6 + Math.random();
            s.addDye(x, y, 7, c[0], c[1], c[2], 2.2);
            s.addVelocity(x, y, 9, Math.cos(ang) * sp, Math.sin(ang) * sp);
            s.addVortex(x, y, 8, (Math.random() < 0.5 ? -1 : 1) * 0.7);
          }
        },
        setup: (lab) => {
          const s = lab.engine;
          DROPS.slice(0, 3).forEach((hex, i) => {
            const c = rgb(hex);
            const x = s.W * (0.25 + 0.25 * i), y = s.H * (0.35 + 0.3 * (i % 2));
            s.addDye(x, y, 9, c[0], c[1], c[2], 1.6);
            s.addVortex(x, y, 9, (i % 2 ? -1 : 1) * 0.9);
          });
          lab.setHint(lab.t('dragHint'));
        },
        controls: [{ type: 'colors', rainbow: true }, playback({ step: false })].concat(rules(['swirls', 'fade', 'thickness'], VIEWS)),
      },
    },

    {
      id: 'advection',
      lab: {
        grid: [128, 80], brush: 'push', brushes: ['push', 'dye'], brushSize: 4, colors: PLAYGROUND,
        params: { vorticity: 0.15, dissipation: 0 },
        setup: (lab) => lab.setHint(lab.t('dragHint')),
        controls: [{ type: 'brushes' }, { type: 'colors' }, playback({ step: false })].concat(rules(['thickness', 'swirls', 'brush'], VIEWS)),
      },
    },

    {
      id: 'pressure',
      lab: {
        grid: [128, 80], brush: 'push', brushes: ['push', 'dye'], brushSize: 5, colors: PLAYGROUND,
        params: { vorticity: 0.15, dissipation: 0 },
        renderModes: ['dye', 'mountains'],
        setup: (lab) => {
          const s = lab.engine;
          DROPS.slice(0, 3).forEach((hex, i) => { const c = rgb(hex); const x = s.W * (0.25 + 0.25 * i), y = s.H * (0.35 + 0.3 * (i % 2)); s.addDye(x, y, 8, c[0], c[1], c[2], 1.5); s.addVortex(x, y, 9, (i % 2 ? -1 : 1) * 1.0); });
        },
        controls: [
          { type: 'toggle', key: 'project', label: '@makeRoom', icon: '🫧', big: true },
          { type: 'views', modes: ['dye', 'mountains'], big: true }, { type: 'height' },
          { type: 'brushes' }, { type: 'colors' }, playback({ step: false }),
        ].concat(rules(['quality', 'thickness', 'swirls'], VIEWS)),
      },
    },

    {
      id: 'diffusion',
      lab: {
        grid: [128, 80], dyeMul: 2, brush: 'dye', brushes: ['dye', 'push'], brushSize: 3, colors: PLAYGROUND,
        params: { diffusion: 0.00003, viscosity: 0, dissipation: 0, vorticity: 0.1 },
        controls: [
          { type: 'button', icon: '💧', label: '@dropInk', primary: true, big: true, action: (lab) => {
            const s = lab.engine; const c = rgb(PLAYGROUND[Math.floor(Math.random() * PLAYGROUND.length)]);
            s.addDye(12 + Math.random() * (s.W - 24), 10 + Math.random() * (s.H - 20), 4, c[0], c[1], c[2], 1.2);
          } },
          KNOB.spread, KNOB.thickness,
          { type: 'brushes' }, playback({ step: false }),
        ].concat(rules(['fade', 'swirls', 'brush'], VIEWS)),
      },
    },

    {
      id: 'forces',
      lab: {
        grid: [128, 80], brush: 'dye', brushes: ['dye', 'push'], brushSize: 4, colors: PLAYGROUND,
        params: { vorticity: 0.15, dissipation: 0.004, diffusion: 0 },
        onFrame: (lab) => { if (lab.state.fan) fanJet(lab, 1.6); },
        controls: [
          { type: 'toggle', label: '@fanSide', icon: '🌬️', big: true, get: (lab) => !!lab.state.fan, set: (lab, v) => { lab.state.fan = v; } },
          KNOB.weight,
          { type: 'brushes' }, { type: 'colors' }, playback({ step: false }),
        ].concat(rules(['wind', 'lift', 'swirls'], VIEWS)),
      },
    },

    {
      id: 'grid',
      lab: {
        engine: 'cpu', grid: [24, 15], brush: 'dye', brushes: ['dye', 'push'], brushSize: 0.6, pushStrength: 0.5, colors: ['#ffd23f'],
        render: 'grid', paused: true, gridArrows: true, showCursor: false,
        params: { diffusion: 0.0004, dissipation: 0, vorticity: 0, conserveDye: true, pressureIters: 40, sharpAdvection: false },
        setup: (lab) => { lab.showNumbers = true; },
        controls: [
          playback({ primaryStep: true, clear: true }),
          { type: 'toggle', label: '@numbers', icon: '🔢', get: (lab) => lab.showNumbers, set: (lab, v) => { lab.showNumbers = v; } },
          { type: 'toggle', label: '@arrows', icon: '➡️', get: (lab) => !!lab.config.gridArrows, set: (lab, v) => { lab.config.gridArrows = v; } },
          { type: 'brushes' },
        ],
      },
    },

    {
      id: 'windtunnel',
      lab: {
        grid: [160, 80], brush: 'none', brushes: ['none', 'solid', 'eraser'], brushSize: 3, render: 'dye', renderModes: ['dye', 'speed', 'curl'], speedScale: 1.6, bloom: false,
        params: { windX: 0.6, vorticity: 0.02, dissipation: 0.005, viscosity: 0, diffusion: 0, conserveDye: false, pressureIters: 40, sharpVelocity: true },
        setup: (lab) => placeShape(lab, lab.state.shape || 'circle'),
        onClear: (lab) => { if (lab.engine.setUniformFlow) lab.engine.setUniformFlow(lab.engine.params.windX, 0); },
        onFrame: (lab) => smokeStripes(lab, [0.8, 0.82, 0.9], 5, 0.5),
        controls: [
          { type: 'segment', label: '@shape', big: true, options: [
            { value: 'circle', icon: '⚪', label: '@shape_round' }, { value: 'square', icon: '⬜', label: '@shape_box' },
            { value: 'wing', icon: '✈️', label: '@shape_wing' }, { value: 'none', icon: '✏️', label: '@shape_draw' },
          ], get: (lab) => lab.state.shape || 'circle', set: (lab, v) => { placeShape(lab, v); if (v === 'none') lab.brush = 'solid'; lab.buildControls(); } },
          Object.assign({}, KNOB.wind, { label: '@windSpeed', min: 0.2 }),
          { type: 'brushes' }, playback({ step: false }),
        ].concat(rules(['thickness', 'swirls', 'quality'], ['dye', 'mountains', 'speed', 'curl', 'pressure'])),
      },
    },

    {
      id: 'smoke',
      lab: {
        grid: [112, 96], brush: 'heat', brushes: ['heat', 'solid', 'eraser'], brushSize: 3, tempGlow: true,
        params: { buoyancy: 0.3, vorticity: 0.12, dissipation: 0.008, diffusion: 0.00002, viscosity: 0.000004, tempCooling: 0.06 },
        setup: (lab) => { lab.state.candles = [{ x: lab.engine.W * 0.5, y: lab.engine.H * 0.82 }]; lab.state.heat = 1; lab.state.fan = 0; },
        onPointer: (lab, phase, g) => {
          if (lab.brush !== 'heat') return false;
          if (phase === 'down' && g.inside) lab.state.candles.push({ x: g.x, y: g.y });
          return true;
        },
        onFrame: (lab) => {
          const s = lab.engine, heat = lab.state.heat || 1;
          for (const c of lab.state.candles || []) {
            s.addHeat(c.x, c.y, 2.2, 0.45 * heat);
            s.addDye(c.x, c.y - 1, 1.8, 0.8, 0.78, 0.75, 0.14);
          }
          if (lab.state.fan) fanJet(lab, lab.state.fan);
        },
        overlay: (ctx, lab, cw, chh) => {
          ctx.save();
          for (const c of lab.state.candles || []) {
            const x = (c.x - 1) * cw, y = (c.y - 1) * chh;
            ctx.fillStyle = '#fff6e5'; ctx.fillRect(x - cw * 0.9, y + chh * 0.6, cw * 1.8, chh * 3.2);
            ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(x, y - chh * 0.2, cw * 0.7, chh * 1.3, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        },
        controls: [
          { type: 'slider', label: '@candleHeat', icon: '🕯️', min: 0.1, max: 3, curve: 'lin', get: (lab) => lab.state.heat, set: (lab, v) => { lab.state.heat = v; }, format: pct(3) },
          Object.assign({}, KNOB.lift, { max: 1 }),
          { type: 'slider', label: '@fanSide', icon: '🌬️', min: 0, max: 2, get: (lab) => lab.state.fan || 0, set: (lab, v) => { lab.state.fan = v; }, format: pct(2) },
          { type: 'button', icon: '💨', label: '@blowOut', action: (lab) => { lab.state.candles = []; } },
          { type: 'brushes' }, playback({ step: false }),
        ].concat(rules(['swirls', 'fade', 'thickness'], VIEWS)),
      },
    },

    {
      id: 'vortex',
      lab: {
        grid: [128, 96], brush: 'vortex', brushSize: 4, vortexStrength: 1.6, render: 'dye', renderModes: ['dye', 'curl', 'arrows'],
        params: { viscosity: 0, vorticity: 0.03, dissipation: 0, diffusion: 0, pressureIters: 30 },
        setup: (lab) => { seedStripes(lab); lab.vortexSign = 1; },
        onClear: (lab) => seedStripes(lab),
        controls: [
          { type: 'button', icon: '🔁', label: '@sameWay', primary: true, big: true, action: (lab) => {
            const s = lab.engine; s.clearVelocity(); seedStripes(lab);
            s.addVortex(s.W * 0.5 - 17, s.H * 0.5, 8, 1.4); s.addVortex(s.W * 0.5 + 17, s.H * 0.5, 8, 1.4);
          } },
          { type: 'button', icon: '↔️', label: '@opposite', primary: true, big: true, action: (lab) => {
            const s = lab.engine; s.clearVelocity(); seedStripes(lab);
            s.addVortex(s.W * 0.25, s.H * 0.5 - 13, 8, -1.4); s.addVortex(s.W * 0.25, s.H * 0.5 + 13, 8, 1.4);
          } },
          { type: 'toggle', label: '@spinDirection', icon: '🔄', get: (lab) => lab.vortexSign > 0, set: (lab, v) => { lab.vortexSign = v ? 1 : -1; } },
          { type: 'button', icon: '🧵', label: '@fresh', action: (lab) => seedStripes(lab) },
          playback({ step: false }),
        ].concat(rules(['thickness', 'swirls', 'quality'], ['dye', 'mountains', 'curl', 'arrows', 'speed'])),
      },
    },

    {
      id: 'mixing',
      lab: {
        grid: [96, 96], dyeMul: 1, brush: 'none', brushSize: 5, pushStrength: 0.7, colors: ['#ffffff'], tempGlow: false, wantsMixedness: true, pushDye: false, bloom: false,
        params: { diffusion: 0.000025, dissipation: 0, vorticity: 0.1, viscosity: 0, conserveDye: true },
        setup: (lab) => {
          lab.engine.fillHalves([0.95, 0.12, 0], [0, 0.35, 0.95]);
          lab.state.round = 0; lab.state.done = false; lab.brush = 'none';
        },
        onFrame: (lab) => {
          const st = lab.state, m = lab.engine.mixedness();
          lab.setMeter('mixed', m, Math.round(m * 100) + '%');
          if (st.round && !st.done) {
            const secs = (performance.now() - st.startMs) / 1000;
            const id = st.round === 1 ? 'wait' : 'stir';
            let text, frac = secs / 90;
            if (m >= 0.6) { st.done = true; frac = 1; text = lab.t('reached').replace('{s}', secs.toFixed(1)); lab.brush = 'none'; lab.setHint(''); }
            else if (secs >= 90) { st.done = true; text = lab.t('stillOnly').replace('{p}', Math.round(m * 100)).replace('{s}', '90'); lab.brush = 'none'; lab.setHint(''); }
            else text = secs.toFixed(1) + ' s';
            lab.persist[id] = { frac, text };
            lab.setMeter(id, frac, text);
          }
        },
        controls: [
          { type: 'meter', id: 'mixed', label: '@howMixed', color: '#b656ff' },
          { type: 'button', id: 'r1', icon: '⏳', label: '@round1', primary: true, big: true, action: (lab) => startRound(lab, 1) },
          { type: 'meter', id: 'wait', label: '@waitTime', color: '#3d7dff' },
          { type: 'button', id: 'r2', icon: '🥄', label: '@round2', primary: true, big: true, action: (lab) => startRound(lab, 2) },
          { type: 'meter', id: 'stir', label: '@stirTime', color: '#ff4f9a' },
        ].concat(rules(['spread', 'swirls', 'brush'], ['dye', 'mountains'])),
      },
    },

    {
      id: 'marble',
      lab: {
        grid: [144, 96], brush: 'swirl', brushes: ['swirl', 'dye', 'push'], brushSize: 5, pushStrength: 0.5, colors: CANDY.concat(OCEAN.slice(0, 2)), pushDye: false,
        params: { viscosity: 0.000005, diffusion: 0, dissipation: 0, vorticity: 0.2 },
        setup: (lab) => lab.engine.fillBands([rgb('#ff4f9a'), rgb('#3d7dff'), rgb('#ffd23f'), rgb('#22e3d1')], lab.engine.H / 8, 0.8),
        onClear: (lab) => lab.config.setup(lab),
        controls: [
          { type: 'colors', rainbow: true }, { type: 'brushes' },
          { type: 'button', icon: '↔️', label: '@combAcross', action: (lab) => lab.engine.comb('x', 4, Math.random() * 6.28, 1.4) },
          { type: 'button', icon: '↕️', label: '@combDown', action: (lab) => lab.engine.comb('y', 5, Math.random() * 6.28, 1.4) },
          KNOB.brush,
          { type: 'button', icon: '💾', label: '@savePicture', primary: true, big: true, action: (lab) => lab.savePicture('marble-painting') },
          playback({ step: false }),
        ].concat(rules(['thickness', 'swirls', 'fade'], ['dye', 'mountains'])),
      },
    },

    {
      id: 'sandbox',
      lab: {
        grid: [128, 80], brush: 'push', brushes: ['push', 'dye', 'swirl', 'heat', 'vortex', 'solid', 'eraser'], brushSize: 4, colors: PLAYGROUND,
        render: 'dye', renderModes: ['dye', 'speed', 'arrows', 'curl', 'pressure'], speedScale: 2, vortexStrength: 2.5,
        params: { vorticity: 0.25, dissipation: 0.002, diffusion: 0.000005, viscosity: 0, buoyancy: 0.5, tempCooling: 0.04, pressureIters: 40, dt: 1 },
        setup: (lab) => {
          lab.state.preset = lab.state.preset || 'water';
          lab.state.smoke = lab.state.preset === 'wind';
          if (lab.state.preset === 'wind') placeShape(lab, 'circle');
          else if (lab.state.preset === 'slowmo') seedStripes(lab);
          else if (lab.state.preset === 'water' || lab.state.preset === 'wobbly') {
            const s = lab.engine;
            DROPS.slice(0, 3).forEach((hex, i) => { const c = rgb(hex); const x = s.W * (0.25 + 0.25 * i), y = s.H * (0.35 + 0.3 * (i % 2)); s.addDye(x, y, 8, c[0], c[1], c[2], 1.5); s.addVortex(x, y, 9, (i % 2 ? -1 : 1) * 0.9); });
          }
        },
        onFrame: (lab) => { if (lab.state.smoke && lab.engine.params.windX > 0) smokeStripes(lab, [0.8, 0.82, 0.9], 5, 0.5); },
        onClear: (lab) => { if (lab.engine.params.windX > 0 && lab.engine.setUniformFlow) lab.engine.setUniformFlow(lab.engine.params.windX, 0); },
        controls: [
          { type: 'segment', big: true, options: [
            { value: 'water', icon: '💧', label: '@preset_water' }, { value: 'honey', icon: '🍯', label: '@preset_honey' },
            { value: 'smoke', icon: '🕯️', label: '@preset_smoke' }, { value: 'wind', icon: '🌬️', label: '@preset_wind' },
            { value: 'slowmo', icon: '🐢', label: '@preset_slowmo' }, { value: 'wobbly', icon: '🫨', label: '@preset_wobbly' },
          ], get: (lab) => lab.state.preset, set: (lab, v) => applyPreset(lab, v) },
          { type: 'section' },
          { type: 'brushes' }, { type: 'colors', rainbow: true },
          playback({}),
        ].concat(rules(['thickness', 'spread', 'swirls', 'weight', 'wind', 'lift'], VIEWS)).concat([
          { type: 'segment', label: '@boxes', options: [
            { value: 'low', label: '160' }, { value: 'medium', label: '256' }, { value: 'high', label: '384' },
          ], get: (lab) => lab.quality, set: (lab, v) => { lab.setQuality(v); lab.buildControls(); } },
        ]),
      },
    },
  ];

  function startRound(lab, round) {
    const keep = Object.assign({}, lab.persist);
    lab.reset();
    Object.assign(lab.persist, keep);
    for (const id of ['wait', 'stir']) if (keep[id]) lab.setMeter(id, keep[id].frac, keep[id].text);
    lab.state.round = round; lab.state.startMs = performance.now(); lab.state.done = false;
    lab.brush = round === 2 ? 'push' : 'none';
    lab.setHint(lab.t(round === 1 ? 'handsOff' : 'stirNow'));
  }

  const PRESETS = {
    water: { params: { viscosity: 0, diffusion: 0.000005, dissipation: 0.002, vorticity: 0.25, inkWeight: 0, buoyancy: 0.5, windX: 0, pressureIters: 24, dt: 1, advect: true, project: true, diffuse: true, sharpVelocity: false }, brush: 'push', rainbow: true },
    honey: { params: { viscosity: 0.00015, diffusion: 0, dissipation: 0, vorticity: 0, inkWeight: 0, buoyancy: 0, windX: 0, pressureIters: 24, dt: 1, advect: true, project: true, diffuse: true, sharpVelocity: false }, brush: 'push', rainbow: false, color: '#ffd23f' },
    smoke: { params: { viscosity: 0, diffusion: 0.00003, dissipation: 0.008, vorticity: 0.45, inkWeight: 0, buoyancy: 0.8, windX: 0, pressureIters: 24, dt: 1, advect: true, project: true, diffuse: true, sharpVelocity: false }, brush: 'heat', rainbow: false, color: '#ffffff' },
    wind: { params: { viscosity: 0, diffusion: 0, dissipation: 0.005, vorticity: 0.02, inkWeight: 0, buoyancy: 0, windX: 0.6, pressureIters: 28, dt: 1, advect: true, project: true, diffuse: true, sharpVelocity: true }, brush: 'solid', rainbow: false, color: '#ffffff', shape: 'circle' },
    slowmo: { params: { viscosity: 0, diffusion: 0.00001, dissipation: 0, vorticity: 0.3, inkWeight: 0, buoyancy: 0.5, windX: 0, pressureIters: 24, dt: 0.2, advect: true, project: true, diffuse: true, sharpVelocity: false }, brush: 'vortex', rainbow: true },
    wobbly: { params: { viscosity: 0, diffusion: 0.00002, dissipation: 0.002, vorticity: 0.25, inkWeight: 0, buoyancy: 0, windX: 0, pressureIters: 1, dt: 1, advect: true, project: true, diffuse: true, sharpVelocity: false }, brush: 'push', rainbow: true },
  };

  function applyPreset(lab, name) {
    const p = PRESETS[name];
    if (!p) return;
    lab.state.preset = name;
    lab.engine.reset();
    Object.assign(lab.engine.params, p.params);
    lab.brush = p.brush; lab.rainbow = !!p.rainbow; if (p.color) lab.color = p.color;
    lab.state.smoke = name === 'wind';
    if (p.shape) placeShape(lab, p.shape);
    if (name === 'slowmo') seedStripes(lab);
    lab.buildControls();
  }

  root.CHAPTERS = CHAPTERS;
})(window);
