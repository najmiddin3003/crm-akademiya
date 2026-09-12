// Tug'ilgan kun qog'ozlari — kutubxonasiz, bitta canvas (faqat brauzerda).
// Barmoq sinovida "siz tezkorsiz" va "yangi server yutdi" lahzalarida.
// Sichqonchani to'smaydi (pointer-events yo'q), ~3 soniyada o'zi yo'qoladi;
// `prefers-reduced-motion` yoqilgan bo'lsa umuman chizilmaydi.

const COLORS = ["#2F6BFF", "#0A8B99", "#F59E0B", "#EF4444", "#22C55E", "#A855F7", "#EC4899", "#FACC15"];

interface Piece {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; rot: number; vr: number;
  color: string; sway: number; phase: number;
}

let active: (() => void) | null = null;

export function burstConfetti(count = 160, durationMs = 3200): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  active?.(); // oldingisi tugamagan bo'lsa — almashtiriladi

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "3000" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = Array.from({ length: count }, () => {
    const size = 6 + Math.random() * 7;
    return {
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.4,
      w: size,
      h: size * (0.5 + Math.random() * 0.7),
      vx: (Math.random() - 0.5) * 2,
      vy: 2.2 + Math.random() * 2.8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      sway: 0.6 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    };
  });

  const start = performance.now();
  let raf = 0;
  const stop = () => { cancelAnimationFrame(raf); canvas.remove(); if (active === stop) active = null; };
  active = stop;

  const frame = (now: number) => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    // Oxirgi 0,6 soniyada so'nadi
    const fade = Math.max(0, Math.min(1, (durationMs / 1000 - t) / 0.6));
    ctx.globalAlpha = fade;
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx + Math.sin(t * 3 + p.phase) * p.sway;
      p.y += p.vy;
      p.vy += 0.02;
      p.rot += p.vr;
      if (p.y < H + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (!alive || t * 1000 > durationMs) { stop(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
