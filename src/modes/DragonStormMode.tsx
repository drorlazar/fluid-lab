import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { assets } from '../engine/spriteAtlas';
import {
  Particle,
  FloatingPopup,
  spawnBurst,
  updateAndDrawParticles,
  drawStrokedText,
  drawSkewedPlate,
  drawLaserBeam,
  drawDiegeticCoachPointer,
} from '../engine/vfxCanvas';
import { sound } from '../audio/soundEngine';

interface DragonStormModeProps {
  lang: Language;
  tier: DifficultyTier;
  heroId: string;
  calmMode: boolean;
  onBack: () => void;
  onSuccess: (op: '+' | '-' | '×', a: number, b: number, usedHack: boolean) => void;
  onHackUsed: () => void;
}

interface BoostRing {
  x: number;
  y: number;
  val: number;
}

export const DragonStormMode: React.FC<DragonStormModeProps> = ({
  lang,
  tier,
  calmMode,
  onBack,
  onSuccess,
  onHackUsed,
}) => {
  const isHe = lang === 'he';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wave, setWave] = useState(1);
  const [combo, setCombo] = useState(56);
  const [score, setScore] = useState(88400);

  const gameRef = useRef<{
    problem: MathProblem;
    rows: number;
    cols: number;
    sliceRow: number | null;
    rings: BoostRing[];
    hoveredRingIdx: number;
    dragonX: number;
    targetDragonX: number;
    dragonBank: number;
    breathTimer: number;
    shakeFrames: number;
    waveTimer: number;
    particles: Particle[];
    popups: FloatingPopup[];
  } | null>(null);

  const initWave = (currentTier: DifficultyTier, isFirst = false) => {
    const p = generateProblem({ tier: currentTier, forcedOp: '×' });
    if (isFirst) {
      p.a = 7;
      p.b = 8;
      p.answer = 56;
    }

    const rows = p.a;
    const cols = p.b;
    const decoys = p.choices.filter((c) => c !== p.answer).slice(0, 2);
    const ringVals = [decoys[0] || p.answer - cols, p.answer, decoys[1] || p.answer + cols];
    if (!isFirst) ringVals.sort(() => Math.random() - 0.5);

    const rings: BoostRing[] = [
      { x: 265, y: 635, val: ringVals[0] },
      { x: 800, y: 605, val: ringVals[1] },
      { x: 1320, y: 545, val: ringVals[2] },
    ];

    gameRef.current = {
      problem: p,
      rows,
      cols,
      // Auto-demonstrate the laser wing-slash on Wave 1!
      sliceRow: isFirst ? 5 : null,
      rings,
      hoveredRingIdx: 1,
      dragonX: 1080,
      targetDragonX: 1080,
      dragonBank: -0.18,
      breathTimer: 0,
      shakeFrames: 0,
      waveTimer: 0,
      particles: gameRef.current?.particles || [],
      popups: gameRef.current?.popups || [],
    };
  };

  useEffect(() => {
    assets.loadAll();
    initWave(tier, true);
  }, [tier]);

  const toggleWingSlash = (customRow?: number) => {
    const g = gameRef.current;
    if (!g) return;
    sound.playLaserSlice();
    if (customRow !== undefined) {
      g.sliceRow = customRow;
    } else if (g.sliceRow !== null) {
      g.sliceRow = null;
    } else {
      g.sliceRow = g.rows > 5 ? 5 : Math.max(1, Math.floor(g.rows / 2));
    }
    if (g.sliceRow !== null) {
      onHackUsed();
      spawnBurst(g.particles, 740, 290, '#ff007f', 28, 10, 'shard');
    }
  };

  const diveThroughRing = (ringIdx: number) => {
    const g = gameRef.current;
    if (!g || g.breathTimer > 0) return;
    const ring = g.rings[ringIdx];
    if (!ring) return;

    g.hoveredRingIdx = ringIdx;
    g.targetDragonX = ring.x;

    if (ring.val === g.problem.answer) {
      sound.playLaserSlice();
      sound.playVictoryFanfare();
      g.breathTimer = 30;
      if (!calmMode) g.shakeFrames = 18;

      // Explode every drone in the formation!
      spawnBurst(g.particles, 680, 270, '#ffe600', 50, 15, 'shard');
      spawnBurst(g.particles, ring.x, ring.y, '#00f5d4', 32, 11, 'circle');

      g.popups.push({
        x: 700,
        y: 250,
        vy: -2.4,
        text: `🔥 SWARM OBLITERATED! ${g.problem.answer}!`,
        color: '#ffe600',
        scale: 1.3,
        alpha: 1,
        life: 0,
      });

      onSuccess('×', g.problem.a, g.problem.b, g.sliceRow !== null);
      setCombo((c) => c + 1);
      setScore((s) => s + 4200);

      if (!calmMode && typeof window !== 'undefined') {
        confetti({ particleCount: 45, spread: 70, origin: { y: 0.45 } });
      }

      setTimeout(() => {
        setWave((w) => w + 1);
        initWave(tier, false);
      }, 980);
    } else {
      sound.playShieldDeflect();
      spawnBurst(g.particles, ring.x, ring.y, '#ff4d6d', 18, 7, 'circle');
      if (g.sliceRow === null) {
        toggleWingSlash();
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        toggleWingSlash();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        g.hoveredRingIdx = Math.max(0, g.hoveredRingIdx - 1);
        sound.playClick();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        g.hoveredRingIdx = Math.min(2, g.hoveredRingIdx + 1);
        sound.playClick();
      } else if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'w') {
        diveThroughRing(g.hoveredRingIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    let rafId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const render = (now: number) => {
      const t = now * 0.001;
      const g = gameRef.current;
      if (!g) {
        rafId = requestAnimationFrame(render);
        return;
      }

      g.waveTimer += 1 / 60;
      const dx = g.targetDragonX - g.dragonX;
      g.dragonX += dx * 0.14;
      g.dragonBank = -0.18 + Math.max(-0.22, Math.min(0.22, dx * 0.0018));

      ctx.save();
      if (g.shakeFrames > 0 && !calmMode) {
        g.shakeFrames--;
        ctx.translate(
          (Math.random() - 0.5) * g.shakeFrames * 1.6,
          (Math.random() - 0.5) * g.shakeFrames * 1.6
        );
      }

      // 1. Painted Volcanic Canyon Background
      const bg = assets.getBg('dragon');
      if (bg) {
        ctx.drawImage(bg, 0, 0, 1600, 900);
      } else {
        ctx.fillStyle = '#1c0b19';
        ctx.fillRect(0, 0, 1600, 900);
      }

      // 2. Living Geometric Formation of Glowing Mecha-Drones (tilted in 2.5D perspective like Frame 4!)
      const { rows, cols, sliceRow } = g;
      const gridOriginX = 460;
      const gridOriginY = 145;
      const cellW = Math.min(54, Math.floor(420 / cols));
      const cellH = Math.min(44, Math.floor(310 / rows));

      for (let r = 0; r < rows; r++) {
        const isBottomSlice = sliceRow !== null && r >= sliceRow;
        const sliceGap = isBottomSlice ? 34 : 0;
        for (let c = 0; c < cols; c++) {
          const fiveGap = c >= 5 ? 14 : 0;
          const x = gridOriginX + c * cellW + fiveGap + r * 4;
          const y =
            gridOriginY +
            r * cellH +
            sliceGap -
            c * 2.5 +
            (calmMode ? 0 : Math.sin(t * 5 + r + c) * 2.5);

          const droneColor =
            sliceRow === null
              ? '#fbbf24'
              : isBottomSlice
              ? '#00f5d4'
              : '#ffd60a';

          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = droneColor;
          ctx.fillStyle = isBottomSlice ? 'rgba(0, 245, 212, 0.25)' : 'rgba(255, 214, 10, 0.25)';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = droneColor;
          ctx.shadowBlur = 10;

          // Draw Mecha-Hornet Drone Silhouette (wings + core)
          ctx.beginPath();
          ctx.moveTo(-14, -8);
          ctx.lineTo(0, -2);
          ctx.lineTo(14, -8);
          ctx.lineTo(8, 6);
          ctx.lineTo(0, 12);
          ctx.lineTo(-8, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 1, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. Blazing Magenta-Gold Laser Wing-Slash Line & Callout Badges (Just like Frame 4!)
      if (sliceRow !== null) {
        const slashY = gridOriginY + sliceRow * cellH + 4;
        drawLaserBeam(
          ctx,
          gridOriginX - 110,
          slashY + 42,
          gridOriginX + cols * cellW + 90,
          slashY - 22,
          '#ff007f',
          '#fff36b',
          22
        );

        const topRows = sliceRow;
        const botRows = rows - sliceRow;
        const topProd = topRows * cols;
        const botProd = botRows * cols;

        // Top Gold Drones Callout
        const calloutX = gridOriginX + cols * cellW + 175;
        drawSkewedPlate(
          ctx,
          calloutX,
          gridOriginY + 45,
          230,
          78,
          'rgba(38, 28, 6, 0.92)',
          '#ffe600',
          4,
          -0.12,
          '#ffe600'
        );
        drawStrokedText(
          ctx,
          `${topRows} × ${cols} = ${topProd}`,
          calloutX,
          gridOriginY + 35,
          32,
          '#ffe600',
          '#000',
          6
        );
        drawStrokedText(
          ctx,
          'GOLD DRONES',
          calloutX,
          gridOriginY + 64,
          16,
          '#fef08a',
          '#000',
          4
        );

        // Bottom Cyan Drones Callout
        drawSkewedPlate(
          ctx,
          calloutX + 15,
          slashY + 60,
          230,
          78,
          'rgba(6, 32, 48, 0.92)',
          '#00f5d4',
          4,
          -0.12,
          '#00f5d4'
        );
        drawStrokedText(
          ctx,
          `${botRows} × ${cols} = ${botProd}`,
          calloutX + 15,
          slashY + 50,
          32,
          '#00f5d4',
          '#000',
          6
        );
        drawStrokedText(
          ctx,
          'CYAN DRONES',
          calloutX + 15,
          slashY + 79,
          16,
          '#a5f3fc',
          '#000',
          4
        );
      }

      // 4. Three Glowing Circular Boost Rings in the Sky (48, 56, 64 — Just like Frame 4!)
      g.rings.forEach((ring, idx) => {
        const isHovered = g.hoveredRingIdx === idx;
        const ry = ring.y + (calmMode ? 0 : Math.sin(t * 3 + idx) * 6);

        ctx.save();
        ctx.translate(ring.x, ry);

        // Blazing Fire Ring Aura
        ctx.strokeStyle = isHovered ? '#ffe600' : 'rgba(255, 255, 255, 0.78)';
        ctx.fillStyle = isHovered ? 'rgba(255, 190, 11, 0.25)' : 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = isHovered ? 12 : 6;
        ctx.shadowColor = isHovered ? '#ff9f1c' : '#ffffff';
        ctx.shadowBlur = isHovered ? 30 : 12;
        ctx.beginPath();
        ctx.arc(0, 0, isHovered ? 88 : 78, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        drawStrokedText(
          ctx,
          String(ring.val),
          0,
          4,
          isHovered ? 62 : 52,
          isHovered ? '#ffe600' : '#ffffff',
          '#000',
          10
        );
        ctx.restore();
      });

      // 5. Super-Nova Dragon Fire Breath when Ring is triggered!
      if (g.breathTimer > 0) {
        g.breathTimer--;
        const activeRing = g.rings[g.hoveredRingIdx] || g.rings[1];
        drawLaserBeam(
          ctx,
          g.dragonX - 60,
          610,
          gridOriginX + (cols * cellW) / 2,
          gridOriginY + (rows * cellH) / 2,
          '#ff007f',
          '#ffe600',
          52
        );
        drawLaserBeam(
          ctx,
          g.dragonX - 60,
          610,
          activeRing.x,
          activeRing.y,
          '#ffe600',
          '#ffffff',
          32
        );
      }

      // 6. Painted Cyber-Dragon Sprite (`dracox`) Banking Dynamically over the Lava Canyon!
      const dragonSpr = assets.getSprite('dracox');
      const dragonBob = calmMode ? 0 : Math.sin(t * 4) * 9;
      ctx.save();
      ctx.translate(g.dragonX, 650 + dragonBob);
      ctx.rotate(g.dragonBank);
      if (dragonSpr) {
        ctx.drawImage(dragonSpr, -260, -220, 520, 440);
      }
      ctx.restore();

      // 7. DIEGETIC VISUAL COACH ("Show, Don't Tell")
      const correctRing = g.rings.find((r) => r.val === g.problem.answer);
      if ((wave === 1 || g.waveTimer > 4.5) && g.breathTimer === 0 && correctRing) {
        if (g.sliceRow === null && g.waveTimer < 3.2) {
          drawDiegeticCoachPointer(
            ctx,
            gridOriginX - 40,
            gridOriginY + 140,
            gridOriginX + 340,
            gridOriginY + 120,
            t,
            '#ff007f'
          );
        } else {
          drawDiegeticCoachPointer(
            ctx,
            gridOriginX + 200,
            gridOriginY + 140,
            correctRing.x,
            correctRing.y,
            t,
            '#ffe600'
          );
        }
      }

      // 8. Top Center Combo Counter (Just like Frame 4!)
      drawStrokedText(ctx, `x${combo}`, 800, 48, 56, '#ffe600', '#000', 9);
      drawStrokedText(ctx, 'COMBO', 800, 88, 22, '#ffffff', '#000', 5);

      updateAndDrawParticles(ctx, g.particles, g.popups);

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [calmMode, combo, tier, wave]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1600,
      y: ((e.clientY - rect.top) / rect.height) * 900,
    };
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { x, y } = getCoords(e);
    g.targetDragonX = Math.max(420, Math.min(1320, x + 160));

    if (y > 440) {
      let best = g.hoveredRingIdx;
      let minD = 9999;
      g.rings.forEach((r, idx) => {
        const d = Math.hypot(x - r.x, y - r.y);
        if (d < minD) {
          minD = d;
          best = idx;
        }
      });
      g.hoveredRingIdx = best;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { x, y } = getCoords(e);

    // Did they click/swipe on the Drone Formation Grid to slice it?
    if (x > 360 && x < 1050 && y > 110 && y < 460) {
      const clickedRow = Math.max(
        1,
        Math.min(g.rows - 1, Math.round((y - 145) / Math.min(44, Math.floor(310 / g.rows))))
      );
      toggleWingSlash(clickedRow);
      return;
    }

    // Did they click one of the 3 Boost Rings?
    for (let i = 0; i < g.rings.length; i++) {
      const r = g.rings[i];
      if (Math.hypot(x - r.x, y - r.y) < 115) {
        diveThroughRing(i);
        return;
      }
    }

    diveThroughRing(g.hoveredRingIdx);
  };

  return (
    <div className="fullscreen-world-Wrapper">
      <canvas
        ref={canvasRef}
        width={1600}
        height={900}
        className="fullscreen-game-canvas"
        onMouseMove={handleMove}
        onClick={handleClick}
      />

      <button type="button" className="brawl-back-corner" onClick={onBack} aria-label="Back">
        ◀
      </button>

      <div className="world-hud-top-left" dir="ltr">
        <div className="hp-bar-frame">
          <span className="hp-tag">❤️</span>
          <div className="hp-fill">DRACO-X</div>
        </div>
        <div className="space-stat-line">SCORE: {score.toLocaleString()}</div>
      </div>

      <div className="world-hud-bottom-bar" dir="ltr">
        LAVA CANYON | WAVE {wave}
      </div>

      <button
        type="button"
        className="brawl-action-fab magenta-fab"
        onClick={() => toggleWingSlash()}
      >
        ⚔️ SLICE SWARM {isHe ? 'חיתוך לייזר' : ''}
      </button>
    </div>
  );
};
