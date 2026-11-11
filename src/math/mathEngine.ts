export type Operation = '+' | '-' | '×';
export type DifficultyTier = 'rookie' | 'pro' | 'master' | 'custom';
export type Language = 'he' | 'en';

export interface MathHackStep {
  badge: string;
  formula: string;
  explanationHe: string;
  explanationEn: string;
  highlightColor: 'gold' | 'cyan' | 'magenta' | 'green';
}

export interface MathHack {
  id: string;
  titleHe: string;
  titleEn: string;
  shortBannerHe: string;
  shortBannerEn: string;
  transformedEquation: string;
  steps: MathHackStep[];
  visualType:
    | 'make10'
    | 'splitTensOnes'
    | 'friendlyTen'
    | 'bridgeJump'
    | 'equalShift'
    | 'finger9'
    | 'doubleChain'
    | 'halfTen'
    | 'arraySplit';
  visualData: {
    tensA?: number;
    onesA?: number;
    tensB?: number;
    onesB?: number;
    shiftAmount?: number;
    bridgeStop?: number;
    jump1?: number;
    jump2?: number;
    fingerFolded?: number;
    splitRowA?: number;
    splitRowB?: number;
    cols?: number;
  };
}

export interface MathProblem {
  id: string;
  op: Operation;
  a: number;
  b: number;
  answer: number;
  displayEquation: string;
  choices: number[];
  hack: MathHack;
  orbPool: number[]; // For World 1 (Dino Forge) & World 2 (Space Slicer)
}

/**
 * Generates a tailored, kid-friendly "Gamer Hack" (mental math strategy)
 * for ANY addition, subtraction, or multiplication problem.
 */
export function generateMathHack(op: Operation, a: number, b: number): MathHack {
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;

  if (op === '+') {
    const onesA = a % 10;
    const onesB = b % 10;
    const tensA = a - onesA;
    const tensB = b - onesB;

    // Case 1: Single-digit or small bridge over 10 (Make-10 Magnet)
    if (a < 10 && b < 10 && a + b > 10) {
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      const needToTen = 10 - big;
      const leftover = small - needToTen;
      return {
        id: 'make10',
        titleHe: 'מגנט ה-10 (השלמה לעשר!)',
        titleEn: 'Magnet-10 Lock!',
        shortBannerHe: `${big} מושך ${needToTen} מתוך ${small} כדי להפוך ל-10 עגול!`,
        shortBannerEn: `${big} pulls ${needToTen} from ${small} to lock into a clean 10!`,
        transformedEquation: `10 + ${leftover} = ${answer}`,
        visualType: 'make10',
        visualData: { tensA: 10, onesA: needToTen, onesB: leftover },
        steps: [
          {
            badge: '1',
            formula: `${big} + ${needToTen} = 10`,
            explanationHe: `כמה חסר ל-${big} כדי להגיע ל-10? רק ${needToTen}! ניקח אותו מ-${small}.`,
            explanationEn: `How much does ${big} need to reach 10? Just ${needToTen}! Pull it from ${small}.`,
            highlightColor: 'gold',
          },
          {
            badge: '2',
            formula: `${small} - ${needToTen} = ${leftover}`,
            explanationHe: `נשאר לנו ${leftover} בצד.`,
            explanationEn: `That leaves ${leftover} remaining.`,
            highlightColor: 'cyan',
          },
          {
            badge: '⚡',
            formula: `10 + ${leftover} = ${answer}`,
            explanationHe: `10 ועוד ${leftover} זה מיד ${answer}!`,
            explanationEn: `10 plus ${leftover} is an instant ${answer}!`,
            highlightColor: 'green',
          },
        ],
      };
    }

    // Case 2: One of the numbers ends in 8 or 9 -> Friendly-10 Turbo Swap!
    if ((onesA >= 8 || onesB >= 8) && a >= 10 && b >= 4) {
      const roundFirst = onesA >= onesB;
      const nearTenNum = roundFirst ? a : b;
      const otherNum = roundFirst ? b : a;
      const boost = 10 - (nearTenNum % 10);
      const roundedTen = nearTenNum + boost;
      const reducedOther = otherNum - boost;
      return {
        id: 'friendlyTen',
        titleHe: 'האק עיגול טורבו לעשרת קרובה!',
        titleEn: 'Friendly-10 Turbo Swap!',
        shortBannerHe: `מעבירים ${boost} מ-${otherNum} אל ${nearTenNum} כדי לקבל ${roundedTen} עגול!`,
        shortBannerEn: `Slide ${boost} from ${otherNum} to ${nearTenNum} to make a clean ${roundedTen}!`,
        transformedEquation: `${roundedTen} + ${reducedOther} = ${answer}`,
        visualType: 'friendlyTen',
        visualData: {
          tensA: roundedTen,
          onesA: reducedOther,
          shiftAmount: boost,
        },
        steps: [
          {
            badge: '1',
            formula: `${nearTenNum} + ${boost} = ${roundedTen}`,
            explanationHe: `${nearTenNum} ממש קרוב ל-${roundedTen}! ניתן לו ${boost} מתוך ${otherNum}.`,
            explanationEn: `${nearTenNum} is super close to ${roundedTen}! Give it ${boost} from ${otherNum}.`,
            highlightColor: 'gold',
          },
          {
            badge: '2',
            formula: `${otherNum} - ${boost} = ${reducedOther}`,
            explanationHe: `עכשיו המספר השני הוא ${reducedOther}.`,
            explanationEn: `Now the other number becomes ${reducedOther}.`,
            highlightColor: 'cyan',
          },
          {
            badge: '⚡',
            formula: `${roundedTen} + ${reducedOther} = ${answer}`,
            explanationHe: `לחבר מספר עגול זה קלי קלות: ${roundedTen} + ${reducedOther} = ${answer}!`,
            explanationEn: `Adding to a round ten is effortless: ${roundedTen} + ${reducedOther} = ${answer}!`,
            highlightColor: 'green',
          },
        ],
      };
    }

    // Case 3: General 2-digit Addition -> Tens-First Laser Split!
    const tensSum = tensA + tensB;
    const onesSum = onesA + onesB;
    return {
      id: 'splitTensOnes',
      titleHe: 'פיצול לייזר: עשרות לחוד ואחדות לחוד!',
      titleEn: 'Laser Split: Tens First, Ones Second!',
      shortBannerHe: `מחברים עשרות (${tensA}+${tensB}=${tensSum}) ואז אחדות (${onesA}+${onesB}=${onesSum})!`,
      shortBannerEn: `Fuse Tens (${tensA}+${tensB}=${tensSum}) then Ones (${onesA}+${onesB}=${onesSum})!`,
      transformedEquation: `${tensSum} + ${onesSum} = ${answer}`,
      visualType: 'splitTensOnes',
      visualData: { tensA, onesA, tensB, onesB },
      steps: [
        {
          badge: '10s',
          formula: `${tensA} + ${tensB} = ${tensSum}`,
          explanationHe: `קודם ממזגים את מטילי העשרות הגדולים: ${tensA} ועוד ${tensB} שווה ${tensSum}.`,
          explanationEn: `First fuse the big Tens bars: ${tensA} + ${tensB} = ${tensSum}.`,
          highlightColor: 'gold',
        },
        {
          badge: '1s',
          formula: `${onesA} + ${onesB} = ${onesSum}`,
          explanationHe: `עכשיו ממזגים את ניצוצות האחדות: ${onesA} ועוד ${onesB} שווה ${onesSum}.`,
          explanationEn: `Next fuse the Ones sparks: ${onesA} + ${onesB} = ${onesSum}.`,
          highlightColor: 'cyan',
        },
        {
          badge: '⚡',
          formula: `${tensSum} + ${onesSum} = ${answer}`,
          explanationHe: `יורים ביחד: ${tensSum} + ${onesSum} = ${answer}!`,
          explanationEn: `Fire together: ${tensSum} + ${onesSum} = ${answer}!`,
          highlightColor: 'green',
        },
      ],
    };
  }

  if (op === '-') {
    const onesA = a % 10;
    const onesB = b % 10;

    // Case 1: Subtracting a number ending in 7, 8, or 9 where borrowing is needed -> Equal Shift Shield Hack!
    if (b >= 9 && onesB >= 7 && onesA < onesB) {
      const shift = 10 - onesB;
      const newA = a + shift;
      const newB = b + shift;
      return {
        id: 'equalShift',
        titleHe: 'האק ההזזה השווה (בלי פריטה מעצבנת!)',
        titleEn: 'Equal Shift Hack (Zero Borrowing!)',
        shortBannerHe: `מוסיפים +${shift} לשני המספרים: ${a}-${b} הופך ל-${newA}-${newB}!`,
        shortBannerEn: `Add +${shift} to BOTH numbers: ${a}-${b} becomes ${newA}-${newB}!`,
        transformedEquation: `${newA} - ${newB} = ${answer}`,
        visualType: 'equalShift',
        visualData: { shiftAmount: shift, tensA: newA, tensB: newB },
        steps: [
          {
            badge: '+⚡',
            formula: `${b} + ${shift} = ${newB}`,
            explanationHe: `שונא לפרוט מעשרות? נוסיף +${shift} ל-${b} כדי להפוך אותו ל-${newB} עגול!`,
            explanationEn: `Hate borrowing? Add +${shift} to ${b} so it becomes a clean round ${newB}!`,
            highlightColor: 'cyan',
          },
          {
            badge: '+⚡',
            formula: `${a} + ${shift} = ${newA}`,
            explanationHe: `כדי שהמרחק לא ישתנה, מוסיפים +${shift} גם ל-${a} ומקבלים ${newA}.`,
            explanationEn: `To keep the gap identical, add +${shift} to ${a} too → ${newA}.`,
            highlightColor: 'gold',
          },
          {
            badge: '🎯',
            formula: `${newA} - ${newB} = ${answer}`,
            explanationHe: `עכשיו החיסור סופר קל: ${newA} פחות ${newB} שווה ${answer}!`,
            explanationEn: `Now subtraction is effortless: ${newA} - ${newB} = ${answer}!`,
            highlightColor: 'green',
          },
        ],
      };
    }

    // Case 2: Ninja Bridge Jump (Counting Up from b to a)
    const nextTen = Math.ceil((b + 1) / 10) * 10;
    if (nextTen < a) {
      const jump1 = nextTen - b;
      const jump2 = a - nextTen;
      return {
        id: 'bridgeJump',
        titleHe: 'גשר הקפיצות של הנינג׳ה (סופרים קדימה!)',
        titleEn: 'Ninja Bridge Jump (Count Up!)',
        shortBannerHe: `קופצים מ-${b} ל-${nextTen} (+${jump1}) ומשם ל-${a} (+${jump2})!`,
        shortBannerEn: `Jump from ${b} to ${nextTen} (+${jump1}), then to ${a} (+${jump2})!`,
        transformedEquation: `+${jump1} + ${jump2} = ${answer}`,
        visualType: 'bridgeJump',
        visualData: { bridgeStop: nextTen, jump1, jump2 },
        steps: [
          {
            badge: 'קפיצה 1',
            formula: `${b} + ${jump1} = ${nextTen}`,
            explanationHe: `במקום לחסר אחורה, נתחיל ב-${b} ונקפוץ לעשרת הקרובה (${nextTen}): זו קפיצה של +${jump1}.`,
            explanationEn: `Instead of subtracting backward, start at ${b} and jump to ${nextTen}: that's +${jump1}.`,
            highlightColor: 'cyan',
          },
          {
            badge: 'קפיצה 2',
            formula: `${nextTen} + ${jump2} = ${a}`,
            explanationHe: `מ-${nextTen} עד ${a} זו קפיצה קלה של +${jump2}.`,
            explanationEn: `From ${nextTen} to ${a} is an easy jump of +${jump2}.`,
            highlightColor: 'gold',
          },
          {
            badge: '⚡',
            formula: `${jump1} + ${jump2} = ${answer}`,
            explanationHe: `מחברים את שתי הקפיצות: ${jump1} + ${jump2} = ${answer}!`,
            explanationEn: `Add the two jumps together: ${jump1} + ${jump2} = ${answer}!`,
            highlightColor: 'green',
          },
        ],
      };
    }

    // Case 3: Direct Tens & Ones Slice
    const tensB = Math.floor(b / 10) * 10;
    const afterTens = a - tensB;
    return {
      id: 'bridgeJump',
      titleHe: 'חיתוך לייזר בשני שלבים!',
      titleEn: 'Two-Step Laser Slice!',
      shortBannerHe:
        tensB > 0
          ? `חותכים קודם ${tensB} (${a}-${tensB}=${afterTens}) ואז עוד ${onesB}!`
          : `סופרים קדימה מ-${b} עד ${a}: +${answer}!`,
      shortBannerEn:
        tensB > 0
          ? `Slice ${tensB} first (${a}-${tensB}=${afterTens}), then slice ${onesB}!`
          : `Count up from ${b} to ${a}: +${answer}!`,
      transformedEquation:
        tensB > 0 ? `${afterTens} - ${onesB} = ${answer}` : `${b} + ${answer} = ${a}`,
      visualType: 'bridgeJump',
      visualData: { bridgeStop: b + Math.floor(answer / 2), jump1: Math.floor(answer / 2), jump2: answer - Math.floor(answer / 2) },
      steps: [
        {
          badge: '1',
          formula: tensB > 0 ? `${a} - ${tensB} = ${afterTens}` : `${a} - ${b} = ${answer}`,
          explanationHe:
            tensB > 0
              ? `קודם מורידים את העשרות: ${a} פחות ${tensB} משאיר ${afterTens}.`
              : `כמה צעדים יש מ-${b} עד ${a}?`,
          explanationEn:
            tensB > 0
              ? `First slice the tens: ${a} - ${tensB} leaves ${afterTens}.`
              : `How many steps from ${b} up to ${a}?`,
          highlightColor: 'cyan',
        },
        {
          badge: '⚡',
          formula: tensB > 0 ? `${afterTens} - ${onesB} = ${answer}` : `${b} + ${answer} = ${a}`,
          explanationHe: `ועכשיו מורידים ${onesB} ומגיעים ל-${answer}!`,
          explanationEn: `Now slice the remaining ${onesB} to land on ${answer}!`,
          highlightColor: 'green',
        },
      ],
    };
  }

  // MULTIPLICATION ('×')
  const has9 = a === 9 || b === 9;
  const otherFrom9 = a === 9 ? b : a;
  if (has9 && otherFrom9 >= 1 && otherFrom9 <= 10) {
    const leftFingers = otherFrom9 - 1;
    const rightFingers = 10 - otherFrom9;
    const tenTimes = otherFrom9 * 10;
    return {
      id: 'finger9',
      titleHe: 'סורק אצבעות הניאון לכפולות 9!',
      titleEn: 'Cyber-9 Finger Scanner & 10x Hack!',
      shortBannerHe: `מקפלים אצבע מס׳ ${otherFrom9}: ${leftFingers} עשרות משמאל ו-${rightFingers} אחדות מימין = ${answer}!`,
      shortBannerEn: `Fold finger #${otherFrom9}: ${leftFingers} tens on left, ${rightFingers} ones on right = ${answer}!`,
      transformedEquation: `${tenTimes} - ${otherFrom9} = ${answer}`,
      visualType: 'finger9',
      visualData: { fingerFolded: otherFrom9, tensA: leftFingers * 10, onesA: rightFingers },
      steps: [
        {
          badge: '🖐️',
          formula: `[${leftFingers} עשרות] | [${rightFingers} אחדות] → ${answer}`,
          explanationHe: `מרימים 10 אצבעות ומקפלים את אצבע מס׳ ${otherFrom9}: יש ${leftFingers} אצבעות משמאל (${leftFingers * 10}) ו-${rightFingers} מימין (${rightFingers}) = ${answer}!`,
          explanationEn: `Hold up 10 fingers and fold finger #${otherFrom9}: ${leftFingers} fingers on left (${leftFingers * 10}) + ${rightFingers} on right (${rightFingers}) = ${answer}!`,
          highlightColor: 'magenta',
        },
        {
          badge: '10x',
          formula: `10 × ${otherFrom9} - ${otherFrom9} = ${tenTimes} - ${otherFrom9} = ${answer}`,
          explanationHe: `או טריק העשר: 10 פעמים ${otherFrom9} זה ${tenTimes}, פחות ${otherFrom9} אחד = ${answer}! (ושימו לב: ${leftFingers}+${rightFingers}=9 תמיד!)`,
          explanationEn: `Or the 10x trick: 10 × ${otherFrom9} is ${tenTimes}, minus ${otherFrom9} = ${answer}! (Plus digits ${leftFingers}+${rightFingers} always equal 9!)`,
          highlightColor: 'gold',
        },
      ],
    };
  }

  // Case: x5 -> Half and Zero Hack!
  if (a === 5 || b === 5) {
    const other = a === 5 ? b : a;
    const tenProduct = other * 10;
    return {
      id: 'halfTen',
      titleHe: 'טריק החצי-עשר (כפולות 5)!',
      titleEn: 'The Half-of-10x Turbo Trick (×5)!',
      shortBannerHe: `5 זה בדיוק חצי מ-10! חצי מ-${tenProduct} (${other}×10) זה ${answer}!`,
      shortBannerEn: `5 is half of 10! Half of ${tenProduct} (${other}×10) is ${answer}!`,
      transformedEquation: `${tenProduct} ÷ 2 = ${answer}`,
      visualType: 'halfTen',
      visualData: { tensA: tenProduct, onesA: answer, splitRowA: 5, splitRowB: 0, cols: other },
      steps: [
        {
          badge: '×10',
          formula: `10 × ${other} = ${tenProduct}`,
          explanationHe: `להכפיל ב-10 זה הכי קל בעולם: ${other} כפול 10 שווה ${tenProduct}.`,
          explanationEn: `Multiplying by 10 is instant: ${other} × 10 = ${tenProduct}.`,
          highlightColor: 'gold',
        },
        {
          badge: '½',
          formula: `${tenProduct} ÷ 2 = ${answer}`,
          explanationHe: `מכיוון ש-5 הוא חצי מ-10, פשוט חותכים את ${tenProduct} לחצי ומקבלים ${answer}!`,
          explanationEn: `Since 5 is half of 10, just slice ${tenProduct} in half → ${answer}!`,
          highlightColor: 'green',
        },
      ],
    };
  }

  // Case: x2, x4, x8 -> Double / Double-Double / Triple-Double Chain!
  if (a === 2 || b === 2 || a === 4 || b === 4 || a === 8 || b === 8) {
    const mult = a === 8 || b === 8 ? 8 : a === 4 || b === 4 ? 4 : 2;
    const base = a === mult ? b : a;
    const d1 = base * 2;
    const d2 = d1 * 2;
    const d3 = d2 * 2;
    return {
      id: 'doubleChain',
      titleHe:
        mult === 2
          ? 'שכפול תאומים כפול (×2)!'
          : mult === 4
          ? 'דאבל-דאבל: מכפילים פעמיים (×4)!'
          : 'טריפל-דאבל: מכפילים 3 פעמים (×8)!',
      titleEn:
        mult === 2
          ? 'Twin Clone Double (×2)!'
          : mult === 4
          ? 'Double-Double Hack (×4)!'
          : 'Triple-Double Overdrive (×8)!',
      shortBannerHe:
        mult === 2
          ? `${base} + ${base} = ${d1}!`
          : mult === 4
          ? `כפול 2 פעמיים: ${base} → ${d1} → ${d2}!`
          : `כפול 2 שלוש פעמים: ${base} → ${d1} → ${d2} → ${d3}!`,
      shortBannerEn:
        mult === 2
          ? `${base} + ${base} = ${d1}!`
          : mult === 4
          ? `Double twice: ${base} → ${d1} → ${d2}!`
          : `Double 3 times: ${base} → ${d1} → ${d2} → ${d3}!`,
      transformedEquation:
        mult === 2
          ? `${base} + ${base} = ${d1}`
          : mult === 4
          ? `${d1} + ${d1} = ${d2}`
          : `${d2} + ${d2} = ${d3}`,
      visualType: 'doubleChain',
      visualData: {
        splitRowA: mult / 2,
        splitRowB: mult / 2,
        cols: base,
      },
      steps: [
        ...(mult === 2
          ? [
              {
                badge: '👯',
                formula: `2 × ${base} = ${base} + ${base}`,
                explanationHe: `שלב 1 — כפול 2 זה פשוט לשכפל את ${base} לפעמיים ${base}!`,
                explanationEn: `Step 1 — Multiplying by 2 just clones ${base} into two ${base}s!`,
                highlightColor: 'gold' as const,
              },
            ]
          : []),
        {
          badge: '×2',
          formula: `${base} + ${base} = ${d1}`,
          explanationHe: `שלב ${mult === 2 ? '2' : '1'} — מחברים את התאומים: ${base} + ${base} = ${d1}.`,
          explanationEn: `Step ${mult === 2 ? '2' : '1'} — Double ${base}: ${base} + ${base} = ${d1}.`,
          highlightColor: 'cyan',
        },
        ...(mult >= 4
          ? [
              {
                badge: '×4',
                formula: `${d1} + ${d1} = ${d2}`,
                explanationHe: `שלב 2 — מכפילים שוב פי 2: ${d1} + ${d1} = ${d2}!`,
                explanationEn: `Step 2 — Double again: ${d1} + ${d1} = ${d2}!`,
                highlightColor: 'gold' as const,
              },
            ]
          : []),
        ...(mult === 8
          ? [
              {
                badge: '×8',
                formula: `${d2} + ${d2} = ${d3}`,
                explanationHe: `שלב 3 — עוד הכפלה אחת של ${d2}: ${d2} + ${d2} = ${d3}!`,
                explanationEn: `Step 3 — One last double of ${d2}: ${d2} + ${d2} = ${d3}!`,
                highlightColor: 'green' as const,
              },
            ]
          : []),
      ],
    };
  }

  // Case: x3, x6, x7 -> Smart Array Laser Split (e.g., 7x8 = 5x8 + 2x8, or 6x7 = 5x7 + 1x7, or 3xN = 2xN + N)
  const rows = Math.min(a, b);
  const cols = Math.max(a, b);
  const splitRowA = rows >= 6 ? 5 : rows === 3 ? 2 : Math.floor(rows / 2);
  const splitRowB = rows - splitRowA;
  const partA = splitRowA * cols;
  const partB = splitRowB * cols;

  // Special callout for 7x8 = 56 ("5-6-7-8") or 6x8 = 48
  const is5678 = (a === 7 && b === 8) || (a === 8 && b === 7);
  const is6x8 = (a === 6 && b === 8) || (a === 8 && b === 6);

  return {
    id: 'arraySplit',
    titleHe: is5678
      ? 'קוד הנינג׳ה הסודי: 5-6-7-8 (56 = 7×8) + פיצול 5!'
      : is6x8
      ? 'חרוז הברולרים: 6 כפול 8 = 48!'
      : `חיתוך חכם של הרשת (${splitRowA} שורות + ${splitRowB} שורות)!`,
    titleEn: is5678
      ? 'Secret Ninja Sequence: 5-6-7-8 (56 = 7×8)!'
      : is6x8
      ? 'Brawler Rhyme: 6 × 8 = 48!'
      : `Laser Grid Split (${splitRowA} rows + ${splitRowB} rows)!`,
    shortBannerHe: is5678
      ? `זוכרים בסדר עולה: 5, 6, 7, 8 → 56 = 7 × 8! (או ${partA} + ${partB} = ${answer})`
      : `מפצלים את ${rows}×${cols} ל-${splitRowA}×${cols} (${partA}) ועוד ${splitRowB}×${cols} (${partB})!`,
    shortBannerEn: is5678
      ? `Count in order: 5, 6, 7, 8 → 56 = 7 × 8! (Or ${partA} + ${partB} = ${answer})`
      : `Slice ${rows}×${cols} into ${splitRowA}×${cols} (${partA}) + ${splitRowB}×${cols} (${partB})!`,
    transformedEquation: `${partA} + ${partB} = ${answer}`,
    visualType: 'arraySplit',
    visualData: { splitRowA, splitRowB, cols },
    steps: [
      {
        badge: `${splitRowA}×${cols}`,
        formula: `${splitRowA} × ${cols} = ${partA}`,
        explanationHe: `חותכים את הרשת לחלק קל: ${splitRowA} פעמים ${cols} שווה ${partA}.`,
        explanationEn: `Slice the grid into a friendly chunk: ${splitRowA} × ${cols} = ${partA}.`,
        highlightColor: 'gold',
      },
      {
        badge: `${splitRowB}×${cols}`,
        formula: `${splitRowB} × ${cols} = ${partB}`,
        explanationHe: `החלק השני שנשאר הוא ${splitRowB} פעמים ${cols} שווה ${partB}.`,
        explanationEn: `The remaining slice is ${splitRowB} × ${cols} = ${partB}.`,
        highlightColor: 'cyan',
      },
      {
        badge: '⚡',
        formula: `${partA} + ${partB} = ${answer}`,
        explanationHe: `מחברים את שני החלקים: ${partA} + ${partB} = ${answer}!`,
        explanationEn: `Fuse both slices together: ${partA} + ${partB} = ${answer}!`,
        highlightColor: 'green',
      },
    ],
  };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateChoices(answer: number, op: Operation): number[] {
  const set = new Set<number>([answer]);
  const offsets =
    op === '×'
      ? [-10, -8, -6, -4, -3, -2, 2, 3, 4, 6, 8, 10]
      : [-10, -2, -1, 1, 2, 10, -11, 9, -9, 11];

  let guard = 0;
  while (set.size < 4 && guard < 50) {
    guard++;
    const delta = offsets[randInt(0, offsets.length - 1)];
    const candidate = answer + delta;
    if (candidate > 0 && candidate !== answer) {
      set.add(candidate);
    }
  }
  while (set.size < 4) {
    set.add(answer + set.size + 1);
  }
  return Array.from(set).sort(() => Math.random() - 0.5);
}

/**
 * Builds an interactive pool of energy orbs so the player can construct the answer
 * by combining Tens & Ones or friendly chunks in World 1 / World 2.
 */
function buildOrbPool(op: Operation, a: number, b: number, answer: number): number[] {
  if (op === '+') {
    const tens = Math.floor(answer / 10) * 10;
    const ones = answer % 10;
    const tensA = Math.floor(a / 10) * 10;
    const onesA = a % 10;
    const tensB = Math.floor(b / 10) * 10;
    const onesB = b % 10;
    const pool: number[] = [];
    if (tensA > 0) pool.push(tensA);
    if (tensB > 0) pool.push(tensB);
    if (onesA > 0) pool.push(onesA);
    if (onesB > 0) pool.push(onesB);
    if (tens > 0 && !pool.includes(tens)) pool.push(tens);
    if (ones > 0 && !pool.includes(ones)) pool.push(ones);
    pool.push(10, 5, 2, 1);
    return pool.slice(0, 8);
  }
  if (op === '-') {
    const tensAns = Math.floor(answer / 10) * 10;
    const onesAns = answer % 10;
    const pool = [10, 20, 5, 2, 1];
    if (tensAns > 0 && !pool.includes(tensAns)) pool.unshift(tensAns);
    if (onesAns > 0 && !pool.includes(onesAns)) pool.push(onesAns);
    return pool.slice(0, 7);
  }
  return [10, 5, 2, 1];
}

export interface ProblemGeneratorOptions {
  tier: DifficultyTier;
  forcedOp?: Operation;
  focusTable?: number | null; // e.g., 7 for practicing 7x table
}

export function generateProblem(options: ProblemGeneratorOptions): MathProblem {
  const { tier, forcedOp, focusTable } = options;
  const ops: Operation[] = forcedOp ? [forcedOp] : ['+', '-', '×'];
  const op = ops[randInt(0, ops.length - 1)];

  let a = 5;
  let b = 3;

  if (op === '+') {
    if (tier === 'rookie') {
      // Single digit to teen bridging (e.g., 6 + 7, 8 + 5, 12 + 6)
      a = randInt(4, 14);
      b = randInt(3, 9);
    } else if (tier === 'pro') {
      // 2-digit + 1-or-2 digit (e.g., 38 + 25, 47 + 35)
      a = randInt(15, 68);
      b = randInt(8, 39);
    } else {
      // Master: higher 2-digit addition with carrying (e.g., 58 + 37)
      a = randInt(26, 78);
      b = randInt(16, 49);
    }
  } else if (op === '-') {
    if (tier === 'rookie') {
      // Single digit & teen subtraction (e.g., 15 - 7, 18 - 9)
      b = randInt(3, 9);
      const ans = randInt(3, 12);
      a = b + ans;
    } else if (tier === 'pro') {
      // 2-digit subtraction, often bridging tens (e.g., 62 - 28, 73 - 39, 54 - 19)
      b = randInt(12, 49);
      const ans = randInt(11, 45);
      a = b + ans;
    } else {
      // Master: challenging 2-digit subtraction (e.g., 82 - 47, 91 - 58)
      b = randInt(18, 68);
      const ans = randInt(14, 55);
      a = b + ans;
    }
  } else {
    // Multiplication ('×') — single digit (2..9) and 10
    if (focusTable && focusTable >= 2 && focusTable <= 10) {
      a = focusTable;
      b = randInt(2, 9);
    } else if (tier === 'rookie') {
      const easyFactors = [2, 3, 4, 5, 10];
      a = easyFactors[randInt(0, easyFactors.length - 1)];
      b = randInt(2, 9);
    } else if (tier === 'pro') {
      a = randInt(3, 9);
      b = randInt(3, 9);
    } else {
      // Master focuses on the trickiest single-digit facts (4, 6, 7, 8, 9)
      const hardFactors = [4, 6, 7, 8, 9];
      a = hardFactors[randInt(0, hardFactors.length - 1)];
      b = randInt(4, 9);
    }
  }

  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const hack = generateMathHack(op, a, b);
  const choices = generateChoices(answer, op);
  const orbPool = buildOrbPool(op, a, b, answer);

  return {
    id: `${op}-${a}-${b}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op,
    a,
    b,
    answer,
    displayEquation: `${a} ${op} ${b}`,
    choices,
    hack,
    orbPool,
  };
}
