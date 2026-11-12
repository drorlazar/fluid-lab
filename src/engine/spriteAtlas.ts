// Runtime Sprite Atlas Loader & Flood-Fill Chroma-Key Extractor
// Slices 2x2 quadrant sprite sheets and strips the outer #FF00FF magenta background
// via edge flood-fill so interior magenta/pink glows remain 100% intact.

export type SpriteId =
  | 'ignis'
  | 'kirb'
  | 'viper'
  | 'mecharex'
  | 'tricera'
  | 'raptor'
  | 'dreadnought'
  | 'dracox';

export type BgId = 'lobby' | 'dino' | 'space' | 'dragon';

class AssetManager {
  private sprites = new Map<SpriteId, HTMLCanvasElement>();
  private bgs = new Map<BgId, HTMLImageElement>();
  private loadPromise: Promise<void> | null = null;
  public ready = false;

  public loadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    if (typeof window === 'undefined') return Promise.resolve();

    this.loadPromise = (async () => {
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      try {
        const [bgLobby, bgDino, bgSpace, bgDragon, sheetHeroes, sheetBosses] =
          await Promise.all([
            loadImg('./assets/bg-lobby.png'),
            loadImg('./assets/bg-dino-arena.png'),
            loadImg('./assets/bg-space-nebula.png'),
            loadImg('./assets/bg-dragon-canyon.png'),
            loadImg('./assets/sprites-sheet-heroes.png'),
            loadImg('./assets/sprites-sheet-bosses.png'),
          ]);

        this.bgs.set('lobby', bgLobby);
        this.bgs.set('dino', bgDino);
        this.bgs.set('space', bgSpace);
        this.bgs.set('dragon', bgDragon);

        // Extract 4 quadrants from heroes sheet
        this.sprites.set('ignis', this.extractQuadrant(sheetHeroes, 0, 0));
        this.sprites.set('kirb', this.extractQuadrant(sheetHeroes, 1, 0));
        this.sprites.set('viper', this.extractQuadrant(sheetHeroes, 0, 1));
        this.sprites.set('mecharex', this.extractQuadrant(sheetHeroes, 1, 1));

        // Extract 4 quadrants from bosses sheet
        this.sprites.set('tricera', this.extractQuadrant(sheetBosses, 0, 0));
        this.sprites.set('raptor', this.extractQuadrant(sheetBosses, 1, 0));
        this.sprites.set('dreadnought', this.extractQuadrant(sheetBosses, 0, 1));
        this.sprites.set('dracox', this.extractQuadrant(sheetBosses, 1, 1));

        this.ready = true;
      } catch (e) {
        console.warn('Asset preload warning:', e);
      }
    })();

    return this.loadPromise;
  }

  public getSprite(id: SpriteId): HTMLCanvasElement | undefined {
    return this.sprites.get(id);
  }

  public getBg(id: BgId): HTMLImageElement | undefined {
    return this.bgs.get(id);
  }

  private extractQuadrant(
    sheet: HTMLImageElement,
    qx: 0 | 1,
    qy: 0 | 1
  ): HTMLCanvasElement {
    const halfW = Math.floor(sheet.width / 2);
    const halfH = Math.floor(sheet.height / 2);
    // Inset by 8px to avoid the black dividing lines between quadrants
    const pad = 8;
    const w = halfW - pad * 2;
    const h = halfH - pad * 2;
    const sx = qx * halfW + pad;
    const sy = qy * halfH + pad;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(sheet, sx, sy, w, h, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const isChromaMagenta = (idx: number) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Pure/near magenta chroma background: high R & B, low G, and R+B >> 2*G
      return r > 155 && b > 155 && g < 115 && r + b - g * 2 > 140;
    };

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const p = y * w + x;
      if (visited[p]) return;
      const idx = p * 4;
      if (isChromaMagenta(idx)) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    // Seed flood-fill along all 4 edges of the quadrant
    for (let x = 0; x < w; x++) {
      enqueue(x, 0);
      enqueue(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      enqueue(0, y);
      enqueue(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const idx = p * 4;
      data[idx + 3] = 0; // Transparent!

      const x = p % w;
      const y = (p - x) / w;
      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }

    // Also strip any enclosed pure #FF00FF chroma pockets (e.g. between wings and torso)
    for (let p = 0; p < w * h; p++) {
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r > 210 && b > 210 && g < 55) {
        visited[p] = 1;
        data[idx + 3] = 0;
      }
    }

    // De-spill 1px fringe around removed background pixels
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (visited[p]) continue;
        if (
          visited[p - 1] ||
          visited[p + 1] ||
          visited[p - w] ||
          visited[p + w]
        ) {
          const idx = p * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          if (r > 130 && b > 130 && g < 110) {
            data[idx + 3] = 0;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }
}

export const assets = new AssetManager();
