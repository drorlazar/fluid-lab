import React, { useState } from 'react';
import { Language } from '../math/mathEngine';
import { sound } from '../audio/soundEngine';

interface HackerCodexModalProps {
  lang: Language;
  multMastery: Record<string, number>;
  onClose: () => void;
}

const FINAL_BOSS_KEYS = new Set([
  '3-3',
  '3-6',
  '3-7',
  '6-6',
  '6-7',
  '7-7',
  '6-8',
  '7-8',
]);

export const HackerCodexModal: React.FC<HackerCodexModalProps> = ({
  lang,
  onClose,
}) => {
  const isHe = lang === 'he';

  // Toy 1: 10x10 3D Cube Matrix + Mirror Shield Laser
  const [mirrorLaserOn, setMirrorLaserOn] = useState(true);
  const [activeCube, setActiveCube] = useState<{ r: number; c: number }>({ r: 8, c: 7 });

  // Toy 2: Tactile Mechanical Rail Slider (Subtraction Equal Shift)
  const [subPair, setSubPair] = useState<{ a: number; b: number }>({ a: 73, b: 39 });
  const idealShift = (10 - (subPair.b % 10)) % 10;
  const [railShift, setRailShift] = useState<number>(1);

  // Toy 3: Interactive 10-Finger 9x Mecha-Hand
  const [foldedFinger, setFoldedFinger] = useState<number>(7);

  const selectSubPreset = (a: number, b: number) => {
    sound.playHackActivate();
    setSubPair({ a, b });
    setRailShift((10 - (b % 10)) % 10);
  };

  return (
    <div className="hack-lab-fullscreen" role="dialog" aria-modal="true">
      {/* Top Neon Title & Back Button */}
      <div className="hack-lab-topbar">
        <button type="button" className="brawl-back-corner static-pos" onClick={onClose}>
          ◀
        </button>

        <h1 className="hack-lab-main-title">
          {isHe ? 'VISUAL HACK LAB / מעבדת ההאקים' : 'VISUAL HACK LAB'}
        </h1>

        <button
          type="button"
          className={`brawl-skew-toggle ${mirrorLaserOn ? 'active' : ''}`}
          onClick={() => {
            sound.playLaserSlice();
            setMirrorLaserOn((v) => !v);
          }}
        >
          🪞 {isHe ? 'מגן מראה (7×3 = 3×7)' : 'MIRROR SHIELD (7×3 = 3×7)'}
        </button>
      </div>

      {/* Main 2-Column Toy Box Layout (Matching Frame 5 Right Half!) */}
      <div className="hack-lab-grid">
        {/* LEFT COLUMN: 3D 10x10 Cube Matrix with Red Mirror Laser & Final Boss Cubes */}
        <div className="hack-toy-panel matrix-toy-panel">
          <div className="matrix-stage-3d" dir="ltr">
            {mirrorLaserOn && <div className="red-mirror-laser-line" />}

            <div className="cubes-10x10-grid">
              {Array.from({ length: 10 }).map((_, rIdx) => {
                const r = rIdx + 1;
                return Array.from({ length: 10 }).map((__, cIdx) => {
                  const c = cIdx + 1;
                  const isDuplicate = mirrorLaserOn && c > r;
                  const normKey = `${Math.min(r, c)}-${Math.max(r, c)}`;
                  const isBoss = !isDuplicate && FINAL_BOSS_KEYS.has(normKey);
                  const isSelected = activeCube.r === r && activeCube.c === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      className={`holo-cube-3d ${
                        isDuplicate
                          ? 'cube-vaporized'
                          : isBoss
                          ? 'cube-final-boss'
                          : 'cube-cyan'
                      } ${isSelected ? 'cube-selected' : ''}`}
                      onClick={() => {
                        sound.playOrbPickup((r + c) % 5);
                        setActiveCube({ r, c });
                        if (r === 9 || c === 9) {
                          setFoldedFinger(r === 9 ? c : r);
                        }
                      }}
                    >
                      {!isDuplicate && (
                        <>
                          <span className="cube-top-face">{r * c}</span>
                          {isBoss && (r === c || (r === 8 && c === 7)) && (
                            <span className="boss-mini-tag">BOSS</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                });
              })}
            </div>
          </div>

          {/* Live Selected Cube Visual Breakdown Bar */}
          <div className="cube-inspector-strip" dir="ltr">
            <span className="inspector-eq">
              {activeCube.r} × {activeCube.c} = <strong>{activeCube.r * activeCube.c}</strong>
            </span>
            <span className="inspector-hack-pill">
              {(activeCube.r === 7 && activeCube.c === 8) ||
              (activeCube.r === 8 && activeCube.c === 7)
                ? '🔥 5, 6, 7, 8 ➔ 56 = 7 × 8'
                : activeCube.r === 9 || activeCube.c === 9
                ? `🖐️ FINGER #${activeCube.r === 9 ? activeCube.c : activeCube.r} ➔ ${
                    ((activeCube.r === 9 ? activeCube.c : activeCube.r) - 1) * 10
                  } + ${10 - (activeCube.r === 9 ? activeCube.c : activeCube.r)}`
                : `⚔️ (5 × ${activeCube.c}) + (${Math.abs(activeCube.r - 5)} × ${
                    activeCube.c
                  })`}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Tactile Mechanical Rail Slider + 10-Finger Hologram + Boss Codes */}
        <div className="hack-toys-right-stack">
          {/* TOY 2: TACTILE MECHANICAL RAIL SLIDER (73 - 39 -> +1 -> 74 - 40 = 34) */}
          <div className="hack-toy-panel slider-toy-panel">
            <div className="toy-preset-chips" dir="ltr">
              {[
                { a: 73, b: 39 },
                { a: 82, b: 48 },
                { a: 64, b: 27 },
                { a: 91, b: 59 },
              ].map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`preset-pill-btn ${
                    subPair.a === p.a && subPair.b === p.b ? 'active' : ''
                  }`}
                  onClick={() => selectSubPreset(p.a, p.b)}
                >
                  {p.a} - {p.b}
                </button>
              ))}
              <button
                type="button"
                className="preset-pill-btn gold-snap"
                onClick={() => {
                  sound.playHackActivate();
                  setRailShift(idealShift);
                }}
              >
                ⚡ SNAP +{idealShift}
              </button>
            </div>

            <div className="mechanical-rail-track" dir="ltr">
              <input
                type="range"
                min={0}
                max={5}
                value={railShift}
                onChange={(e) => {
                  sound.playClick();
                  setRailShift(Number(e.target.value));
                }}
                className="tactile-rail-input"
              />
            </div>

            <div className="rail-readout-plates" dir="ltr">
              <div className="rail-plate raw-plate">
                {subPair.a} - {subPair.b}
              </div>

              <div className="rail-shift-badge">+{railShift}</div>

              <div
                className={`rail-plate shifted-plate ${
                  (subPair.b + railShift) % 10 === 0 ? 'perfect-zero' : ''
                }`}
              >
                {subPair.a + railShift} - {subPair.b + railShift} ={' '}
                <strong>{subPair.a - subPair.b}</strong>
              </div>
            </div>
          </div>

          {/* TOY 3: INTERACTIVE 10-FINGER 9x HOLOGRAM + BOSS CODE PADS */}
          <div className="hack-toy-panel fingers-toy-panel">
            <div className="interactive-10-fingers" dir="ltr">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isFolded = num === foldedFinger;
                const isLeft = num < foldedFinger;
                return (
                  <button
                    key={num}
                    type="button"
                    className={`holo-finger-btn ${
                      isFolded ? 'folded' : isLeft ? 'gold-ten' : 'cyan-one'
                    }`}
                    onClick={() => {
                      sound.playOrbPickup(num % 5);
                      setFoldedFinger(num);
                    }}
                  >
                    <span className="f-idx">{num}</span>
                    <span className="f-val">
                      {isFolded ? `9×${num}` : isLeft ? '+10' : '+1'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="finger-live-total" dir="ltr">
              <span className="gold-part">{(foldedFinger - 1) * 10}</span>
              <span>+</span>
              <span className="cyan-part">{10 - foldedFinger}</span>
              <span>=</span>
              <span className="green-part">{9 * foldedFinger}</span>
            </div>

            {/* Neon Boss Code Badges (Just like Frame 5!) */}
            <div className="boss-code-badges-row" dir="ltr">
              <button
                type="button"
                className="neon-code-badge cyan-code"
                onClick={() => {
                  sound.playHackActivate();
                  setActiveCube({ r: 8, c: 7 });
                }}
              >
                5, 6, 7, 8 ➔ <strong>56 = 7 × 8</strong>
              </button>

              <button
                type="button"
                className="neon-code-badge gold-code"
                onClick={() => {
                  sound.playHackActivate();
                  setActiveCube({ r: 7, c: 4 });
                }}
              >
                4 × 7 ➔ 7 ➔ 14 ➔ <strong>28</strong>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
