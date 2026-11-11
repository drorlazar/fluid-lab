import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Zap, ShieldAlert, ArrowLeft, Rocket, RotateCcw, Crosshair } from 'lucide-react';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { UI_STRINGS } from '../i18n/content';
import { HeroAvatar } from '../components/HeroAvatar';
import { HackVisorPanel } from '../components/HackVisorPanel';
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

const SPACE_BOSSES = [
  { nameHe: 'משחתת החלל זורג', nameEn: 'ZORG DREADNOUGHT', emoji: '🛸', color: '#00bbf9' },
  { nameHe: 'תחנת הקרב נובה-X', nameEn: 'NOVA-X BATTLESTATION', emoji: '🛰️', color: '#f15bb5' },
  { nameHe: 'לוויתן הכוכבים המכני', nameEn: 'MECHA STAR-LEVIATHAN', emoji: '👾', color: '#9b5de5' },
];

export const SpaceSlicerMode: React.FC<SpaceSlicerModeProps> = ({
  lang,
  tier,
  heroId,
  calmMode,
  onBack,
  onSuccess,
  onHackUsed,
}) => {
  const t = UI_STRINGS[lang];
  const isHe = lang === 'he';

  const [problem, setProblem] = useState<MathProblem>(() =>
    generateProblem({ tier, forcedOp: '-' })
  );
  const [warpJumps, setWarpJumps] = useState<number[]>([]);
  const [shiftActive, setShiftActive] = useState(false);
  const [hackOpen, setHackOpen] = useState(false);
  const [bossIdx, setBossIdx] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [deflectMsg, setDeflectMsg] = useState<string | null>(null);
  const [beamFiring, setBeamFiring] = useState(false);

  const totalJumped = warpJumps.reduce((s, v) => s + v, 0);
  const currentShipPos = problem.b + totalJumped;
  const boss = SPACE_BOSSES[bossIdx % SPACE_BOSSES.length];

  // Calculate Equal-Shift amount to round `b` up to the next multiple of 10
  const onesB = problem.b % 10;
  const shiftDelta = onesB === 0 ? 0 : 10 - onesB;
  const shiftedA = problem.a + shiftDelta;
  const shiftedB = problem.b + shiftDelta;

  const nextWave = () => {
    setProblem(generateProblem({ tier, forcedOp: '-' }));
    setWarpJumps([]);
    setShiftActive(false);
    setHackOpen(false);
    setBanner(null);
    setDeflectMsg(null);
    setBeamFiring(false);
  };

  useEffect(() => {
    nextWave();
  }, [tier]);

  const triggerVictory = () => {
    setBeamFiring(true);
    sound.playLaserSlice();
    const msg = t.correctBanners[Math.floor(Math.random() * t.correctBanners.length)];
    setBanner(msg);
    setDeflectMsg(null);
    onSuccess('-', problem.a, problem.b, hackOpen || shiftActive);

    if (!calmMode && typeof window !== 'undefined') {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.6 },
      });
    }

    setTimeout(() => {
      setBossIdx((prev) => prev + 1);
      nextWave();
    }, 1150);
  };

  const handleAddJump = (stepVal: number) => {
    sound.playOrbPickup(warpJumps.length);
    setDeflectMsg(null);
    const nextJumps = [...warpJumps, stepVal];
    setWarpJumps(nextJumps);
    const nextTotal = nextJumps.reduce((s, v) => s + v, 0);
    if (problem.b + nextTotal === problem.a) {
      // Exact bridge jump reached!
      triggerVictory();
    }
  };

  const handleDirectChoice = (choice: number) => {
    if (choice === problem.answer) {
      setWarpJumps([choice]);
      triggerVictory();
    } else {
      sound.playShieldDeflect();
      setDeflectMsg(t.shieldDeflectMsg);
      if (!hackOpen) {
        setHackOpen(true);
        onHackUsed();
      }
    }
  };

  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((totalJumped / Math.max(1, problem.answer)) * 100))
  );

  return (
    <div className="mode-screen space-theme">
      {/* Top Bar */}
      <div className="mode-topbar">
        <button type="button" className="slab back-btn" onClick={onBack}>
          <ArrowLeft size={20} className="gi-back" />
          <span>{t.backToLobby}</span>
        </button>

        <div className="mode-title-pill cyan-pill">
          <span>🚀 {t.worlds.space.name}</span>
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

      {/* Space Arena */}
      <div className="battle-arena space-arena">
        <div className="fighter-pod hero-pod">
          <HeroAvatar heroId={heroId} size={96} action={beamFiring ? 'attack' : 'idle'} />
          <div className="reactor-box">
            <div className="reactor-label">
              {isHe ? 'מרחק קפיצת על-חלל שהצטבר:' : 'Total Warp Distance Jumped:'}
            </div>
            <div className="reactor-total" dir="ltr">
              <span className="charge-val cyan-text">{totalJumped}</span>
            </div>
            <div className="absorbed-pills" dir="ltr">
              {warpJumps.map((j, i) => (
                <span key={i} className="orb-chip tens-chip">
                  +{j}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Center Target & Equal-Shift Shield */}
        <div className="arena-center-zone">
          {beamFiring && <div className="mega-laser-beam cyan-beam" />}
          <div className="target-shield-card space-card">
            <div className="shield-card-label">
              {isHe ? 'מגן משחתת החלל לפיצוח:' : 'Mothership Shield Frequency:'}
            </div>

            <div className="shield-equation" dir="ltr">
              {!shiftActive ? (
                <span>
                  {problem.a} <span className="op-minus">−</span> {problem.b} = ?
                </span>
              ) : (
                <div className="shifted-eq-highlight">
                  <span className="shifted-tag">+{shiftDelta} SHIFT!</span>
                  <span>
                    {shiftedA} <span className="op-minus">−</span> {shiftedB} = ?
                  </span>
                </div>
              )}
            </div>

            {shiftDelta > 0 && problem.b > 10 && (
              <button
                type="button"
                className="slab shift-beam-btn"
                onClick={() => {
                  sound.playHackActivate();
                  setShiftActive((prev) => !prev);
                }}
              >
                <Crosshair size={18} />
                <span>
                  {shiftActive
                    ? isHe
                      ? 'הצג תרגיל מקורי'
                      : 'Show Original'
                    : isHe
                    ? `🛡️ קרן הזזה שווה (+${shiftDelta} לשניהם = בלי פריטה!)`
                    : `🛡️ Equal Shift (+${shiftDelta} to both = No Borrow!)`}
                </span>
              </button>
            )}

            {/* Visual Warp Number Bridge from b up to a */}
            <div className="warp-bridge-track" dir="ltr">
              <div className="warp-endpoint start">
                <span className="ep-tag">START</span>
                <strong>{problem.b}</strong>
              </div>
              <div className="warp-bar-outer">
                <div className="warp-bar-fill" style={{ width: `${progressPct}%` }} />
                <span className="warp-ship-marker" style={{ left: `${progressPct}%` }}>
                  🚀 {currentShipPos}
                </span>
              </div>
              <div className="warp-endpoint end">
                <span className="ep-tag">TARGET</span>
                <strong>{problem.a}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Boss Side */}
        <div className={`fighter-pod boss-pod ${beamFiring ? 'boss-hit' : ''}`}>
          <div className="boss-header">
            <span className="boss-name">{isHe ? boss.nameHe : boss.nameEn}</span>
          </div>
          <div className="boss-emoji-stage" style={{ borderColor: boss.color }}>
            <span className="giant-boss-emoji">{boss.emoji}</span>
            <span className="boss-armor-badge" dir="ltr">
              🛡️ {problem.displayEquation}
            </span>
          </div>
        </div>
      </div>

      {banner && <div className="victory-toast-banner">{banner}</div>}
      {deflectMsg && (
        <div className="deflect-alert-banner">
          <ShieldAlert size={22} />
          <span>{deflectMsg}</span>
        </div>
      )}

      {/* Warp Thruster Jump Deck & Direct Slicer */}
      <div className="control-deck-card">
        <div className="orb-forge-header">
          <h4>
            {isHe
              ? `🚀 גשר הקפיצות: קפוץ מ-${problem.b} עד ${problem.a} (הסכום שתצבור ינצח אוטומטית!):`
              : `🚀 Warp Bridge: Jump from ${problem.b} up to ${problem.a} (Landing on ${problem.a} fires automatically!):`}
          </h4>
          <button
            type="button"
            className="slab reset-btn"
            onClick={() => {
              sound.playClick();
              setWarpJumps([]);
            }}
            disabled={warpJumps.length === 0}
          >
            <RotateCcw size={18} />
            <span>{isHe ? 'אפס קפיצות' : 'Reset Jumps'}</span>
          </button>
        </div>

        <div className="orb-pool-grid" dir="ltr">
          {[20, 10, 5, 3, 2, 1].map((stepVal) => (
            <button
              key={stepVal}
              type="button"
              className={`energy-orb-btn ${stepVal >= 10 ? 'orb-tens' : 'orb-ones'}`}
              onClick={() => handleAddJump(stepVal)}
            >
              <Rocket size={16} />
              <span className="orb-plus">+{stepVal}</span>
              <span className="orb-type-tag">WARP HOP</span>
            </button>
          ))}
        </div>

        <div className="direct-lock-section">
          <span className="direct-lock-label">{t.directAnswerLabel}</span>
          <div className="direct-choices-grid" dir="ltr">
            {problem.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="slab choice-slab-btn"
                onClick={() => handleDirectChoice(choice)}
              >
                ⚡ {choice}
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
