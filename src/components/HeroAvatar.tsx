import React from 'react';

interface HeroAvatarProps {
  heroId: string;
  size?: number;
  action?: 'idle' | 'attack' | 'charge';
}

export const HeroAvatar: React.FC<HeroAvatarProps> = ({
  heroId,
  size = 96,
  action = 'idle',
}) => {
  const animClass =
    action === 'attack'
      ? 'hero-svg-attack'
      : action === 'charge'
      ? 'hero-svg-charge'
      : 'hero-svg-idle';

  switch (heroId) {
    case 'rexbot':
      // Armored Mecha T-Rex
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="REX-BOT X"
        >
          <defs>
            <linearGradient id="rexArmor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2ecc71" />
              <stop offset="100%" stop-color="#117a43" />
            </linearGradient>
          </defs>
          {/* Tail & Back Spikes */}
          <polygon points="14,32 28,22 28,40" fill="#00f5d4" stroke="#042240" strokeWidth="4" />
          <polygon points="22,50 36,38 36,56" fill="#00f5d4" stroke="#042240" strokeWidth="4" />
          {/* Body & Head */}
          <rect x="26" y="46" width="52" height="52" rx="14" fill="url(#rexArmor)" stroke="#042240" strokeWidth="5" />
          <rect x="36" y="18" width="66" height="42" rx="12" fill="url(#rexArmor)" stroke="#042240" strokeWidth="5" />
          {/* Jaw Cannon */}
          <rect x="54" y="52" width="46" height="18" rx="6" fill="#1e293b" stroke="#042240" strokeWidth="5" />
          {/* Glowing Cyber Teeth */}
          <polygon points="62,52 67,44 72,52" fill="#fff080" />
          <polygon points="75,52 80,44 85,52" fill="#fff080" />
          <polygon points="88,52 93,44 98,52" fill="#fff080" />
          {/* Visor Eye */}
          <rect x="64" y="26" width="24" height="12" rx="5" fill="#042240" />
          <rect x="68" y="29" width="18" height="6" rx="3" fill="#ffda35" />
          {/* Chest Fusion Core */}
          <circle cx="54" cy="74" r="12" fill="#042240" />
          <circle cx="54" cy="74" r="8" fill="#00f5d4" />
        </svg>
      );

    case 'novakirb':
      // Cosmic Star Absorber (Kirby-Mecha inspired)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="NOVA-KIRB"
        >
          <defs>
            <radialGradient id="kirbBody" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#ff9ebb" />
              <stop offset="60%" stop-color="#ff5ca8" />
              <stop offset="100%" stop-color="#c9186b" />
            </radialGradient>
          </defs>
          {/* Jet Boots */}
          <ellipse cx="40" cy="98" rx="18" ry="11" fill="#e63946" stroke="#042240" strokeWidth="5" />
          <ellipse cx="80" cy="98" rx="18" ry="11" fill="#e63946" stroke="#042240" strokeWidth="5" />
          {/* Arms */}
          <circle cx="20" cy="62" r="13" fill="url(#kirbBody)" stroke="#042240" strokeWidth="5" />
          <circle cx="100" cy="56" r="13" fill="url(#kirbBody)" stroke="#042240" strokeWidth="5" />
          {/* Main Round Body */}
          <circle cx="60" cy="60" r="38" fill="url(#kirbBody)" stroke="#042240" strokeWidth="5" />
          {/* Cyber Star Crown */}
          <polygon points="60,10 68,26 85,26 71,36 76,50 60,40 44,50 49,36 35,26 52,26" fill="#ffda35" stroke="#042240" strokeWidth="4" />
          {/* Eyes */}
          <ellipse cx="48" cy="54" rx="5" ry="11" fill="#042240" />
          <ellipse cx="48" cy="50" rx="3" ry="4" fill="#ffffff" />
          <ellipse cx="72" cy="54" rx="5" ry="11" fill="#042240" />
          <ellipse cx="72" cy="50" rx="3" ry="4" fill="#ffffff" />
          {/* Cheek Blushes */}
          <ellipse cx="35" cy="63" rx="6" ry="3.5" fill="#ff2a85" />
          <ellipse cx="85" cy="63" rx="6" ry="3.5" fill="#ff2a85" />
          {/* Mouth (Open Vortex when charging, happy smile otherwise) */}
          {action === 'charge' ? (
            <circle cx="60" cy="72" r="11" fill="#042240" stroke="#00f5d4" strokeWidth="3" />
          ) : (
            <path d="M52,69 Q60,78 68,69" fill="none" stroke="#042240" strokeWidth="4.5" strokeLinecap="round" />
          )}
        </svg>
      );

    case 'voltdash':
      // Supersonic Neon Sonic-Bot
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="VOLT-DASH"
        >
          {/* Speed Quills */}
          <polygon points="8,36 48,24 38,50" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          <polygon points="4,58 46,44 38,70" fill="#0096c7" stroke="#042240" strokeWidth="5" />
          <polygon points="12,80 48,64 42,88" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          {/* Head & Body */}
          <circle cx="66" cy="54" r="32" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          {/* Ears */}
          <polygon points="48,28 58,10 68,26" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          <polygon points="72,26 84,10 92,30" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          {/* Electric Visor */}
          <polygon points="50,44 96,40 90,62 52,60" fill="#042240" />
          <polygon points="55,48 91,45 87,58 56,56" fill="#fee440" />
          {/* Lightning Emblem */}
          <polygon points="64,74 54,90 66,90 58,106 78,86 66,86" fill="#fee440" stroke="#042240" strokeWidth="3" />
        </svg>
      );

    case 'titanprime':
      // Transforming Cyber Guardian Mech
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="TITAN-PRIME"
        >
          {/* Shoulder Cannons */}
          <rect x="10" y="34" width="22" height="38" rx="6" fill="#8338ec" stroke="#042240" strokeWidth="5" />
          <rect x="88" y="34" width="22" height="38" rx="6" fill="#8338ec" stroke="#042240" strokeWidth="5" />
          {/* Chest Matrix */}
          <rect x="28" y="48" width="64" height="54" rx="10" fill="#3a86ff" stroke="#042240" strokeWidth="5" />
          <rect x="38" y="58" width="44" height="24" rx="6" fill="#042240" />
          <circle cx="60" cy="70" r="9" fill="#00f5d4" />
          {/* Helmet & Crest */}
          <rect x="36" y="16" width="48" height="36" rx="8" fill="#8338ec" stroke="#042240" strokeWidth="5" />
          <polygon points="60,6 70,22 50,22" fill="#ffda35" stroke="#042240" strokeWidth="4" />
          {/* Visor & Battle Mask */}
          <rect x="44" y="26" width="32" height="10" rx="3" fill="#00f5d4" stroke="#042240" strokeWidth="3" />
          <rect x="46" y="38" width="28" height="10" rx="3" fill="#cbd5e1" stroke="#042240" strokeWidth="3" />
        </svg>
      );

    case 'astrodrake':
      // Galactic Star-Wyrm Cruiser
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="ASTRO-DRAKE"
        >
          {/* Swept Space Wings */}
          <polygon points="8,74 52,36 52,82" fill="#f15bb5" stroke="#042240" strokeWidth="5" />
          <polygon points="112,74 68,36 68,82" fill="#f15bb5" stroke="#042240" strokeWidth="5" />
          {/* Fuselage Dragon Body */}
          <polygon points="60,8 84,64 60,106 36,64" fill="#00bbf9" stroke="#042240" strokeWidth="5" />
          {/* Cockpit Canopy */}
          <ellipse cx="60" cy="52" rx="12" ry="20" fill="#042240" />
          <ellipse cx="60" cy="50" rx="8" ry="14" fill="#fee440" />
          {/* Twin Thrusters */}
          <circle cx="46" cy="94" r="8" fill="#00f5d4" stroke="#042240" strokeWidth="4" />
          <circle cx="74" cy="94" r="8" fill="#00f5d4" stroke="#042240" strokeWidth="4" />
        </svg>
      );

    case 'ignis':
    default:
      // IGNIS-9 Cyber Plasma Dragon (Default Starter)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          className={animClass}
          aria-label="IGNIS-9"
        >
          <defs>
            <linearGradient id="dragonScale" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ff595e" />
              <stop offset="100%" stop-color="#c9184a" />
            </linearGradient>
          </defs>
          {/* Cyber Dragon Wings */}
          <polygon points="6,28 44,42 26,76 8,58" fill="#ffca3a" stroke="#042240" strokeWidth="5" strokeLinejoin="round" />
          <polygon points="114,28 76,42 94,76 112,58" fill="#ffca3a" stroke="#042240" strokeWidth="5" strokeLinejoin="round" />
          {/* Horns */}
          <polygon points="34,28 22,6 48,22" fill="#ffda35" stroke="#042240" strokeWidth="5" strokeLinejoin="round" />
          <polygon points="86,28 98,6 72,22" fill="#ffda35" stroke="#042240" strokeWidth="5" strokeLinejoin="round" />
          {/* Dragon Head & Armor */}
          <rect x="32" y="24" width="56" height="54" rx="18" fill="url(#dragonScale)" stroke="#042240" strokeWidth="5" />
          {/* Glowing Cyber Eyes */}
          <polygon points="40,42 56,48 42,54" fill="#00f5d4" stroke="#042240" strokeWidth="3" />
          <polygon points="80,42 64,48 78,54" fill="#00f5d4" stroke="#042240" strokeWidth="3" />
          {/* Dragon Snout & Plasma Core */}
          <rect x="42" y="58" width="36" height="22" rx="9" fill="#ff9f1c" stroke="#042240" strokeWidth="4" />
          <circle cx="52" cy="68" r="3.5" fill="#042240" />
          <circle cx="68" cy="68" r="3.5" fill="#042240" />
          {/* Chest Star Emblem */}
          <polygon points="60,78 66,90 79,92 69,100 72,112 60,105 48,112 51,100 41,92 54,90" fill="#00f5d4" stroke="#042240" strokeWidth="4" />
        </svg>
      );
  }
};
