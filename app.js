/* Fluid Lab — navigation, language and look switching, wiring content + chapter configs to the Lab. */
(function () {
  'use strict';

  const store = {
    get(k, d) { try { const v = localStorage.getItem('fluidlab.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fluidlab.' + k, v); } catch (e) { /* ignore */ } },
  };

  const UI = CONTENT.ui;
  const TEXT = {};
  for (const c of CONTENT.chapters) TEXT[c.id] = c;

  let lang = store.get('lang', 'en');
  if (lang !== 'en' && lang !== 'he') lang = 'en';
  let look = store.get('look', 'glow');
  if (look !== 'glow' && look !== 'paper') look = 'glow';
  const fromUrl = parseInt(new URLSearchParams(location.search).get('ch') || '', 10);
  let index = Number.isFinite(fromUrl) ? fromUrl - 1 : parseInt(store.get('chapter', '0'), 10) || 0;
  index = Math.max(0, Math.min(CHAPTERS.length - 1, index));
  const seen = new Set((store.get('seen', '') || '').split(',').filter(Boolean).map(Number));

  const t = (key) => (UI[lang] && UI[lang][key]) || UI.en[key] || key;
  const tx = (v) => (typeof v === 'string' ? v : (v[lang] || v.en));
  const list = (v) => (v && (v[lang] || v.en)) || [];

  const lessonEl = document.getElementById('lesson');
  const storyEl = document.getElementById('lessonStory');
  const rulesEl = document.getElementById('lessonRules');
  const footEl = document.getElementById('lessonFoot');
  let tab = 'story';
  function setTab(name) {
    tab = name;
    document.querySelectorAll('#tabs .tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'));
    storyEl.hidden = name !== 'story';
    rulesEl.hidden = name !== 'rules';
  }
  document.querySelectorAll('#tabs .tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  const mapEl = document.getElementById('chapterMap');
  const langBtn = document.getElementById('langBtn');
  const lookBtn = document.getElementById('lookBtn');
  const lab = new Lab(document.getElementById('lab'), t);
  lab.rulesEl = rulesEl;
  lab.lang = lang;
  lab.setLook(look);
  window.fluidLab = lab;

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ui]').forEach((el) => { el.textContent = t(el.dataset.ui); });
    document.title = t('brand');
    syncLookBtn();
    lab.setLang(lang);
  }

  function syncLookBtn() {
    lookBtn.innerHTML = look === 'glow'
      ? `${gameIcon('paper')}<span>${t('look_paper')}</span>`
      : `${gameIcon('sun')}<span>${t('look_glow')}</span>`;
    lookBtn.title = t('look');
    langBtn.innerHTML = `${gameIcon('globe')}<span>${t('langButton')}</span>`;
    const mb = document.getElementById('menuBtn');
    mb.innerHTML = `${gameIcon('grid')}<span>${t('chapters')}</span>`;
    document.querySelector('[data-tab="story"]').innerHTML = `${gameIcon('book')}<span>${t('tab_story')}</span>`;
    document.querySelector('[data-tab="rules"]').innerHTML = `${gameIcon('sliders')}<span>${t('tab_rules')}</span>`;
  }

  // Titles land letter by letter (Cloud Bridge Racers' kinetic title).
  function kinetic(text) {
    return Array.from(text).map((ch, i) => ch === ' ' ? ' ' : `<span class="title-letter" style="--glyph:${i}">${ch}</span>`).join('');
  }

  function buildMap() {
    mapEl.innerHTML = '';
    CHAPTERS.forEach((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const text = TEXT[ch.id];
      b.innerHTML = i === index ? `<span class="ic">${text.emoji}</span>` : String(i + 1);
      b.title = tx(text.title);
      b.setAttribute('aria-current', i === index ? 'true' : 'false');
      if (seen.has(i)) b.classList.add('seen');
      b.addEventListener('click', () => go(i));
      mapEl.appendChild(b);
    });
  }

  function buildMenu() {
    const list = document.getElementById('chapterList');
    list.innerHTML = '';
    CHAPTERS.forEach((ch, i) => {
      const text = TEXT[ch.id];
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="n">${i + 1}</span><span class="ic">${text.emoji}</span><span>${tx(text.title)}</span>`;
      b.setAttribute('aria-current', i === index ? 'true' : 'false');
      b.addEventListener('click', () => { document.getElementById('chapterMenu').open = false; go(i); });
      list.appendChild(b);
    });
  }
  document.addEventListener('click', (e) => { const m = document.getElementById('chapterMenu'); if (m.open && !m.contains(e.target)) m.open = false; });

  function renderLesson() {
    const ch = CHAPTERS[index], text = TEXT[ch.id];
    const isLast = index === CHAPTERS.length - 1;
    const science = list(text.science).map((p) => `<p>${p}</p>`).join('');
    const challenge = list(text.challenge).map((s) => `<li>${s}</li>`).join('');
    storyEl.innerHTML = `
      <div class="lesson-head">
        <span class="lesson-emoji">${text.emoji}</span>
        <div>
          <div class="badge">${t('chapter')} ${index + 1} ${t('of')} ${CHAPTERS.length}</div>
          <h1>${kinetic(tx(text.title))}</h1>
        </div>
      </div>
      <p class="invite">${tx(text.invite)}</p>
      <p class="discover">${tx(text.discover)}</p>
      <div class="card challenge"><h3>🎯 ${t('challenge')}</h3><ul>${challenge}</ul></div>
      <div class="card ask"><h3>💬 ${t('ask')}</h3><p>${tx(text.ask)}</p></div>
      <details class="peek science"><summary><span class="ic">🔬</span><span>${t('peekInside')}</span></summary><div class="peek-body">${science}</div></details>
      ${isLast ? `<div class="finish">🎉 ${t('finished')}</div>` : ''}
      <div class="foot-notes"><span>${t('keyHint')}</span><span>${t('source')}: <a href="https://youtu.be/mOvtumfyjCs" target="_blank" rel="noopener">Two Minute Papers</a></span></div>
    `;
    footEl.innerHTML = `
        <button class="nav-btn" id="prevBtn" type="button" title="${t('prev')}" ${index === 0 ? 'disabled' : ''}>${gameIcon('back')}</button>
        <span class="nav-count">${index + 1} / ${CHAPTERS.length}</span>
        <button class="nav-btn primary" id="nextBtn" type="button" ${isLast ? 'disabled' : ''}><span>${t('next')}</span>${gameIcon('arrow')}</button>
    `;
    footEl.querySelector('#prevBtn').addEventListener('click', () => go(index - 1));
    footEl.querySelector('#nextBtn').addEventListener('click', () => go(index + 1));
    setTab('story');
    storyEl.style.animation = 'none'; void storyEl.offsetWidth; storyEl.style.animation = '';
  }

  function go(i, force) {
    if (i < 0 || i >= CHAPTERS.length) return;
    if (i === index && !force) return;
    index = i;
    seen.add(i);
    store.set('chapter', String(i));
    store.set('seen', Array.from(seen).join(','));
    history.replaceState(null, '', '?ch=' + (i + 1));
    renderLesson();
    buildMap();
    buildMenu();
    lab.setHint('');
    lab.load(CHAPTERS[i].lab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  langBtn.addEventListener('click', () => {
    lang = lang === 'en' ? 'he' : 'en';
    store.set('lang', lang);
    applyLang();
    renderLesson();
    buildMap();
    buildMenu();
  });

  lookBtn.addEventListener('click', () => {
    look = look === 'glow' ? 'paper' : 'glow';
    store.set('look', look);
    lab.setLook(look);
    document.documentElement.dataset.look = look;
    syncLookBtn();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    const rtl = lang === 'he';
    if (e.key === 'ArrowRight') go(index + (rtl ? -1 : 1));
    else if (e.key === 'ArrowLeft') go(index + (rtl ? 1 : -1));
  });

  document.documentElement.dataset.look = look;
  applyLang();
  seen.add(index);
  renderLesson();
  buildMap();
  buildMenu();
  lab.load(CHAPTERS[index].lab);
})();
