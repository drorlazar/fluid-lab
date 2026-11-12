// Shared 60fps Canvas Game Juice, VFX & Diegetic Visual Choreography Helpers

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'shard' | 'ring';
}

export interface FloatingPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  alpha: number;
  life: number;
}

export function spawnBurst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count = 28,
  speed = 9,
  shape: 'circle' | 'shard' = 'shard'
) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const spd = (0.35 + Math.random() * 0.85) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      size: 5 + Math.random() * 9,
      color,
      alpha: 1,
      life: 0,
      maxLife: 24 + Math.random() * 18,
      shape,
    });
  }
}

export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  popups: FloatingPopup[]
) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life++;
    p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.translate(p.x, p.y);
    if (p.shape === 'shard') {
      ctx.rotate(p.life * 0.18);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = popups.length - 1; i >= 0; i--) {
    const f = popups[i];
    f.y += f.vy;
    f.life++;
    f.alpha = Math.max(0, 1 - f.life / 48);
    if (f.life >= 48) {
      popups.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = f.alpha;
    drawStrokedText(ctx, f.text, f.x, f.y, 34 * f.scale, f.color, '#000', 8);
    ctx.restore();
  }
}

export function drawStrokedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke = '#000000',
  strokeW = 7,
  align: CanvasTextAlign = 'center'
) {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = `900 ${Math.round(size)}px "Lilita One", "Secular One", "Rubik", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawSkewedPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bgFill: string | CanvasGradient,
  borderColor = '#000000',
  borderW = 5,
  skew = -0.16,
  glowColor?: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, skew, 1, 0, 0);

  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
  }

  // Extruded drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 8, w, h);

  ctx.shadowBlur = 0;
  ctx.fillStyle = bgFill;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderW;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  // Specular top gloss rim
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 6);
  ctx.restore();
}

export function drawLaserBeam(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outerColor: string,
  coreColor = '#ffffff',
  width = 24
) {
  ctx.save();
  ctx.lineCap = 'round';

  // Outer glow
  ctx.strokeStyle = outerColor;
  ctx.shadowColor = outerColor;
  ctx.shadowBlur = 28;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Inner hot core
  ctx.strokeStyle = coreColor;
  ctx.shadowBlur = 10;
  ctx.lineWidth = width * 0.42;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws an animated diegetic Ghost Pointer / Visual Coach ("Show, don't tell")
 * moving between two points or pulsing on an interactive target.
 */
export function drawDiegeticCoachPointer(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  time: number,
  color = '#ffe600'
) {
  const t = (Math.sin(time * 3.2) + 1) * 0.5; // 0..1 smooth oscillation
  const cx = x1 + (x2 - x1) * t;
  const cy = y1 + (y2 - y1) * t;

  ctx.save();
  // Dashed glowing guide path
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 10]);
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pulsing target ring at current interpolated point
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = color;
  ctx.fillStyle = 'rgba(255, 230, 0, 0.25)';
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, 22 + Math.sin(time * 8) * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawStrokedText(ctx, '👆', cx + 10, cy + 12, 34, '#fff', '#000', 4);
  ctx.restore();
}
