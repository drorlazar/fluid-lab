import { useState, useEffect, useCallback } from 'react';
import { DifficultyTier, Language, Operation } from '../math/mathEngine';
import { sound } from '../audio/soundEngine';

export interface PlayerProgress {
  lang: Language;
  tier: DifficultyTier;
  calmMode: boolean;
  muted: boolean;
  trophies: number;
  gems: number;
  streak: number;
  bestStreak: number;
  selectedHeroId: string;
  brawlBoxes: number;
  totalSolved: number;
  hacksUsed: number;
  // Multiplication table mastery count per cell "r-c" (e.g., "7-8": 3)
  multMastery: Record<string, number>;
}

const STORAGE_KEY = 'nova_brawl_save_v1';

const DEFAULT_PROGRESS: PlayerProgress = {
  lang: 'he', // Hebrew is native & default!
  tier: 'pro',
  calmMode: false,
  muted: false,
  trophies: 30,
  gems: 100,
  streak: 0,
  bestStreak: 0,
  selectedHeroId: 'ignis',
  brawlBoxes: 1, // Start with 1 free Brawl Box so he gets an immediate dopamine reward!
  totalSolved: 0,
  hacksUsed: 0,
  multMastery: {
    '2-2': 2,
    '5-5': 2,
    '10-10': 3,
  },
};

export function useGameStore() {
  const [state, setState] = useState<PlayerProgress>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROGRESS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_PROGRESS, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PROGRESS;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'he' ? 'rtl' : 'ltr';
    sound.muted = state.muted || new URLSearchParams(window.location.search).get('mute') === '1';
  }, [state]);

  const toggleLang = useCallback(() => {
    sound.playClick();
    setState((prev) => ({ ...prev, lang: prev.lang === 'he' ? 'en' : 'he' }));
  }, []);

  const setTier = useCallback((tier: DifficultyTier) => {
    sound.playClick();
    setState((prev) => ({ ...prev, tier }));
  }, []);

  const toggleCalmMode = useCallback(() => {
    sound.playClick();
    setState((prev) => ({ ...prev, calmMode: !prev.calmMode }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => {
      const nextMuted = !prev.muted;
      sound.muted = nextMuted;
      if (!nextMuted) sound.playClick();
      return { ...prev, muted: nextMuted };
    });
  }, []);

  const selectHero = useCallback((heroId: string) => {
    sound.playOrbPickup(3);
    setState((prev) => ({ ...prev, selectedHeroId: heroId }));
  }, []);

  const recordSuccess = useCallback((op: Operation, a: number, b: number, usedHack: boolean) => {
    sound.playVictoryFanfare();
    setState((prev) => {
      const newStreak = prev.streak + 1;
      const trophyGain = 12 + Math.min(newStreak * 2, 18) + (usedHack ? 5 : 0);
      const gemGain = 15 + (usedHack ? 10 : 0);
      const nextSolved = prev.totalSolved + 1;
      const earnedBox = nextSolved % 4 === 0 ? 1 : 0;

      const nextMastery = { ...prev.multMastery };
      if (op === '×') {
        const k1 = `${a}-${b}`;
        const k2 = `${b}-${a}`;
        nextMastery[k1] = (nextMastery[k1] || 0) + 1;
        nextMastery[k2] = (nextMastery[k2] || 0) + 1;
      }

      return {
        ...prev,
        trophies: prev.trophies + trophyGain,
        gems: prev.gems + gemGain,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        totalSolved: nextSolved,
        brawlBoxes: prev.brawlBoxes + earnedBox,
        multMastery: nextMastery,
      };
    });
  }, []);

  const recordHackBonus = useCallback(() => {
    sound.playHackActivate();
    setState((prev) => ({
      ...prev,
      gems: prev.gems + 10,
      hacksUsed: prev.hacksUsed + 1,
    }));
  }, []);

  const openBrawlBox = useCallback(() => {
    sound.playVictoryFanfare();
    setState((prev) => {
      if (prev.brawlBoxes <= 0) return prev;
      return {
        ...prev,
        brawlBoxes: prev.brawlBoxes - 1,
        gems: prev.gems + 75,
        trophies: prev.trophies + 25,
      };
    });
  }, []);

  return {
    state,
    toggleLang,
    setTier,
    toggleCalmMode,
    toggleMute,
    selectHero,
    recordSuccess,
    recordHackBonus,
    openBrawlBox,
  };
}
