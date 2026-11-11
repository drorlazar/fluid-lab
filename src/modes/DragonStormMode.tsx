import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Zap, ShieldAlert, ArrowLeft, Scissors, RefreshCw } from 'lucide-react';
import { DifficultyTier, Language, MathProblem, generateProblem } from '../math/mathEngine';
import { UI_STRINGS } from '../i18n/content';
import { HeroAvatar } from '../components/HeroAvatar';
import { HackVisorPanel } from '../components/HackVisorPanel';
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

export const DragonStormMode: React.FC<DragonStormModeProps> = ({
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

  const [focusTable, setFocusTable] = useState<number | null>(null);
  const [problem, setProblem] = useState<MathProblem>(() =>
    generateProblem({ tier, forcedOp: '×', focusTable: null })
  );
  const [flipped, setFlipped] = useState(false);
  const [sliceRow, setSliceRow] = useState<number | null>(null);
  const [hackOpen, setHackOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [deflectMsg, setDeflectMsg] = useState<string | null>(null);
  const [dragonBreathing, setDragonBreathing] = useState(false);

  const rows = flipped ? problem.b : problem.a;
  const cols = flipped ? problem.a : problem.b;

  const nextSwarm = (customTable: number | null = focusTable) => {
    const p = generateProblem({ tier, forcedOp: '×', focusTable: customTable });
    setProblem(p);
    setFlipped(false);
    setSliceRow(null);
    setHackOpen(false);
    setBanner(null);
    setDeflectMsg(null);
    setDragonBreathing(false);
  };

  useEffect(() => {
    nextSwarm(focusTable);
  }, [tier, focusTable]);

  const handleSmartSlice = () => {
    sound.playLaserSlice();
    if (sliceRow !== null) {
      setSliceRow(null);
      return;
    }
    // Smart pedagogical split: if rows > 5, slice at 5; else slice in half
    const idealSplit = rows > 5 ? 5 : Math.max(1, Math.floor(rows / 2));
    setSliceRow(idealSplit);
  };

  const handleFlipSwarm = () => {
    sound.playClick();
    setFlipped((prev) => !prev);
    setSliceRow(null);
  };

  const handleSelectChoice = (choice: number) => {
    if (choice === problem.answer) {
      setDragonBreathing(true);
      sound.playLaserSlice();
      const msg = t.correctBanners[Math.floor(Math.random() * t.correctBanners.length)];
      setBanner(msg);
      setDeflectMsg(null);
      onSuccess('×', problem.a, problem.b, hackOpen || sliceRow !== null);

      if (!calmMode && typeof window !== 'undefined') {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      setTimeout(() => {
        nextSwarm(focusTable);
      }, 1150);
    } else {
      sound.playShieldDeflect();
      setDeflectMsg(t.shieldDeflectMsg);
      if (!hackOpen) {
        setHackOpen(true);
        onHackUsed();
      }
      if (sliceRow === null && rows >= 4) {
        setSliceRow(rows > 5 ? 5 : Math.floor(rows / 2));
      }
    }
  };

  const topRows = sliceRow !== null ? sliceRow : rows;
  const bottomRows = sliceRow !== null ? rows - sliceRow : 0;
  const topProduct = topRows * cols;
  const bottomProduct = bottomRows * cols;

  return (
    <div className="mode-screen dragon-theme">
      {/* Top Bar */}
      <div className="mode-topbar">
        <button type="button" className="slab back-btn" onClick={onBack}>
          <ArrowLeft size={20} className="gi-back" />
          <span>{t.backToLobby}</span>
        </button>

        <div className="mode-title-pill magenta-pill">
          <span>🐉 {t.worlds.dragon.name}</span>
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

      {/* Multiplication Table Focus Filter Bar */}
      <div className="table-filter-bar">
        <span className="filter-label">
          {isHe ? '🎯 מיקוד כפולה:' : '🎯 Focus Table:'}
        </span>
        <div className="table-pills-row" dir="ltr">
          <button
            type="button"
            className={`slab mini-table-btn ${focusTable === null ? 'primary' : ''}`}
            onClick={() => setFocusTable(null)}
          >
            ALL
          </button>
          {[2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className={`slab mini-table-btn ${focusTable === num ? 'primary' : ''}`}
              onClick={() => setFocusTable(num)}
            >
              ×{num}
            </button>
          ))}
        </div>
      </div>

      {/* Dragon vs Living Drone Swarm Stage */}
      <div className="battle-arena dragon-arena">
        <div className="fighter-pod hero-pod">
          <HeroAvatar
            heroId={heroId}
            size={104}
            action={dragonBreathing ? 'attack' : 'idle'}
          />
          <div className="dragon-tools-stack">
            <button type="button" className="slab dragon-tool-btn" onClick={handleSmartSlice}>
              <Scissors size={18} />
              <span>
                {sliceRow !== null
                  ? isHe
                    ? 'בטל חיתוך נחיל'
                    : 'Merge Swarm'
                  : isHe
                  ? '⚔️ חתוך נחיל ל-2 חלקים קלים!'
                  : '⚔️ Slice Swarm into 2 Easy Parts!'}
              </span>
            </button>
            <button type="button" className="slab dragon-tool-btn" onClick={handleFlipSwarm}>
              <RefreshCw size={18} />
              <span>
                {isHe
                  ? `🔄 סובב מראה (${rows}×${cols} ➔ ${cols}×${rows})`
                  : `🔄 Mirror Flip (${rows}×${cols} ➔ ${cols}×${rows})`}
              </span>
            </button>
          </div>
        </div>

        {/* Center Living Drone Matrix */}
        <div className="drone-matrix-card">
          {dragonBreathing && <div className="mega-laser-beam fire-beam" />}
          <div className="drone-matrix-header">
            <div className="shield-equation" dir="ltr">
              {rows} <span className="op-mult">×</span> {cols} = ?
            </div>
            {sliceRow !== null && (
              <div className="slice-Readout-pill" dir="ltr">
                <span className="gold-txt">
                  ({topRows}×{cols} = {topProduct})
                </span>{' '}
                +{' '}
                <span className="cyan-txt">
                  ({bottomRows}×{cols} = {bottomProduct})
                </span>
              </div>
            )}
          </div>

          <p className="drone-matrix-hint">
            {isHe
              ? '💡 לחץ בין שתי שורות של רחפנים כדי לחתוך את הנחיל בטופר לייזר!'
              : '💡 Click between any two drone rows to slice the swarm with your laser claw!'}
          </p>

          <div className="interactive-drone-grid" dir="ltr">
            {Array.from({ length: rows }).map((_, rIdx) => {
              const isBottomPart = sliceRow !== null && rIdx >= sliceRow;
              const isSliceBoundary = sliceRow !== null && rIdx === sliceRow;
              return (
                <React.Fragment key={rIdx}>
                  {isSliceBoundary && (
                    <div className="laser-slice-divider">
                      <span>⚡ LASER CLAW SPLIT ⚡</span>
                    </div>
                  )}
                  <div
                    className={`drone-formation-row ${
                      sliceRow === null
                        ? 'row-normal'
                        : isBottomPart
                        ? 'row-sliced-cyan'
                        : 'row-sliced-gold'
                    }`}
                    onClick={() => {
                      if (rIdx > 0) {
                        sound.playLaserSlice();
                        setSliceRow(sliceRow === rIdx ? null : rIdx);
                      }
                    }}
                    title={
                      rIdx > 0
                        ? isHe
                          ? `לחץ לחיתוך כאן (${rIdx} שורות למעלה, ${rows - rIdx} למטה)`
                          : `Click to slice here (${rIdx} rows top, ${rows - rIdx} bottom)`
                        : undefined
                    }
                  >
                    <span className="row-index-badge">{rIdx + 1}</span>
                    <div className="drone-cells-wrap">
                      {Array.from({ length: cols }).map((__, cIdx) => (
                        <span
                          key={cIdx}
                          className={`cyber-drone-unit ${
                            cIdx === 4 ? 'fifth-marker' : ''
                          }`}
                        >
                          👾
                        </span>
                      ))}
                    </div>
                    <span className="row-running-total">{(rIdx + 1) * cols}</span>
                  </div>
                </React.Fragment>
              );
            })}
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

      {/* Fireball Barrage Target Selection */}
      <div className="control-deck-card">
        <div className="direct-lock-section">
          <span className="direct-lock-label">
            {isHe
              ? `🔥 שגר מטח כדורי אש בעוצמה המדויקת (${rows} × ${cols}):`
              : `🔥 Fire Dragon Barrage with Exact Swarm Power (${rows} × ${cols}):`}
          </span>
          <div className="direct-choices-grid" dir="ltr">
            {problem.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="slab choice-slab-btn fire-choice"
                onClick={() => handleSelectChoice(choice)}
              >
                🔥 {choice}
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
