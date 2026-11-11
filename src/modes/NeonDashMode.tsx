import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Zap, ArrowLeft, Gauge } from 'lucide-react';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { UI_STRINGS } from '../i18n/content';
import { HackVisorPanel } from '../components/HackVisorPanel';
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

export const NeonDashMode: React.FC<NeonDashModeProps> = ({
  lang,
  tier,
  calmMode,
  onBack,
  onSuccess,
  onHackUsed,
}) => {
  const t = UI_STRINGS[lang];
  const isHe = lang === 'he';

  const [problem, setProblem] = useState<MathProblem>(() =>
    generateProblem({ tier })
  );
  const [laneChoices, setLaneChoices] = useState<number[]>([]);
  const [runnerLane, setRunnerLane] = useState<number>(1); // 0, 1, 2
  const [lockedBoost, setLockedBoost] = useState<boolean>(false);
  const [bulletTime, setBulletTime] = useState<boolean>(false);
  const [hackOpen, setHackOpen] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [banner, setBanner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const portalXRef = useRef<number>(0.92); // normalized 0..1 across canvas
  const scrollOffsetRef = useRef<number>(0);

  // Build 3 lane portal values (1 correct, 2 decoys)
  const setupPortals = useCallback((p: MathProblem) => {
    const decoys = p.choices.filter((c) => c !== p.answer).slice(0, 2);
    const three = [p.answer, ...decoys].sort(() => Math.random() - 0.5);
    setLaneChoices(three);
    portalXRef.current = 0.92;
    setLockedBoost(false);
    setBulletTime(false);
    setHackOpen(false);
  }, []);

  useEffect(() => {
    const p = generateProblem({ tier });
    setProblem(p);
    setupPortals(p);
  }, [tier, setupPortals]);

  const handleChooseLane = useCallback(
    (laneIdx: number) => {
      setRunnerLane(laneIdx);
      const chosenVal = laneChoices[laneIdx];
      if (chosenVal === problem.answer) {
        sound.playVictoryFanfare();
        setLockedBoost(true);
        setBulletTime(false);
        setCombo((c) => c + 1);
        const msg = t.correctBanners[Math.floor(Math.random() * t.correctBanners.length)];
        setBanner(msg);
        onSuccess(problem.op, problem.a, problem.b, hackOpen);

        if (!calmMode && typeof window !== 'undefined') {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.55 },
          });
        }

        setTimeout(() => {
          const nextP = generateProblem({ tier });
          setProblem(nextP);
          setupPortals(nextP);
          setBanner(null);
        }, 900);
      } else {
        // Gentle shield bounce + open Hack Visor!
        sound.playShieldDeflect();
        if (!hackOpen) {
          setHackOpen(true);
          onHackUsed();
        }
      }
    },
    [laneChoices, problem, hackOpen, calmMode, tier, t.correctBanners, onSuccess, onHackUsed, setupPortals]
  );

  // Keyboard support (Up/Down or W/S + Space/Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setRunnerLane((l) => Math.max(0, l - 1));
        sound.playClick();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setRunnerLane((l) => Math.min(2, l + 1));
        sound.playClick();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleChooseLane(runnerLane);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runnerLane, handleChooseLane]);

  // 60fps Synthwave Highway Canvas Loop
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Advance portal X until Bullet-Time threshold (x = 0.36)
      if (lockedBoost) {
        portalXRef.current -= 0.035;
      } else if (portalXRef.current > 0.38) {
        portalXRef.current -= calmMode ? 0.0022 : 0.0035;
        if (portalXRef.current <= 0.42 && !bulletTime) {
          setBulletTime(true);
        }
      }

      const speed = lockedBoost ? 14 : bulletTime ? 1.5 : calmMode ? 4 : 7;
      scrollOffsetRef.current = (scrollOffsetRef.current + speed) % 48;

      // Background Sky Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#090d24');
      bgGrad.addColorStop(1, '#1a103c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Scrolling Vertical Grid Lines
      ctx.strokeStyle = bulletTime ? 'rgba(0, 245, 212, 0.25)' : 'rgba(241, 91, 181, 0.22)';
      ctx.lineWidth = 2;
      for (let gx = w - scrollOffsetRef.current; gx > 0; gx -= 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }

      // 3 Horizontal Cyber Lanes
      const laneH = h / 3;
      for (let i = 0; i < 3; i++) {
        const yTop = i * laneH;
        const isCurrent = i === runnerLane;
        ctx.fillStyle = isCurrent
          ? 'rgba(0, 187, 249, 0.16)'
          : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, yTop + 4, w, laneH - 8);

        ctx.strokeStyle = isCurrent ? '#00f5d4' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isCurrent ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yTop + laneH - 4);
        ctx.lineTo(w, yTop + laneH - 4);
        ctx.stroke();
      }

      // Draw Runner Cube / Sonic Mecha at x = 18%
      const runnerX = w * 0.18;
      const runnerY = runnerLane * laneH + laneH / 2;

      // Neon Speed Trail
      const trailGrad = ctx.createLinearGradient(runnerX - 90, runnerY, runnerX, runnerY);
      trailGrad.addColorStop(0, 'rgba(0, 245, 212, 0)');
      trailGrad.addColorStop(1, lockedBoost ? '#ffda35' : '#00f5d4');
      ctx.fillStyle = trailGrad;
      ctx.fillRect(runnerX - 90, runnerY - 14, 90, 28);

      // Geometry Dash / Sonic Cube Body
      ctx.save();
      ctx.translate(runnerX, runnerY);
      ctx.fillStyle = lockedBoost ? '#ffda35' : '#00bbf9';
      ctx.strokeStyle = '#042240';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-24, -24, 48, 48, 10);
      ctx.fill();
      ctx.stroke();

      // Visor Eyes
      ctx.fillStyle = '#042240';
      ctx.fillRect(-10, -10, 26, 12);
      ctx.fillStyle = '#fee440';
      ctx.fillRect(-6, -7, 8, 6);
      ctx.fillRect(6, -7, 8, 6);
      ctx.restore();

      // Draw 3 Approaching Energy Portals
      const pX = Math.max(w * 0.34, portalXRef.current * w);
      laneChoices.forEach((val, idx) => {
        const pY = idx * laneH + laneH / 2;
        const isSelected = idx === runnerLane;

        ctx.save();
        ctx.translate(pX, pY);
        ctx.fillStyle = isSelected ? '#ffda35' : '#1e293b';
        ctx.strokeStyle = isSelected ? '#ffffff' : '#00bbf9';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-44, -26, 88, 52, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#042240' : '#ffffff';
        ctx.font = '900 24px "Rubik", "Lilita One", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), 0, 1);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [runnerLane, laneChoices, lockedBoost, bulletTime, calmMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickedLane = Math.min(2, Math.max(0, Math.floor((clickY / rect.height) * 3)));
    handleChooseLane(clickedLane);
  };

  return (
    <div className="mode-screen dash-theme">
      {/* Top Bar */}
      <div className="mode-topbar">
        <button type="button" className="slab back-btn" onClick={onBack}>
          <ArrowLeft size={20} className="gi-back" />
          <span>{t.backToLobby}</span>
        </button>

        <div className="mode-title-pill neon-pill">
          <span>⚡ {t.worlds.dash.name}</span>
        </div>

        <button
          type="button"
          className={`slab hack-trigger-btn ${hackOpen ? 'active' : 'primary'}`}
          onClick={() => {
            if (!hackOpen) onHackUsed();
            setHackOpen(true);
          }}
        >
          <Zap size={20} />
          <span>{t.hackButton}</span>
        </button>
      </div>

      {/* Target Equation HUD Banner above the Track */}
      <div className="dash-hud-card">
        <div className="dash-combo-pill">
          <Gauge size={20} />
          <span>
            {isHe ? `קומבו מהירות: ×${combo}` : `SPEED COMBO: ×${combo}`}
          </span>
        </div>

        <div className="dash-equation-box" dir="ltr">
          <span className="dash-eq-text">{problem.displayEquation} = ?</span>
        </div>

        <div className={`bullet-time-badge ${bulletTime ? 'active' : ''}`}>
          {bulletTime
            ? isHe
              ? '⏱️ זמן קליע פעיל! השערים ממתינים לבחירה שלך בלי לחץ!'
              : '⏱️ BULLET-TIME ACTIVE! Portals wait for your lock!'
            : isHe
            ? '⚡ בחר נתיב או לחץ על השער המתאים!'
            : '⚡ Tap any lane or portal button below!'}
        </div>
      </div>

      {/* 60fps Synthwave 3-Lane Runner Canvas */}
      <div className="dash-canvas-container">
        <canvas
          ref={canvasRef}
          width={860}
          height={270}
          className="dash-canvas"
          onClick={handleCanvasClick}
        />
      </div>

      {banner && <div className="victory-toast-banner">{banner}</div>}

      {/* 3 Big Tactile Portal Lock Buttons */}
      <div className="control-deck-card">
        <div className="direct-lock-section">
          <span className="direct-lock-label">
            {isHe
              ? '⚡ פרוץ דרך שער האנרגיה עם התוצאה הנכונה:'
              : '⚡ Smash Through the Matching Portal Gate:'}
          </span>
          <div className="direct-choices-grid three-cols" dir="ltr">
            {laneChoices.map((val, idx) => (
              <button
                key={`${val}-${idx}`}
                type="button"
                className={`slab choice-slab-btn portal-choice-btn ${
                  runnerLane === idx ? 'primary' : ''
                }`}
                onClick={() => handleChooseLane(idx)}
              >
                <span>LANE {idx + 1}:</span> <strong>{val}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {hackOpen && (
        <HackVisorPanel
          hack={problem.hack}
          lang={lang}
          a={problem.a}
          b={problem.b}
          answer={problem.answer}
        />
      )}
    </div>
  );
};
