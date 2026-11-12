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

interface SpaceSlicerModeProps {
  lang: Language;
  tier: DifficultyTier;
  heroId: string;
  calmMode: boolean;
  onBack: () => void;
  onSuccess: (op: '+' | '-' | '×', a: number, b: number, usedHack: boolean) => void;
  onHackUsed: () => void;
}

interface CorePod {
  x: number;
  y: number;
  val: number;
}

export const SpaceSlicerMode: React.FC<SpaceSlicerModeProps> = ({
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
  const [score, setScore] = useState(1450230);

  const gameRef = useRef<{
    problem: MathProblem;
    shiftDelta: number;
    shiftUnlocked: boolean;
    shiftAnimProgress: number;
    corePods: CorePod[];
    hoveredPodIdx: number;
    shipX: number;
    targetShipX: number;
    shipBank: number;
    firingLaser: number;
    laserTarget: { x: number; y: number } | null;
    bossHitAnim: number;
    shakeFrames: number;
    waveTimer: number;
    particles: Particle[];
    popups: FloatingPopup[];
  } | null>(null);

  const initWave = (currentTier: DifficultyTier, isFirst = false) => {
    const p = generateProblem({ tier: currentTier, forcedOp: '-' });
    if (isFirst && currentTier !== 'rookie') {
      p.a = 73;
      p.b = 39;
      p.answer = 34;
    } else if (!isFirst && currentTier !== 'rookie' && p.b % 10 < 6) {
      // Favor numbers ending in 7, 8, 9 so the Equal Shift +1/+2/+3 is super crisp!
      const rem = 7 + Math.floor(Math.random() * 3);
      p.b = Math.floor(p.b / 10) * 10 + rem;
      if (p.a <= p.b + 8) p.a = p.b + 24;
      p.answer = p.a - p.b;
    }

    const onesB = p.b % 10;
    const shiftDelta = onesB === 0 ? 0 : 10 - onesB;

    const decoys = p.choices.filter((c) => c !== p.answer).slice(0, 2);
    const podVals = [decoys[0] || p.answer + 10, p.answer, decoys[1] || Math.max(2, p.answer - 8)];
    if (!isFirst) podVals.sort(() => Math.random() - 0.5);

    const corePods: CorePod[] = [
      { x: 520, y: 120, val: podVals[0] },
      { x: 800, y: 85, val: podVals[1] },
      { x: 1080, y: 120, val: podVals[2] },
    ];

    gameRef.current = {
      problem: p,
      shiftDelta,
      shiftUnlocked: false,
      shiftAnimProgress: 0,
      corePods,
      hoveredPodIdx: 1,
      shipX: 880,
      targetShipX: 880,
      shipBank: 0,
      firingLaser: 0,
      laserTarget: null,
      bossHitAnim: 0,
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

  const triggerEqualShiftBeam = () => {
    const g = gameRef.current;
    if (!g) return;
    sound.playHackActivate();
    if (!g.shiftUnlocked) {
      g.shiftUnlocked = true;
      g.shiftAnimProgress = 1;
      onHackUsed();
      spawnBurst(g.particles, 1020, 355, '#4ade80', 32, 9, 'circle');
      g.popups.push({
        x: 920,
        y: 520,
        vy: -2.0,
        text: `⚡ EQUAL SHIFT +${g.shiftDelta}!`,
        color: '#00f5d4',
        scale: 1.1,
        alpha: 1,
        life: 0,
      });
    } else {
      g.shiftUnlocked = false;
    }
  };

  const fireAtPod = (podIdx: number) => {
    const g = gameRef.current;
    if (!g || g.firingLaser > 0) return;
    const pod = g.corePods[podIdx];
    if (!pod) return;

    g.hoveredPodIdx = podIdx;
    g.targetShipX = Math.max(580, Math.min(1120, pod.x));

    if (pod.val === g.problem.answer) {
      sound.playLaserSlice();
      sound.playVictoryFanfare();
      g.firingLaser = 28;
      g.laserTarget = { x: pod.x, y: pod.y };
      g.bossHitAnim = 28;
      if (!calmMode) g.shakeFrames = 18;

      spawnBurst(g.particles, 800, 355, '#ffe600', 48, 14, 'shard');
      spawnBurst(g.particles, pod.x, pod.y, '#00f5d4', 32, 11, 'circle');

      g.popups.push({
        x: 800,
        y: 280,
        vy: -2.5,
        text: `💥 CORE BREACH ${g.problem.answer}! +25 🏆`,
        color: '#ffe600',
        scale: 1.35,
        alpha: 1,
        life: 0,
      });

      onSuccess('-', g.problem.a, g.problem.b, g.shiftUnlocked);
      setScore((s) => s + 25000);

      if (!calmMode && typeof window !== 'undefined') {
        confetti({ particleCount: 45, spread: 70, origin: { y: 0.4 } });
      }

      setTimeout(() => {
        setWave((w) => w + 1);
        initWave(tier, false);
      }, 980);
    } else {
      sound.playShieldDeflect();
      spawnBurst(g.particles, pod.x, pod.y, '#ff4d6d', 18, 7, 'circle');
      if (!g.shiftUnlocked) {
        triggerEqualShiftBeam();
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        triggerEqualShiftBeam();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        g.hoveredPodIdx = Math.max(0, g.hoveredPodIdx - 1);
        sound.playClick();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        g.hoveredPodIdx = Math.min(2, g.hoveredPodIdx + 1);
        sound.playClick();
      } else if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'w') {
        fireAtPod(g.hoveredPodIdx);
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
      const dx = g.targetShipX - g.shipX;
      g.shipX += dx * 0.15;
      g.shipBank = Math.max(-0.28, Math.min(0.28, dx * 0.0022));

      ctx.save();
      if (g.shakeFrames > 0 && !calmMode) {
        g.shakeFrames--;
        ctx.translate(
          (Math.random() - 0.5) * g.shakeFrames * 1.6,
          (Math.random() - 0.5) * g.shakeFrames * 1.6
        );
      }

      // 1. Painted Nebula Canyon Background
      const bg = assets.getBg('space');
      if (bg) {
        ctx.drawImage(bg, 0, 0, 1600, 900);
      } else {
        ctx.fillStyle = '#0d0628';
        ctx.fillRect(0, 0, 1600, 900);
      }

      const { a, b, answer } = g.problem;
      const shiftedA = a + g.shiftDelta;
      const shiftedB = b + g.shiftDelta;

      // 2. Colossal Painted Dreadnought Boss at Upper-Center (800, 345)
      const bossSpr = assets.getSprite('dreadnought');
      const bossBob = calmMode ? 0 : Math.sin(t * 2.5) * 8;
      const bossX = 800;
      const bossY = 345 + bossBob - (g.bossHitAnim > 0 ? g.bossHitAnim * 1.2 : 0);
      if (g.bossHitAnim > 0) g.bossHitAnim--;

      if (bossSpr) {
        ctx.drawImage(bossSpr, bossX - 420, bossY - 250, 840, 500);
      }

      // Glowing Central Reactor Core inside the Dreadnought
      const coreGrad = ctx.createRadialGradient(bossX, bossY, 10, bossX, bossY, 96);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.45, '#ffbe0b');
      coreGrad.addColorStop(1, 'rgba(255, 0, 128, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(bossX, bossY, 96, 0, Math.PI * 2);
      ctx.fill();

      // If Equal Shift is unlocked, show the glowing golden weak-point indicator in the center!
      drawStrokedText(
        ctx,
        g.shiftUnlocked ? `${shiftedA - shiftedB}` : '?',
        bossX,
        bossY,
        58,
        '#ffe600',
        '#000',
        10
      );

      // LEFT HOLOGRAPHIC SHIELD PLATE: Red Locked `73 - 39`
      drawSkewedPlate(
        ctx,
        575,
        bossY + 10,
        265,
        104,
        'rgba(30, 41, 59, 0.88)',
        '#38bdf8',
        4,
        0.08,
        '#38bdf8'
      );
      drawStrokedText(ctx, `🔒 ${a} - ${b}`, 575, bossY + 10, 44, '#ef4444', '#000', 8);

      // RIGHT HOLOGRAPHIC SHIELD PLATE: Green Unlocked `74 - 40` with `+1` thruster sparks!
      drawSkewedPlate(
        ctx,
        1035,
        bossY + 10,
        290,
        112,
        g.shiftUnlocked ? 'rgba(20, 83, 45, 0.92)' : 'rgba(15, 23, 42, 0.88)',
        g.shiftUnlocked ? '#4ade80' : '#00f5d4',
        5,
        -0.08,
        g.shiftUnlocked ? '#4ade80' : '#00f5d4'
      );

      if (g.shiftUnlocked) {
        drawStrokedText(
          ctx,
          `🔓 ${shiftedA} - ${shiftedB}`,
          1035,
          bossY + 10,
          46,
          '#4ade80',
          '#000',
          8
        );
        // +1 Thruster Sparks at top & bottom of the unlocked plate (just like Frame 3!)
        drawStrokedText(ctx, `+${g.shiftDelta}`, 965, bossY - 56, 32, '#ffe600', '#000', 6);
        drawStrokedText(ctx, `+${g.shiftDelta}`, 1105, bossY - 56, 32, '#ffe600', '#000', 6);
        drawStrokedText(ctx, `+${g.shiftDelta}`, 965, bossY + 76, 32, '#ffe600', '#000', 6);
        drawStrokedText(ctx, `+${g.shiftDelta}`, 1105, bossY + 76, 32, '#ffe600', '#000', 6);
      } else {
        drawStrokedText(
          ctx,
          `⚡ SHIFT +${g.shiftDelta}`,
          1035,
          bossY + 10,
          38,
          '#00f5d4',
          '#000',
          7
        );
      }

      // 3. Three Orbiting Target Core Pods above the Dreadnought
      g.corePods.forEach((pod, idx) => {
        const isHovered = g.hoveredPodIdx === idx;
        const py = pod.y + Math.sin(t * 3.5 + idx) * 6;

        ctx.save();
        ctx.translate(pod.x, py);
        ctx.strokeStyle = isHovered ? '#ffe600' : '#00f5d4';
        ctx.fillStyle = isHovered ? 'rgba(255, 230, 0, 0.25)' : 'rgba(9, 19, 44, 0.9)';
        ctx.lineWidth = isHovered ? 6 : 4;
        ctx.shadowColor = isHovered ? '#ffe600' : '#00f5d4';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        drawStrokedText(
          ctx,
          String(pod.val),
          0,
          2,
          48,
          isHovered ? '#ffe600' : '#ffffff',
          '#000',
          9
        );
        ctx.restore();
      });

      // 4. 3D HOLOGRAPHIC WARP-JUMP TUNNEL along Bottom-Left (Just like Frame 3!)
      const nextTen = Math.ceil((b + 1) / 10) * 10;
      const jump1 = Math.max(1, nextTen - b);
      const jump2 = Math.max(1, a - nextTen);

      // Curved Translucent Tunnel Tube
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
      ctx.lineWidth = 96;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(60, 660);
      ctx.quadraticCurveTo(320, 770, 610, 825);
      ctx.stroke();
      ctx.restore();

      const warpNodes = [
        { x: 145, y: 715, val: String(b), col: '#00bbf9', step: `+${jump1}` },
        { x: 365, y: 780, val: String(nextTen), col: '#00f5d4', step: `+${jump2}` },
        { x: 590, y: 825, val: String(a), col: '#d946ef', step: null },
      ];

      warpNodes.forEach((wn) => {
        ctx.save();
        ctx.translate(wn.x, wn.y);
        ctx.strokeStyle = wn.col;
        ctx.fillStyle = 'rgba(8, 15, 35, 0.88)';
        ctx.lineWidth = 6;
        ctx.shadowColor = wn.col;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 68, 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawStrokedText(ctx, wn.val, 0, 0, 42, '#ffe600', '#000', 8);
        ctx.restore();

        if (wn.step) {
          drawStrokedText(ctx, `(${wn.step}) ➔`, wn.x + 112, wn.y + 18, 28, '#4ade80', '#000', 6);
        }
      });

      // 5. Twin Equal-Shift Tractor Beams or Plasma Torpedo Laser from Star-Viper!
      const shipY = 740;
      if (g.firingLaser > 0 && g.laserTarget) {
        g.firingLaser--;
        drawLaserBeam(
          ctx,
          g.shipX - 45,
          shipY - 40,
          g.laserTarget.x,
          g.laserTarget.y,
          '#00f5d4',
          '#ffffff',
          26
        );
        drawLaserBeam(
          ctx,
          g.shipX + 45,
          shipY - 40,
          g.laserTarget.x,
          g.laserTarget.y,
          '#ffe600',
          '#ffffff',
          26
        );
      } else {
        // Twin blue tractor beams locked onto the Dreadnought core (Just like Frame 3!)
        drawLaserBeam(ctx, g.shipX - 46, shipY - 40, bossX - 45, bossY + 60, '#00bbf9', '#e0f2fe', 14);
        drawLaserBeam(ctx, g.shipX + 46, shipY - 40, bossX + 45, bossY + 60, '#00bbf9', '#e0f2fe', 14);
      }

      drawStrokedText(
        ctx,
        `EQUAL SHIFT +${g.shiftDelta}`,
        g.shipX + 90,
        shipY - 125,
        34,
        '#38bdf8',
        '#000',
        7
      );

      // 6. Player Painted Star-Viper Spaceship Sprite (`viper`)
      const viperSpr = assets.getSprite('viper');
      ctx.save();
      ctx.translate(g.shipX, shipY);
      ctx.rotate(g.shipBank);
      if (viperSpr) {
        ctx.drawImage(viperSpr, -165, -130, 330, 260);
      }
      ctx.restore();

      // 7. DIEGETIC VISUAL COACH ("Show, Don't Tell")
      const matchingPod = g.corePods.find((p) => p.val === answer);
      if ((wave === 1 || g.waveTimer > 4.5) && g.firingLaser === 0 && matchingPod) {
        if (!g.shiftUnlocked && g.waveTimer < 3.5) {
          drawDiegeticCoachPointer(ctx, g.shipX, shipY - 60, 1035, bossY + 10, t, '#00f5d4');
        } else {
          drawDiegeticCoachPointer(ctx, 1035, bossY + 10, matchingPod.x, matchingPod.y, t, '#ffe600');
        }
      }

      // 8. Particles & Floating Popups
      updateAndDrawParticles(ctx, g.particles, g.popups);

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [calmMode, tier, wave]);

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
    g.targetShipX = Math.max(540, Math.min(1220, x));
    if (y < 240) {
      let best = g.hoveredPodIdx;
      let minD = 9999;
      g.corePods.forEach((p, idx) => {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < minD) {
          minD = d;
          best = idx;
        }
      });
      g.hoveredPodIdx = best;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { x, y } = getCoords(e);

    // Did they click one of the 3 Top Target Core Pods?
    for (let i = 0; i < g.corePods.length; i++) {
      const p = g.corePods[i];
      if (Math.hypot(x - p.x, y - p.y) < 88) {
        fireAtPod(i);
        return;
      }
    }

    // Did they click the Dreadnought's Shield Plates to trigger Equal Shift +1?
    if (y > 220 && y < 520) {
      if (!g.shiftUnlocked) {
        triggerEqualShiftBeam();
        return;
      }
    }

    fireAtPod(g.hoveredPodIdx);
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
        <div className="space-stat-line">LIVES: 3</div>
        <div className="space-stat-line">SCORE: {score.toLocaleString()}</div>
      </div>

      <div className="world-hud-top-right" dir="ltr">
        <span>🛸 DREADNOUGHT | WAVE {wave}</span>
      </div>

      <button
        type="button"
        className="brawl-action-fab cyan-fab"
        onClick={triggerEqualShiftBeam}
      >
        ⚡ SHIFT +1 {isHe ? 'הזזה שווה' : 'BEAM'}
      </button>
    </div>
  );
};
