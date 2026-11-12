import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useGameStore } from './state/useGameStore';
import { HEROES } from './i18n/content';
import { assets, SpriteId } from './engine/spriteAtlas';
import {
  Particle,
  FloatingPopup,
  spawnBurst,
  updateAndDrawParticles,
  drawStrokedText,
} from './engine/vfxCanvas';
import { DinoForgeMode } from './modes/DinoForgeMode';
import { SpaceSlicerMode } from './modes/SpaceSlicerMode';
import { DragonStormMode } from './modes/DragonStormMode';
import { NeonDashMode } from './modes/NeonDashMode';
import { HackerCodexModal } from './components/HackerCodexModal';
import { HeroGarageModal } from './components/HeroGarageModal';
import { sound } from './audio/soundEngine';

type WorldId = 'dino' | 'space' | 'dragon' | 'dash';

const HERO_SPRITE_MAP: Record<string, SpriteId> = {
  ignis: 'ignis',
  rexbot: 'mecharex',
  novakirb: 'kirb',
  voltdash: 'viper',
  titanprime: 'tricera',
  astrodrake: 'dracox',
};

export const App: React.FC = () => {
  const {
    state,
    toggleLang,
    setTier,
    toggleMute,
    selectHero,
    recordSuccess,
    recordHackBonus,
    openBrawlBox,
  } = useGameStore();

  const [activeWorld, setActiveWorld] = useState<WorldId | null>(() => {
    if (typeof window === 'undefined') return null;
    const w = new URLSearchParams(window.location.search).get('world');
    if (w === 'dino' || w === 'space' || w === 'dragon' || w === 'dash') return w;
    return null;
  });
  const [selectedBlade, setSelectedBlade] = useState<WorldId>('dino');
  const [codexOpen, setCodexOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('world') === 'hacklab';
  });
  const [garageOpen, setGarageOpen] = useState(false);

  const lobbyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lobbyVfxRef = useRef<{ particles: Particle[]; popups: FloatingPopup[] }>({
    particles: [],
    popups: [],
  });

  const isHe = state.lang === 'he';
  const currentHero = HEROES.find((h) => h.id === state.selectedHeroId) || HEROES[0];

  useEffect(() => {
    assets.loadAll();
  }, []);

  // 60fps Animated Brawl Lobby Pedestal Canvas (Matching Frame 1!)
  useEffect(() => {
    if (activeWorld !== null) return;
    let rafId = 0;
    const canvas = lobbyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const render = (now: number) => {
      const t = now * 0.001;

      // 1. Painted Brawl Pedestal Background
      const bg = assets.getBg('lobby');
      if (bg) {
        ctx.drawImage(bg, 0, 0, 1600, 900);
      } else {
        ctx.fillStyle = '#071436';
        ctx.fillRect(0, 0, 1600, 900);
      }

      // 2. Glowing Pedestal Rings & Rising Energy Motes
      ctx.save();
      ctx.translate(770, 745);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.ellipse(0, 0, 235 + Math.sin(t * 3) * 6, 62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Painted Hero Sprite Breathing on the Center Pedestal
      const sprId = HERO_SPRITE_MAP[currentHero.id] || 'ignis';
      const spr = assets.getSprite(sprId);
      const bobY = state.calmMode ? 0 : Math.sin(t * 3.2) * 10;

      ctx.save();
      ctx.translate(770, 465 + bobY);
      if (spr) {
        ctx.drawImage(spr, -255, -255, 510, 510);
      }
      ctx.restore();

      // 4. Hero Nameplate on the Pedestal Base (Just like Frame 1!)
      drawStrokedText(
        ctx,
        isHe ? currentHero.nameHe : currentHero.nameEn,
        770,
        812,
        54,
        '#ffffff',
        '#000000',
        11
      );

      updateAndDrawParticles(
        ctx,
        lobbyVfxRef.current.particles,
        lobbyVfxRef.current.popups
      );

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [activeWorld, currentHero, isHe, state.calmMode]);

  const handleTriggerMegaBox = () => {
    sound.playVictoryFanfare();
    openBrawlBox();
    spawnBurst(lobbyVfxRef.current.particles, 770, 480, '#ffe600', 48, 14, 'shard');
    spawnBurst(lobbyVfxRef.current.particles, 770, 480, '#00f5d4', 32, 10, 'circle');
    lobbyVfxRef.current.popups.push({
      x: 770,
      y: 380,
      vy: -2.2,
      text: '🎁 MEGA BOX! +75 💎 +25 🏆',
      color: '#ffe600',
      scale: 1.3,
      alpha: 1,
      life: 0,
    });
    if (!state.calmMode && typeof window !== 'undefined') {
      confetti({ particleCount: 55, spread: 75, origin: { y: 0.55 } });
    }
  };

  const handleCycleTier = () => {
    const order: Array<'rookie' | 'pro' | 'master'> = ['rookie', 'pro', 'master'];
    const next = order[(order.indexOf(state.tier as 'rookie' | 'pro' | 'master') + 1) % order.length];
    setTier(next);
  };

  // Render Active Full-Viewport World
  if (activeWorld === 'dino') {
    return (
      <DinoForgeMode
        lang={state.lang}
        tier={state.tier}
        heroId={state.selectedHeroId}
        calmMode={state.calmMode}
        onBack={() => setActiveWorld(null)}
        onSuccess={recordSuccess}
        onHackUsed={recordHackBonus}
      />
    );
  }

  if (activeWorld === 'space') {
    return (
      <SpaceSlicerMode
        lang={state.lang}
        tier={state.tier}
        heroId={state.selectedHeroId}
        calmMode={state.calmMode}
        onBack={() => setActiveWorld(null)}
        onSuccess={recordSuccess}
        onHackUsed={recordHackBonus}
      />
    );
  }

  if (activeWorld === 'dragon') {
    return (
      <DragonStormMode
        lang={state.lang}
        tier={state.tier}
        heroId={state.selectedHeroId}
        calmMode={state.calmMode}
        onBack={() => setActiveWorld(null)}
        onSuccess={recordSuccess}
        onHackUsed={recordHackBonus}
      />
    );
  }

  if (activeWorld === 'dash') {
    return (
      <NeonDashMode
        lang={state.lang}
        tier={state.tier}
        heroId={state.selectedHeroId}
        calmMode={state.calmMode}
        onBack={() => setActiveWorld(null)}
        onSuccess={recordSuccess}
        onHackUsed={recordHackBonus}
      />
    );
  }

  // BRAWL STARS 3D PEDESTAL LOBBY (Exact Match to Frame 1!)
  return (
    <div className="fullscreen-world-Wrapper lobby-wrapper" dir="ltr">
      <canvas
        ref={lobbyCanvasRef}
        width={1600}
        height={900}
        className="fullscreen-game-canvas"
        onClick={() => {
          // Clicking the center pedestal cycles heroes with a burst!
          const idx = HEROES.findIndex((h) => h.id === currentHero.id);
          const nextHero = HEROES[(idx + 1) % HEROES.length];
          selectHero(nextHero.id);
          spawnBurst(lobbyVfxRef.current.particles, 770, 520, '#00f5d4', 24, 9, 'circle');
        }}
      />

      {/* TOP BAR: Skewed Currency Counters + Compact Utility Pills */}
      <div className="lobby-top-bar">
        <div className="lobby-util-left">
          <button
            type="button"
            className="brawl-util-pill"
            onClick={toggleLang}
            title="Switch Language"
          >
            🌐 {isHe ? 'EN' : 'עב'}
          </button>
          <button
            type="button"
            className="brawl-util-pill"
            onClick={handleCycleTier}
            title="Difficulty Tier"
          >
            {state.tier === 'rookie'
              ? '🌱 LVL 1'
              : state.tier === 'pro'
              ? '⚡ LVL 2'
              : '🔥 MAX'}
          </button>
          <button
            type="button"
            className="brawl-util-pill"
            onClick={toggleMute}
            title="Sound"
          >
            {state.muted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="lobby-currencies-right">
          <div className="brawl-stat-skew">
            <span className="stat-ic">🏆</span>
            <span>{state.trophies.toLocaleString()}</span>
          </div>
          <div className="brawl-stat-skew">
            <span className="stat-ic">💎</span>
            <span>{state.gems.toLocaleString()}</span>
          </div>
          <div className="brawl-stat-skew">
            <span className="stat-ic">🔥</span>
            <span>x{Math.max(1, state.streak)}</span>
          </div>
        </div>
      </div>

      {/* LEFT DOCK: 3 Iconic Skewed Brawl Stars Buttons (Exact Match to Frame 1!) */}
      <div className="lobby-left-dock">
        <button
          type="button"
          className="brawl-dock-btn green-dock"
          onClick={() => {
            sound.playClick();
            setGarageOpen(true);
          }}
        >
          <span className="dock-icon">🦖</span>
          <div className="dock-labels">
            <span className="dock-en">BRAWLERS</span>
            <span className="dock-he">ברולרים</span>
          </div>
        </button>

        <button
          type="button"
          className="brawl-dock-btn blue-dock"
          onClick={() => {
            sound.playHackActivate();
            setCodexOpen(true);
          }}
        >
          <span className="dock-icon">🛠️</span>
          <div className="dock-labels">
            <span className="dock-en">HACK LAB</span>
            <span className="dock-he">האקים</span>
          </div>
        </button>

        <button
          type="button"
          className="brawl-dock-btn purple-dock"
          onClick={handleTriggerMegaBox}
        >
          <span className="dock-icon">🎁</span>
          <div className="dock-labels">
            <span className="dock-en">MEGA BOX</span>
            <span className="dock-he">תיבת מגה!</span>
          </div>
        </button>
      </div>

      {/* RIGHT DOCK: 4 Skewed World Selector Blades + Giant Gold BRAWL! Button */}
      <div className="lobby-right-dock">
        <button
          type="button"
          className={`brawl-world-blade blade-dino ${
            selectedBlade === 'dino' ? 'selected' : ''
          }`}
          onClick={() => {
            sound.playClick();
            if (selectedBlade === 'dino') setActiveWorld('dino');
            else setSelectedBlade('dino');
          }}
        >
          <span>{isHe ? '🦖 זירת הדינו  |  Mecha-Dino Arena' : 'Mecha-Dino Arena'}</span>
        </button>

        <button
          type="button"
          className={`brawl-world-blade blade-space ${
            selectedBlade === 'space' ? 'selected' : ''
          }`}
          onClick={() => {
            sound.playClick();
            if (selectedBlade === 'space') setActiveWorld('space');
            else setSelectedBlade('space');
          }}
        >
          <span>{isHe ? '🚀 צייד החלל  |  Space Boss Slicer' : 'Space Boss Slicer'}</span>
        </button>

        <button
          type="button"
          className={`brawl-world-blade blade-dragon ${
            selectedBlade === 'dragon' ? 'selected' : ''
          }`}
          onClick={() => {
            sound.playClick();
            if (selectedBlade === 'dragon') setActiveWorld('dragon');
            else setSelectedBlade('dragon');
          }}
        >
          <span>{isHe ? '🐉 סופת הדרקון  |  Dragon Swarm' : 'Dragon Swarm'}</span>
        </button>

        <button
          type="button"
          className={`brawl-world-blade blade-dash ${
            selectedBlade === 'dash' ? 'selected' : ''
          }`}
          onClick={() => {
            sound.playClick();
            if (selectedBlade === 'dash') setActiveWorld('dash');
            else setSelectedBlade('dash');
          }}
        >
          <span>{isHe ? '⚡ ניאון דאש  |  Geometry Overdrive' : 'Geometry Overdrive'}</span>
        </button>

        {/* GIANT GOLDEN BRAWL! / לקרב! CTA */}
        <button
          type="button"
          className="brawl-giant-play-btn"
          onClick={() => {
            sound.playVictoryFanfare();
            setActiveWorld(selectedBlade);
          }}
        >
          <span className="play-en">BRAWL!</span>
          <span className="play-he">לקרב!</span>
        </button>
      </div>

      {/* VISUAL HACK LAB MODAL */}
      {codexOpen && (
        <HackerCodexModal
          lang={state.lang}
          multMastery={state.multMastery}
          onClose={() => setCodexOpen(false)}
        />
      )}

      {/* BRAWLER GARAGE MODAL */}
      {garageOpen && (
        <HeroGarageModal
          lang={state.lang}
          trophies={state.trophies}
          selectedHeroId={state.selectedHeroId}
          brawlBoxes={state.brawlBoxes}
          calmMode={state.calmMode}
          onSelectHero={(id) => {
            selectHero(id);
            setGarageOpen(false);
          }}
          onOpenBox={openBrawlBox}
          onClose={() => setGarageOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
