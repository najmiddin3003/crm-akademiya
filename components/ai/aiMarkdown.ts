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
  | { kind: "ol"; start: number; items: Inline[][] };

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

export function parseAiMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;

  const closePara = () => {
    if (para && para.length) blocks.push({ kind: "p", lines: para });
    para = null;
  };

  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closePara();
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
