"use client";

import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// LID CHEKI — avval ko'rib chiqish oynasi, keyin brauzerning bosma oynasi.
//
// Ikki sahifa bo'lishadi: Lidlar → Buyurtmalar ro'yxati (qatordagi "Chek
// chiqarish" tugmasi, 18.09.2026) va Lidlar → Birinchi darsga keladiganlar
// (qator menyusidagi "Chop etish"). Ilgari bu kod FirstLessonsPage ichida
// turardi; ikkinchi sahifa ham kerak bo'lgach shu yerga ko'chirildi —
// chek ko'rinishi (58mm, oq fon, chiziqli ajratgichlar) ikkalasida ham
// bir xil qolsin, farq faqat sarlavha va qatorlarda.
//
// Bosma usuli CashboxesPage.tsx dagi kirim cheki bilan bir xil: yashirin
// iframe ichiga tayyor HTML yoziladi va `print()` chaqiriladi. Alohida
// chek route'i kerak emas, sahifaning o'zi ham o'zgarmaydi.

/** Chekdagi bitta qator: [yorliq, qiymat]. */
export type ReceiptRow = [string, string];

export interface LeadReceipt {
  /** Bosma hujjat nomi (brauzer oynasi sarlavhasi / PDF fayl nomi). */
  docTitle: string;
  /** Chekning katta sarlavhasi, masalan "BIRINCHI DARSGA YOZILISH". */
  heading: string;
  rows: ReceiptRow[];
}

function escHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return s.replace(/[&<>"]/g, (c) => map[c]);
}

/** Yashirin iframe orqali bosmaga yuboradi. */
export function printLeadReceipt(r: LeadReceipt) {
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${escHtml(r.docTitle)}</title><style>
    @page{size:58mm auto;margin:3mm}
    /* Bosma DOIM oq fonda — sayt tungi rejimda bo'lsa ham. Sabab
       CashboxesPage.tsx dagi bilan bir xil: color-scheme:light
       brauzer/OS ning "majburiy tungi rejim"ini shu hujjatga qo'llashini
       to'xtatadi, aks holda qora siyoh qora fonda bosilardi. */
    html,body{margin:0;padding:0;background:#fff;color-scheme:light}
    body{font:11px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;display:flex;justify-content:center}
    .wrap{width:52mm}
    .brand{text-align:center;font-size:12px;font-weight:700;letter-spacing:.15em}
    .title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.05em;margin-top:8px}
    .divider{border-top:1px dashed #94a3b8;margin:8px 0}
    .r{display:flex;justify-content:space-between;gap:6px;padding:2px 0}
    .r span:first-child{color:#64748b}
    .r span:last-child{text-align:right;font-weight:500;word-break:break-word}
    .thanks{text-align:center;font-style:italic;color:#64748b;font-size:10px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <div class="wrap">
      <div class="brand">Akademiya CRM</div>
      <div class="title">${escHtml(r.heading)}</div>
      <div class="divider"></div>
      ${r.rows.map(([k, v]) => `<div class="r"><span>${escHtml(k)}</span><span>${escHtml(v)}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="thanks">Akademiya - ilm maskani!</div>
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
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
}

/**
 * Ko'rib chiqish oynasi — "Chek chiqarish"/"Chop etish" bosilganda AVVAL
 * shu chiqadi; foydalanuvchi ma'lumotni ko'rib "Chop etish" bosgandagina
 * brauzerning bosma oynasi ochiladi.
 */
export default function LeadReceiptModal({ receipt, onClose }: { receipt: LeadReceipt; onClose: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={300} panelClassName="p-5 space-y-4">
      <h3 className="text-lg font-semibold">{t("Chek — ko'rib chiqish")}</h3>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-center text-[13px] font-bold tracking-[0.15em]">{t("Akademiya CRM")}</div>
        <div className="mt-1 text-center text-sm font-bold">{t(receipt.heading)}</div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="max-h-72 overflow-y-auto">
          {receipt.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1 text-[13px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right font-medium break-words">{v}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="text-center text-xs italic text-muted-foreground">{t("Akademiya - ilm maskani!")}</div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={modal.close} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          {t("Bekor qilish")}
        </button>
        <button
          type="button"
          onClick={() => { printLeadReceipt(receipt); modal.close(); }}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
        >
          {t("Chop etish")}
        </button>
      </div>
    </Modal>
  );
}
