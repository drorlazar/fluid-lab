# ⭐ NOVA BRAWL (נובה ברול: ארקייד הכוח)
## Research, Game Design & Neurodivergent Math Pedagogy Guide

### 🔗 Live Links
- **Live Vercel Game (Production, Publicly Accessible):** [https://nova-brawl.vercel.app](https://nova-brawl.vercel.app)
- **Backup Vercel Alias:** [https://work-five-blush.vercel.app](https://work-five-blush.vercel.app)
- **GitHub Repository Branch (`drorlazar`):** [https://github.com/drorlazar/fluid-lab/tree/nova-brawl](https://github.com/drorlazar/fluid-lab/tree/nova-brawl)
  *(Note: The environment's fine-grained GitHub PAT has `Contents: Write` on existing repos rather than account-level `Administration: Write` for new repo creation, so the full commit history was pushed to a dedicated branch `nova-brawl` under `drorlazar/fluid-lab` without touching `main`, and a standalone `nova-brawl.bundle` is included in the artifacts directory.)*

---

### 1. Research Findings: Why Traditional "Math Games" Fail Kids with ADHD & ASD
When a bright 9-year-old who loves **Kirby, Mario, Sonic, Geometry Dash, Brawl Stars, Dragons, Dinosaurs, Spaceships, and Robots** plays a typical educational math game, he spots the "broccoli covered in chocolate" immediately:
1. **Extrinsic "Quiz Gates" Kill Flow:** Stopping the action to ask a multiple-choice question (`47 + 35 = ?`) feels like homework interrupting a game.
2. **Working Memory Bottlenecks:** In 2-digit mental addition (`47 + 35`) and subtraction with borrowing (`82 − 67` or `73 − 39`), holding multiple digits and carries in working memory is the #1 point of overload for ADHD brains.
3. **Timer Panic & Rejection Sensitivity:** Ticking countdown clocks trigger freeze responses, while harsh "WRONG! Streak Reset to 0" screens cause frustration and shutdown.
4. **Rote Memorization vs. "Hacking the System":** Kids with ADHD and light ASD love discovering **patterns, shortcuts, and "glitches/hacks"** that make a 100-cell multiplication table collapse into a handful of visual rules.

---

### 2. How NOVA BRAWL Solves This: 4 Distinct Arcade Worlds

Instead of a single repetitive mechanic, **NOVA BRAWL** features **4 visually and mechanically distinct worlds** where numbers are the weapons, shields, drone formations, and speed portals:

#### 🦖 World 1: Mecha-Dino Forge (זירת הדינו-רובוט) — *Addition & Core Fusion (`+`)*
- **Inspiration:** *Kirby* (Inhale & Fuse) + *Mega-Man* + Mecha-Dinosaurs (**Mecha-Rex 9000**, **Tricera-Tank**, **Raptor-Laser X**).
- **Intrinsic Mechanic:** Floating **Tens Bars (`+10`, `+20`, `+30`)** and **Ones Sparks (`+1`..`+9`)** hover in the arena. The player inhales/absorbs orbs into their **Fusion Reactor**, watching Tens and Ones stack up visually until the reactor matches the Mecha-Dino's Armor Frequency, then fires a **MEGA-BLAST**.
- **Built-in Strategy Button:** **⚡ Split into Tens & Ones (פצל לעשרות ואחדות)** physically breaks `47 + 35` into `40 + 30 = 70` (Gold) and `7 + 5 = 12` (Cyan) right on the battlefield.

#### 🚀 World 2: Galactic Star-Slicer (גלקסיית החלליות) — *Subtraction & Warp Number-Bridge (`-`)*
- **Inspiration:** Classic Space Shooters + *Star Fox* / *Gradius* (**Zorg Dreadnought**, **Nova-X Battlestation**).
- **Intrinsic Mechanic:** Instead of subtracting backward and borrowing in your head, you pilot the Nova Viper across a **Visual Warp Bridge** from the smaller number (`b`) up to the target (`a`) using `+10`, `+20`, `+5`, `+2`, `+1` Warp Hops!
- **Built-in Strategy Button:** **🛡️ Equal Shift Beam (קרן הזזה שווה — בלי פריטה!)**: Facing `73 − 39`? One tap adds `+1` to BOTH ships simultaneously, transforming the shield into **`74 − 40 = 34`** with zero borrowing!

#### 🐉 World 3: Cyber-Dragon Multi-Storm (דרקון הסייבר: סופת הכפל) — *Multiplication & Living Drone Arrays (`×`)*
- **Inspiration:** *Emberwing* + *Sonic* Boss Battles.
- **Intrinsic Mechanic:** Enemy drones fly in **living 2D geometric grids** (`rows × cols`, color-grouped in fives for instant visual subitizing).
- **Interactive Dragon Claw Laser Slicer:** Click between any two rows of drones to **physically slice a hard multiplication swarm into two easy swarms**! For example, slice `7 × 8` into **`5 × 8 = 40`** (Gold) and **`2 × 8 = 16`** (Cyan) → `56`! Includes a **🔄 Mirror Flip** button that rotates the swarm 90° (`7 × 3 ↔ 3 × 7`) and a **Table Focus Bar (`ALL, ×2..×9`)**.

#### ⚡ World 4: Neon Dash: Rhythm Runner (ניאון דאש: ריצת הקצב) — *3-Lane Portal Dash + Smart Bullet-Time (`+ / - / ×`)*
- **Inspiration:** *Geometry Dash* + *Sonic Dash*.
- **Intrinsic Mechanic:** 60fps HTML5 Canvas synthwave 3-lane highway. Steer with Up/Down arrows, W/S, or tap lanes directly.
- **ADHD-Friendly Smart Bullet-Time (זמן קליע חכם):** As the Triple Energy Portals get close, time automatically slows down into a Matrix-style Focus Zone so the player **never fails from a fast timer**, then blasts into hyperspeed as soon as they lock onto the right portal!

---

### 3. The Hacker's Math Codex & 12 Secret Gamer Strategies (ספר ההאקים הסודי)

In every battle—and inside the dedicated **Hacker Codex** modal—the player can use **12 Pro Gamer Math Hacks**:

1. **🧲 Magnet-10 Partners (מגנט העשר):** Lock pairs that make 10 (`9+1, 8+2, 7+3, 6+4, 5+5`). For `8 + 5`, pull `2` from `5` → `10 + 3 = 13`.
2. **⚡ Tens-First Laser Split (פיצול עשרות ואז אחדות):** For `47 + 35`, fuse Tens first (`40+30=70`), fuse Ones second (`7+5=12`), then merge (`70+12=82`).
3. **🚀 Friendly-10 Turbo Swap (קפיצה לעשרת קרובה):** For `58 + 25`, slide `2` from `25` to `58` → `60 + 23 = 83`.
4. **👯 Twin Clone +1 (שיבוט תאומים):** Use known doubles (`6+6=12, 7+7=14, 25+25=50`) to solve neighbors (`25+26 = 50+1 = 51`).
5. **🛡️ Equal Shift Shield (הזזה שווה — אפס פריטה!):** Add the same number (`+1`, `+2`, or `+3`) to both numbers in subtraction so the second ends in zero (`73 − 39` → `+1` to both → `74 − 40 = 34`).
6. **🐸 Ninja Bridge Jump (גשר הקפיצות — סופרים קדימה!):** Turn subtraction into forward jumps (`82 − 67`: jump `67 → 70 (+3)` then `70 → 82 (+12)` → `3 + 12 = 15`).
7. **⚔️ Two-Step Safe Slice (חיתוך בשני שלבים):** Subtract tens first, then ones (`64 − 22` → `64 − 20 = 44` → `44 − 2 = 42`).
8. **🪞 The Mirror Flip Law (חוק המראה):** `a × b = b × a` (`7 × 3 = 3 × 7 = 21`) — deletes half of the multiplication table immediately!
9. **⚡ Double, Double-Double, Triple-Double (`×2, ×4, ×8`):**
   - `×2` = Double (`7+7=14`)
   - `×4` = Double twice (`4 × 7`: `7 → 14 → 28`)
   - `×8` = Double 3 times (`8 × 6`: `6 → 12 → 24 → 48`)
10. **🍕 Half-of-10x Turbo Hack (`×5`):** Multiply by 10, cut in half (`5 × 8 = 80 ÷ 2 = 40`).
11. **🖐️ Cyber-9 Finger Scanner (`×9`):** Fold finger `#N` out of 10: fingers on the left are Tens, fingers on the right are Ones (`9 × 7` → fold #7 → `6` left, `3` right = `63`). Also `10×N − N` (`70 − 7 = 63`), and digits always sum to `9`!
12. **💎 Final Boss Codes (`5-6-7-8` & `6×8=48`):**
    - `5, 6, 7, 8` in order → **`56 = 7 × 8`**!
    - Rhyme: **`6 × 8 = 48`** ("שש כפול שמונה = ארבעים ושמונה")!
    - For `7 × 6`: slice into `5×6 (30) + 2×6 (12) = 42`.
