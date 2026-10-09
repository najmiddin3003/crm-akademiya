// AI JAVOBI MATNINI TAHLIL QILISH — juda kichik markdown qismi.
//
// NEGA KUTUBXONA EMAS: kerakli qism tor — paragraf, ro'yxat, **qalin**,
// `kod` va havola. To'liq markdown kutubxonasi HTML ham qabul qiladi va
// uni `dangerouslySetInnerHTML` bilan chizish modelning (yoki vosita
// natijasidagi o'quvchi izohining) matnini sahifaga HTML bo'lib tushirish
// degani. Bu yerda natija oddiy daraxt — React uni matn sifatida chizadi.
//
// HAVOLALAR FAQAT CRM ICHIDA: `/finance-cash` kabi nisbiy yo'l. Tashqi
// manzil havola bo'lmaydi, faqat matni qoladi — begona saytga olib
// boradigan havola (masalan, o'quvchi izohiga yozib qo'yilgan) panelda
// bosiladigan bo'lmasin.
//
// Fayl HECH NARSA import qilmaydi — sinov skripti uni bazasiz tekshiradi.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "p"; lines: Inline[][] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "ol"; start: number; items: Inline[][] }
  /** Jadval (5-bosqich) — kataklar XOM matn: chizishda parseInline, CSV'da plainText. */
  | { kind: "table"; header: string[]; rows: string[][] };

/** Faqat ilova ichidagi nisbiy yo'l: "/..." (lekin "//host" emas). */
export function isInternalHref(href: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\-._~%/?=&#]*$/.test(href);
}

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: src.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else if (m[3] !== undefined) {
      const href = m[4] ?? "";
      out.push(isInternalHref(href) ? { kind: "link", text: m[3], href } : { kind: "text", text: m[3] });
    }
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
/** Jadval ajratkichi: "| --- | :---: |" (chetidagi chiziqlar ixtiyoriy). */
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const MAX_TABLE_ROWS = 300;

/** "| a | b |" → ["a", "b"]; `\|` — katak ichidagi chiziq. */
export function tableCells(line: string): string[] {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += s[i];
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** Katak matni — belgilarsiz (CSV va qidiruv uchun). */
export function plainText(src: string): string {
  return parseInline(src)
    .map((p) => p.text)
    .join("");
}

/**
 * CSV — Excel'da to'g'ri ochilsin: UTF-8 BOM (apostrof va kirill harflar),
 * ajratkich ";" (rus/o'zbek Excel'i vergulni ustun deb tanimaydi).
 */
export function tableCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const esc = (s: string) => (/[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const line = (cells: readonly string[]) => cells.map((c) => esc(plainText(c))).join(";");
  return `﻿${[line(header), ...rows.map(line)].join("\r\n")}`;
}

export function parseAiMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;

  const closePara = () => {
    if (para && para.length) blocks.push({ kind: "p", lines: para });
    para = null;
  };

  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      closePara();
      continue;
    }
    // Jadval: sarlavha qatori + ajratkich, keyin "|" li qatorlar.
    if (line.includes("|") && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      closePara();
      const header = tableCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        if (rows.length < MAX_TABLE_ROWS) {
          const cells = tableCells(lines[i]);
          // Qator sarlavhadan qisqa/uzun bo'lsa — sarlavha kengligiga keltiriladi.
          rows.push(header.map((_, k) => cells[k] ?? ""));
        }
        i++;
      }
      i--; // tsikl o'zi oshiradi
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const ul = UL.exec(line);
    const ol = ul ? null : OL.exec(line);
    if (ul || ol) {
      closePara();
      const prev = blocks[blocks.length - 1];
      if (ul) {
        if (prev?.kind === "ul") prev.items.push(parseInline(ul[1]));
        else blocks.push({ kind: "ul", items: [parseInline(ul[1])] });
      } else if (ol) {
        if (prev?.kind === "ol") prev.items.push(parseInline(ol[2]));
        else blocks.push({ kind: "ol", start: Number(ol[1]) || 1, items: [parseInline(ol[2])] });
      }
      continue;
    }
    // Sarlavha — ko'rsatmada taqiqlangan, lekin kelsa qalin qator bo'ladi.
    const h = HEADING.exec(line);
    const inline = h ? [{ kind: "bold" as const, text: h[1].replace(/\*\*/g, "") }] : parseInline(line.trim());
    (para ??= []).push(inline);
  }
  closePara();
  return blocks;
}
