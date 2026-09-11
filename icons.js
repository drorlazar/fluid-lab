/*
  Chunky filled silhouettes on a 32x32 box, sharing the lettering's weight.
  The first eleven come from Cloud Bridge Racers (src/ui/game-icons.ts); the rest match their style.
*/
(function (root) {
  'use strict';
  const shapes = {
    infinity: '<path d="M10 6c-6 0-10 4-10 10s4 10 10 10c4 0 7-4 10-8 3-4 5-6 7-6 2 0 3 2 3 4s-1 4-3 4c-1 0-3-1-5-3l-4 5c3 3 6 4 9 4 6 0 10-4 10-10S33 6 27 6c-4 0-7 4-10 8s-5 6-7 6c-2 0-4-2-4-4s2-4 4-4c2 0 3 1 5 3l4-5c-3-3-6-4-9-4Z" transform="translate(1 3) scale(.8)"/>',
    pause: '<rect x="7" y="5" width="6" height="22" rx="2"/><rect x="19" y="5" width="6" height="22" rx="2"/>',
    close: '<path d="m8 4 8 8 8-8 4 4-8 8 8 8-4 4-8-8-8 8-4-4 8-8-8-8Z"/>',
    back: '<path d="M19 3 6 16l13 13 5-5-8-8 8-8Z"/>',
    arrow: '<path d="m9 3 14 13L9 29l-5-5 9-8-9-8Z"/>',
    gear: '<path fill-rule="evenodd" d="m12 2-1 4-3 2-4-1-3 6 3 3-1 4 5 5 4-1 2 5h6l2-5 4 1 4-5-1-4 3-3-3-6-4 1-3-2-1-4Zm4 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/>',
    shield: '<path d="M16 2 3 7v9c0 8 13 14 13 14s13-6 13-14V7Z"/><path d="m10 15 4 4 8-9" fill="none" stroke="#fffbed" stroke-width="3"/>',
    sound: '<path d="M3 11v10h6l8 7V4l-8 7Z"/><path d="M22 10q7 6 0 12m4-16q10 10 0 20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
    help: '<path fill-rule="evenodd" d="M16 2a14 14 0 1 0 0 28 14 14 0 0 0 0-28Zm-1 17v-2c0-3 5-3 5-6 0-2-5-3-6 1l-4-1c1-8 15-8 15 0 0 5-5 5-5 8Zm0 3h5v5h-5Z"/>',
    install: '<path d="M13 2h6v12l5-5 4 4-12 12L4 13l4-4 5 5ZM3 25h6v2h14v-2h6v6H3Z"/>',
    flag: '<path d="M4 3h4v27H4Z"/><path d="M9 4h20v18H9Z" fill="#fffbed"/><path d="M9 4h7v6H9Zm14 0h6v6h-6Zm-7 6h7v6h-7Zm-7 6h7v6H9Zm14 0h6v6h-6Z" fill="#07509a"/>',
    // ours
    play: '<path d="M8 4v24l20-12Z"/>',
    step: '<path d="M5 5v22l13-11Z"/><rect x="21" y="5" width="6" height="22" rx="2"/>',
    restart: '<path d="M16 4a12 12 0 1 0 11 7h-5a7 7 0 1 1-6-3v5l9-7-9-7Z"/>',
    home: '<path d="M16 3 2 15h4v13h8v-8h4v8h8V15h4Z"/>',
    book: '<path d="M4 5h9a3 3 0 0 1 3 3 3 3 0 0 1 3-3h9v20h-9a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4Z"/>',
    sliders: '<path d="M4 8h24v4H4Zm0 12h24v4H4Z"/><rect x="8" y="5" width="6" height="10" rx="2"/><rect x="18" y="17" width="6" height="10" rx="2"/>',
    grid: '<path d="M4 4h10v10H4Zm14 0h10v10H18ZM4 18h10v10H4Zm14 0h10v10H18Z"/>',
    star: '<path d="m16 2 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z"/>',
    check: '<path d="m4 17 5-5 5 5L27 7l4 4-17 17Z"/>',
    sun: '<circle cx="16" cy="16" r="7"/><path d="M16 1v5m0 20v5M1 16h5m20 0h5M5 5l4 4m14 14 4 4M5 27l4-4m14-14 4-4" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/>',
    paper: '<path d="M6 2h14l6 6v22H6Z"/><path d="M20 2v6h6" fill="#07509a"/>',
    globe: '<path fill-rule="evenodd" d="M16 2a14 14 0 1 0 0 28 14 14 0 0 0 0-28Zm0 4c1 0 3 3 3 10s-2 10-3 10-3-3-3-10 2-10 3-10Zm-8 6h4c0 3 0 5 1 8H8a10 10 0 0 1 0-8Zm12 0h4a10 10 0 0 1 0 8h-4c1-3 1-5 0-8Z"/>',
  };
  root.GAME_ICONS = shapes;
  root.gameIcon = (name) => `<svg class="gi gi-${name}" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">${shapes[name] || ''}</svg>`;
})(window);
