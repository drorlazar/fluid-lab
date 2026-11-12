import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import {
  Particle,
  FloatingPopup,
  spawnBurst,
  updateAndDrawParticles,
  drawStrokedText,
  drawSkewedPlate,
  drawDiegeticCoachPointer,
} from '../engine/vfxCanvas';
import { sound } from '../audio/soundEngine';

interface NeonDashModeProps {
  lang: Language;
  tier: DifficultyTier;
  heroId: string;
  calmMode: boolean;
  onBack: () => void;
  onSuccess: (op: '+' | '-' | '×', a: number, b: number, usedHack: boolean) => void;
  onHackUsed: () => void;
}

interface PortalRail {
  y: number;
  val: number;
}

export const NeonDashMode: React.FC<NeonDashModeProps> = ({
  lang,
  tier,
  calmMode,
  onBack,
  onSuccess,
  onHackUsed,
}) => {
  const isHe = lang === 'he';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [combo, setCombo] = useState(1);

  const gameRef = useRef<{
    problem: MathProblem;
    otherFactor: number;
    rails: PortalRail[];
    selectedRailIdx: number;
    holoHandsVisible: boolean;
    dashAnimProgress: number; // 0 = hovering in Bullet-Time, >0 = smashing through portal!
    shakeFrames: number;
    waveTimer: number;
    particles: Particle[];
    popups: FloatingPopup[];
  } | null>(null);

  const initJump = (currentTier: DifficultyTier, isFirst = false) => {
    const p = generateProblem({ tier: currentTier, forcedOp: '×', focusTable: isFirst ? 9 : null });
    if (isFirst) {
      p.a = 9;
      p.b = 7;
      p.answer = 63;
    } else if (Math.random() < 0.65) {
      // Favor 9x table in Geometry Overdrive so the 10 Holographic Mecha-Fingers shine!
      const n = 2 + Math.floor(Math.random() * 8);
      p.a = 9;
      p.b = n;
      p.answer = 9 * n;
      p.displayEquation = `9 × ${n}`;
    }

    const otherFactor = p.a === 9 ? p.b : p.b === 9 ? p.a : Math.min(10, p.b);
    const decoys = p.choices.filter((c) => c !== p.answer).slice(0, 2);
    const railVals = [decoys[0] || p.answer + 9, p.answer, decoys[1] || Math.max(4, p.answer - 9)];
    if (!isFirst) railVals.sort(() => Math.random() - 0.5);

    const rails: PortalRail[] = [
      { y: 455, val: railVals[0] },
      { y: 585, val: railVals[1] },
      { y: 715, val: railVals[2] },
    ];

    gameRef.current = {
      problem: p,
      otherFactor,
      rails,
      selectedRailIdx: 1,
      holoHandsVisible: true,
      dashAnimProgress: 0,
      shakeFrames: 0,
      waveTimer: 0,
      particles: gameRef.current?.particles || [],
      popups: gameRef.current?.popups || [],
    };
  };

  useEffect(() => {
    initJump(tier, true);
  }, [tier]);

  const smashPortal = (railIdx: number) => {
    const g = gameRef.current;
    if (!g || g.dashAnimProgress > 0) return;
    const rail = g.rails[railIdx];
    if (!rail) return;

    g.selectedRailIdx = railIdx;

    if (rail.val === g.problem.answer) {
      sound.playLaserSlice();
      sound.playVictoryFanfare();
      g.dashAnimProgress = 1;
      if (!calmMode) g.shakeFrames = 18;

      spawnBurst(g.particles, 1140, rail.y, '#ffe600', 48, 15, 'shard');
      spawnBurst(g.particles, 1140, rail.y, '#00f5d4', 30, 11, 'circle');

      g.popups.push({
        x: 980,
        y: rail.y - 45,
        vy: -2.4,
        text: `⚡ PORTAL SMASH ${g.problem.answer}! +25 🏆`,
        color: '#ffe600',
        scale: 1.35,
        alpha: 1,
        life: 0,
      });

      onSuccess('×', g.problem.a, g.problem.b, g.holoHandsVisible);
      setCombo((c) => c + 1);

      if (!calmMode && typeof window !== 'undefined') {
        confetti({ particleCount: 45, spread: 70, origin: { y: 0.5 } });
      }

      setTimeout(() => {
        initJump(tier, false);
      }, 880);
    } else {
      sound.playShieldDeflect();
      spawnBurst(g.particles, 1140, rail.y, '#ff2a6d', 18, 7, 'circle');
      g.holoHandsVisible = true;
      onHackUsed();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        g.selectedRailIdx = Math.max(0, g.selectedRailIdx - 1);
        sound.playClick();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        g.selectedRailIdx = Math.min(2, g.selectedRailIdx + 1);
        sound.playClick();
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        smashPortal(g.selectedRailIdx);
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
      if (g.dashAnimProgress > 0) {
        g.dashAnimProgress = Math.min(1.5, g.dashAnimProgress + 0.08);
      }

      ctx.save();
      if (g.shakeFrames > 0 && !calmMode) {
        g.shakeFrames--;
        ctx.translate(
          (Math.random() - 0.5) * g.shakeFrames * 1.5,
          (Math.random() - 0.5) * g.shakeFrames * 1.5
        );
      }

      // 1. Deep Synthwave Night City Backdrop (Just like Frame 5 Left Half!)
      const sky = ctx.createLinearGradient(0, 0, 0, 900);
      sky.addColorStop(0, '#090b24');
      sky.addColorStop(0.55, '#191342');
      sky.addColorStop(1, '#080716');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 1600, 900);

      // Cyber City Silhouette skyline
      ctx.fillStyle = 'rgba(13, 18, 48, 0.85)';
      [
        [40, 520, 110, 380],
        [170, 560, 95, 340],
        [310, 490, 130, 410],
        [480, 580, 90, 320],
        [820, 540, 140, 360],
        [1020, 510, 110, 390],
      ].forEach(([bx, by, bw, bh]) => {
        ctx.fillRect(bx, by, bw, bh);
      });

      // 2. 10 GIANT HOLOGRAPHIC MECHA-FINGERS FANNED OUT IN THE SKY (Just like Frame 5!)
      const { a, b, answer } = g.problem;
      const isNineFact = a === 9 || b === 9;
      const foldedFinger = isNineFact ? g.otherFactor : -1;
      const leftTensCount = isNineFact ? foldedFinger - 1 : Math.floor(answer / 10);

      for (let i = 1; i <= 10; i++) {
        const isFolded = i === foldedFinger;
        const isLeftGold = isNineFact ? i < foldedFinger : i <= leftTensCount;
        const fx = 285 + (i - 1) * 74 + (i > 5 ? 34 : 0);
        const fy = isFolded ? 285 : 225 - Math.sin(((i - 1) / 9) * Math.PI) * 42;
        const angle = (i - 5.5) * 0.048;
        const fingerLen = isFolded ? 82 : 175;

        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(angle);

        const col = isFolded ? '#475569' : isLeftGold ? '#ffe600' : '#00f5d4';
        ctx.strokeStyle = col;
        ctx.fillStyle = isFolded
          ? 'rgba(51, 65, 85, 0.55)'
          : isLeftGold
          ? 'rgba(255, 230, 0, 0.2)'
          : 'rgba(0, 245, 212, 0.2)';
        ctx.lineWidth = 5;
        ctx.shadowColor = col;
        ctx.shadowBlur = isFolded ? 4 : 22;

        // Segmented Robot Finger Capsule
        ctx.beginPath();
        ctx.roundRect(-27, -fingerLen / 2, 54, fingerLen, 22);
        ctx.fill();
        ctx.stroke();

        // Knuckle joints
        if (!isFolded) {
          ctx.beginPath();
          ctx.moveTo(-25, -fingerLen / 2 + 52);
          ctx.lineTo(25, -fingerLen / 2 + 52);
          ctx.moveTo(-25, -fingerLen / 2 + 108);
          ctx.lineTo(25, -fingerLen / 2 + 108);
          ctx.stroke();
        }

        // Finger Value Label
        const label = isFolded
          ? `×${foldedFinger}`
          : isLeftGold
          ? `${leftTensCount * 10}`
          : `${10 - foldedFinger}`;
        drawStrokedText(
          ctx,
          isNineFact ? label : isLeftGold ? '+10' : '+1',
          0,
          fingerLen / 2 - 28,
          26,
          isLeftGold ? '#ffe600' : '#00f5d4',
          '#000',
          6
        );
        drawStrokedText(ctx, String(i), 0, -fingerLen / 2 + 24, 20, '#ffffff', '#000', 4);
        ctx.restore();
      }

      // 3. Left Neon Launch Platform & Jump Pad Burst (Just like Frame 5!)
      ctx.fillStyle = '#071426';
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 18;
      ctx.fillRect(-10, 650, 390, 260);
      ctx.strokeRect(-10, 650, 390, 260);
      ctx.shadowBlur = 0;

      // Jump Pad Starburst on Platform Edge
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.moveTo(190, 650);
      ctx.lineTo(225, 605);
      ctx.lineTo(245, 638);
      ctx.lineTo(285, 595);
      ctx.lineTo(275, 650);
      ctx.closePath();
      ctx.fill();

      // 4. Blazing Neon Pink Laser Spikes across the Pit!
      for (let sx = 415; sx < 1120; sx += 54) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 128, 0.28)';
        ctx.strokeStyle = '#ff00a0';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff00a0';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(sx, 855);
        ctx.lineTo(sx + 27, 735);
        ctx.lineTo(sx + 54, 855);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 5. Three Stacked Portal Rails on the Right (`72`, `63`, `54` — Just like Frame 5!)
      const activeRail = g.rails[g.selectedRailIdx] || g.rails[1];
      g.rails.forEach((rail, idx) => {
        const isSelected = g.selectedRailIdx === idx;
        ctx.save();
        ctx.translate(1150, rail.y);

        // Horizontal Neon Rail Beam
        const railGrad = ctx.createLinearGradient(0, -36, 0, 36);
        railGrad.addColorStop(0, isSelected ? '#fde047' : '#0284c7');
        railGrad.addColorStop(1, isSelected ? '#ca8a04' : '#0f172a');
        ctx.fillStyle = railGrad;
        ctx.strokeStyle = isSelected ? '#ffffff' : '#38bdf8';
        ctx.lineWidth = 5;
        ctx.shadowColor = isSelected ? '#ffe600' : '#00bbf9';
        ctx.shadowBlur = isSelected ? 26 : 10;

        ctx.beginPath();
        ctx.roundRect(0, -38, 460, 76, 16);
        ctx.fill();
        ctx.stroke();

        // Glowing Golden Portal Ring Mouth on Selected Rail!
        ctx.fillStyle = isSelected ? '#ffe600' : '#0f172a';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        drawStrokedText(
          ctx,
          String(rail.val),
          125,
          2,
          56,
          isSelected ? '#ffffff' : '#e0f2fe',
          '#000',
          10
        );
        ctx.restore();
      });

      // 6. Glowing Cyan Jump Trajectory Arc + 3D Mecha-Cube Runner in Mid-Air Bullet-Time!
      const startX = 240;
      const startY = 640;
      const hoverX = 560;
      const hoverY = 465 + (calmMode ? 0 : Math.sin(t * 4) * 8);

      const cubeX =
        g.dashAnimProgress > 0
          ? hoverX + (1150 - hoverX) * Math.min(1, g.dashAnimProgress)
          : hoverX;
      const cubeY =
        g.dashAnimProgress > 0
          ? hoverY + (activeRail.y - hoverY) * Math.min(1, g.dashAnimProgress)
          : hoverY;

      // Glowing Cyan Comet Trail from Launch Pad to Cube
      const trailGrad = ctx.createLinearGradient(startX, startY, cubeX, cubeY);
      trailGrad.addColorStop(0, 'rgba(0, 245, 212, 0.05)');
      trailGrad.addColorStop(1, 'rgba(0, 245, 212, 0.85)');
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(380, 500, cubeX, cubeY);
      ctx.stroke();

      // Dotted Aiming Trajectory from Cube into Selected Portal Rail
      if (g.dashAnimProgress === 0) {
        ctx.save();
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 6;
        ctx.setLineDash([16, 12]);
        ctx.beginPath();
        ctx.moveTo(cubeX + 60, cubeY);
        ctx.quadraticCurveTo(860, (cubeY + activeRail.y) / 2 - 40, 1130, activeRail.y);
        ctx.stroke();
        ctx.restore();
      }

      // 3D Isometric Glowing Cyan Mecha-Cube (Just like Frame 5!)
      ctx.save();
      ctx.translate(cubeX, cubeY);
      ctx.rotate(-0.12);
      ctx.fillStyle = '#0891b2';
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.roundRect(-72, -72, 144, 144, 18);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner 3D Cube Face Divider
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.strokeRect(-62, -62, 124, 124);

      drawStrokedText(ctx, `${a} × ${b}`, 0, 0, 44, '#72efdd', '#000', 8);
      ctx.restore();

      drawStrokedText(ctx, 'BULLET-TIME', cubeX, cubeY + 108, 30, '#ffffff', '#000', 6);
      drawStrokedText(ctx, 'SLOW-MO', cubeX, cubeY + 140, 30, '#00f5d4', '#000', 6);

      // 7. DIEGETIC VISUAL COACH ("Show, Don't Tell")
      const correctRail = g.rails.find((r) => r.val === answer);
      if ((combo === 1 || g.waveTimer > 4.0) && g.dashAnimProgress === 0 && correctRail) {
        drawDiegeticCoachPointer(ctx, cubeX + 70, cubeY, 1220, correctRail.y, t, '#ffe600');
      }

      // Top Title Banner
      drawStrokedText(ctx, 'GEOMETRY OVERDRIVE', 460, 58, 62, '#ffffff', '#000', 11);

      updateAndDrawParticles(ctx, g.particles, g.popups);

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [calmMode, combo, tier]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1600,
      y: ((e.clientY - rect.top) / rect.height) * 900,
    };
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g || g.dashAnimProgress > 0) return;
    const { y } = getCoords(e);
    let best = g.selectedRailIdx;
    let minD = 9999;
    g.rails.forEach((r, idx) => {
      const d = Math.abs(y - r.y);
      if (d < minD) {
        minD = d;
        best = idx;
      }
    });
    g.selectedRailIdx = best;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g) return;
    const { y } = getCoords(e);
    let best = g.selectedRailIdx;
    let minD = 9999;
    g.rails.forEach((r, idx) => {
      const d = Math.abs(y - r.y);
      if (d < minD) {
        minD = d;
        best = idx;
      }
    });
    smashPortal(best);
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

      <div className="world-hud-top-right" dir="ltr">
        <span>⚡ COMBO ×{combo}</span>
      </div>

      <button
        type="button"
        className="brawl-action-fab gold-fab"
        onClick={() => smashPortal(gameRef.current?.selectedRailIdx ?? 1)}
      >
        🚀 WARP DASH {isHe ? 'שיגור!' : '!'}
      </button>
    </div>
  );
};
