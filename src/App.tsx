import React, { useState } from 'react';
import {
  Trophy,
  Gem,
  Flame,
  BookOpen,
  Users,
  Volume2,
  VolumeX,
  Sparkles,
  Gift,
  Globe,
  Play,
  Zap,
} from 'lucide-react';
import { useGameStore } from './state/useGameStore';
import { HEROES, UI_STRINGS } from './i18n/content';
import { HeroAvatar } from './components/HeroAvatar';
import { DinoForgeMode } from './modes/DinoForgeMode';
import { SpaceSlicerMode } from './modes/SpaceSlicerMode';
import { DragonStormMode } from './modes/DragonStormMode';
import { NeonDashMode } from './modes/NeonDashMode';
import { HackerCodexModal } from './components/HackerCodexModal';
import { HeroGarageModal } from './components/HeroGarageModal';
import { sound } from './audio/soundEngine';

type ActiveScreen = 'lobby' | 'dino' | 'space' | 'dragon' | 'dash';

export const App: React.FC = () => {
  const {
    state,
    toggleLang,
    setTier,
    toggleCalmMode,
    toggleMute,
    selectHero,
    recordSuccess,
    recordHackBonus,
    openBrawlBox,
  } = useGameStore();

  const [screen, setScreen] = useState<ActiveScreen>('lobby');
  const [codexOpen, setCodexOpen] = useState<boolean>(false);
  const [garageOpen, setGarageOpen] = useState<boolean>(false);

  const t = UI_STRINGS[state.lang];
  const isHe = state.lang === 'he';
  const currentHero =
    HEROES.find((h) => h.id === state.selectedHeroId) || HEROES[0];

  // Find next locked hero for Trophy Road progress bar
  const nextLockedHero = HEROES.find((h) => h.unlockTrophies > state.trophies);
  const roadTarget = nextLockedHero ? nextLockedHero.unlockTrophies : 500;
  const roadPct = Math.min(100, Math.round((state.trophies / roadTarget) * 100));

  return (
    <div
      className={`nova-app-shell ${state.calmMode ? 'calm-mode' : ''}`}
      dir={isHe ? 'rtl' : 'ltr'}
      lang={state.lang}
    >
      {/* BRAWL STARS EXTRUDED TOPBAR */}
      <header className="brawl-topbar">
        <div
          className="brand-cluster"
          onClick={() => {
            sound.playClick();
            setScreen('lobby');
          }}
          role="button"
          tabIndex={0}
        >
          <span className="brand-star-icon">⭐</span>
          <div className="brand-text-stack">
            <span className="brand-main-name">{t.brandTitle}</span>
            <span className="brand-sub-tag">{t.brandSubtitle}</span>
          </div>
        </div>

        {/* Currency & Streak Pills */}
        <div className="hud-stats-cluster" dir="ltr">
          <div className="stat-pill trophy-pill" title={t.trophies}>
            <Trophy size={18} />
            <span>{state.trophies}</span>
          </div>
          <div className="stat-pill gem-pill" title={t.gems}>
            <Gem size={18} />
            <span>{state.gems}</span>
          </div>
          <div className="stat-pill streak-pill" title={t.streak}>
            <Flame size={18} />
            <span>×{state.streak}</span>
          </div>
        </div>

        {/* Top Action Slabs */}
        <div className="topbar-actions">
          <button
            type="button"
            className="slab primary codex-top-btn"
            onClick={() => {
              sound.playHackActivate();
              setCodexOpen(true);
            }}
          >
            <BookOpen size={19} />
            <span>{t.codexBtn}</span>
          </button>

          <button
            type="button"
            className="slab garage-top-btn"
            onClick={() => {
              sound.playClick();
              setGarageOpen(true);
            }}
          >
            <Users size={19} />
            <span>{t.heroesBtn}</span>
            {state.brawlBoxes > 0 && (
              <span className="box-badge-dot">{state.brawlBoxes}</span>
            )}
          </button>

          <button
            type="button"
            className={`slab icon-top-btn ${state.calmMode ? 'calm-active' : ''}`}
            onClick={toggleCalmMode}
            title={state.calmMode ? t.calmModeOn : t.calmModeOff}
          >
            <Sparkles size={18} />
            <span className="hide-mobile">
              {state.calmMode ? t.calmModeOn : t.calmModeOff}
            </span>
          </button>

          <button
            type="button"
            className="slab icon-top-btn"
            onClick={toggleMute}
            aria-label="Toggle Sound"
          >
            {state.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          <button
            type="button"
            className="slab lang-top-btn"
            onClick={toggleLang}
          >
            <Globe size={18} />
            <span>{t.langSwitch}</span>
          </button>
        </div>
      </header>

      {/* MAIN STAGE */}
      <main className="nova-main-stage">
        {screen === 'lobby' && (
          <div className="brawl-lobby-grid">
            {/* Hero Spotlight Side Panel */}
            <aside className="hero-spotlight-panel">
              <div className="spotlight-header-tag">
                {isHe ? 'הברולר שלך לקרב' : 'ACTIVE BRAWLER'}
              </div>

              <div
                className="spotlight-avatar-stage"
                onClick={() => {
                  sound.playClick();
                  setGarageOpen(true);
                }}
              >
                <HeroAvatar heroId={currentHero.id} size={136} action="idle" />
              </div>

              <h2 className="spotlight-hero-name">
                { currentHero.iconEmoji }{' '}
                {isHe ? currentHero.nameHe : currentHero.nameEn}
              </h2>
              <p className="spotlight-hero-title">
                {isHe ? currentHero.titleHe : currentHero.titleEn}
              </p>
              <div className="spotlight-power-box">
                ⚡ {isHe ? currentHero.powerHe : currentHero.powerEn}
              </div>

              {/* Trophy Road Progress */}
              <div className="trophy-road-box">
                <div className="road-label-row">
                  <span>
                    🏆 {isHe ? 'מסלול הגביעים:' : 'Trophy Road:'}
                  </span>
                  <strong dir="ltr">
                    {state.trophies} / {roadTarget}
                  </strong>
                </div>
                <div className="road-bar-outer">
                  <div
                    className="road-bar-fill"
                    style={{ width: `${roadPct}%` }}
                  />
                </div>
                {nextLockedHero && (
                  <span className="road-next-hint">
                    {isHe
                      ? `הגיבור הבא: ${nextLockedHero.nameHe} ${nextLockedHero.iconEmoji}`
                      : `Next Hero: ${nextLockedHero.nameEn} ${nextLockedHero.iconEmoji}`}
                  </span>
                )}
              </div>

              <div className="spotlight-buttons-stack">
                {state.brawlBoxes > 0 && (
                  <button
                    type="button"
                    className="slab primary pulse-box-btn"
                    onClick={() => {
                      sound.playClick();
                      setGarageOpen(true);
                    }}
                  >
                    <Gift size={20} />
                    <span>
                      {isHe
                        ? `🎁 פתח תיבת מגה (${state.brawlBoxes})!`
                        : `🎁 Open Mega Box (${state.brawlBoxes})!`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="slab codex-spotlight-btn"
                  onClick={() => {
                    sound.playHackActivate();
                    setCodexOpen(true);
                  }}
                >
                  <Zap size={20} />
                  <span>
                    {isHe
                      ? '⚡ פתח את ספר ההאקים הסודי!'
                      : '⚡ Open Secret Hacker Codex!'}
                  </span>
                </button>
              </div>
            </aside>

            {/* Right Area: Difficulty Tier Bar + 4 World Event Cards */}
            <section className="worlds-showcase-section">
              <div className="tier-selector-card">
                <span className="tier-title">{t.difficultyLabel}</span>
                <div className="tier-buttons-row">
                  <button
                    type="button"
                    className={`slab tier-btn ${
                      state.tier === 'rookie' ? 'primary' : ''
                    }`}
                    onClick={() => setTier('rookie')}
                  >
                    {t.tierRookie}
                  </button>
                  <button
                    type="button"
                    className={`slab tier-btn ${
                      state.tier === 'pro' ? 'primary' : ''
                    }`}
                    onClick={() => setTier('pro')}
                  >
                    {t.tierPro}
                  </button>
                  <button
                    type="button"
                    className={`slab tier-btn ${
                      state.tier === 'master' ? 'primary' : ''
                    }`}
                    onClick={() => setTier('master')}
                  >
                    {t.tierMaster}
                  </button>
                </div>
              </div>

              {/* 4 Brawl Event Cards */}
              <div className="worlds-cards-grid">
                {/* World 1: Mecha-Dino Forge (+) */}
                <article className="world-event-card card-dino">
                  <div className="world-card-top">
                    <span className="world-emoji-medallion">🦖</span>
                    <div className="world-title-block">
                      <span className="world-op-badge gold-badge">
                        {t.worlds.dino.badge}
                      </span>
                      <h3>{t.worlds.dino.name}</h3>
                    </div>
                  </div>
                  <p className="world-desc">{t.worlds.dino.desc}</p>
                  <button
                    type="button"
                    className="slab primary world-play-btn"
                    onClick={() => {
                      sound.playClick();
                      setScreen('dino');
                    }}
                  >
                    <Play size={20} />
                    <span>{t.worlds.dino.playBtn}</span>
                  </button>
                </article>

                {/* World 2: Galactic Star-Slicer (-) */}
                <article className="world-event-card card-space">
                  <div className="world-card-top">
                    <span className="world-emoji-medallion">🚀</span>
                    <div className="world-title-block">
                      <span className="world-op-badge cyan-badge">
                        {t.worlds.space.badge}
                      </span>
                      <h3>{t.worlds.space.name}</h3>
                    </div>
                  </div>
                  <p className="world-desc">{t.worlds.space.desc}</p>
                  <button
                    type="button"
                    className="slab primary world-play-btn"
                    onClick={() => {
                      sound.playClick();
                      setScreen('space');
                    }}
                  >
                    <Play size={20} />
                    <span>{t.worlds.space.playBtn}</span>
                  </button>
                </article>

                {/* World 3: Cyber-Dragon Multi-Storm (×) */}
                <article className="world-event-card card-dragon">
                  <div className="world-card-top">
                    <span className="world-emoji-medallion">🐉</span>
                    <div className="world-title-block">
                      <span className="world-op-badge magenta-badge">
                        {t.worlds.dragon.badge}
                      </span>
                      <h3>{t.worlds.dragon.name}</h3>
                    </div>
                  </div>
                  <p className="world-desc">{t.worlds.dragon.desc}</p>
                  <button
                    type="button"
                    className="slab primary world-play-btn"
                    onClick={() => {
                      sound.playClick();
                      setScreen('dragon');
                    }}
                  >
                    <Play size={20} />
                    <span>{t.worlds.dragon.playBtn}</span>
                  </button>
                </article>

                {/* World 4: Neon Dash Runner (⚡) */}
                <article className="world-event-card card-dash">
                  <div className="world-card-top">
                    <span className="world-emoji-medallion">⚡</span>
                    <div className="world-title-block">
                      <span className="world-op-badge green-badge">
                        {t.worlds.dash.badge}
                      </span>
                      <h3>{t.worlds.dash.name}</h3>
                    </div>
                  </div>
                  <p className="world-desc">{t.worlds.dash.desc}</p>
                  <button
                    type="button"
                    className="slab primary world-play-btn"
                    onClick={() => {
                      sound.playClick();
                      setScreen('dash');
                    }}
                  >
                    <Play size={20} />
                    <span>{t.worlds.dash.playBtn}</span>
                  </button>
                </article>
              </div>
            </section>
          </div>
        )}

        {screen === 'dino' && (
          <DinoForgeMode
            lang={state.lang}
            tier={state.tier}
            heroId={state.selectedHeroId}
            calmMode={state.calmMode}
            onBack={() => setScreen('lobby')}
            onSuccess={recordSuccess}
            onHackUsed={recordHackBonus}
          />
        )}

        {screen === 'space' && (
          <SpaceSlicerMode
            lang={state.lang}
            tier={state.tier}
            heroId={state.selectedHeroId}
            calmMode={state.calmMode}
            onBack={() => setScreen('lobby')}
            onSuccess={recordSuccess}
            onHackUsed={recordHackBonus}
          />
        )}

        {screen === 'dragon' && (
          <DragonStormMode
            lang={state.lang}
            tier={state.tier}
            heroId={state.selectedHeroId}
            calmMode={state.calmMode}
            onBack={() => setScreen('lobby')}
            onSuccess={recordSuccess}
            onHackUsed={recordHackBonus}
          />
        )}

        {screen === 'dash' && (
          <NeonDashMode
            lang={state.lang}
            tier={state.tier}
            heroId={state.selectedHeroId}
            calmMode={state.calmMode}
            onBack={() => setScreen('lobby')}
            onSuccess={recordSuccess}
            onHackUsed={recordHackBonus}
          />
        )}
      </main>

      {/* MODALS */}
      {codexOpen && (
        <HackerCodexModal
          lang={state.lang}
          multMastery={state.multMastery}
          onClose={() => setCodexOpen(false)}
        />
      )}

      {garageOpen && (
        <HeroGarageModal
          lang={state.lang}
          trophies={state.trophies}
          selectedHeroId={state.selectedHeroId}
          brawlBoxes={state.brawlBoxes}
          calmMode={state.calmMode}
          onSelectHero={selectHero}
          onOpenBox={openBrawlBox}
          onClose={() => setGarageOpen(false)}
        />
      )}
    </div>
  );
};
export default App;
