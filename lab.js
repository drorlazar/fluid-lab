/*
  Lab — one reusable fluid playground: a WebGL canvas (GpuFluid) or a 2D canvas (CPU FluidSolver
  for the grid chapter and as a fallback), pointer brushes, render modes, and a controls tray
  built from a chapter config. Depends on fluid.js and gpu.js.
*/
(function (root) {
  'use strict';

  const BG = [14, 10, 18];
  const STONE = [115, 108, 102];

  const BRUSH_ICONS = { push: '🖐️', dye: '🎨', swirl: '🌀', heat: '🕯️', vortex: '🌪️', solid: '🧱', eraser: '🧽', none: '👀', orbit: '🔄' };
  const BRUSH_KEYS = { push: 'stir', dye: 'color', swirl: 'swirl', heat: 'candle', vortex: 'whirl', solid: 'build', eraser: 'erase', none: 'watch', orbit: 'orbit' };
  const VIEW_ICONS = { dye: '🎨', speed: '🔥', arrows: '➡️', curl: '🌀', pressure: '💨', grid: '🔲', mountains: '⛰️' };
  const VIEW_KEYS = { dye: 'ink', speed: 'speed', arrows: 'arrows', curl: 'swirls', pressure: 'pressure', grid: 'grid', mountains: 'mountains' };
  // velocity grid width (cells across) and dye multiplier per tier; the ink is what needs the pixels
  const QUALITY = { low: { sim: 160, dye: 4, vol: 48 }, medium: { sim: 256, dye: 4, vol: 64 }, high: { sim: 384, dye: 4, vol: 80 } };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  class Lab {
    constructor(host, t) {
      this.host = host;
      this.t = t;
      this.lang = 'en';
      this.config = null;
      this.engine = null;
      this.running = false;
      this.paused = false;
      this.frame = 0;
      this.meters = {};
      this.state = {};
      this.persist = {};
      this.pointer = { down: false, x: 0, y: 0, lx: 0, ly: 0, button: 0 };
      this.vortexSign = 1;
      this.look = 'glow';
      // phones and tablets start one tier down; the frame watchdog can drop further
      this.mobile = window.innerWidth < 900 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      this.quality = this.mobile ? 'low' : 'medium';
      this.gpuOk = false;
      this.touched = false;
      this._frameTimes = [];

      host.innerHTML = '';
      this.stageEl = document.createElement('div');
      this.stageEl.className = 'lab-stage';
      this.glCanvas = document.createElement('canvas');
      this.glCanvas.className = 'lab-gl';
      this.ov = document.createElement('canvas');
      this.ov.className = 'lab-overlay';
      this.stageEl.append(this.glCanvas, this.ov);
      this.hintEl = document.createElement('div');
      this.hintEl.className = 'lab-hint';
      this.hintEl.hidden = true;
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'lab-toast';
      this.toastEl.hidden = true;
      this.stageEl.append(this.hintEl, this.toastEl);
      this.controlsEl = document.createElement('div');
      this.controlsEl.className = 'lab-controls';
      host.append(this.stageEl, this.controlsEl);
      this.octx = this.ov.getContext('2d');
      this.off = document.createElement('canvas');
      this.offctx = this.off.getContext('2d');

      try { this.gpuOk = GpuFluid.supported(document.createElement('canvas')); } catch (e) { this.gpuOk = false; }

      this._bindPointer();
      // the floating rules drawer closes when you click anywhere else
      document.addEventListener('pointerdown', (e) => {
        const open = this.controlsEl.querySelector('details.peek[open]');
        if (open && !open.contains(e.target)) open.open = false;
      });
      this._resizeObserver = new ResizeObserver(() => this._fitCanvas());
      this._resizeObserver.observe(this.host);
      this._resizeObserver.observe(this.controlsEl);
      this._loopId = 0;
    }

    // '@key' resolves through the UI dictionary; {en, he} objects and plain strings pass through.
    tx(v) { return v == null ? '' : typeof v === 'string' ? (v[0] === '@' ? this.t(v.slice(1)) : v) : (v[this.lang] || v.en || ''); }
    get solver() { return this.engine; }

    // ---------- lifecycle ----------

    load(config) {
      this.stop();
      this.ready = false;
      this.config = config;
      this.state = {};
      this.persist = {};
      this.meters = {};
      this.frame = 0;
      this.paused = !!config.paused;
      this.brush = config.brush || 'push';
      this.brushSize = config.brushSize || 4;
      this.pushStrength = config.pushStrength || 0.6;
      this.colors = config.colors || ['#f59e0b'];
      this.color = config.color || this.colors[0];
      this.rainbow = !!config.rainbow;
      this.view = config.render || 'dye';
      this.showNumbers = false;
      this.speedScale = config.speedScale || 1.5;
      this.touched = false;
      this._buildEngine(config.grid || [128, 80]);
      if (config.setup) config.setup(this);
      this.ready = true;
      this.buildControls();
      this._fitAspect();
      this.render();
      this.start();
    }

    // On a desktop layout the water fills the free box: keep the chapter's width in reference cells,
    // derive the height from the space the tray actually gets (minus the controls dock).
    _fitAspect() {
      const cfg = this.config;
      if (this.cpu || cfg.fillAspect === false) return;
      if (this.volume) {
        // the raymarched box renders at any aspect: just size the canvas to the free space
        const col = this.host.getBoundingClientRect();
        const ctlH = this.controlsEl.hidden ? 0 : this.controlsEl.offsetHeight + 14;
        const availW = col.width, availH = window.innerWidth <= 1080 ? Math.round(window.innerHeight * 0.6) : col.height - ctlH;
        if (availW > 100 && availH > 100) { const H = Math.max(6, Math.round(16 * availH / availW)); if (H !== this.engine.H) { this.engine.H = H; this._fitCanvas(); } }
        return;
      }
      const col = this.host.getBoundingClientRect();
      const ctlH = this.controlsEl.hidden ? 0 : this.controlsEl.offsetHeight + 14;
      // desktop: fill the free height beside the card; phone/tablet: about 60% of the screen height
      const availW = col.width, availH = window.innerWidth <= 1080 ? Math.round(window.innerHeight * 0.6) : col.height - ctlH;
      if (availW < 200 || availH < 200) return;
      const [W] = cfg.grid || [128, 80];
      const H = Math.max(40, Math.round(W * availH / availW));
      if (Math.abs(H - this.engine.H) < 3) return;
      this.ready = false;
      this._keepParams = true;
      const hadState = this.frame > 0 || this.touched;
      this._buildEngine([W, H], hadState && !this.cpu);
      this._keepParams = false;
      if (!hadState && cfg.setup) cfg.setup(this);
      this.ready = true;
    }

    _buildEngine(grid, inherit) {
      const [w, h] = grid;
      const keep = (this.engine && this._keepParams) ? Object.assign({}, this.engine.params) : null;
      const old = this.engine;
      if (old && old.dispose && !inherit) old.dispose();
      const useCpu = this.config.engine === 'cpu' || !this.gpuOk;
      this.cpu = useCpu;
      this.volume = false;
      if (!useCpu && this.config.engine === 'volume') {
        const q = QUALITY[this.quality] || QUALITY.medium;
        try {
          this.engine = new VolumeFluid(this.glCanvas, q.vol);
          this.engine.look = this.look;
          this.volume = true;
          this.glCanvas.hidden = false;
        } catch (err) {
          console.warn('Fluid Lab: 3D engine failed.', err);
          this.engine = new FluidSolver(w, h); this.cpu = true; this.glCanvas.hidden = true;
          this.off.width = w + 2; this.off.height = h + 2; this.img = this.offctx.createImageData(w + 2, h + 2);
        }
      } else if (useCpu) {
        this.engine = new FluidSolver(w, h);
        this.off.width = w + 2; this.off.height = h + 2;
        this.img = this.offctx.createImageData(w + 2, h + 2);
        this.glCanvas.hidden = true;
      } else {
        const q = QUALITY[this.quality] || QUALITY.medium;
        try {
          // a chapter may ask for a coarser ink grid (blurry-by-design chapters diffuse far faster there)
          this.engine = new GpuFluid(this.glCanvas, w, h, q.sim, this.config.dyeMul || q.dye);
          this.engine.look = this.look;
          this.glCanvas.hidden = false;
        } catch (err) {
          console.warn('Fluid Lab: GPU engine failed, using the CPU solver.', err);
          this.gpuOk = false;
          this.cpu = true;
          this.engine = new FluidSolver(w, h);
          this.off.width = w + 2; this.off.height = h + 2;
          this.img = this.offctx.createImageData(w + 2, h + 2);
          this.glCanvas.hidden = true;
        }
      }
      if (this.config.params) Object.assign(this.engine.params, this.config.params);
      if (keep) Object.assign(this.engine.params, keep);
      if (inherit && old && old.isGpu && this.engine.isGpu && !this.volume && !old.isVolume) { this.engine.copyFrom(old); old.dispose(); }
      else if (inherit && old && old.dispose) old.dispose();
      this._fitCanvas();
    }

    // rebuild at another quality tier (sandbox "boxes" control, or auto-tiering)
    setQuality(q) {
      if (!QUALITY[q] || q === this.quality) return;
      this.quality = q;
      this._rebuild();
    }
    _rebuild() {
      this.ready = false;
      this._keepParams = true;
      this._buildEngine([this.engine.W, this.engine.H], !this.cpu);
      this._keepParams = false;
      this.ready = true;
      this.render();
    }
    setLook(look) {
      this.look = look;
      if (this.engine && this.engine.isGpu) this.engine.look = look;
      this.stageEl.dataset.look = look;
      this.render();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = performance.now();
      this._acc = 0;
      const id = ++this._loopId;
      const loop = (now) => {
        if (!this.running || id !== this._loopId) return;
        this._loop(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    stop() { this.running = false; this._loopId = (this._loopId || 0) + 1; }

    reset() {
      this.ready = false;
      this.engine.reset();
      this.frame = 0;
      this.state = {};
      if (this.config.setup) this.config.setup(this);
      this.ready = true;
      this.buildControls();
      this.render();
    }

    stepOnce() { this._tick(); this.render(); }

    setLang(lang) { this.lang = lang; if (this.config) this.buildControls(); }

    setView(v) {
      const was3d = this.is3d;
      this.view = v;
      if (this.is3d && !was3d) { if (this.brush === 'none') this.brush = this.config.brushes ? this.config.brushes[0] : 'push'; this.setHint(this.t('orbitHint')); }
      if (!this.is3d && was3d) { if (this.brush === 'orbit') this.brush = this.config.brush || 'push'; this.setHint(''); }
      this.buildControls();
    }

    // Restart: fresh water, same walls, candles and settings.
    restart() {
      this.engine.clearDye(); this.engine.clearVelocity(); this.engine.clearHeat();
      this.frame = 0;
      if (this.config.onClear) this.config.onClear(this);
      this.render();
    }

    // Put every solver parameter back to what the chapter started with.
    restoreParams() {
      const eng = this.engine;
      const base = Object.assign({}, eng.isVolume ? VolumeFluid.DEFAULTS : eng.isGpu ? GpuFluid.DEFAULTS : FluidSolver.DEFAULTS || {}, this.config.params || {});
      Object.assign(eng.params, base);
      this.buildControls();
    }

    // ---------- loop ----------

    // One simulation step per 1/60 s of wall time, whatever the display refresh rate (60, 90, 120 Hz).
    _loop(now) {
      const dtms = Math.min(100, now - (this._last || now));
      this._last = now;
      if (!this.paused) {
        this._acc = (this._acc || 0) + dtms;
        if (this._acc >= 1000 / 60) { this._tick(); this._acc = Math.min(this._acc - 1000 / 60, 1000 / 60); }
      }
      this.render();
      this._watchFrame(dtms);
    }

    _tick() {
      const cfg = this.config;
      if (cfg.onFrame) cfg.onFrame(this);
      this.engine.step();
      this.frame++;
      if (cfg.wantsMixedness && this.engine.isGpu && this.frame % 8 === 0) this.engine.updateMixedness();
    }

    // Drop a quality tier if the GPU can't keep up for a couple of seconds.
    _watchFrame(dtms) {
      if (!this.engine || !this.engine.isGpu || this.paused) return;
      const ft = this._frameTimes;
      ft.push(dtms);
      if (ft.length < 120) return;
      const slow = ft.filter((x) => x > 30).length;
      ft.length = 0;
      if (slow > 80) {
        if (this.quality === 'high') this.setQuality('medium');
        else if (this.quality === 'medium') this.setQuality('low');
      }
    }

    // ---------- sizing ----------

    _fitCanvas() {
      if (!this.engine) return;
      const W = this.engine.W, H = this.engine.H;
      const col = this.host.getBoundingClientRect();
      let cssW = Math.max(200, col.width);
      // on a desktop layout the whole page must fit the viewport: cap the tray by the free height too
      if (window.innerWidth > 1080 && col.height > 200) {
        const ctlH = this.controlsEl.hidden ? 0 : this.controlsEl.offsetHeight + 18;
        const availH = col.height - ctlH;
        cssW = Math.max(200, Math.min(cssW, availH * W / H));
      }
      const cssH = cssW * H / W;
      this.stageEl.style.width = cssW + 'px';
      let dpr = Math.min(this.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
      const cap = this.mobile ? 1.0e6 : 1.8e6;
      if (cssW * cssH * dpr * dpr > cap) dpr = Math.sqrt(cap / (cssW * cssH));
      this.stageEl.style.height = cssH + 'px';
      for (const c of [this.glCanvas, this.ov]) {
        c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
        c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
      }
      this.dpr = dpr; this.cssW = cssW; this.cssH = cssH;
      this.render();
      // the box may have changed shape (window resize, dock grew): re-derive the water's aspect, debounced
      clearTimeout(this._aspectT);
      this._aspectT = setTimeout(() => { if (this.ready) this._fitAspect(); }, 150);
    }

    // ---------- pointer ----------

    get is3d() { return (this.view === 'mountains' && !this.cpu) || !!this.volume; }

    _gridPos(e) {
      const r = this.ov.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      if (this.is3d && this.engine.pick) {
        const hit = this.engine.pick(px * 2 - 1, 1 - py * 2);
        if (hit) return hit;
        return { x: 0, y: 0, z: 0, inside: false };
      }
      return { x: 1 + px * this.engine.W, y: 1 + py * this.engine.H, inside: px >= 0 && px <= 1 && py >= 0 && py <= 1 };
    }

    _bindPointer() {
      const c = this.stageEl;
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('pointerdown', (e) => {
        if (!this.engine || e.target === this.hintEl || e.target === this.toastEl) return;
        try { c.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
        const g = this._gridPos(e);
        const p = this.pointer;
        p.down = true; p.button = e.button; p.x = p.lx = g.x; p.y = p.ly = g.y; p.z = p.lz = g.z || 0;
        this._applyBrush('down', g, e);
        if (!this.touched) { this.touched = true; this.setHint(''); if (this.config.onFirstTouch) this.config.onFirstTouch(this); else if (this.brush !== 'none') { this.toast(this.t('firstTouch')); this.burst(e.clientX, e.clientY); } }
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.engine) return;
        const g = this._gridPos(e);
        const p = this.pointer;
        p.lx = p.x; p.ly = p.y; p.lz = p.z; p.x = g.x; p.y = g.y; p.z = g.z || 0;
        this.hover = g;
        if (p.down) this._applyBrush('move', g, e);
      });
      const up = (e) => { this.pointer.down = false; if (this.config && this.config.onPointer) this.config.onPointer(this, 'up', this._gridPos(e), e); };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { this.hover = null; });
      c.addEventListener('wheel', (e) => {
        if (!this.is3d) return;
        e.preventDefault();
        const cam = this.engine.cam;
        cam.dist = Math.min(7, Math.max(1.6, cam.dist * (1 + e.deltaY * 0.0015)));
      }, { passive: false });
      this._lastClient = null;
      c.addEventListener('pointermove', (e) => { this._lastClient = [e.clientX, e.clientY]; });
    }

    currentColorRgb() {
      if (this.rainbow) {
        const h = (this.frame * 2) % 360;
        const s = 0.9, l = 0.55;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
        return [f(0), f(8), f(4)];
      }
      return hexToRgb(this.color);
    }

    _applyBrush(phase, g, e) {
      const cfg = this.config, s = this.engine, p = this.pointer;
      if (cfg.onPointer && cfg.onPointer(this, phase, g, e) === true) return;
      const brush = this.brush;
      if (brush === 'none' && !(this.is3d && e && e.buttons === 2)) return;
      if (brush === 'orbit' || (this.is3d && e && (e.button === 2 || e.buttons === 2))) {
        if (phase === 'down') this._orbitFrom = null;
        if (phase === 'move' && this.is3d && this._orbitFrom) {
          const cam = this.engine.cam;
          cam.yaw -= (e.clientX - this._orbitFrom[0]) * 0.008;
          cam.pitch = Math.min(1.45, Math.max(0.25, cam.pitch + (e.clientY - this._orbitFrom[1]) * 0.006));
        }
        this._orbitFrom = [e.clientX, e.clientY];
        return;
      }
      if (!g.inside && this.is3d) return;
      const dx = p.x - p.lx, dy = p.y - p.ly;
      const R = this.brushSize;
      if (this.volume) {
        const dz = p.z - p.lz, kk = this.pushStrength;
        if (brush === 'push') {
          if (phase === 'move') s.addVelocity(g.x, g.y, g.z, R * 1.6, dx * kk, dy * kk, dz * kk);
          s.addSmoke(g.x, g.y, g.z, R, phase === 'down' ? 0.5 : 0.1, 0);
        } else if (brush === 'dye') {
          s.addSmoke(g.x, g.y, g.z, R * 1.2, phase === 'down' ? 1.4 : 0.35, 0.25);
        } else if (brush === 'heat') {
          s.addSmoke(g.x, g.y, g.z, R, 0.6, 1.6);
        }
        return;
      }
      const col = this.currentColorRgb();
      switch (brush) {
        case 'push': {
          if (phase === 'move') s.addVelocity(g.x, g.y, R, dx * this.pushStrength, dy * this.pushStrength);
          if (cfg.pushDye !== false) s.addDye(g.x, g.y, R * 0.8, col[0], col[1], col[2], phase === 'down' ? 0.5 : 0.14);
          break;
        }
        case 'dye': {
          s.addDye(g.x, g.y, R, col[0], col[1], col[2], phase === 'down' ? 0.8 : 0.25);
          if (phase === 'move') s.addVelocity(g.x, g.y, R, dx * 0.15, dy * 0.15);
          break;
        }
        case 'swirl': {
          s.addDye(g.x, g.y, R, col[0], col[1], col[2], phase === 'down' ? 0.6 : 0.15);
          if (phase === 'move') s.addVelocity(g.x, g.y, R * 1.5, dx * this.pushStrength, dy * this.pushStrength);
          break;
        }
        case 'heat': {
          s.addHeat(g.x, g.y, R, phase === 'down' ? 3 : 1);
          s.addDye(g.x, g.y, R * 0.7, 0.85, 0.8, 0.75, 0.15);
          break;
        }
        case 'vortex': {
          if (phase !== 'down') break;
          const sign = (e && e.button === 2) ? -this.vortexSign : this.vortexSign;
          s.addVortex(g.x, g.y, R * 2.2, (cfg.vortexStrength || 2.5) * sign);
          break;
        }
        case 'solid':
        case 'eraser': {
          const on = brush === 'solid';
          if (phase === 'move' && s.addSolidStroke) s.addSolidStroke(p.lx, p.ly, g.x, g.y, R, on);
          else s.setSolid(g.x, g.y, R, on);
          break;
        }
      }
    }

    // ---------- messages ----------

    setMeter(id, frac, text) {
      const m = this.meters[id];
      if (!m) return;
      if (frac != null) m.bar.style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
      if (text != null) m.value.textContent = text;
    }
    setHint(text) { this.hintEl.textContent = text || ''; this.hintEl.hidden = !text; }
    toast(text, ms) {
      this.toastEl.textContent = text; this.toastEl.hidden = false;
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { this.toastEl.hidden = true; }, ms || 1800);
    }

    // ---------- controls ----------

    buildControls() {
      const el = this.controlsEl;
      el.innerHTML = '';
      if (this.rulesEl) this.rulesEl.innerHTML = '';
      this.meters = {};
      const specs = this.config.controls || [];
      let row = null, parent = el;
      const newRow = (label) => {
        row = document.createElement('div');
        row.className = 'ctl-row';
        if (label) { const h = document.createElement('div'); h.className = 'ctl-row-label'; h.textContent = this.tx(label); row.appendChild(h); }
        parent.appendChild(row);
      };
      newRow();
      for (const spec of specs) {
        if (spec.type === 'section') { newRow(spec.label); continue; }
        if (spec.type === 'drawer') {
          if (this.rulesEl) { parent = this.rulesEl; newRow(); continue; }
          const drawer = document.createElement('details');
          drawer.className = 'peek';
          drawer.innerHTML = `<summary><span class="ic">🔬</span><span>${this.tx(spec.label) || this.t('peekInside')}</span></summary>`;
          const body = document.createElement('div'); body.className = 'peek-body';
          drawer.appendChild(body);
          el.appendChild(drawer);
          parent = body;
          newRow();
          continue;
        }
        const node = this._buildControl(spec);
        if (node) row.appendChild(node);
      }
      el.hidden = specs.length === 0;
      let i = 0;
      el.querySelectorAll('.ctl').forEach((c) => c.style.setProperty('--i', String(Math.min(i++, 14))));
    }

    // A little burst of shards where the first touch landed.
    burst(clientX, clientY) {
      const r = this.stageEl.getBoundingClientRect();
      const cols = ['#ffda35', '#ff4f9a', '#22e3d1', '#fffbed', '#b656ff'];
      for (let k = 0; k < 14; k++) {
        const s = document.createElement('i');
        s.className = 'shard';
        const a = (k / 14) * Math.PI * 2 + Math.random() * 0.4, d = 50 + Math.random() * 70;
        s.style.left = (clientX - r.left - 6) + 'px'; s.style.top = (clientY - r.top - 6) + 'px';
        s.style.background = cols[k % cols.length];
        s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
        s.style.setProperty('--dy', (Math.sin(a) * d - 30).toFixed(0) + 'px');
        s.style.setProperty('--rot', (Math.random() * 360).toFixed(0) + 'deg');
        this.stageEl.appendChild(s);
        setTimeout(() => s.remove(), 600);
      }
    }

    _buildControl(spec) {
      const t = this.t;
      // never capture the engine: the box may be rebuilt (aspect, quality) while these controls live on
      const s = { get params() { return self.engine.params; } };
      const self = this;
      switch (spec.type) {
        case 'toggle': {
          const wrap = document.createElement('button');
          wrap.className = 'ctl ctl-toggle' + (spec.big ? ' big' : '');
          wrap.type = 'button';
          wrap.setAttribute('role', 'switch');
          const get = spec.get ? () => spec.get(this) : () => !!s.params[spec.key];
          const set = spec.set ? (v) => spec.set(this, v) : (v) => { s.params[spec.key] = v; };
          const sync = () => {
            const on = get();
            wrap.setAttribute('aria-checked', on ? 'true' : 'false');
            wrap.innerHTML = `${spec.icon ? `<span class="ic">${spec.icon}</span>` : ''}<span class="ctl-label">${this.tx(spec.label)}</span><span class="sw"><i></i></span><span class="ctl-state">${on ? t('on') : t('off')}</span>`;
          };
          wrap.addEventListener('click', () => { set(!get()); sync(); if (spec.after) spec.after(this); });
          sync();
          return wrap;
        }
        case 'slider': {
          // The track is a 0..1000 position; `curve` maps it to the physical value so the useful
          // low range gets most of the travel: 'quad' (default), 'squad' (signed, centre = 0), 'lin'.
          const wrap = document.createElement('label');
          wrap.className = 'ctl ctl-slider';
          const get = spec.get ? () => spec.get(this) : () => s.params[spec.key];
          const set = spec.set ? (v) => spec.set(this, v) : (v) => { s.params[spec.key] = v; };
          const min = spec.min, max = spec.max, curve = spec.curve || (min < 0 ? 'squad' : 'quad');
          const toV = (t) => {
            if (curve === 'lin') return min + (max - min) * t;
            if (curve === 'squad') { const u = 2 * t - 1; return Math.sign(u) * u * u * max; }
            return min + (max - min) * t * t;
          };
          const toT = (v) => {
            if (curve === 'lin') return (v - min) / (max - min);
            if (curve === 'squad') { const u = Math.sign(v) * Math.sqrt(Math.abs(v) / max); return (u + 1) / 2; }
            return Math.sqrt(Math.max(0, (v - min) / (max - min)));
          };
          const snap = (v) => (spec.integer ? Math.round(v) : v);
          const fmt = spec.format ? (v) => spec.format(v, this) : (v) => (spec.integer ? String(Math.round(v)) : v.toFixed(2));
          const input = document.createElement('input');
          input.type = 'range';
          input.min = 0; input.max = 1000; input.step = 1;
          input.value = Math.round(toT(get()) * 1000);
          const lab = document.createElement('span'); lab.className = 'ctl-label'; lab.innerHTML = (spec.icon ? `<span class="ic">${spec.icon}</span>` : '') + this.tx(spec.label);
          if (spec.hint) lab.title = this.tx(spec.hint);
          const val = document.createElement('span'); val.className = 'ctl-value'; val.textContent = fmt(get());
          input.addEventListener('input', () => { const v = snap(toV(Number(input.value) / 1000)); set(v); val.textContent = fmt(v); if (spec.after) spec.after(this, v); });
          wrap.append(lab, input, val);
          if (spec.ends) { const ends = document.createElement('span'); ends.className = 'ctl-ends'; ends.innerHTML = `<span>${this.tx(spec.ends[0])}</span><span>${this.tx(spec.ends[1])}</span>`; wrap.appendChild(ends); }
          if (spec.hint) { const h = document.createElement('span'); h.className = 'ctl-hint'; h.textContent = this.tx(spec.hint); wrap.appendChild(h); }
          return wrap;
        }
        case 'button': {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ctl ctl-btn' + (spec.primary ? ' primary' : '') + (spec.big ? ' big' : '');
          b.innerHTML = (spec.icon ? `<span class="ic">${spec.icon}</span>` : '') + `<span>${this.tx(spec.label)}</span>`;
          b.addEventListener('click', () => spec.action(this, b));
          if (spec.id) this.state['btn_' + spec.id] = b;
          return b;
        }
        case 'segment': {
          const wrap = document.createElement('div');
          wrap.className = 'ctl ctl-segment';
          if (spec.label) { const l = document.createElement('span'); l.className = 'ctl-label'; l.textContent = this.tx(spec.label); wrap.appendChild(l); }
          const group = document.createElement('div'); group.className = 'seg' + (spec.big ? ' big' : '');
          const sync = () => {
            const cur = spec.get(this);
            group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(cur) ? 'true' : 'false'));
          };
          for (const o of spec.options) {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.v = String(o.value);
            const label = this.tx(o.label);
            if (spec.big && o.icon) { b.classList.add('iconic'); b.innerHTML = `<span class="ic">${o.icon}</span><span class="cap">${label}</span>`; b.title = label; }
            else b.innerHTML = (o.icon ? `<span class="ic">${o.icon}</span>` : '') + `<span>${label}</span>`;
            if (o.swatch) { b.classList.add('swatch'); b.style.setProperty('--sw', o.swatch); }
            b.addEventListener('click', () => { spec.set(this, o.value); sync(); });
            group.appendChild(b);
          }
          wrap.appendChild(group);
          sync();
          return wrap;
        }
        case 'brushes': {
          let brushes = spec.brushes || this.config.brushes || [this.brush];
          if (this.is3d) brushes = ['orbit'].concat(brushes.filter((b) => b !== 'orbit'));
          if (brushes.length < 2 && !spec.force) return null;
          const names = this.config.brushLabels || {};
          return this._buildControl({
            type: 'segment', big: true, label: spec.label,
            options: brushes.map((b) => ({ value: b, icon: (this.config.brushIcons || {})[b] || BRUSH_ICONS[b], label: names[b] ? this.tx(names[b]) : t('tool_' + BRUSH_KEYS[b]) })),
            get: () => this.brush, set: (_, v) => { this.brush = v; },
          });
        }
        case 'colors': {
          return this._buildControl({
            type: 'segment', big: true, label: spec.label,
            options: this.colors.map((c) => ({ value: c, swatch: c, label: '' })).concat(spec.rainbow ? [{ value: 'rainbow', icon: '🌈', label: t('rainbow') }] : []),
            get: () => (this.rainbow ? 'rainbow' : this.color),
            set: (_, v) => { if (v === 'rainbow') this.rainbow = true; else { this.rainbow = false; this.color = v; } },
          });
        }
        case 'views': {
          const modes = spec.modes || this.config.renderModes || ['dye'];
          if (modes.length < 2) return null;
          return this._buildControl({
            type: 'segment', label: spec.label, big: spec.big,
            options: modes.map((m) => ({ value: m, icon: VIEW_ICONS[m], label: t('view_' + VIEW_KEYS[m]) })),
            get: () => this.view, set: (_, v) => this.setView(v),
          });
        }
        case 'height': {
          if (!this.is3d || this.volume) return null;
          return this._buildControl({
            type: 'segment', label: t('height'),
            options: [{ value: 'pressure', icon: '💨', label: t('height_pressure') }, { value: 'ink', icon: '🎨', label: t('height_ink') }, { value: 'speed', icon: '🔥', label: t('height_speed') }],
            get: () => this.height || 'pressure', set: (_, v) => { this.height = v; },
          });
        }
        case 'look': {
          if (this.cpu) return null;
          return this._buildControl({
            type: 'segment', label: t('look'),
            options: [{ value: 'glow', icon: '✨', label: t('look_glow') }, { value: 'paper', icon: '📄', label: t('look_paper') }],
            get: () => this.look, set: (_, v) => this.setLook(v),
          });
        }
        case 'playback': {
          const wrap = document.createElement('div');
          wrap.className = 'ctl ctl-playback';
          const gi = (n) => (root.gameIcon ? root.gameIcon(n) : '');
          const mk = (icon, label, fn, cls) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'ctl-btn iconic' + (cls ? ' ' + cls : '');
            b.innerHTML = `${gi(icon)}<span class="cap">${label}</span>`; b.title = label; b.addEventListener('click', () => fn(b)); wrap.appendChild(b); return b;
          };
          const play = mk(this.paused ? 'play' : 'pause', this.paused ? t('go') : t('freeze'), (b) => {
            this.paused = !this.paused;
            b.innerHTML = `${gi(this.paused ? 'play' : 'pause')}<span class="cap">${this.paused ? t('go') : t('freeze')}</span>`;
          }, spec.primaryPlay ? 'primary' : '');
          if (spec.step !== false) mk('step', t('step'), () => { this.paused = true; play.innerHTML = `${gi('play')}<span class="cap">${t('go')}</span>`; this.stepOnce(); }, spec.primaryStep ? 'primary' : '');
          if (spec.clear !== false) mk('restart', t('restart'), () => this.restart());
          if (spec.reset !== false) mk('home', t('startOver'), () => this.reset());
          return wrap;
        }
        case 'meter': {
          const wrap = document.createElement('div');
          wrap.className = 'ctl ctl-meter';
          wrap.innerHTML = `<span class="ctl-label">${this.tx(spec.label)}</span><span class="meter-value">—</span><div class="meter-bar"><i></i></div>`;
          this.meters[spec.id] = { value: wrap.querySelector('.meter-value'), bar: wrap.querySelector('.meter-bar i') };
          if (spec.color) wrap.style.setProperty('--meter', spec.color);
          return wrap;
        }
      }
      return null;
    }

    // ---------- rendering ----------

    render() {
      if (!this.ready || !this.engine) return;
      const ctx = this.octx, cw = this.ov.width, ch = this.ov.height;
      const W = this.engine.W, H = this.engine.H;
      const cellW = cw / W, cellH = ch / H;
      const view = this.view;
      if (this.volume) {
        this.engine.render({ fire: this.config.fire, densScale: this.config.densScale, steps: this.mobile ? 64 : 96 });
        ctx.clearRect(0, 0, cw, ch);
        return;
      }
      if (this.cpu) {
        this._renderCpu(ctx, cw, ch, view);
      } else {
        this.engine.render({ view, speedScale: this.speedScale, tempGlow: this.config.tempGlow !== false, bloom: this.config.bloom !== false, arrowsAcross: 36, height: this.height || 'pressure', heightGain: this.heightGain || 1 });
        ctx.clearRect(0, 0, cw, ch);
      }
      if (this.is3d) return;
      if (view === 'grid' || this.config.showGrid) this._drawGrid(ctx, cw, ch, cellW, cellH);
      if (this.cpu && (view === 'arrows' || (view === 'grid' && this.config.gridArrows))) this._drawArrows(ctx, cellW, cellH, view === 'grid' ? 1 : Math.max(1, Math.round(W / 24)));
      if (view === 'grid' && this.showNumbers) this._drawNumbers(ctx, cellW, cellH);
      if (this.config.overlay) this.config.overlay(ctx, this, cellW, cellH);
      if (!this.pointer.down && this.hover && this.brush !== 'none' && this.config.showCursor !== false) this._drawCursor(ctx, cellW, cellH);
    }

    _renderCpu(ctx, cw, ch, view) {
      const s = this.engine, W = s.W, H = s.H, n = s.size;
      const data = this.img.data, solid = s.solid, r = s.r, g = s.g, b = s.b;
      const paper = this.look === 'paper';
      const bg = paper ? [247, 242, 230] : BG;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (solid[i]) { data[o] = STONE[0]; data[o + 1] = STONE[1]; data[o + 2] = STONE[2]; data[o + 3] = 255; continue; }
        let rr = clamp(r[i], 0, 1), gg = clamp(g[i], 0, 1), bb = clamp(b[i], 0, 1);
        if (paper) {
          const d = Math.max(rr, gg, bb);
          const hr = d > 0 ? rr / d : 1, hg = d > 0 ? gg / d : 1, hb = d > 0 ? bb / d : 1;
          data[o] = bg[0] * (1 - d + d * hr * 0.92); data[o + 1] = bg[1] * (1 - d + d * hg * 0.92); data[o + 2] = bg[2] * (1 - d + d * hb * 0.92);
        } else {
          rr *= 2 - rr; gg *= 2 - gg; bb *= 2 - bb;
          data[o] = bg[0] + rr * (255 - bg[0]); data[o + 1] = bg[1] + gg * (255 - bg[1]); data[o + 2] = bg[2] + bb * (255 - bg[2]);
        }
        data[o + 3] = 255;
      }
      this.offctx.putImageData(this.img, 0, 0);
      ctx.imageSmoothingEnabled = view !== 'grid';
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(this.off, 1, 1, W, H, 0, 0, cw, ch);
    }

    _drawGrid(ctx, cw, ch, cellW, cellH) {
      const s = this.engine;
      ctx.save();
      ctx.strokeStyle = this.look === 'paper' ? 'rgba(40,30,20,0.18)' : 'rgba(250,250,249,0.18)';
      ctx.lineWidth = 1 * this.dpr;
      ctx.beginPath();
      for (let i = 0; i <= s.W; i++) { const x = Math.round(i * cellW) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
      for (let j = 0; j <= s.H; j++) { const y = Math.round(j * cellH) + 0.5; ctx.moveTo(0, y); ctx.lineTo(cw, y); }
      ctx.stroke();
      ctx.restore();
    }

    _drawArrows(ctx, cellW, cellH, stride) {
      const s = this.engine, W = s.W, H = s.H, S = s.stride;
      ctx.save();
      const col = this.look === 'paper' ? 'rgba(30,20,10,0.85)' : 'rgba(250,250,249,0.85)';
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = Math.max(1, 1.4 * this.dpr);
      const maxLen = Math.min(cellW, cellH) * stride * 0.9;
      // scale to the strongest cell so even a gentle push shows as a readable arrow
      let vmax = 0;
      for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) { const idx = i + j * S; const m = Math.hypot(s.u[idx], s.v[idx]); if (m > vmax) vmax = m; }
      if (vmax < 1e-4) { ctx.restore(); return; }
      const scale = maxLen / vmax;
      const floor = vmax * 0.06;
      for (let j = 1; j <= H; j += stride) for (let i = 1; i <= W; i += stride) {
        const idx = i + j * S;
        if (s.solid[idx]) continue;
        const u = s.u[idx], v = s.v[idx];
        const len = Math.sqrt(u * u + v * v);
        if (len < floor) continue;
        const L = Math.max(Math.min(cellW, cellH) * 0.35, Math.min(maxLen, len * scale));
        const cx = (i - 1 + (stride - 1) / 2 + 0.5) * cellW, cy = (j - 1 + (stride - 1) / 2 + 0.5) * cellH;
        const nx = u / len, ny = v / len;
        const x1 = cx - nx * L / 2, y1 = cy - ny * L / 2, x2 = cx + nx * L / 2, y2 = cy + ny * L / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const hw = Math.max(2, L * 0.25);
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - nx * hw - ny * hw * 0.5, y2 - ny * hw + nx * hw * 0.5);
        ctx.lineTo(x2 - nx * hw + ny * hw * 0.5, y2 - ny * hw - nx * hw * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // Grid chapter: the amount of ink in each box (0..1), so the numbers add up.
    _drawNumbers(ctx, cellW, cellH) {
      const s = this.engine, W = s.W, H = s.H, S = s.stride;
      ctx.save();
      ctx.font = `700 ${Math.max(8, Math.floor(cellH * 0.34))}px "Nunito", ui-rounded, "JetBrains Mono", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let j = 1; j <= H; j++) for (let i = 1; i <= W; i++) {
        const idx = i + j * S;
        if (s.solid[idx]) continue;
        const d = s.r[idx] + s.g[idx] + s.b[idx];
        if (d < 0.005) continue;
        ctx.fillStyle = d > 0.6 ? 'rgba(14,10,18,0.9)' : (this.look === 'paper' ? 'rgba(30,20,10,0.9)' : 'rgba(250,250,249,0.9)');
        ctx.fillText(d >= 0.995 ? '1' : d.toFixed(2).replace(/^0/, ''), (i - 0.5) * cellW, (j - 0.5) * cellH);
      }
      ctx.restore();
    }

    _drawCursor(ctx, cellW, cellH) {
      const g = this.hover, R = this.brushSize;
      ctx.save();
      ctx.strokeStyle = this.look === 'paper' ? 'rgba(30,20,10,0.5)' : 'rgba(250,250,249,0.6)';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.setLineDash([4 * this.dpr, 4 * this.dpr]);
      ctx.beginPath();
      ctx.ellipse((g.x - 1) * cellW, (g.y - 1) * cellH, R * cellW, R * cellH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Save the composed picture as a PNG.
    savePicture(name) {
      const filename = (name || 'fluid-art') + '.png';
      const out = document.createElement('canvas');
      out.width = this.ov.width; out.height = this.ov.height;
      const c = out.getContext('2d');
      this.render();
      if (!this.cpu) c.drawImage(this.glCanvas, 0, 0);
      c.drawImage(this.ov, 0, 0);
      const done = () => this.toast(this.t('saved'));
      const plainLink = () => {
        const a = document.createElement('a');
        a.download = filename; a.href = out.toDataURL('image/png'); a.click(); done();
      };
      if (window.claude && typeof window.claude.use === 'function') {
        window.claude.use('downloads').then((dl) => {
          if (!dl) return plainLink();
          out.toBlob((blob) => { dl.save({ filename, data: blob }).then(done).catch(() => {}); }, 'image/png');
        }).catch(plainLink);
        return;
      }
      plainLink();
    }
  }

  Lab.hexToRgb = hexToRgb;
  Lab.QUALITY = QUALITY;
  root.Lab = Lab;
})(window);
