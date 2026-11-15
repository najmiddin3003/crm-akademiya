"use client";

// O'QUVCHI KABINETI (v2) — TO'LOV CHEKI: bosma (iframe) va rasm (PNG).
//
// Xodimlar cheki (components/finance/cashReceipt.tsx → printReceipt) bilan BIR XIL
// uslub: 58 mm termal qog'ozga mos, hamma matn qora, sarlavha/logotip/pastki matn
// «Sozlamalar → Markaz ma'lumotlari → Chek» dan. Uni to'g'ridan-to'g'ri chaqirmaymiz:
// u `TransactionEntry` kutadi va «Tranzaksiya», «Ustoz», «Izoh» kabi ICHKI qatorlarni
// bosadi — o'quvchiga esa «Qaysi oy uchun» kerak, ichki maydonlar emas.
//
// Ko'rinish (ReceiptDialogV2), bosma va rasm — bitta `StudentReceiptModel` dan:
// qatorlar bir marta (joriy tilda) yasaladi, uch joyda bir xil chiqadi.
//
// TELEGRAM: Mini App ichida `window.print()` ko'pincha hech narsa qilmaydi (Android
// WebView, iOS) — shu sabab «Rasm sifatida saqlash»: chek <canvas> da chiziladi
// (kutubxonasiz), telefonda ulashish oynasi (Web Share), kompyuterda yuklab olish.

export interface StudentReceiptModel {
  /** Logotip manzili (sozlamada yoqilgan va markazda logotip bo'lsa), aks holda null. */
  logo: string | null;
  /** Chek sarlavhasi — markaz nomi. */
  brand: string;
  /** Filial manzili va telefoni. */
  branchLines: string[];
  /** «TO'LOV CHEKI» / «QAYTARISH CHEKI». */
  heading: string;
  /** Bekor qilingan to'lov — chek ustida qizil belgi; aks holda null. */
  stamp: string | null;
  rows: [string, string][];
  totalLabel: string;
  /** «150 000 so'm» */
  total: string;
  footer: string;
  /** Hujjat sarlavhasi («Chek #5106»). */
  docTitle: string;
  /** Rasm fayli nomi («chek-5106.png»). */
  fileName: string;
}

function escHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return s.replace(/[&<>"]/g, (c) => map[c]);
}

function absUrl(src: string): string {
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

/** Bosma chek — yashirin iframe'da sahifa yasab, brauzerning bosma oynasini ochadi («PDF sifatida saqlash» ham shu yerda). */
export function printStudentReceipt(m: StudentReceiptModel): void {
  const logo = m.logo ? absUrl(m.logo) : null;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(m.docTitle)}</title><style>
    @page{size:58mm auto;margin:3mm}
    html,body{margin:0;padding:0;background:#fff;color-scheme:light}
    body{font:11px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#000;display:flex;justify-content:center}
    .wrap{width:52mm}
    .logo{display:block;margin:0 auto 4px;max-width:36mm;max-height:14mm;filter:brightness(0)}
    .brand{text-align:center;font-size:12px;font-weight:700;letter-spacing:.05em}
    .sub{text-align:center;font-size:10px;margin-top:1px}
    .title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.05em;margin-top:8px}
    .stamp{text-align:center;font-size:12px;font-weight:700;letter-spacing:.08em;margin-top:4px;border:1.5px solid #000;padding:2px 0}
    .divider{border-top:1px dashed #000;margin:8px 0}
    .r{display:flex;justify-content:space-between;gap:6px;padding:2px 0}
    .r span:last-child{text-align:right;font-weight:700;word-break:break-word}
    .total{display:flex;justify-content:space-between;align-items:baseline}
    .total .lbl{font-size:11px;font-style:italic}
    .total .val{font-size:15px;font-weight:700}
    .thanks{text-align:center;font-style:italic;font-size:10px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <div class="wrap">
      ${logo ? `<img class="logo" src="${escHtml(logo)}" alt="">` : ""}
      <div class="brand">${escHtml(m.brand)}</div>
      ${m.branchLines.map((l) => `<div class="sub">${escHtml(l)}</div>`).join("")}
      <div class="title">${escHtml(m.heading)}</div>
      ${m.stamp ? `<div class="stamp">${escHtml(m.stamp)}</div>` : ""}
      <div class="divider"></div>
      ${m.rows.map(([k, v]) => `<div class="r"><span>${escHtml(k)}</span><span>${escHtml(v)}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="total"><span class="lbl">${escHtml(m.totalLabel)}</span><span class="val">${escHtml(m.total)}</span></div>
      ${m.footer ? `<div class="divider"></div><div class="thanks">${escHtml(m.footer)}</div>` : ""}
    </div>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  // Logotip yuklanib bo'lgach (aks holda bo'sh joy chiqadi); yuklanmasa — 2 s dan keyin baribir.
  const img = doc.querySelector("img");
  if (img && !img.complete) {
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      go();
    };
    img.addEventListener("load", once);
    img.addEventListener("error", once);
    window.setTimeout(once, 2000);
  } else {
    go();
  }
}

// ── Rasm (PNG) ───────────────────────────────────────────────────────────────

const FAMILY = '"Onest Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const W = 360;
const PAD = 24;
const INK = "#0E1726";
const MUTED = "#4A5565";
const RED = "#C13A2F";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const fin = (v: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    img.onload = () => fin(img);
    img.onerror = () => fin(null);
    window.setTimeout(() => fin(null), 2500);
    img.src = src;
  });
}

/** Logotipni QORA qilib (bosmadagi `brightness(0)` bilan bir xil) alohida kanvasda tayyorlaydi; boshqa domendan bo'lsa — null. */
async function blackLogo(src: string, scale: number): Promise<{ canvas: HTMLCanvasElement; w: number; h: number } | null> {
  const img = await loadImage(absUrl(src));
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const maxW = 150;
  const maxH = 44;
  const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const cx = c.getContext("2d");
  if (!cx) return null;
  try {
    cx.drawImage(img, 0, 0, c.width, c.height);
    const data = cx.getImageData(0, 0, c.width, c.height); // boshqa domen rasmi — shu yerda xato (kanvas «bulg'angan»)
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 0;
      data.data[i + 1] = 0;
      data.data[i + 2] = 0;
    }
    cx.putImageData(data, 0, 0);
    return { canvas: c, w, h };
  } catch {
    return null;
  }
}

function wrapText(cx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Chekni PNG qilib chizadi (oq qog'oz, 360 px eni × 3 zichlik). */
export async function receiptToPng(m: StudentReceiptModel): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
  } catch {
    /* shriftsiz ham chiziladi */
  }
  const scale = 3;
  const logo = m.logo ? await blackLogo(m.logo, scale) : null;

  // Balandlik oldindan noma'lum — katta kanvasda chizib, keyin kesiladi.
  const tall = document.createElement("canvas");
  tall.width = W * scale;
  tall.height = 1600 * scale;
  const cx = tall.getContext("2d");
  if (!cx) return null;
  cx.scale(scale, scale);
  cx.fillStyle = "#FFFFFF";
  cx.fillRect(0, 0, W, 1600);
  cx.textBaseline = "alphabetic";

  const inner = W - PAD * 2;
  let y = PAD;

  const center = (text: string, font: string, color: string, lh: number) => {
    cx.font = font;
    cx.fillStyle = color;
    cx.textAlign = "center";
    for (const line of wrapText(cx, text, inner)) {
      y += lh;
      cx.fillText(line, W / 2, y - lh * 0.28);
    }
  };
  const dashed = () => {
    y += 10;
    cx.save();
    cx.strokeStyle = "#8A939F";
    cx.lineWidth = 1;
    cx.setLineDash([4, 3]);
    cx.beginPath();
    cx.moveTo(PAD, y + 0.5);
    cx.lineTo(W - PAD, y + 0.5);
    cx.stroke();
    cx.restore();
    y += 10;
  };

  if (logo) {
    cx.drawImage(logo.canvas, (W - logo.w) / 2, y, logo.w, logo.h);
    y += logo.h + 6;
  }
  center(m.brand, `700 15px ${FAMILY}`, INK, 21);
  for (const l of m.branchLines) center(l, `400 12px ${FAMILY}`, MUTED, 17);
  y += 8;
  center(m.heading, `700 16px ${FAMILY}`, INK, 22);
  if (m.stamp) {
    y += 4;
    cx.font = `700 13px ${FAMILY}`;
    const sw = cx.measureText(m.stamp).width + 20;
    cx.strokeStyle = RED;
    cx.lineWidth = 1.5;
    cx.strokeRect((W - sw) / 2, y, sw, 22);
    cx.fillStyle = RED;
    cx.textAlign = "center";
    cx.fillText(m.stamp, W / 2, y + 15.5);
    y += 26;
  }
  dashed();

  const LH = 19;
  for (const [k, v] of m.rows) {
    cx.font = `400 13px ${FAMILY}`;
    const labelW = Math.min(cx.measureText(k).width, inner * 0.5);
    const labelLines = wrapText(cx, k, inner * 0.5);
    cx.font = `600 13px ${FAMILY}`;
    const valueLines = wrapText(cx, v, inner - labelW - 12);
    const n = Math.max(labelLines.length, valueLines.length);
    cx.font = `400 13px ${FAMILY}`;
    cx.fillStyle = MUTED;
    cx.textAlign = "left";
    labelLines.forEach((line, i) => cx.fillText(line, PAD, y + LH * (i + 1) - 5));
    cx.font = `600 13px ${FAMILY}`;
    cx.fillStyle = INK;
    cx.textAlign = "right";
    valueLines.forEach((line, i) => cx.fillText(line, W - PAD, y + LH * (i + 1) - 5));
    y += LH * n + 2;
  }
  dashed();

  cx.font = `italic 400 13px ${FAMILY}`;
  cx.fillStyle = MUTED;
  cx.textAlign = "left";
  cx.fillText(m.totalLabel, PAD, y + 20);
  cx.font = `700 20px ${FAMILY}`;
  cx.fillStyle = INK;
  cx.textAlign = "right";
  cx.fillText(m.total, W - PAD, y + 21);
  y += 28;

  if (m.footer) {
    dashed();
    center(m.footer, `italic 400 12px ${FAMILY}`, MUTED, 17);
  }
  y += PAD;

  const out = document.createElement("canvas");
  out.width = W * scale;
  out.height = Math.ceil(y * scale);
  const ox = out.getContext("2d");
  if (!ox) return null;
  ox.drawImage(tall, 0, 0);
  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png"));
}

export type SaveImageResult = "shared" | "downloaded" | "failed";

/**
 * Chekni rasm qilib saqlaydi: telefonda (barmoq bilan boshqariladigan ekran) —
 * ulashish oynasi («Rasmni saqlash», Telegram'ga yuborish); kompyuterda yoki
 * ulashish bo'lmasa — fayl yuklab olinadi.
 */
export async function saveReceiptImage(m: StudentReceiptModel): Promise<SaveImageResult> {
  const blob = await receiptToPng(m);
  if (!blob) return "failed";
  const file = new File([blob], m.fileName, { type: "image/png" });
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: m.docTitle });
      return "shared";
    } catch (e) {
      // Foydalanuvchi ulashish oynasini o'zi yopdi — xato emas.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = m.fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
