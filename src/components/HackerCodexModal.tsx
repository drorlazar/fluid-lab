import React, { useState } from 'react';
import { X, Zap, Grid, BookOpen, Sliders, Printer, EyeOff, Eye, Sparkles } from 'lucide-react';
import { Language, Operation, generateMathHack } from '../math/mathEngine';
import { HackVisorPanel } from './HackVisorPanel';
import { sound } from '../audio/soundEngine';

interface HackerCodexModalProps {
  lang: Language;
  multMastery: Record<string, number>;
  onClose: () => void;
}

interface StrategyCardData {
  id: string;
  op: Operation;
  icon: string;
  titleHe: string;
  titleEn: string;
  whenHe: string;
  whenEn: string;
  beforeEq: string;
  afterEq: string;
  secretHe: string;
  secretEn: string;
  sampleA: number;
  sampleB: number;
}

export const STRATEGY_CARDS: StrategyCardData[] = [
  {
    id: 'add-make10',
    op: '+',
    icon: '🧲',
    titleHe: 'מגנט העשר (חברים ל-10)',
    titleEn: 'Magnet-10 Partners',
    whenHe: 'חיבור חד-ספרתי שעובר את 10',
    whenEn: 'Single-digit addition crossing 10',
    beforeEq: '8 + 5',
    afterEq: '10 + 3 = 13',
    secretHe: 'זכור את הזוגות שיוצרים 10: (9+1, 8+2, 7+3, 6+4, 5+5). ה-8 שואב 2 מתוך ה-5 והופך ל-10 עגול!',
    secretEn: 'Know your 10-partners: (9+1, 8+2, 7+3, 6+4, 5+5). 8 pulls 2 from 5 to lock into 10!',
    sampleA: 8,
    sampleB: 5,
  },
  {
    id: 'add-split',
    op: '+',
    icon: '⚡',
    titleHe: 'פיצול לייזר: עשרות ואז אחדות',
    titleEn: 'Tens-First Laser Split',
    whenHe: 'כל חיבור דו-ספרתי',
    whenEn: 'Any 2-digit addition',
    beforeEq: '47 + 35',
    afterEq: '70 + 12 = 82',
    secretHe: 'במקום לחבר בטור מהסוף ולהסתבך עם זכירה, חבר קודם עשרות (40+30=70), אז אחדות (7+5=12), ומזג: 82!',
    secretEn: 'Instead of right-to-left carrying in your head, fuse Tens first (40+30=70), then Ones (7+5=12) → 82!',
    sampleA: 47,
    sampleB: 35,
  },
  {
    id: 'add-friendly10',
    op: '+',
    icon: '🚀',
    titleHe: 'קפיצת טורבו לעשרת קרובה',
    titleEn: 'Friendly-10 Turbo Swap',
    whenHe: 'כשמספר מסתיים ב-8 או ב-9',
    whenEn: 'When a number ends in 8 or 9',
    beforeEq: '58 + 25',
    afterEq: '60 + 23 = 83',
    secretHe: '58 רחוק רק ב-2 מ-60! העבר 2 מתוך ה-25 אל ה-58, וקיבלת תרגיל קליל: 60 + 23 = 83!',
    secretEn: '58 is just 2 away from 60! Slide 2 from 25 over to 58 and get an effortless 60 + 23 = 83!',
    sampleA: 58,
    sampleB: 25,
  },
  {
    id: 'add-doubles',
    op: '+',
    icon: '👯',
    titleHe: 'שיבוט תאומים (+1)',
    titleEn: 'Twin Clone +1 (Near Doubles)',
    whenHe: 'שני מספרים עוקבים או קרובים',
    whenEn: 'Two neighbor numbers',
    beforeEq: '25 + 26',
    afterEq: '25 + 25 + 1 = 51',
    secretHe: 'קל לזכור תאומים (6+6=12, 7+7=14, 25+25=50). אז 25+26 זה פשוט פעמיים 25 ועוד 1!',
    secretEn: 'Doubles are easy (6+6=12, 7+7=14, 25+25=50). So 25+26 is just 50 + 1 = 51!',
    sampleA: 25,
    sampleB: 26,
  },
  {
    id: 'sub-equalshift',
    op: '-',
    icon: '🛡️',
    titleHe: 'הזזה שווה — אפס פריטה!',
    titleEn: 'Equal Shift Shield (Zero Borrowing!)',
    whenHe: 'חיסור מספר שמסתיים ב-7, 8 או 9',
    whenEn: 'Subtracting a number ending in 7, 8, or 9',
    beforeEq: '73 − 39',
    afterEq: '74 − 40 = 34',
    secretHe: 'הטריק הכי חזק במשחק! הוסף +1 לשני המספרים יחד. הפער נשאר זהה, וה-39 הופך ל-40 עגול בלי שום פריטה!',
    secretEn: 'Pro gamer secret! Add +1 to BOTH numbers. The gap stays identical and 39 becomes a clean 40!',
    sampleA: 73,
    sampleB: 39,
  },
  {
    id: 'sub-bridgejump',
    op: '-',
    icon: '🐸',
    titleHe: 'גשר הקפיצות (סופרים קדימה!)',
    titleEn: 'Ninja Bridge Jump (Count Up!)',
    whenHe: 'חיסור בין שני מספרים דו-ספרתיים',
    whenEn: 'Finding the gap between 2-digit numbers',
    beforeEq: '82 − 67',
    afterEq: '67 ➔ (+3) ➔ 70 ➔ (+12) ➔ 82 = 15',
    secretHe: 'אל תחסר אחורה! התחל ב-67, קפוץ +3 ל-70, ואז קפוץ +12 ל-82. חבר את הקפיצות: 3 + 12 = 15!',
    secretEn: 'Never count backward! Start at 67, hop +3 to 70, then +12 to 82. Add your hops: 3 + 12 = 15!',
    sampleA: 82,
    sampleB: 67,
  },
  {
    id: 'sub-twostep',
    op: '-',
    icon: '⚔️',
    titleHe: 'חיתוך לייזר בשני שלבים',
    titleEn: 'Two-Step Safe Slice',
    whenHe: 'חיסור דו-ספרתי רגיל',
    whenEn: 'General 2-digit subtraction',
    beforeEq: '64 − 22',
    afterEq: '64 − 20 = 44 ➔ 44 − 2 = 42',
    secretHe: 'חתוך קודם את העשרות (64 פחות 20 זה 44), ורק אז הורד את האחדות (44 פחות 2 זה 42)!',
    secretEn: 'Slice away the Tens first (64 - 20 = 44), then slice the Ones (44 - 2 = 42)!',
    sampleA: 64,
    sampleB: 22,
  },
  {
    id: 'mult-mirror',
    op: '×',
    icon: '🪞',
    titleHe: 'חוק המראה (חצי לוח במתנה!)',
    titleEn: 'The Mirror Flip Law',
    whenHe: 'כל תרגיל בלוח הכפל!',
    whenEn: 'Every multiplication fact!',
    beforeEq: '7 × 3',
    afterEq: '3 × 7 = 21',
    secretHe: '7 כפול 3 נראה קשה? הפוך אותו! הוא שווה בדיוק ל-3 כפול 7! זה מוחק מעל חצי מלוח הכפל מיד!',
    secretEn: '7 × 3 looks tough? Flip it! It equals 3 × 7 = 21. That deletes half of the multiplication table!',
    sampleA: 7,
    sampleB: 3,
  },
  {
    id: 'mult-doublechain',
    op: '×',
    icon: '⚡',
    titleHe: 'דאבל, דאבל-דאבל וטריפל-דאבל (×2, ×4, ×8)',
    titleEn: 'Double, Double-Double & Triple-Double',
    whenHe: 'כפולות של 2, 4 או 8',
    whenEn: 'Multiplying by 2, 4, or 8',
    beforeEq: '4 × 7  |  8 × 6',
    afterEq: '7➔14➔28  |  6➔12➔24➔48',
    secretHe: 'כפול 4 = להכפיל פי 2 פעמיים! כפול 8 = להכפיל פי 2 שלוש פעמים! לא צריך לשנן בעל פה!',
    secretEn: '×4 = Double twice! ×8 = Double 3 times! Zero rote memorization needed!',
    sampleA: 4,
    sampleB: 7,
  },
  {
    id: 'mult-halften',
    op: '×',
    icon: '🍕',
    titleHe: 'טריק החצי-עשר (כפולות 5)',
    titleEn: 'Half-of-10x Turbo Hack (×5)',
    whenHe: 'כל כפולה של 5',
    whenEn: 'Multiplying any number by 5',
    beforeEq: '5 × 8',
    afterEq: '(10 × 8) ÷ 2 = 80 ÷ 2 = 40',
    secretHe: '5 הוא בדיוק חצי מ-10! קח חצי מהמספר והוסף לו 0 (חצי מ-8 זה 4 ➔ 40)!',
    secretEn: '5 is half of 10! Cut the number in half and add a zero (half of 8 is 4 ➔ 40)!',
    sampleA: 5,
    sampleB: 8,
  },
  {
    id: 'mult-finger9',
    op: '×',
    icon: '🖐️',
    titleHe: 'סורק 10 האצבעות וטריק ה-9',
    titleEn: 'Cyber-9 Finger Scanner',
    whenHe: 'כל כפולה של 9',
    whenEn: 'Multiplying 9 by 1..10',
    beforeEq: '9 × 7',
    afterEq: '[6 עשרות] + [3 אחדות] = 63',
    secretHe: 'קפל את האצבע ה-7: משמאלה יש 6 אצבעות (60) ומימינה 3 אצבעות (3) = 63! וגם: סכום הספרות תמיד שווה 9 (6+3=9)!',
    secretEn: 'Fold finger #7: 6 fingers left (60) + 3 fingers right (3) = 63! Plus the digits always add up to 9!',
    sampleA: 9,
    sampleB: 7,
  },
  {
    id: 'mult-5678',
    op: '×',
    icon: '💎',
    titleHe: 'קוד 5-6-7-8 וחרוז 6×8=48',
    titleEn: 'Secret 5-6-7-8 Code & 6×8 Rhyme',
    whenHe: 'הכפולות הקשות ביותר בלוח (6×7, 6×8, 7×8)',
    whenEn: 'The Final Boss facts (6×7, 6×8, 7×8)',
    beforeEq: '7 × 8  |  6 × 8',
    afterEq: '56 = 7 × 8  |  6 × 8 = 48',
    secretHe: 'ספור ברצף: 5, 6, 7, 8 ➔ 56 = 7×8! ובחרוז: "שש כפול שמונה = ארבעים ושמונה (48)"! ול-7×6: חתוך ל-5×6 (30) + 2×6 (12) = 42!',
    secretEn: 'Count in order: 5, 6, 7, 8 ➔ 56 = 7×8! Rhyme: "Six times eight is forty-eight (48)"! For 7×6: 5×6(30) + 2×6(12) = 42!',
    sampleA: 7,
    sampleB: 8,
  },
];

export const HackerCodexModal: React.FC<HackerCodexModalProps> = ({
  lang,
  multMastery,
  onClose,
}) => {
  const isHe = lang === 'he';

  const [activeTab, setActiveTab] = useState<'matrix' | 'simulator' | 'cards' | 'cheatsheet'>('matrix');

  // State for Tab 1: Interactive 10x10 Matrix
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 7, c: 8 });
  const [mirrorFilter, setMirrorFilter] = useState<boolean>(false);
  const [hideEasyFacts, setHideEasyFacts] = useState<boolean>(false);

  // State for Tab 2: Live Hack Simulator
  const [simOp, setSimOp] = useState<Operation>('+');
  const [simA, setSimA] = useState<number>(58);
  const [simB, setSimB] = useState<number>(25);

  // State for Tab 3: Strategy Cards filter
  const [cardFilter, setCardFilter] = useState<'ALL' | Operation>('ALL');

  const cellHack = generateMathHack('×', selectedCell.r, selectedCell.c);
  const cellAnswer = selectedCell.r * selectedCell.c;

  // Ensure valid subtraction in simulator
  const effectiveSimA = simOp === '-' && simA <= simB ? simB + 14 : simA;
  const effectiveSimB = simOp === '×' ? Math.min(10, Math.max(1, simB)) : simB;
  const effectiveSimAMult = simOp === '×' ? Math.min(10, Math.max(1, simA)) : effectiveSimA;
  const finalA = simOp === '×' ? effectiveSimAMult : effectiveSimA;
  const finalB = effectiveSimB;
  const simAnswer =
    simOp === '+' ? finalA + finalB : simOp === '-' ? finalA - finalB : finalA * finalB;
  const simHack = generateMathHack(simOp, finalA, finalB);

  const loadSampleIntoSimulator = (op: Operation, a: number, b: number) => {
    sound.playHackActivate();
    setSimOp(op);
    setSimA(a);
    setSimB(b);
    setActiveTab('simulator');
  };

  // Helper to classify a multiplication cell
  const getCellCategory = (r: number, c: number) => {
    if (r === 1 || c === 1 || r === 10 || c === 10) return 'easy-ten';
    if (r === 5 || c === 5) return 'half-five';
    if (r === 9 || c === 9) return 'nine-finger';
    if (r === 2 || c === 2 || r === 4 || c === 4 || r === 8 || c === 8) return 'double-family';
    return 'boss-core';
  };

  return (
    <div className="codex-modal-backdrop" role="dialog" aria-modal="true">
      <div className="codex-modal-window">
        {/* Modal Header */}
        <div className="codex-modal-header">
          <div className="codex-title-group">
            <span className="codex-logo-badge">📓 HACK CODEX</span>
            <h2>
              {isHe
                ? 'ספר ההאקים הסודי ולוח הכפל החכם'
                : "The Hacker's Math Codex & Smart Matrix"}
            </h2>
          </div>

          <button type="button" className="slab close-modal-btn" onClick={onClose}>
            <X size={22} />
            <span>{isHe ? 'סגור' : 'Close'}</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="codex-tabs-bar">
          <button
            type="button"
            className={`slab codex-tab-btn ${activeTab === 'matrix' ? 'primary' : ''}`}
            onClick={() => {
              sound.playClick();
              setActiveTab('matrix');
            }}
          >
            <Grid size={19} />
            <span>{isHe ? 'לוח הכפל החכם (10×10)' : 'Smart 10×10 Matrix'}</span>
          </button>

          <button
            type="button"
            className={`slab codex-tab-btn ${activeTab === 'cards' ? 'primary' : ''}`}
            onClick={() => {
              sound.playClick();
              setActiveTab('cards');
            }}
          >
            <BookOpen size={19} />
            <span>{isHe ? '12 קלפי הטריקים הסודיים' : '12 Secret Hack Cards'}</span>
          </button>

          <button
            type="button"
            className={`slab codex-tab-btn ${activeTab === 'simulator' ? 'primary' : ''}`}
            onClick={() => {
              sound.playClick();
              setActiveTab('simulator');
            }}
          >
            <Sliders size={19} />
            <span>{isHe ? 'סימולטור האקים חי' : 'Live Hack Simulator'}</span>
          </button>

          <button
            type="button"
            className={`slab codex-tab-btn ${activeTab === 'cheatsheet' ? 'primary' : ''}`}
            onClick={() => {
              sound.playClick();
              setActiveTab('cheatsheet');
            }}
          >
            <Printer size={19} />
            <span>{isHe ? 'דף שליפים מהיר' : 'Quick Cheat Sheet'}</span>
          </button>
        </div>

        {/* TAB 1: INTERACTIVE 10x10 MULTIPLICATION MATRIX */}
        {activeTab === 'matrix' && (
          <div className="codex-tab-content matrix-layout">
            <div className="matrix-left-pane">
              <div className="matrix-controls-row">
                <button
                  type="button"
                  className={`slab filter-toggle-btn ${mirrorFilter ? 'primary' : ''}`}
                  onClick={() => {
                    sound.playHackActivate();
                    setMirrorFilter((p) => !p);
                  }}
                >
                  {mirrorFilter ? <Eye size={18} /> : <EyeOff size={18} />}
                  <span>
                    {isHe
                      ? '🪞 חוק המראה: העלם כפילויות (חצי לוח!)'
                      : '🪞 Mirror Law: Hide Duplicate Half!'}
                  </span>
                </button>

                <button
                  type="button"
                  className={`slab filter-toggle-btn ${hideEasyFacts ? 'primary' : ''}`}
                  onClick={() => {
                    sound.playHackActivate();
                    setHideEasyFacts((p) => !p);
                  }}
                >
                  <Sparkles size={18} />
                  <span>
                    {isHe
                      ? '💎 הצג רק את "תרגילי הבוס" שנותרו!'
                      : '💎 Highlight Only Final Boss Facts!'}
                  </span>
                </button>
              </div>

              <div className="matrix-legend-row">
                <span className="legend-chip easy-ten">
                  {isHe ? '×1 / ×10 (מתנה!)' : '×1 / ×10 (Free!)'}
                </span>
                <span className="legend-chip half-five">
                  {isHe ? '×5 (חצי מ-10)' : '×5 (Half of 10)'}
                </span>
                <span className="legend-chip double-family">
                  {isHe ? '×2 / ×4 / ×8 (הכפלות)' : '×2 / ×4 / ×8 (Doubles)'}
                </span>
                <span className="legend-chip nine-finger">
                  {isHe ? '×9 (טריק האצבעות)' : '×9 (Finger Scanner)'}
                </span>
                <span className="legend-chip boss-core">
                  {isHe ? '×3 / ×6 / ×7 (בוסים)' : '×3 / ×6 / ×7 (Bosses)'}
                </span>
              </div>

              {/* 10x10 Grid */}
              <div className="mult-grid-10x10" dir="ltr">
                <div className="grid-corner">×</div>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => (
                  <div key={`h-${col}`} className="grid-header-cell">
                    {col}
                  </div>
                ))}

                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((row) => (
                  <React.Fragment key={`r-${row}`}>
                    <div className="grid-header-cell">{row}</div>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => {
                      const isSelected =
                        selectedCell.r === row && selectedCell.c === col;
                      const isMirrorDup = mirrorFilter && col > row;
                      const cat = getCellCategory(row, col);
                      const isHiddenEasy =
                        hideEasyFacts &&
                        (cat === 'easy-ten' ||
                          cat === 'half-five' ||
                          cat === 'nine-finger' ||
                          row === 2 ||
                          col === 2);
                      const mastery = multMastery[`${row}-${col}`] || 0;

                      return (
                        <button
                          key={`${row}-${col}`}
                          type="button"
                          className={`mult-cell ${cat} ${
                            isSelected ? 'selected-cell' : ''
                          } ${isMirrorDup || isHiddenEasy ? 'dimmed-cell' : ''}`}
                          onClick={() => {
                            sound.playOrbPickup((row + col) % 5);
                            setSelectedCell({ r: row, c: col });
                          }}
                        >
                          <span className="cell-prod">{row * col}</span>
                          {mastery > 0 && <span className="cell-star">★</span>}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Right Pane: Selected Cell Visual Array & Hack */}
            <div className="matrix-right-pane">
              <div className="selected-cell-showcase">
                <div className="showcase-top-eq" dir="ltr">
                  <span>
                    {selectedCell.r} × {selectedCell.c} ={' '}
                    <strong className="gold-txt">{cellAnswer}</strong>
                  </span>
                  {selectedCell.r !== selectedCell.c && (
                    <span className="mirror-twin-badge">
                      🪞 = {selectedCell.c} × {selectedCell.r}
                    </span>
                  )}
                </div>

                <HackVisorPanel
                  hack={cellHack}
                  lang={lang}
                  a={selectedCell.r}
                  b={selectedCell.c}
                  answer={cellAnswer}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE HACK SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="codex-tab-content simulator-layout">
            <div className="sim-controls-card">
              <h3>
                {isHe
                  ? '⚡ בחר כל תרגיל וראה איך לפצח אותו בשניות:'
                  : '⚡ Pick Any Problem & Watch How to Hack It:'}
              </h3>

              {/* Quick Preset Chips */}
              <div className="sim-presets-row">
                <span className="preset-label">
                  {isHe ? 'דוגמאות חמות:' : 'Hot Examples:'}
                </span>
                {[
                  { op: '+' as Operation, a: 58, b: 25, label: '58 + 25' },
                  { op: '+' as Operation, a: 47, b: 35, label: '47 + 35' },
                  { op: '+' as Operation, a: 8, b: 6, label: '8 + 6' },
                  { op: '-' as Operation, a: 73, b: 39, label: '73 − 39' },
                  { op: '-' as Operation, a: 82, b: 67, label: '82 − 67' },
                  { op: '×' as Operation, a: 9, b: 7, label: '9 × 7' },
                  { op: '×' as Operation, a: 8, b: 6, label: '8 × 6' },
                  { op: '×' as Operation, a: 7, b: 8, label: '7 × 8' },
                ].map((pr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="slab preset-chip-btn"
                    dir="ltr"
                    onClick={() => {
                      sound.playOrbPickup(idx % 4);
                      setSimOp(pr.op);
                      setSimA(pr.a);
                      setSimB(pr.b);
                    }}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>

              {/* Custom Builder Controls */}
              <div className="sim-sliders-grid" dir="ltr">
                <div className="sim-num-box">
                  <label>Number A: {finalA}</label>
                  <input
                    type="range"
                    min={simOp === '×' ? 2 : 4}
                    max={simOp === '×' ? 10 : 95}
                    value={finalA}
                    onChange={(e) => setSimA(Number(e.target.value))}
                  />
                </div>

                <div className="sim-op-selector">
                  {(['+', '-', '×'] as Operation[]).map((op) => (
                    <button
                      key={op}
                      type="button"
                      className={`slab op-pick-btn ${simOp === op ? 'primary' : ''}`}
                      onClick={() => {
                        sound.playClick();
                        setSimOp(op);
                        if (op === '×') {
                          setSimA(Math.min(9, simA));
                          setSimB(Math.min(9, simB));
                        } else if (op === '-' && simA <= simB) {
                          setSimA(73);
                          setSimB(39);
                        }
                      }}
                    >
                      {op}
                    </button>
                  ))}
                </div>

                <div className="sim-num-box">
                  <label>Number B: {finalB}</label>
                  <input
                    type="range"
                    min={simOp === '×' ? 2 : 2}
                    max={simOp === '×' ? 10 : simOp === '-' ? Math.max(2, finalA - 2) : 65}
                    value={finalB}
                    onChange={(e) => setSimB(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <HackVisorPanel
              hack={simHack}
              lang={lang}
              a={finalA}
              b={finalB}
              answer={simAnswer}
            />
          </div>
        )}

        {/* TAB 3: 12 SECRET STRATEGY CARDS */}
        {activeTab === 'cards' && (
          <div className="codex-tab-content cards-layout">
            <div className="cards-filter-bar">
              {(['ALL', '+', '-', '×'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`slab filter-op-btn ${cardFilter === f ? 'primary' : ''}`}
                  onClick={() => {
                    sound.playClick();
                    setCardFilter(f);
                  }}
                >
                  {f === 'ALL'
                    ? isHe
                      ? '🌟 כל 12 הטריקים'
                      : '🌟 All 12 Hacks'
                    : f === '+'
                    ? isHe
                      ? '➕ טריקים לחיבור'
                      : '➕ Addition Hacks'
                    : f === '-'
                    ? isHe
                      ? '➖ טריקים לחיסור'
                      : '➖ Subtraction Hacks'
                    : isHe
                    ? '✖️ טריקים לכפל'
                    : '✖️ Multiplication Hacks'}
                </button>
              ))}
            </div>

            <div className="strategy-cards-grid">
              {STRATEGY_CARDS.filter(
                (c) => cardFilter === 'ALL' || c.op === cardFilter
              ).map((card) => (
                <div key={card.id} className={`strategy-deck-card op-border-${card.op}`}>
                  <div className="strategy-card-top">
                    <span className="strategy-icon">{card.icon}</span>
                    <div>
                      <h4>{isHe ? card.titleHe : card.titleEn}</h4>
                      <span className="strategy-when-tag">
                        {isHe ? card.whenHe : card.whenEn}
                      </span>
                    </div>
                  </div>

                  <div className="strategy-transform-box" dir="ltr">
                    <span className="before-eq">{card.beforeEq}</span>
                    <span className="transform-arrow">⚡➔</span>
                    <span className="after-eq">{card.afterEq}</span>
                  </div>

                  <p className="strategy-secret-p">
                    {isHe ? card.secretHe : card.secretEn}
                  </p>

                  <button
                    type="button"
                    className="slab try-sim-btn"
                    onClick={() =>
                      loadSampleIntoSimulator(card.op, card.sampleA, card.sampleB)
                    }
                  >
                    <Zap size={16} />
                    <span>
                      {isHe ? 'נסה בסימולטור החי!' : 'Try in Live Simulator!'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRINTABLE / QUICK-GLANCE CHEAT SHEET */}
        {activeTab === 'cheatsheet' && (
          <div className="codex-tab-content cheatsheet-layout">
            <div className="cheatsheet-toolbar">
              <h3>
                {isHe
                  ? '📄 דף השליפים הסודי של אלופי נובה ברול'
                  : '📄 Nova Brawl Pro Gamer Pocket Cheat Sheet'}
              </h3>
              <button
                type="button"
                className="slab primary"
                onClick={() => window.print()}
              >
                <Printer size={18} />
                <span>{isHe ? 'הדפס דף שליפים' : 'Print Cheat Sheet'}</span>
              </button>
            </div>

            <div className="printable-sheet-grid">
              {/* Addition Box */}
              <div className="cheat-section-card gold-sec">
                <h4>
                  {isHe
                    ? '➕ 3 חוקי הזהב לחיבור מהיר (1-99)'
                    : '➕ 3 Golden Rules for Rapid Addition'}
                </h4>
                <ul>
                  <li>
                    <strong>{isHe ? '1. חברים ל-10:' : '1. Partners to 10:'}</strong>{' '}
                    <span dir="ltr">9+1, 8+2, 7+3, 6+4, 5+5</span>.{' '}
                    {isHe
                      ? 'תמיד השלם קודם ל-10 עגול!'
                      : 'Always lock a 10 first!'}
                  </li>
                  <li>
                    <strong>
                      {isHe ? '2. פיצול עשרות ואחדות:' : '2. Split Tens & Ones:'}
                    </strong>{' '}
                    <span dir="ltr">47 + 35 ➔ (40+30) + (7+5) = 70 + 12 = 82</span>.
                  </li>
                  <li>
                    <strong>
                      {isHe ? '3. עיגול לעשרת קרובה:' : '3. Friendly-10 Swap:'}
                    </strong>{' '}
                    <span dir="ltr">58 + 25 ➔ 60 + 23 = 83</span>.
                  </li>
                </ul>
              </div>

              {/* Subtraction Box */}
              <div className="cheat-section-card cyan-sec">
                <h4>
                  {isHe
                    ? '➖ 3 חוקי הנינג׳ה לחיסור בלי פריטה!'
                    : '➖ 3 Ninja Rules for Zero-Borrow Subtraction!'}
                </h4>
                <ul>
                  <li>
                    <strong>
                      {isHe ? '1. הזזה שווה (בלי פריטה!):' : '1. Equal Shift (No Borrow!):'}
                    </strong>{' '}
                    {isHe
                      ? 'הוסף אותו מספר לשניהם כדי לקבל עשרת עגולה:'
                      : 'Add the same amount to both:'}{' '}
                    <span dir="ltr">73 − 39 (+1) ➔ 74 − 40 = 34</span>!
                  </li>
                  <li>
                    <strong>
                      {isHe ? '2. גשר הקפיצות (סופרים קדימה):' : '2. Bridge Jump (Count Up):'}
                    </strong>{' '}
                    <span dir="ltr">82 − 67 ➔ 67 +3 (70) +12 (82) ➔ 3+12 = 15</span>!
                  </li>
                  <li>
                    <strong>
                      {isHe ? '3. חיתוך עשרות ואז אחדות:' : '3. Slice Tens Then Ones:'}
                    </strong>{' '}
                    <span dir="ltr">64 − 23 ➔ 64 − 20 (44) − 3 = 41</span>.
                  </li>
                </ul>
              </div>

              {/* Multiplication Box */}
              <div className="cheat-section-card magenta-sec full-span">
                <h4>
                  {isHe
                    ? '✖️ מפת הקיצורים של לוח הכפל (איך לדעת הכל בלי לשנן 100 תרגילים!)'
                    : '✖️ Multiplication Master Shortcuts (Conquer the Table without Rote Memorization!)'}
                </h4>
                <div className="mult-cheats-columns">
                  <div>
                    <p>
                      <strong>🪞 {isHe ? 'חוק המראה:' : 'Mirror Flip:'}</strong>{' '}
                      <span dir="ltr">7 × 3 = 3 × 7</span> (
                      {isHe ? 'מוחק חצי לוח!' : 'Deletes half the table!'})
                    </p>
                    <p>
                      <strong>⚡ {isHe ? 'כפולות 2, 4, 8:' : '2s, 4s, 8s:'}</strong>{' '}
                      {isHe
                        ? '×2 = כפול, ×4 = דאבל פעמיים (4×7: 7➔14➔28), ×8 = דאבל 3 פעמים!'
                        : '×2 = Double, ×4 = Double twice, ×8 = Double 3 times!'}
                    </p>
                    <p>
                      <strong>🍕 {isHe ? 'כפולות 5:' : '5s Hack:'}</strong>{' '}
                      {isHe
                        ? 'חצי מכפול 10! (5×8 = חצי מ-80 = 40).'
                        : 'Half of ×10! (5×8 = half of 80 = 40).'}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>🖐️ {isHe ? 'כפולות 9:' : '9s Finger Trick:'}</strong>{' '}
                      {isHe
                        ? 'קפל אצבע מס׳ N (משמאל עשרות, מימין אחדות) או 10×N פחות N!'
                        : 'Fold finger #N (left=tens, right=ones) or 10×N − N!'}
                    </p>
                    <p>
                      <strong>💎 {isHe ? 'קוד הבוסים:' : 'Final Boss Codes:'}</strong>{' '}
                      <span dir="ltr">5, 6, 7, 8 ➔ 56 = 7 × 8</span> |{' '}
                      <span dir="ltr">6 × 8 = 48</span> |{' '}
                      <span dir="ltr">6 × 6 = 36</span> |{' '}
                      <span dir="ltr">7 × 7 = 49</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
