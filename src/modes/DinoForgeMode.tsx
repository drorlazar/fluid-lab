import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Zap, ShieldAlert, Sparkles, RotateCcw, ArrowLeft, Flame } from 'lucide-react';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { UI_STRINGS } from '../i18n/content';
import { HeroAvatar } from '../components/HeroAvatar';
import { HackVisorPanel } from '../components/HackVisorPanel';
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

const DINO_BOSSES = [
  { nameHe: 'מכה-רקס 9000', nameEn: 'MECHA-REX 9000', emoji: '🦖', color: '#2ecc71' },
  { nameHe: 'טריצרה-טנק', nameEn: 'TRICERA-TANK', emoji: '🦕', color: '#f59e0b' },
  { nameHe: 'רפטור-לייזר X', nameEn: 'RAPTOR-LASER X', emoji: '🐉', color: '#ec4899' },
];

export const DinoForgeMode: React.FC<DinoForgeModeProps> = ({
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
    generateProblem({ tier, forcedOp: '+' })
  );
  const [absorbedOrbs, setAbsorbedOrbs] = useState<number[]>([]);
  const [hackOpen, setHackOpen] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [bossIndex, setBossIndex] = useState(0);
  const [bossHp, setBossHp] = useState(3);
  const [banner, setBanner] = useState<string | null>(null);
  const [deflectMsg, setDeflectMsg] = useState<string | null>(null);
  const [laserFiring, setLaserFiring] = useState(false);

  const currentCharge = absorbedOrbs.reduce((sum, val) => sum + val, 0);
  const currentTens = Math.floor(currentCharge / 10) * 10;
  const currentOnes = currentCharge % 10;
  const boss = DINO_BOSSES[bossIndex % DINO_BOSSES.length];

  const nextWave = () => {
    setProblem(generateProblem({ tier, forcedOp: '+' }));
    setAbsorbedOrbs([]);
    setHackOpen(false);
    setSplitMode(false);
    setBanner(null);
    setDeflectMsg(null);
    setLaserFiring(false);
  };

  useEffect(() => {
    nextWave();
  }, [tier]);

  const handleAbsorbOrb = (val: number) => {
    sound.playOrbPickup(absorbedOrbs.length);
    setDeflectMsg(null);
    setAbsorbedOrbs((prev) => [...prev, val]);
  };

  const handleUndoOrb = (index: number) => {
    sound.playClick();
    setAbsorbedOrbs((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerVictory = () => {
    setLaserFiring(true);
    sound.playLaserSlice();
    const msg = t.correctBanners[Math.floor(Math.random() * t.correctBanners.length)];
    setBanner(msg);
    setDeflectMsg(null);
    onSuccess('+', problem.a, problem.b, hackOpen || splitMode);

    if (!calmMode && typeof window !== 'undefined') {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.6 },
      });
    }

    setTimeout(() => {
      if (bossHp <= 1) {
        setBossIndex((prev) => prev + 1);
        setBossHp(3);
      } else {
        setBossHp((prev) => prev - 1);
      }
      nextWave();
    }, 1150);
  };

  const handleFireReactor = () => {
    if (currentCharge === problem.answer) {
      triggerVictory();
    } else {
      sound.playShieldDeflect();
      setDeflectMsg(
        isHe
          ? `הכור טעון על ${currentCharge}, אבל שריון הדינו דורש ${problem.displayEquation}! נסה לשאוב עוד כדורים או הפעל את ההאק החכם!`
          : `Reactor is at ${currentCharge}, but Dino Armor requires ${problem.displayEquation}! Absorb more orbs or activate Smart Hack!`
      );
      setHackOpen(true);
    }
  };

  const handleDirectChoice = (choice: number) => {
    if (choice === problem.answer) {
      setAbsorbedOrbs([choice]);
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

  const handleToggleSplit = () => {
    sound.playHackActivate();
    setSplitMode((prev) => !prev);
  };

  const handleActivateHack = () => {
    if (!hackOpen) {
      onHackUsed();
    }
    setHackOpen(true);
  };

  const tensA = Math.floor(problem.a / 10) * 10;
  const onesA = problem.a % 10;
  const tensB = Math.floor(problem.b / 10) * 10;
  const onesB = problem.b % 10;

  return (
    <div className="mode-screen dino-theme">
      {/* Top Mode Bar */}
      <div className="mode-topbar">
        <button type="button" className="slab back-btn" onClick={onBack}>
          <ArrowLeft size={20} className="gi-back" />
          <span>{t.backToLobby}</span>
        </button>

        <div className="mode-title-pill">
          <span>🦖 {t.worlds.dino.name}</span>
        </div>

        <button
          type="button"
          className={`slab hack-trigger-btn ${hackOpen ? 'active' : 'primary'}`}
          onClick={handleActivateHack}
        >
          <Zap size={20} />
          <span>{t.hackButton}</span>
        </button>
      </div>

      {/* Battle Arena Stage */}
      <div className="battle-arena dino-arena">
        {/* Hero Side */}
        <div className="fighter-pod hero-pod">
          <div className="fighter-avatar-wrap">
            <HeroAvatar
              heroId={heroId}
              size={104}
              action={laserFiring ? 'attack' : absorbedOrbs.length > 0 ? 'charge' : 'idle'}
            />
          </div>
          <div className="reactor-box">
            <div className="reactor-label">
              {isHe ? 'כור היתוך (לחץ על כדור להוצאה):' : 'Fusion Reactor (Tap orb to eject):'}
            </div>
            <div className="reactor-total" dir="ltr">
              <span className="charge-val">{currentCharge}</span>
              {currentCharge > 10 && (
                <span className="charge-split-tag">
                  ({currentTens} + {currentOnes})
                </span>
              )}
            </div>
            <div className="absorbed-pills" dir="ltr">
              {absorbedOrbs.length === 0 ? (
                <span className="empty-reactor-hint">
                  {isHe ? 'שאב כדורי אנרגיה למטה! 👇' : 'Inhale energy orbs below! 👇'}
                </span>
              ) : (
                absorbedOrbs.map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`orb-chip ${val >= 10 ? 'tens-chip' : 'ones-chip'}`}
                    onClick={() => handleUndoOrb(idx)}
                    title={isHe ? 'לחץ להוצאה' : 'Click to remove'}
                  >
                    +{val} ✖
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Laser Beam & Target Equation */}
        <div className="arena-center-zone">
          {laserFiring && <div className="mega-laser-beam" />}
          <div className="target-shield-card">
            <div className="shield-card-label">
              {isHe ? 'תדר שריון הדינו לפיצוח:' : 'Dino Armor Shield Frequency:'}
            </div>
            <div className="shield-equation" dir="ltr">
              {!splitMode ? (
                <span>
                  {problem.a} <span className="op-plus">+</span> {problem.b} = ?
                </span>
              ) : (
                <div className="split-equation-view">
                  <div className="split-row gold">
                    <span>Tens:</span> {tensA} + {tensB} = <strong>{tensA + tensB}</strong>
                  </div>
                  <div className="split-row cyan">
                    <span>Ones:</span> {onesA} + {onesB} = <strong>{onesA + onesB}</strong>
                  </div>
                </div>
              )}
            </div>

            {problem.a >= 10 && (
              <button
                type="button"
                className="slab split-laser-btn"
                onClick={handleToggleSplit}
              >
                <Sparkles size={18} />
                <span>
                  {splitMode
                    ? isHe
                      ? 'הצג תרגיל רגיל'
                      : 'Show Normal View'
                    : isHe
                    ? '⚡ פצל לעשרות ואחדות!'
                    : '⚡ Split into Tens & Ones!'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Boss Side */}
        <div className={`fighter-pod boss-pod ${laserFiring ? 'boss-hit' : ''}`}>
          <div className="boss-header">
            <span className="boss-name">{isHe ? boss.nameHe : boss.nameEn}</span>
            <div className="boss-hp-hearts" dir="ltr">
              {[1, 2, 3].map((h) => (
                <span key={h} className={`hp-segment ${h <= bossHp ? 'full' : 'empty'}`} />
              ))}
            </div>
          </div>
          <div className="boss-emoji-stage" style={{ borderColor: boss.color }}>
            <span className="giant-boss-emoji">{boss.emoji}</span>
            <span className="boss-armor-badge" dir="ltr">
              🛡️ {problem.displayEquation}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && <div className="victory-toast-banner">{banner}</div>}
      {deflectMsg && (
        <div className="deflect-alert-banner">
          <ShieldAlert size={22} />
          <span>{deflectMsg}</span>
        </div>
      )}

      {/* Interactive Energy Orb Absorption Tray */}
      <div className="control-deck-card">
        <div className="orb-forge-header">
          <h4>
            {isHe
              ? '🌀 שלב 1: שאב מטילי עשרות וניצוצות אחדות לתוך כור ההיתוך (או ירה מיד למטה):'
              : '🌀 Step 1: Inhale Tens Bars & Ones Sparks into your Fusion Reactor:'}
          </h4>
          <div className="orb-forge-actions">
            <button
              type="button"
              className="slab reset-btn"
              onClick={() => {
                sound.playClick();
                setAbsorbedOrbs([]);
              }}
              disabled={absorbedOrbs.length === 0}
            >
              <RotateCcw size={18} />
              <span>{t.resetOrbs}</span>
            </button>
            <button
              type="button"
              className="slab primary fire-mega-btn"
              onClick={handleFireReactor}
            >
              <Flame size={22} />
              <span>
                {t.fireBlast} ({currentCharge})
              </span>
            </button>
          </div>
        </div>

        <div className="orb-pool-grid" dir="ltr">
          {problem.orbPool.map((val, idx) => (
            <button
              key={`${val}-${idx}`}
              type="button"
              className={`energy-orb-btn ${val >= 10 ? 'orb-tens' : 'orb-ones'}`}
              onClick={() => handleAbsorbOrb(val)}
            >
              <span className="orb-plus">+{val}</span>
              <span className="orb-type-tag">{val >= 10 ? '10s CORE' : '1s SPARK'}</span>
            </button>
          ))}
        </div>

        {/* Fast Direct Frequency Lock Buttons */}
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
                🎯 {choice}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Hack Visor Drawer */}
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
