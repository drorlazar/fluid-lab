import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Trophy, Lock, Check, Gift } from 'lucide-react';
import { HEROES } from '../i18n/content';
import { Language } from '../math/mathEngine';
import { HeroAvatar } from './HeroAvatar';

interface HeroGarageModalProps {
  lang: Language;
  trophies: number;
  selectedHeroId: string;
  brawlBoxes: number;
  calmMode: boolean;
  onSelectHero: (id: string) => void;
  onOpenBox: () => void;
  onClose: () => void;
}

export const HeroGarageModal: React.FC<HeroGarageModalProps> = ({
  lang,
  trophies,
  selectedHeroId,
  brawlBoxes,
  calmMode,
  onSelectHero,
  onOpenBox,
  onClose,
}) => {
  const isHe = lang === 'he';
  const [boxRewardMsg, setBoxRewardMsg] = useState<string | null>(null);

  const handleOpenMegaBox = () => {
    if (brawlBoxes <= 0) return;
    onOpenBox();
    setBoxRewardMsg(
      isHe
        ? '🎉 בום! פתחת תיבת מגה: +75 יהלומים ו-+25 גביעים!'
        : '🎉 BOOM! Mega Box Opened: +75 Gems & +25 Trophies!'
    );
    if (!calmMode && typeof window !== 'undefined') {
      confetti({
        particleCount: 65,
        spread: 80,
        origin: { y: 0.5 },
      });
    }
  };

  return (
    <div className="codex-modal-backdrop" role="dialog" aria-modal="true">
      <div className="codex-modal-window garage-window">
        <div className="codex-modal-header">
          <div className="codex-title-group">
            <span className="codex-logo-badge">🏆 BRAWLER GARAGE</span>
            <h2>
              {isHe
                ? 'המוסך של הברולרים ותיבות המגה'
                : 'Brawler Heroes & Mega Boxes'}
            </h2>
          </div>

          <button type="button" className="slab close-modal-btn" onClick={onClose}>
            <X size={22} />
            <span>{isHe ? 'סגור' : 'Close'}</span>
          </button>
        </div>

        {/* Mega Box Opener Strip */}
        <div className="mega-box-banner">
          <div className="mega-box-info">
            <span className="box-icon">🎁</span>
            <div>
              <h3>
                {isHe
                  ? `תיבות מגה זמינות לפתיחה: ${brawlBoxes}`
                  : `Mega Brawl Boxes Ready: ${brawlBoxes}`}
              </h3>
              <p>
                {isHe
                  ? 'כל 4 ניצחונות בקרב מעניקים תיבת מגה חדשה עם גביעים ויהלומים!'
                  : 'Every 4 battle victories earn a new Mega Box with Trophies & Gems!'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="slab primary open-box-btn"
            disabled={brawlBoxes <= 0}
            onClick={handleOpenMegaBox}
          >
            <Gift size={20} />
            <span>
              {brawlBoxes > 0
                ? isHe
                  ? 'פתח תיבת מגה עכשיו!'
                  : 'OPEN MEGA BOX NOW!'
                : isHe
                ? 'נצח בקרבות כדי להשיג עוד'
                : 'Win Battles to Earn More'}
            </span>
          </button>
        </div>

        {boxRewardMsg && <div className="victory-toast-banner">{boxRewardMsg}</div>}

        {/* Heroes Roster Grid */}
        <div className="heroes-roster-grid">
          {HEROES.map((hero) => {
            const unlocked = trophies >= hero.unlockTrophies;
            const isSelected = selectedHeroId === hero.id;
            return (
              <div
                key={hero.id}
                className={`hero-roster-card ${isSelected ? 'selected-hero-card' : ''} ${
                  !unlocked ? 'locked-hero-card' : ''
                }`}
              >
                <div
                  className="hero-card-banner"
                  style={{
                    background: `linear-gradient(135deg, ${hero.primaryColor}33, ${hero.accentColor}22)`,
                  }}
                >
                  <HeroAvatar heroId={hero.id} size={92} action="idle" />
                </div>

                <div className="hero-card-body">
                  <div className="hero-name-row">
                    <h3>{isHe ? hero.nameHe : hero.nameEn}</h3>
                    <span className="hero-emoji-tag">{hero.iconEmoji}</span>
                  </div>
                  <span className="hero-subtitle">
                    {isHe ? hero.titleHe : hero.titleEn}
                  </span>
                  <p className="hero-power-desc">
                    ⚡ {isHe ? hero.powerHe : hero.powerEn}
                  </p>

                  {unlocked ? (
                    <button
                      type="button"
                      className={`slab hero-select-btn ${isSelected ? 'primary' : ''}`}
                      onClick={() => onSelectHero(hero.id)}
                    >
                      <Check size={18} />
                      <span>
                        {isSelected
                          ? isHe
                            ? 'מחובר לקרב!'
                            : 'EQUIPPED!'
                          : isHe
                          ? 'בחר ברולר'
                          : 'SELECT BRAWLER'}
                      </span>
                    </button>
                  ) : (
                    <div className="hero-locked-pill">
                      <Lock size={16} />
                      <Trophy size={16} />
                      <span>
                        {isHe
                          ? `נפתח ב-${hero.unlockTrophies} גביעים`
                          : `Unlocks at ${hero.unlockTrophies} Trophies`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
