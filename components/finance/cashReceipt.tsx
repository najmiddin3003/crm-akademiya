"use client";

import { Printer } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { isStudentRefundEntry, type TransactionEntry } from "@/lib/transactionEntries";

// KASSA CHEKI — eski (CashboxesPage) va yangi (components/v2/finance) Kassalar
// sahifasi uchun bitta manba: ko'rib chiqish oynasi, bosma chek, sana yozuvi va
// «Oyligiga» izohi. CashboxesPage.tsx dan AYNAN ko'chirildi (18.10.2026).

function fmtNum(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function fmtSom(n: number): string {
  return fmtNum(n) + " so'm";
}

export function fmtEntryDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

function escHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  return s.replace(/[&<>"]/g, (c) => map[c]);
}

// Chek chiqarish — yashirin iframe ichida bosma sahifa yasab, brauzerning
// bosma oynasini ochadi. Alohida chek route'i kerak emas va sahifadagi
// holat (drawer, filtrlar) buzilmaydi.

/**
 * Chekdagi sarlavha va pastki satr — BOSMA va KO'RIB CHIQISH oynasi uchun
 * bitta manba. Ular ikki joyda yozilgan edi va shu bois vaqt o'tib
 * bir-biridan uzoqlashishi hech gap emasdi.
 */
const RECEIPT_BRAND = "Akademiya CRM";
const RECEIPT_FOOTER = "Akademiya - ilm maskani!";

// Yozuv o'qituvchi oyligiga QO'SHILADIMI yoki undan AYRILADIMI — JADVALDA
// shu farq ko'rinib turishi kerak (ustun ostidagi izoh sifatida).
//
// CHEKDA esa qisqa "Ustoz" yoziladi: yo'nalish chekning o'z sarlavhasidan
// ("KIRIM CHEKI" / "CHIQIM CHEKI") allaqachon ma'lum, va 52 mm enli termal
// qog'ozda uzun yorliq qiymatni ikkinchi qatorga tashlab yuborardi.
export function salaryTargetLabel(e: TransactionEntry): string {
  // O'quvchiga pul qaytarish: ayriladigani ustozning OYLIGI emas, shu
  // oydagi TUSHUMI (foizli oylik undan hisoblanadi — lib/studentRefund.ts).
  if (isStudentRefundEntry(e)) return "Ustozi tushumidan ayriladi";
  return e.txType === "payIn" ? "Ustoziga qo'shiladi" : "Oyligidan ayriladi";
}

export function printReceipt(e: TransactionEntry, cashboxName: string) {
  const title =
    e.txType === "payIn" ? "KIRIM CHEKI" :
    e.txType === "payOut" ? "CHIQIM CHEKI" :
    "KO'CHIRISH CHEKI";
  const rows: [string, string][] = [
    ["Chek №", String(e.id)],
    ["Sana", fmtEntryDate(e)],
    ["O'quvchi", e.studentName || e.moderator || "—"],
    ["Kassa", cashboxName || "—"],
    ["Tranzaksiya", e.txName || "—"],
    ["To'lov turi", e.paymentType],
  ];
  // Yozuv qaysi o'qituvchining oyligiga tegishli ekani.
  if (e.teacherName) rows.push(["Ustoz", e.teacherName]);
  if (e.note) rows.push(["Izoh", e.note]);
  // Tanga evaziga chegirma (gamifikatsiya, TZ 4.16.4) — «Jami» naqd bo'lib qoladi.
  if (e.discountSom) rows.push(["Chegirma (tanga)", `${fmtSom(e.discountSom)}${e.discountPercent ? ` · ${e.discountPercent}%` : ""}`]);

  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek #${e.id}</title><style>
    @page{size:58mm auto;margin:3mm}
    /* BOSMA HAR DOIM OQ FONDA — sayt tungi rejimda bo'lsa ham.
       Bu hujjat alohida iframe'da yasaladi, ya'ni ilovaning "dark"
       klassi bu yerga o'tmaydi. Baribir aniq yozib qo'yiladi: brauzer
       yoki OS "majburiy tungi rejim" da bo'lsa, fon o'zi qoraytirilib,
       qora siyoh qora fonda bosilardi. color-scheme:light aynan shu
       avtomatik qoraytirishni o'chiradi.
       DIQQAT: bu izoh template literal ICHIDA — teskari apostrof
       ishlatilmaydi, u satrni uzib yuboradi. */
    html,body{margin:0;padding:0;background:#fff;color-scheme:light}
    /* HAMMA MATN QORA. Termal printer faqat qora yoki oq bosadi —
       kulrangni nuqtalar bilan taqlid qiladi va natija yuvilgandek,
       hira chiqadi. Ilgari yorliqlar (#64748b), kassa nomi, "JAMI"
       yozuvi va ajratuvchi chiziqlar (#94a3b8) kulrang edi, ya'ni
       chekning yarmi hira bosilardi. Yorliq bilan qiymat endi RANG
       bilan emas, QALINLIK bilan ajraladi. */
    body{font:11px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#000;display:flex;justify-content:center}
    .wrap{width:52mm}
    .brand{text-align:center;font-size:12px;font-weight:700;letter-spacing:.15em}
    .sub{text-align:center;font-size:10px;margin-top:1px}
    .title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.05em;margin-top:8px}
    /* Uzuq chiziq ham qora: ochiq kulrang chiziq termal qog'ozda deyarli
       ko'rinmasdi. */
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
      <div class="brand">${escHtml(RECEIPT_BRAND)}</div>
      <div class="sub">${escHtml(cashboxName)}</div>
      <div class="title">${title}</div>
      <div class="divider"></div>
      ${rows.map(([k, v]) => `<div class="r"><span>${escHtml(k)}</span><span>${escHtml(v)}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="total"><span class="lbl">Jami</span><span class="val">${fmtSom(Math.abs(e.amount))}</span></div>
      <div class="divider"></div>
      <div class="thanks">${escHtml(RECEIPT_FOOTER)}</div>
    </div>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
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

// Chek chiqarish tugmasi bosilganda avval shu ko'rinishdagi ("kirim cheki"
// referens skrinshoti) modal chiqadi — foydalanuvchi mazmunni ko'rib "Chop
// etish" bosgandagina brauzerning haqiqiy bosma oynasi ochiladi.
export function ReceiptPreviewModal({
  entry,
  cashboxName,
  onClose,
  onPrint,
}: {
  entry: TransactionEntry;
  cashboxName: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const title =
    entry.txType === "payIn"
      ? "KIRIM CHEKI"
      : entry.txType === "payOut"
        ? t("CHIQIM CHEKI")
        : t("KO'CHIRISH CHEKI");
  const rows: [string, string][] = [
    ["Sana", fmtEntryDate(entry)],
    ["O'quvchi", entry.studentName || entry.moderator || "—"],
    ["Kassa", cashboxName || "—"],
    ["Tranzaksiya", entry.txName || "—"],
    ["To'lov turi", entry.paymentType],
  ];
  if (entry.teacherName) rows.push(["Ustoz", entry.teacherName]);
  if (entry.note) rows.push(["Izoh", entry.note]);
  // Tanga evaziga chegirma — bosma chek bilan bir xil qator.
  if (entry.discountSom) rows.push([t("Chegirma (tanga)"), `${t(fmtSom(entry.discountSom))}${entry.discountPercent ? ` · ${entry.discountPercent}%` : ""}`]);

  return (
    <Modal onClose={onClose} controller={modal} bare size="xs" zIndex={130} panelStyle={{ background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
        <div className="px-6 pt-6 pb-4">
          <div className="text-center text-[13px] font-bold tracking-[0.15em]">
            {RECEIPT_BRAND}
          </div>
          <div className="text-center text-[12px] mt-0.5" style={{ color: "#64748b" }}>
            {cashboxName}
          </div>
          <div className="text-center text-[15px] font-bold mt-3 tracking-wide">
            {title}
          </div>
          <div className="my-3 border-t border-dashed" style={{ borderColor: "#cbd5e1" }} />
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <span style={{ color: "#64748b" }}>{t("Chek №")}</span>
              <span className="font-medium tabular-nums">{entry.id}</span>
            </div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span style={{ color: "#64748b" }}>{k}</span>
                <span className="text-right font-medium break-words">{v}</span>
              </div>
            ))}
          </div>
          <div className="my-3 border-t border-dashed" style={{ borderColor: "#cbd5e1" }} />
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] italic" style={{ color: "#64748b" }}>
              {t("Jami")}
            </span>
            <span className="text-[18px] font-bold tabular-nums">
              {t(fmtSom(Math.abs(entry.amount)))}
            </span>
          </div>
          <div className="my-3 border-t border-dashed" style={{ borderColor: "#cbd5e1" }} />
          <div className="text-center text-[12px] italic" style={{ color: "#64748b" }}>
            {RECEIPT_FOOTER}
          </div>
        </div>
        {/* Tugmalar qatori ham oq qog'ozga MOS qilib qoldirildi: mavzu
            tokenlarida qolsa, tungi rejimda oq chekning ostiga qop-qora
            tasma yopishib turardi. */}
        <div
          className="flex gap-2 px-4 py-3"
          style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <button
            onClick={modal.close}
            className="h-9 flex-1 rounded-lg text-sm font-medium"
            style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
          >
            {t("Yopish")}
          </button>
          {/* "Chop etish" — brend rangida qolaveradi: u ikkala mavzuda
              ham oq matn bilan yetarli kontrast beradi. */}
          <button
            onClick={onPrint}
            className="h-9 flex-1 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            {t("Chop etish")}
          </button>
        </div>
      </Modal>
  );
}
