import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { assets, SpriteId } from '../engine/spriteAtlas';
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

interface DinoForgeModeProps {
  lang: Language;
  tier: DifficultyTier;
  heroId: string;
  calmMode: boolean;
  onBack: () => void;
  onSuccess: (op: '+' | '-' | '×', a: number, b: number, usedHack: boolean) => void;
  onHackUsed: () => void;
}

interface DinoTarget {
  x: number;
  y: number;
  shieldVal: number;
  spriteId: SpriteId;
  tint: string;
  hitAnim: number;
  deflectAnim: number;
}

interface VortexOrb {
  angle: number;
  radius: number;
  val: number;
  isTens: boolean;
}

export const DinoForgeMode: React.FC<DinoForgeModeProps> = ({
  lang,
  tier,
  heroId,
  calmMode,
  onBack,
  onSuccess,
  onHackUsed,
}) => {
  const isHe = lang === 'he';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [waveCount, setWaveCount] = useState(1);
  const [score, setScore] = useState(300);

  // Mutable live game state for 60fps loop
  const gameRef = useRef<{
    problem: MathProblem;
    dinos: DinoTarget[];
    hoveredDinoIdx: number;
    playerX: number;
    targetPlayerX: number;
    magnetStage: 0 | 1 | 2; // 0 = raw (58 | 25), 1 = make-ten (60 | 23), 2 = tens-merged (80 | 3)
    magnetSparkProgress: number;
    laserActive: number;
    laserTargetPos: { x: number; y: number } | null;
    shakeFrames: number;
    waveTimer: number;
    vortexOrbs: VortexOrb[];
    particles: Particle[];
    popups: FloatingPopup[];
  } | null>(null);

  const initWave = (currentTier: DifficultyTier, isFirstWave = false) => {
    const p = generateProblem({ tier: currentTier, forcedOp: '+' });
    // Ensure a ends in 6..9 on Wave 1 so the +Magnet arc is super dramatic (like 58 + 25 -> 60 + 23)
    if (isFirstWave && currentTier !== 'rookie') {
      p.a = 58;
      p.b = 25;
      p.answer = 83;
    }

    const decoys = p.choices.filter((c) => c !== p.answer).slice(0, 2);
    const threeVals = [decoys[0] || p.answer - 19, p.answer, decoys[1] || p.answer + 8];
    // Shuffle positions slightly so correct isn't always center after wave 1
    if (!isFirstWave) {
      threeVals.sort(() => Math.random() - 0.5);
    }

    const dinoConfigs: Array<{ x: number; y: number; spriteId: SpriteId; tint: string }> = [
      { x: 390, y: 265, spriteId: 'tricera', tint: '#fbbf24' },
      { x: 800, y: 215, spriteId: 'mecharex', tint: '#4ade80' },
      { x: 1210, y: 265, spriteId: 'raptor', tint: '#f87171' },
    ];

    const dinos: DinoTarget[] = dinoConfigs.map((cfg, idx) => ({
      ...cfg,
      shieldVal: threeVals[idx],
      hitAnim: 0,
      deflectAnim: 0,
    }));

    const vortexOrbs: VortexOrb[] = [
      { angle: 0.2, radius: 140, val: 10, isTens: true },
      { angle: 2.1, radius: 110, val: 10, isTens: true },
      { angle: 4.0, radius: 155, val: 1, isTens: false },
      { angle: 5.2, radius: 95, val: 1, isTens: false },
    ];

    gameRef.current = {
      problem: p,
      dinos,
      hoveredDinoIdx: 1,
      playerX: 800,
      targetPlayerX: 800,
      magnetStage: 0,
      magnetSparkProgress: 0,
      laserActive: 0,
      laserTargetPos: null,
      shakeFrames: 0,
      waveTimer: 0,
      vortexOrbs,
      particles: gameRef.current?.particles || [],
      popups: gameRef.current?.popups || [],
    };
  };

  useEffect(() => {
    assets.loadAll();
    initWave(tier, true);
  }, [tier]);

  const triggerMagnetHack = () => {
    const g = gameRef.current;
    if (!g) return;
    sound.playHackActivate();
    if (g.magnetStage === 0) {
      g.magnetStage = 1;
      g.magnetSparkProgress = 1;
      onHackUsed();
      const needToTen = (10 - (g.problem.a % 10)) % 10;
      g.popups.push({
        x: 800,
        y: 540,
        vy: -1.8,
        text: needToTen > 0 ? `⚡ +${needToTen} MAGNET!` : '⚡ TENS SPLIT!',
        color: '#ffe600',
        scale: 1.0,
        alpha: 1,
        life: 0,
      });
      spawnBurst(g.particles, 800, 620, '#00f5d4', 22, 7, 'circle');
    } else if (g.magnetStage === 1) {
      g.magnetStage = 2;
      g.magnetSparkProgress = 1;
      spawnBurst(g.particles, 800, 620, '#ffe600', 22, 8, 'circle');
    } else {
      g.magnetStage = 0;
    }
  };

  const fireAtDino = (dinoIdx: number) => {
    const g = gameRef.current;
    if (!g || g.laserActive > 0) return;
    const target = g.dinos[dinoIdx];
    if (!target) return;

    g.hoveredDinoIdx = dinoIdx;
    g.targetPlayerX = Math.max(580, Math.min(1020, target.x));

    if (target.shieldVal === g.problem.answer) {
      // CRITICAL SHIELD SHATTER!
      sound.playLaserSlice();
      sound.playVictoryFanfare();
      g.laserActive = 28;
      g.laserTargetPos = { x: target.x, y: target.y };
      target.hitAnim = 28;
      if (!calmMode) g.shakeFrames = 16;

      spawnBurst(g.particles, target.x, target.y, '#ffe600', 42, 13, 'shard');
      spawnBurst(g.particles, target.x, target.y, '#00f5d4', 28, 9, 'circle');

      g.popups.push({
        x: target.x,
        y: target.y - 40,
        vy: -2.4,
        text: `💥 ${g.problem.answer}! +25 🏆`,
        color: '#ffe600',
        scale: 1.35,
        alpha: 1,
        life: 0,
      });

      onSuccess('+', g.problem.a, g.problem.b, g.magnetStage > 0);
      setScore((s) => s + 150);

      if (!calmMode && typeof window !== 'undefined') {
        confetti({ particleCount: 40, spread: 65, origin: { y: 0.45 } });
      }

      setTimeout(() => {
        setWaveCount((w) => w + 1);
        initWave(tier, false);
      }, 950);
    } else {
      // Non-punitive Shield Bounce -> Auto-trigger the visual Magnet transfer so he sees it!
      sound.playShieldDeflect();
      target.deflectAnim = 20;
      spawnBurst(g.particles, target.x, target.y + 40, '#ff4d6d', 16, 6, 'circle');
      if (g.magnetStage === 0) {
        triggerMagnetHack();
      } else if (g.magnetStage === 1) {
        g.magnetStage = 2;
      }
    }
  };

  // Keyboard bindings (Left/Right + Space for Magnet + Enter/Up to Fire)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        triggerMagnetHack();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        g.hoveredDinoIdx = Math.max(0, g.hoveredDinoIdx - 1);
        sound.playClick();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        g.hoveredDinoIdx = Math.min(2, g.hoveredDinoIdx + 1);
        sound.playClick();
      } else if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'w') {
        fireAtDino(g.hoveredDinoIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 60fps Canvas Render Loop
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
      g.playerX += (g.targetPlayerX - g.playerX) * 0.16;

      ctx.save();
      if (g.shakeFrames > 0 && !calmMode) {
        g.shakeFrames--;
        ctx.translate(
          (Math.random() - 0.5) * g.shakeFrames * 1.6,
          (Math.random() - 0.5) * g.shakeFrames * 1.6
        );
      }

      // 1. Painted Volcanic Arena Background
      const bg = assets.getBg('dino');
      if (bg) {
        ctx.drawImage(bg, 0, 0, 1600, 900);
      } else {
        ctx.fillStyle = '#140c1c';
        ctx.fillRect(0, 0, 1600, 900);
      }

      // 2. Swirling Golden Kirby Inhale Vortex in front of the Player Mech
      const vortexX = g.playerX - 180;
      const vortexY = 590;
      ctx.save();
      ctx.translate(vortexX, vortexY);
      for (let ring = 3; ring >= 1; ring--) {
        ctx.strokeStyle = ring % 2 === 0 ? 'rgba(255, 218, 53, 0.45)' : 'rgba(0, 245, 212, 0.38)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          42 * ring + Math.sin(t * 5 + ring) * 6,
          20 * ring,
          Math.sin(t * 2) * 0.2,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();

      // Orbiting +10 Cubes and +1 Sparks getting sucked into the Vortex
      g.vortexOrbs.forEach((orb, idx) => {
        orb.angle += calmMode ? 0.015 : 0.045;
        const r = orb.radius + Math.sin(t * 3 + idx) * 14;
        const ox = vortexX + Math.cos(orb.angle) * r;
        const oy = vortexY + Math.sin(orb.angle) * (r * 0.48);

        ctx.save();
        ctx.translate(ox, oy);
        if (orb.isTens) {
          ctx.fillStyle = '#ffe600';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 14;
          ctx.fillRect(-24, -24, 48, 48);
          ctx.strokeRect(-24, -24, 48, 48);
          drawStrokedText(ctx, '+10', 0, 0, 26, '#fff', '#000', 6);
        } else {
          ctx.fillStyle = '#00f5d4';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00f5d4';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          drawStrokedText(ctx, '+1', 0, 0, 22, '#fff', '#000', 5);
        }
        ctx.restore();
      });

      // 3. Draw the 3 Stomping Painted Mecha-Dinos in Bubble Armor Shields!
      g.dinos.forEach((dino, idx) => {
        const isHovered = g.hoveredDinoIdx === idx;
        const bobY = calmMode ? 0 : Math.sin(t * 3.6 + idx * 1.7) * 7;
        const recoilY = dino.hitAnim > 0 ? -dino.hitAnim * 1.5 : 0;
        const shakeX = dino.deflectAnim > 0 ? Math.sin(dino.deflectAnim * 1.8) * 10 : 0;
        if (dino.hitAnim > 0) dino.hitAnim--;
        if (dino.deflectAnim > 0) dino.deflectAnim--;

        const dx = dino.x + shakeX;
        const dy = dino.y + bobY + recoilY;

        ctx.save();
        ctx.translate(dx, dy);

        // Glowing Floor Shield Ring
        ctx.strokeStyle = isHovered ? '#ff2a6d' : dino.tint;
        ctx.lineWidth = isHovered ? 7 : 4;
        ctx.fillStyle = 'rgba(255, 190, 11, 0.12)';
        ctx.beginPath();
        ctx.ellipse(0, 88, 128, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Painted Dino Sprite
        const spr = assets.getSprite(dino.spriteId);
        if (spr) {
          const scale = dino.hitAnim > 0 ? 1.15 : isHovered ? 1.06 : 1.0;
          const sw = 240 * scale;
          const sh = 240 * scale;
          ctx.drawImage(spr, -sw / 2, -sh / 2 - 10, sw, sh);
        }

        // Translucent Energy Dome Bubble Shield (shatters when hitAnim > 0!)
        if (dino.hitAnim === 0) {
          const domeGrad = ctx.createRadialGradient(-30, -40, 20, 0, 0, 138);
          domeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          domeGrad.addColorStop(0.7, 'rgba(255, 214, 10, 0.08)');
          domeGrad.addColorStop(1, isHovered ? 'rgba(255, 42, 109, 0.55)' : 'rgba(255, 214, 10, 0.42)');
          ctx.fillStyle = domeGrad;
          ctx.strokeStyle = isHovered ? '#ff2a6d' : '#ffd60a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 6, 134, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Red Target-Lock Crosshair Reticle (just like Frame 2!)
        if (isHovered) {
          ctx.save();
          ctx.rotate(t * 0.8);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 6;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 6, 148, 0, Math.PI * 2);
          ctx.stroke();
          for (let a = 0; a < 4; a++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-6, -168, 12, 34);
          }
          ctx.restore();
        }

        // Big Armor Shield Number right on the Dino's chest (NO equation, ONLY the shield number!)
        drawStrokedText(
          ctx,
          String(dino.shieldVal),
          0,
          24,
          68,
          isHovered ? '#ff4d6d' : '#ffe600',
          '#000000',
          11
        );

        ctx.restore();
      });

      // 4. Aiming Laser Sight or Mega Fusion Beam from Player Mech to Target Dino
      const activeDino = g.dinos[g.hoveredDinoIdx] || g.dinos[1];
      if (g.laserActive > 0 && g.laserTargetPos) {
        g.laserActive--;
        drawLaserBeam(
          ctx,
          g.playerX,
          640,
          g.laserTargetPos.x,
          g.laserTargetPos.y + 10,
          '#00f5d4',
          '#fff36b',
          44
        );
      } else if (activeDino) {
        // Dotted aiming sight
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.moveTo(g.playerX, 640);
        ctx.lineTo(activeDino.x, activeDino.y + 45);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Player Mech Sprite at Bottom-Center (`kirb` or `ignis`)
      const heroSpr = assets.getSprite(heroId === 'ignis' ? 'ignis' : 'kirb');
      const heroBob = calmMode ? 0 : Math.sin(t * 4.5) * 5;
      ctx.save();
      ctx.translate(g.playerX, 710 + heroBob);

      // Glowing Cyan Pedestal Ring under Player
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, 74, 96, 34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (heroSpr) {
        ctx.drawImage(heroSpr, -118, -118, 236, 236);
      }

      // 100% HP Bar above Mech
      ctx.fillStyle = '#000';
      ctx.fillRect(-58, -132, 116, 18);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-55, -129, 110, 12);
      ctx.restore();

      // 6. TWIN SHOULDER CANNON HOLOGRAM GAUGES + ELECTRIC MAGNET ARC (Just like Frame 2!)
      const { a, b, answer } = g.problem;
      const needToTen = (10 - (a % 10)) % 10;
      const canMakeTen = needToTen > 0 && b >= needToTen;
      const roundA = canMakeTen ? a + needToTen : Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10;
      const roundB = canMakeTen ? b - needToTen : (a % 10) + (b % 10);

      const topGaugeText =
        g.magnetStage === 0
          ? `${a}`
          : g.magnetStage === 1
          ? `${a} ➔ ${roundA}`
          : `${Math.floor(answer / 10) * 10}`;
      const botGaugeText =
        g.magnetStage === 0
          ? `${b}`
          : g.magnetStage === 1
          ? `${b} ➔ ${roundB}`
          : `+ ${answer % 10}`;

      // Top Gold Gauge
      drawSkewedPlate(
        ctx,
        1155,
        545,
        295,
        88,
        'rgba(38, 28, 6, 0.92)',
        '#ffe600',
        5,
        -0.18,
        '#ffe600'
      );
      drawStrokedText(ctx, topGaugeText, 1155, 545, 50, '#ffe600', '#000', 8);

      // Bottom Cyan Gauge
      drawSkewedPlate(
        ctx,
        1140,
        680,
        295,
        88,
        'rgba(6, 32, 48, 0.92)',
        '#00f5d4',
        5,
        -0.18,
        '#00f5d4'
      );
      drawStrokedText(ctx, botGaugeText, 1140, 680, 50, '#00f5d4', '#000', 8);

      // Electric Magnet Lightning Arc connecting the Mech & Shoulder Gauges
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g.playerX + 75, 650);
      for (let step = 1; step <= 6; step++) {
        const lx = g.playerX + 75 + step * 35;
        const ly = 630 + Math.sin(t * 22 + step * 2) * 10;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      ctx.restore();

      // Interactive "+MAGNET" Trigger Badge between the two gauges
      const magLabel =
        canMakeTen && g.magnetStage === 0
          ? `+${needToTen} MAGNET ⚡`
          : g.magnetStage === 1
          ? `FUSE TENS ⚡`
          : `RESET ⚡`;
      drawSkewedPlate(ctx, 955, 612, 195, 48, '#0b172e', '#00f5d4', 4, -0.14, '#00f5d4');
      drawStrokedText(ctx, magLabel, 955, 612, 23, '#72efdd', '#000', 5);

      // 7. DIEGETIC VISUAL COACH ("Show, Don't Tell" — NO paragraphs of text!)
      // On Wave 1 (or if idle > 4.5s), the glowing hand shows:
      // First 2.5s: Tap the +MAGNET arc to snap 58+25 -> 60+23!
      // After Magnet (or after 2.5s): Point directly at the matching Dino's shield!
      const correctDino = g.dinos.find((d) => d.shieldVal === answer);
      if ((waveCount === 1 || g.waveTimer > 4.5) && g.laserActive === 0 && correctDino) {
        if (g.magnetStage === 0 && g.waveTimer < 3.5) {
          drawDiegeticCoachPointer(ctx, 1140, 680, 955, 612, t, '#00f5d4');
        } else {
          drawDiegeticCoachPointer(
            ctx,
            1155,
            545,
            correctDino.x,
            correctDino.y + 30,
            t,
            '#ffe600'
          );
        }
      }

      // 8. Particles & Floating Popups
      updateAndDrawParticles(ctx, g.particles, g.popups);

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [calmMode, heroId, tier, waveCount]);

  // Pointer Move & Click on the Full-Viewport Canvas
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1600,
      y: ((e.clientY - rect.top) / rect.height) * 900,
    };
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { x, y } = getCanvasCoords(e);
    g.targetPlayerX = Math.max(540, Math.min(1040, x));

    // Highlight closest Dino when aiming in the upper arena
    if (y < 480) {
      let bestIdx = g.hoveredDinoIdx;
      let bestDist = 9999;
      g.dinos.forEach((d, idx) => {
        const dist = Math.hypot(x - d.x, y - d.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      g.hoveredDinoIdx = bestIdx;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { x, y } = getCanvasCoords(e);

    // Did the player click the Shoulder Gauges or +MAGNET badge?
    if (x > 840 && y > 480 && y < 760) {
      triggerMagnetHack();
      return;
    }

    // Did the player click one of the 3 Dinos?
    for (let i = 0; i < g.dinos.length; i++) {
      const d = g.dinos[i];
      if (Math.hypot(x - d.x, y - d.y) < 165) {
        fireAtDino(i);
        return;
      }
    }

    // Otherwise fire at currently aimed Dino!
    fireAtDino(g.hoveredDinoIdx);
  };

  return (
    <div className="fullscreen-world-Wrapper">
      <canvas
        ref={canvasRef}
        width={1600}
        height={900}
        className="fullscreen-game-canvas"
        onMouseMove={handleCanvasMove}
        onClick={handleCanvasClick}
      />

      {/* Minimal Brawl-Style Corner HUD Overlays (Zero Text Clutter!) */}
      <button type="button" className="brawl-back-corner" onClick={onBack} aria-label="Back">
        ◀
      </button>

      <div className="world-hud-top-left" dir="ltr">
        <div className="hp-bar-frame">
          <span className="hp-tag">HP</span>
          <div className="hp-fill">100%</div>
        </div>
        <div className="coin-counter-row">🪙 {score}</div>
      </div>

      <div className="world-hud-top-right" dir="ltr">
        <span>🦖 WAVE {waveCount}</span>
      </div>

      {/* Bottom Right Tactile MAGNET Action Button for Touch/Mobile */}
      <button
        type="button"
        className="brawl-action-fab gold-fab"
        onClick={triggerMagnetHack}
      >
        ⚡ MAGNET {isHe ? 'מגנט 10' : '10'}
      </button>
    </div>
  );
};
