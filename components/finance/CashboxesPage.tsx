"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheckBig,
  CircleX,
  Crown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, {
  type DateRange,
} from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import CashboxDrawer from "./CashboxDrawer";
import CashboxTransferDrawer from "./CashboxTransferDrawer";
import CashboxTransferToDrawer from "./CashboxTransferToDrawer";
import CashboxAdjustDrawer from "./CashboxAdjustDrawer";
import CashboxKirimDrawer from "./CashboxKirimDrawer";
import CashboxDividendDrawer from "./CashboxDividendDrawer";
import CashboxInvestmentDrawer from "./CashboxInvestmentDrawer";
import TransactionDetailDrawer from "./TransactionDetailDrawer";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useTeachers } from "@/hooks/useTeachers";
import { useTransactionTypes } from "@/hooks/useTransactionTypes";
import { useBranch } from "@/components/shared/BranchContext";
import { type Cashbox } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { toUz } from "@/lib/uzTime";

const TX_TYPE_MAP: Record<string, string> = {
  kirim: "payIn",
  chiqim: "payOut",
  kochirish: "transfer",
};
const TX_TYPE_LABELS: Record<string, string> = {
  payIn: "Kirim",
  payOut: "Chiqim",
  transfer: "Ko'chirish",
};

// Moliya â Kassalar (sidebar: Moliya > Kassalar, href /finance-cash).
//
// Dizayn referensi: chapda gradient kassa kartalari (tanlangani va bosh
// kassa â to'q ko'k, qolganlari â och ko'k), tanlangan kartaning ICHIDA
// Kirim/Chiqim/Ko'chirish tugmalari, to'lov turlari bo'yicha qoldiq va
// tahrirlash / asosiy qilish / hisobot yuklab olish satri. O'ngda ikki
// qatorli filtrlar + tranzaksiyalar jadvali.
//
// Barcha amallar HAQIQIY (MongoDB): kassa qo'shish/tahrirlash, Kirim/Chiqim
// (/api/cashboxes/:id/adjust â balans ham o'zgaradi), to'lov turlari orasida
// (transfer) va kassalar orasida (transfer-to) ko'chirish. Har bir amal
// `transaction_entries` kolleksiyasiga yozuv qo'shadi â shu jadval,
// "Tranzaksiyalar" va "Moliya hisobotlari/analitikasi" sahifalari BIR XIL
// manbadan (lib/transactionLog.ts) foydalanadi.
//
// Kartadagi mas'ul (moderator) ismi va jadvaldagi "Kim" ustuni profil
// sahifalariga (/management-xodimlar/[id], /student-edit/[id]) o'tadi.

// Karta foni endi SHU YERDA emas â `.fc-card-dark` / `.fc-card-light`
// klasslarida, globals.css da. Ranglar "BREND PALITRASI" blokidan keladi,
// ya'ni brend almashtirilganda bu katta kartochka ham u bilan birga
// o'zgaradi.
//
// NEGA inline style EMAS: gradientni inline `style` ichida
// `hsl(var(--brand-card-...))` deb yozib ko'rilgandi va u ISHLAMADI â
// o'zgaruvchilar CSS ichida hech qayerda ishlatilmagani uchun qurish
// bosqichida "keraksiz" deb tashlab yuborilgan, natijada kartochka
// fonsiz qolgan edi. CSS klassida ishlatilsa, ular saqlanadi.

// To'lov turi yonidagi rangli nuqta. Kalitlar Sozlamalar â Moliya â To'lov
// turlaridan keladi; ro'yxatga yangi tur qo'shilsa, u zaxira palitradan rang
// oladi (rang faqat bezak â hisob-kitobga ta'sir qilmaydi).
const METHOD_DOT: Record<string, string> = {
  naqd: "#34d399",
  inkassa: "#fbbf24",
  terminal: "#38bdf8",
  plastik: "#c4b5fd",
  korporativKarta: "#94a3b8",
  ilovaClick: "#7dd3fc",
  yagonaQr: "#f472b6",
  hisobRaqam: "#a3e635",
};
const DOT_FALLBACK = [
  "#34d399",
  "#fbbf24",
  "#38bdf8",
  "#c4b5fd",
  "#94a3b8",
  "#7dd3fc",
  "#f472b6",
  "#a3e635",
];
function methodDot(key: string, i: number): string {
  return METHOD_DOT[key] ?? DOT_FALLBACK[i % DOT_FALLBACK.length];
}

const METHOD_ORDER_KEY = "financeCashMethodOrder";

// Foydalanuvchi tanlagan to'lov turlari tartibi (localStorage). Ro'yxatga
// solishtirish render vaqtida bo'ladi â to'lov turlari Sozlamalardan
// asinxron kelgani uchun bu yerda faqat xom massiv o'qiladi.
function readSavedOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(METHOD_ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const selectCls =
  "h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function fmtNum(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function fmtSom(n: number): string {
  return fmtNum(n) + " so'm";
}
function fmtEntryDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayRange(): DateRange {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start };
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

// Chek chiqarish â yashirin iframe ichida bosma sahifa yasab, brauzerning
// bosma oynasini ochadi. Alohida chek route'i kerak emas va sahifadagi
// holat (drawer, filtrlar) buzilmaydi.

/**
 * Chekdagi sarlavha va pastki satr â BOSMA va KO'RIB CHIQISH oynasi uchun
 * bitta manba. Ular ikki joyda yozilgan edi va shu bois vaqt o'tib
 * bir-biridan uzoqlashishi hech gap emasdi.
 */
const RECEIPT_BRAND = "Akademiya CRM";
const RECEIPT_FOOTER = "Akademiya - ilm maskani!";

// Yozuv o'qituvchi oyligiga QO'SHILADIMI yoki undan AYRILADIMI â JADVALDA
// shu farq ko'rinib turishi kerak (ustun ostidagi izoh sifatida).
//
// CHEKDA esa qisqa "Ustoz" yoziladi: yo'nalish chekning o'z sarlavhasidan
// ("KIRIM CHEKI" / "CHIQIM CHEKI") allaqachon ma'lum, va 52 mm enli termal
// qog'ozda uzun yorliq qiymatni ikkinchi qatorga tashlab yuborardi.
function salaryTargetLabel(e: TransactionEntry): string {
  return e.txType === "payIn" ? "Ustoziga qo'shiladi" : "Oyligidan ayriladi";
}

function printReceipt(e: TransactionEntry, cashboxName: string) {
  const title =
    e.txType === "payIn" ? "KIRIM CHEKI" :
    e.txType === "payOut" ? "CHIQIM CHEKI" :
    "KO'CHIRISH CHEKI";
  const rows: [string, string][] = [
    ["Chek â", String(e.id)],
    ["Sana", fmtEntryDate(e)],
    ["O'quvchi", e.studentName || e.moderator || "â"],
    ["Kassa", cashboxName || "â"],
    ["Tranzaksiya", e.txName || "â"],
    ["To'lov turi", e.paymentType],
  ];
  // Yozuv qaysi o'qituvchining oyligiga tegishli ekani.
  if (e.teacherName) rows.push(["Ustoz", e.teacherName]);
  if (e.note) rows.push(["Izoh", e.note]);

  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek #${e.id}</title><style>
    @page{size:58mm auto;margin:3mm}
    /* BOSMA HAR DOIM OQ FONDA â sayt tungi rejimda bo'lsa ham.
       Bu hujjat alohida iframe'da yasaladi, ya'ni ilovaning "dark"
       klassi bu yerga o'tmaydi. Baribir aniq yozib qo'yiladi: brauzer
       yoki OS "majburiy tungi rejim" da bo'lsa, fon o'zi qoraytirilib,
       qora siyoh qora fonda bosilardi. color-scheme:light aynan shu
       avtomatik qoraytirishni o'chiradi.
       DIQQAT: bu izoh template literal ICHIDA â teskari apostrof
       ishlatilmaydi, u satrni uzib yuboradi. */
    html,body{margin:0;padding:0;background:#fff;color-scheme:light}
    /* HAMMA MATN QORA. Termal printer faqat qora yoki oq bosadi â
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
// referens skrinshoti) modal chiqadi â foydalanuvchi mazmunni ko'rib "Chop
// etish" bosgandagina brauzerning haqiqiy bosma oynasi ochiladi.
function ReceiptPreviewModal({
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
  useEscapeClose(onClose);
  const title =
    entry.txType === "payIn"
      ? "KIRIM CHEKI"
      : entry.txType === "payOut"
        ? "CHIQIM CHEKI"
        : "KO'CHIRISH CHEKI";
  const rows: [string, string][] = [
    ["Sana", fmtEntryDate(entry)],
    ["O'quvchi", entry.studentName || entry.moderator || "â"],
    ["Kassa", cashboxName || "â"],
    ["Tranzaksiya", entry.txName || "â"],
    ["To'lov turi", entry.paymentType],
  ];
  if (entry.teacherName) rows.push(["Ustoz", entry.teacherName]);
  if (entry.note) rows.push(["Izoh", entry.note]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* CHEK QOG'OZI DOIM OQ â MAVZUGA ERGASHMAYDI.
          NIMA NOTO'G'RI EDI: karta `bg-white` bilan qattiq oq edi, matn
          esa mavzu tokenlaridan kelardi. Tungi rejimda o'lchandi: fon
          rgb(255,255,255), matn rgb(250,250,250) â ya'ni oq qog'ozda oq
          siyoh, qiymatlarni umuman o'qib bo'lmasdi; yorliqlar esa
          rgb(155,162,176) bo'lib yuvilib ketardi.
          Bu oyna â bosiladigan QOG'OZNING ko'rinishi, ekran elementi emas.
          Qog'oz oq, siyoh qora; shu bois ranglar shu yerda aniq yozilgan
          va `printReceipt` dagi bosma uslubi bilan bir xil. */}
      <div
        className="relative w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}
      >
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
              <span style={{ color: "#64748b" }}>Chek â</span>
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
              Jami
            </span>
            <span className="text-[18px] font-bold tabular-nums">
              {fmtSom(Math.abs(entry.amount))}
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
            onClick={onClose}
            className="h-9 flex-1 rounded-lg text-sm font-medium"
            style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
          >
            Yopish
          </button>
          {/* "Chop etish" â brend rangida qolaveradi: u ikkala mavzuda
              ham oq matn bilan yetarli kontrast beradi. */}
          <button
            onClick={onPrint}
            className="h-9 flex-1 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}

// "O'quvchini qidiring..." / "O'qituvchini qidiring..." â yozib qidiriladigan
// filtr. Qiymat erkin matn (qismiy moslik bo'yicha filtrlaydi), ro'yxatdan
// tanlansa to'liq ism qo'yiladi.
function SearchFilter({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const q = value.trim().toLowerCase();
  const list = options
    .filter((o) => !q || o.toLowerCase().includes(q))
    .slice(0, 40);

  return (
    <div className="relative flex-1 min-w-[150px]" ref={ref}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full h-10 rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          title="Tozalash"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
        >
          Ã
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {list.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-muted-foreground text-center">
              Topilmadi
            </div>
          ) : (
            list.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-secondary text-[13px] truncate"
              >
                {o}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Jadvaldagi "Holati" ustuni. Manbadagi qiymatlar: "" (qabul qilindi),
// "waiting" (kutilmoqda), "cancelled" (bekor qilingan). Miqdor tahrirlangan
// bo'lsa "Tahrirlangan" belgisi qo'shiladi â ustiga bosilganda tahrirlar
// tarixi ochiladi. "Qabul qilindi" faqat tahrirlanmagan holatda ko'rinadi â
// tahrirlangan bo'lsa uning o'rnini "Tahrirlangan" egallaydi (bekor
// qilingan holatda esa ikkalasi birga: "Bekor qilingan" + "Tahrirlangan").
//
// CHIQIMDA MATN BOSHQA: kassadan pul chiqarilganda "Qabul qilindi" noto'g'ri
// o'qiladi â kassa hech narsa qabul qilmagan, aksincha to'lab bergan.
// Shuning uchun payOut yozuvida jigarrang fonli qizil "To'landi" chiqadi;
// kirim va ko'chirishda esa avvalgidek yashil "Qabul qilindi" qoladi.
function StatusCell({
  entry,
  onShowHistory,
  onDecide,
  deciding,
}: {
  entry: TransactionEntry;
  onShowHistory: () => void;
  /** â / Ã bosilganda. Faqat kassalararo ko'chirmaning KELUVCHI qatorida. */
  onDecide: (decision: "confirm" | "reject") => void;
  /** So'rov ketayotgan payt â ikkala tugma ham o'chiriladi. */
  deciding: boolean;
}) {
  const status = entry.status;
  const edited = Array.isArray(entry.editHistory) && entry.editHistory.length > 0;
  // Qaror faqat pul KELAYOTGAN qatorda qabul qilinadi. Eski (edutizimdan
  // kelgan) "waiting" yozuvlarda `transferRole` yo'q â ularda tugmalar
  // chizilmaydi, chunki juftlik bog'lanmagan va pulni qayerga qo'yishni
  // aniqlab bo'lmaydi (server ham bunday so'rovni rad etadi).
  const canDecide = entry.txType === "transfer" && entry.transferRole === "in";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status === "cancelled" ? (
        <span className="inline-flex items-center gap-1 text-[13px] text-rose-500 font-medium">
          <CircleX className="w-3.5 h-3.5" /> Bekor qilingan
        </span>
      ) : status === "waiting" ? (
        // Ã va â â HAQIQIY tugmalar. Ilgari ikkalasi ham oddiy <span> edi,
        // ya'ni "Kutilmoqda" holatidan chiqishning hech qanday yo'li yo'q edi.
        //
        // `stopPropagation` SHART: qatorning o'zida `onClick` bor va u
        // tafsilot oynasini ochadi (shu fayldagi "Tahrirlangan" tugmasi va
        // chek tugmasi ham xuddi shunday qilingan).
        //
        // Tugmalar faqat ko'chirmaning KELUVCHI qatorida chiziladi: pul
        // kelayotgan kassaning egasi tasdiqlaydi. Chiquvchi qatorda faqat
        // "Kutilmoqda" yozuvi qoladi â jo'natuvchi o'z ko'chirmasini o'zi
        // tasdiqlay olmaydi (server ham buni rad etadi).
        <span className="inline-flex items-center gap-1.5">
          {canDecide && (
            <button
              type="button"
              disabled={deciding}
              title="Rad etish â pul jo'natuvchi kassaga qaytariladi"
              onClick={(ev) => { ev.stopPropagation(); onDecide("reject"); }}
              className="h-6 w-6 rounded-md bg-rose-100 inline-flex items-center justify-center text-rose-600 font-bold text-[11px] hover:bg-rose-200 disabled:opacity-50"
            >
              Ã
            </button>
          )}
          <span className="text-[13px] text-rose-600 font-medium">
            Kutilmoqda
          </span>
          {canDecide && (
            <button
              type="button"
              disabled={deciding}
              title="Tasdiqlash â pul shu kassaga qo'shiladi"
              onClick={(ev) => { ev.stopPropagation(); onDecide("confirm"); }}
              className="h-6 w-6 rounded-md bg-emerald-100 inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-200 disabled:opacity-50"
            >
              <UserCheck style={{ width: 11, height: 11 }} />
            </button>
          )}
        </span>
      ) : edited ? null : entry.txType === "payOut" ? (
        <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium bg-red-900 text-red-200">
          To&apos;landi
        </span>
      ) : (
        <span className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium bg-emerald-500/20 text-emerald-700">
          Qabul qilindi
        </span>
      )}
      {edited && (
        <button
          type="button"
          onClick={(ev) => { ev.stopPropagation(); onShowHistory(); }}
          className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
          title="Tahrirlar tarixini ko'rish"
        >
          Tahrirlangan
        </button>
      )}
    </span>
  );
}

// Miqdor tahrirlanish tarixini ko'rsatuvchi modal â jadvaldagi "Tahrirlangan"
// belgisi bosilganda ochiladi.
function EditHistoryModal({
  entry,
  onClose,
}: {
  entry: TransactionEntry;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  const items = Array.isArray(entry.editHistory) ? entry.editHistory : [];
  function fmtAt(iso: string): string {
    const raw = new Date(iso);
    if (Number.isNaN(raw.getTime())) return iso;
    // Har doim O'zbekiston vaqti â brauzer boshqa zonada bo'lsa ham.
    const d = toUz(raw);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-[15px] font-semibold">Tahrirlar tarixi</div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
          >
            Ã
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 && (
            <div className="text-[13px] text-muted-foreground text-center py-6">
              Hozircha tahrir kiritilmagan.
            </div>
          )}
          {items.map((h, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{fmtAt(h.at)}</span>
                <span className="tabular-nums">
                  {fmtNum(Math.abs(h.from))} â <span className="text-foreground font-medium">{fmtNum(Math.abs(h.to))}</span> so&apos;m
                </span>
              </div>
              <div className="text-[13px] mt-1 whitespace-pre-wrap break-words">{h.reason || "â"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CashboxesPage() {
  const { showSuccess, showError } = useToast();
  // Kassani BOSHQARISH (tahrirlash, bosh kassa qilish, hisobotni yuklab
  // olish) faqat administratorda. Kassa egasi â kassir â o'z kassasida
  // pul amallarini bajaradi, lekin kassaning O'ZINI o'zgartira olmaydi.
  //
  // Bu FAQAT KO'RINISH: haqiqiy himoya server tomonda
  // (app/api/cashboxes/[id] â PATCH/DELETE va .../set-primary 403
  // qaytaradi). Tugmani yashirish so'rovni qo'lda yuborishga to'sqinlik
  // qilmaydi.
  const { isAdmin } = useBranch();
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);
  // Tanlangan karta ochiq holatda ko'rinadi (amal tugmalari + to'lov turlari
  // bo'yicha qoldiq), qolganlari yig'ilgan. "More" esa faqat qo'shimcha
  // Divident/Sarmoya tugmalarini ochadi.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cardMoreId, setCardMoreId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "archived" | "all"
  >("active");
  const [hideBalances, setHideBalances] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cashbox | null>(null);
  const [transferState, setTransferState] = useState<{
    cashbox: Cashbox;
    from: string;
  } | null>(null);
  const [transferToTarget, setTransferToTarget] = useState<Cashbox | null>(
    null,
  );
  const [adjustState, setAdjustState] = useState<{
    cashbox: Cashbox;
    mode: "chiqim";
  } | null>(null);
  const [kirimTarget, setKirimTarget] = useState<Cashbox | null>(null);
  const [dividendTarget, setDividendTarget] = useState<Cashbox | null>(null);
  const [investmentTarget, setInvestmentTarget] = useState<Cashbox | null>(
    null,
  );
  const [primaryConfirmTarget, setPrimaryConfirmTarget] =
    useState<Cashbox | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState<TransactionEntry | null>(
    null,
  );
  const [historyEntry, setHistoryEntry] = useState<TransactionEntry | null>(
    null,
  );
  // Qaysi ko'chirma qatori bo'yicha hozir so'rov ketyapti (id) â o'sha
  // qatordagi ikkala tugma ham o'chiriladi, ya'ni ikki marta bosib
  // yuborilmaydi. Server tomonda ham himoya bor (holat almashtirish
  // sharti), bu esa faqat interfeys darajasidagi qulaylik.
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function confirmSetPrimary() {
    if (!primaryConfirmTarget) return;
    setSettingPrimary(true);
    try {
      const res = await fetch(
        `/api/cashboxes/${primaryConfirmTarget.id}/set-primary`,
        { method: "POST" },
      );
      const data = await res.json();
      if (data.ok) {
        setCashboxes((prev) =>
          prev.map((x) => ({
            ...x,
            isPrimary: x.id === primaryConfirmTarget.id,
          })),
        );
      }
    } finally {
      setSettingPrimary(false);
      setPrimaryConfirmTarget(null);
    }
  }

  // Kartadagi qoldiq ro'yxati uchun BARCHA turlar (nofaol qilingani ham) â
  // eski summalar ko'rinib turishi kerak; tanlash ro'yxatlarida esa faqat
  // faollari.
  const { methods: paymentMethods } = usePaymentMethods();
  const [methodOrder, setMethodOrder] = useState<string[]>([]);
  useEffect(() => {
    // localStorage faqat clientda mavjud â SSR bilan bir xil boshlang'ich
    // holatdan boshlab, hydratsiyadan keyin saqlangan tartibga sinxronlaymiz.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMethodOrder(readSavedOrder());
  }, []);
  const [dragKey, setDragKey] = useState<string | null>(null);

  // Saqlangan tartibni haqiqiy ro'yxatga moslaymiz: o'chirilgan turlar
  // tushib qoladi, Sozlamalarda yangi qo'shilganlari oxiriga qo'shiladi.
  const orderedMethods = useMemo(() => {
    const known = new Set(paymentMethods.map((m) => m.key));
    const kept = methodOrder.filter((k) => known.has(k));
    const missing = paymentMethods
      .map((m) => m.key)
      .filter((k) => !kept.includes(k));
    return [...kept, ...missing]
      .map((k) => paymentMethods.find((m) => m.key === k))
      .filter((m): m is (typeof paymentMethods)[number] => !!m);
  }, [paymentMethods, methodOrder]);

  function reorderMethod(target: string) {
    if (!dragKey || dragKey === target) return;
    // Amaldagi (ko'rinib turgan) tartibdan boshlaymiz â saqlangan massiv
    // bo'sh yoki chala bo'lishi mumkin, o'shanda indeks topilmay qolardi.
    const current = orderedMethods.map((m) => m.key);
    const sourceIndex = current.indexOf(dragKey);
    const targetIndex = current.indexOf(target);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = current.filter((k) => k !== dragKey);
    // Dropping past the target in the drag direction: land right after it
    // when moving forward, right before it when moving backward â so a
    // single drag can move a row any number of positions, not just one.
    let insertAt = next.indexOf(target);
    if (sourceIndex < targetIndex) insertAt += 1;
    next.splice(insertAt, 0, dragKey);

    if (typeof window !== "undefined")
      window.localStorage.setItem(METHOD_ORDER_KEY, JSON.stringify(next));
    setMethodOrder(next);
  }

  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [txType, setTxType] = useState("");
  const [txName, setTxName] = useState("");
  const [student, setStudent] = useState("");
  const [payType, setPayType] = useState("");
  const [teacher, setTeacher] = useState("");
  const { names: dbTeachers } = useTeachers();
  const { names: txTypeNames } = useTransactionTypes();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sahifalash endi SERVERDA â shu bois filtr o'zgarganda 1-sahifaga
  // QAYTISH SHART. Ilgari bu faqat kassa almashganda kerak edi: qatorlar
  // brauzerda bo'lgani uchun 300-sahifadan 2-sahifaga o'zi tushardi.
  // Endi esa 300-sahifada turib filtr qo'yilsa server bo'sh javob qaytaradi.
  const filterKey = [
    selectedId, txType, txName, student, payType, teacher,
    dateRange.start?.getTime() ?? "", dateRange.end?.getTime() ?? "",
  ].join("|");
  const [pageResetKey, setPageResetKey] = useState(filterKey);
  if (filterKey !== pageResetKey) {
    setPageResetKey(filterKey);
    setPage(1);
  }

  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [detailEntry, setDetailEntry] = useState<TransactionEntry | null>(null);

  // Filtr TANLOVLARI serverdan (/api/transaction-entries/facets). Ilgari
  // ular `entries` dan yig'ilardi â jadval sahifalab o'qiladigan bo'lgach
  // bu ishlamay qoladi: 50 qatorda kassadagi barcha nomlar bo'lmaydi.
  // Kassa almashgandagina qayta yuklanadi, filtr o'zgarganda emas.
  const [facets, setFacets] = useState<{
    txNames: string[];
    teacherNames: string[];
    studentNames: string[];
  }>({ txNames: [], teacherNames: [], studentNames: [] });
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/transaction-entries/facets?cashboxId=${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setFacets({
          txNames: d.txNames,
          teacherNames: d.teacherNames,
          studentNames: d.studentNames,
        });
      })
      .catch(() => {
        // Tanlovlar yuklanmasa jadval baribir ishlaydi â pastdagi
        // ro'yxatlar katalogdagi qiymatlar bilan qoladi.
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Yozuvlar SERVERDA filtrlanadi VA SAHIFALANADI: brauzerga faqat bitta
  // sahifa (odatda 50 qator) keladi.
  //
  // Ilgari bu yer butun jadvalni tortardi â kassa 4 uchun 18 597 qator,
  // 8.10 MB â filtrlash ham, sahifalash ham brauzerda bo'lardi. Endi
  // bittasi 22.2 KB (373 barobar kam), va "O'quvchini qidiring" katagiga
  // har harf yozilganda 18 597 obyekt qayta filtrlanmaydi.
  //
  // Jadval yuqorisidagi Kirim/Chiqim va "Umumiy soni" â SERVERDAN, butun
  // filtr bo'yicha. Ular endi qatorlardan hisoblanmaydi: brauzerda faqat
  // bitta sahifa (50 qator) bor.
  const [entryTotals, setEntryTotals] = useState({ income: 0, expense: 0 });
  const [entryTotal, setEntryTotal] = useState(0);
  const [entriesError, setEntriesError] = useState(false);
  const entryReqRef = useRef(0);

  // BARCHA filtrlar serverga birga yuboriladi. Bu shart: filtrlash klientda
  // qolsa, u faqat ko'rinib turgan 50 qator ichidan qidirardi.
  const entryQuery = useCallback(() => {
    const qs = new URLSearchParams({ cashboxId: String(selectedId) });
    if (dateRange.start) qs.set("dateFrom", toIso(dateRange.start));
    if (dateRange.end) qs.set("dateTo", toIso(dateRange.end));
    if (txType) qs.set("txType", TX_TYPE_MAP[txType]);
    if (txName) qs.set("txName", txName);
    // ATAYLAB `studentLike`/`teacherLike` â ular ICHIDAN qidiradi, xuddi
    // shu yerdagi eski `.includes()` kabi. API'dagi `?studentName=` esa
    // aynan tenglik va uni bu yerda ishlatib bo'lmaydi.
    if (student.trim()) qs.set("studentLike", student.trim());
    if (teacher.trim()) qs.set("teacherLike", teacher.trim());
    // To'lov turi yozuvda NOMI bilan saqlanadi, filtrda esa kaliti
    // tanlanadi â shuning uchun ro'yxat yuklangan bo'lishi kerak.
    const payLabel = payType
      ? paymentMethods.find((m) => m.key === payType)?.name
      : "";
    if (payLabel) qs.set("paymentType", payLabel);
    return qs;
  }, [
    selectedId, dateRange, txType, txName, student, teacher, payType,
    paymentMethods,
  ]);

  const loadEntries = useCallback(() => {
    // Kassa tanlanmagan bo'lsa so'rov yubormaymiz. Holatni bu yerda
    // tozalash SHART EMAS â `filteredEntries` `selectedId` yo'qligida
    // baribir bo'sh ro'yxat qaytaradi.
    if (!selectedId) return;
    const qs = entryQuery();
    qs.set("page", String(page));
    qs.set("limit", String(pageSize));
    qs.set("withTotals", "1");
    // Sahifalar ketma-ket tez bosilganda javoblar boshqa tartibda kelishi
    // mumkin â faqat ENG OXIRGI so'rovniki qabul qilinadi.
    const seq = ++entryReqRef.current;
    fetch(`/api/transaction-entries?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== entryReqRef.current) return;
        if (!d.ok) throw new Error(d.error || "yuklab bo'lmadi");
        setEntries(d.entries);
        setEntryTotal(d.total);
        setEntryTotals(d.totals || { income: 0, expense: 0 });
        setEntriesError(false);
      })
      .catch(() => {
        if (seq !== entryReqRef.current) return;
        // Moliya jadvali: xato bo'lganda ESKI raqamlar ekranda qolmasligi
        // kerak, lekin nol ham ko'rsatilmaydi â jadval xato holatini
        // ochiq aytadi (pastdagi `entriesError`).
        setEntries([]);
        setEntryTotal(0);
        setEntryTotals({ income: 0, expense: 0 });
        setEntriesError(true);
      });
  }, [selectedId, entryQuery, page, pageSize]);

  // Kassa yoki sana oralig'i o'zgarganda qayta yuklanadi.
  useEffect(() => { loadEntries(); }, [loadEntries]);

  function refreshCashboxes() {
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCashboxes(d.cashboxes);
      });
  }

  /**
   * Kassalararo ko'chirmani tasdiqlash (â) yoki rad etish (Ã).
   *
   * Jadval va kassa kartochkalari IKKALASI ham yangilanadi: tasdiq pulni
   * qabul qiluvchiga qo'shadi, rad etish esa jo'natuvchiga qaytaradi â
   * ya'ni balanslar o'zgaradi.
   */
  async function decideTransfer(entry: TransactionEntry, decision: "confirm" | "reject") {
    setDecidingId(entry.id);
    try {
      // Manzil QATTIQ yoziladi (shablon ichida emas): ruxsatlar jadvali
      // route fayllari bo'yicha yig'iladi va u sahifadan chaqiruvgacha
      // bo'lgan import zanjiriga tayanadi â scripts/gen-api-permissions.mjs.
      const url = decision === "confirm"
        ? `/api/transaction-entries/${entry.id}/transfer-confirm`
        : `/api/transaction-entries/${entry.id}/transfer-reject`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Amal bajarilmadi");
        return;
      }
      showSuccess(decision === "confirm" ? "Ko'chirma tasdiqlandi" : "Ko'chirma rad etildi");
      loadEntries();
      refreshCashboxes();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDecidingId(null);
    }
  }

  // "Kim" ustunini /student-edit/[id] ga bog'lash uchun â TransactionEntry
  // faqat ismni saqlaydi (id emas), shu sabab bazadagi o'quvchilar
  // (/api/pupils) ichidan ism bo'yicha qidiramiz. Xodimlar xaritasi (pastda)
  // bilan bir xil qoida â katta-kichik harf va ortiqcha bo'shliq farq
  // qilmasin (hooks/useStudents.ts â byName).
  // Bu sahifaga o'quvchidan faqat ISM va ID kerak (pastda name->id
  // xaritasi), shu bois yengil rejim â 3.6 MB o'rniga ~544 KB.
  // Ro'yxat SHU YERDA bir marta olinadi va Kirim oynasiga PROP bilan
  // uzatiladi. Ilgari drawer uni o'zi so'rardi â bir xil kesh kaliti
  // bilan ("pupils:light"), lekin TTL 30 s. Kassir jurnalni ko'rib,
  // yarim daqiqadan keyin "+ Kirim" bossa kesh muddati o'tgan bo'lardi
  // va oyna 546 KB / ~1.4 s kutardi. Eng yomoni â o'sha paytda
  // `StudentSearchSelect` `disabled={loading}` bilan o'chib turardi,
  // ya'ni kassir yozishni ham boshlay olmasdi. Ma'lumot esa shu
  // komponentning holatida turardi.
  const {
    names: dbStudents,
    byName: studentByName,
    loading: studentsLoading,
    refresh: refreshStudents,
    refreshing: studentsRefreshing,
  } = useStudents({ light: true });
  const studentIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, s] of studentByName) map.set(key, s.id);
    return map;
  }, [studentByName]);

  // Kassa kartasidagi mas'ul (moderator) ismini xodim profiliga
  // (/management-xodimlar/[id]) bog'lash uchun. Kassada ham faqat ism
  // saqlanadi, shuning uchun xodimlar ro'yxatidan ism bo'yicha qidiramiz.
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const employeeIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const key = e.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, e.id);
    }
    return map;
  }, [employees]);
  function moderatorProfileId(name: string): number | undefined {
    return employeeIdByName.get(name.trim().toLowerCase());
  }

  // Jadvaldagi "Kim" ustuni: o'quvchi bo'lsa /student-edit/[id] ga, xodim
  // (moderator) bo'lsa /management-xodimlar/[id] ga o'tadi. Qatorning o'zi
  // bosilganda tranzaksiya oynasi ochilgani uchun havola propagatsiyani
  // to'xtatadi â ism bosilganda faqat profilga o'tiladi.
  function renderWhoCell(e: TransactionEntry) {
    const linkCls = "text-primary hover:underline";
    if (e.studentName) {
      const studentId = studentIdByName.get(e.studentName.trim().toLowerCase());
      if (studentId !== undefined) {
        return (
          <Link
            href={`/student-edit/${studentId}?src=list`}
            onClick={(ev) => ev.stopPropagation()}
            className={linkCls}
          >
            {e.studentName}
          </Link>
        );
      }
      // O'quvchilar orasidan topilmasa â xodim (masalan "Hodimga avans"
      // yozuvida ismi shu maydonda saqlanadi) profiliga o'tishga urinamiz.
      const empId = moderatorProfileId(e.studentName);
      if (empId !== undefined) {
        return (
          <Link
            href={`/management-xodimlar/${empId}`}
            onClick={(ev) => ev.stopPropagation()}
            className={linkCls}
          >
            {e.studentName}
          </Link>
        );
      }
      return e.studentName;
    }
    if (e.moderator) {
      const employeeId = moderatorProfileId(e.moderator);
      if (employeeId === undefined) return e.moderator;
      return (
        <Link
          href={`/management-xodimlar/${employeeId}`}
          onClick={(ev) => ev.stopPropagation()}
          className={linkCls}
        >
          {e.moderator}
        </Link>
      );
    }
    return "â";
  }

  // Jadvaldagi "Oyligiga" ustuni: yozuv qaysi o'qituvchining oyligiga
  // ta'sir qilishini ko'rsatadi. "Kim" ustuni kabi bu ism ham xodim
  // profiliga (/management-xodimlar/[id]) olib boradi â ilgari oddiy matn
  // edi va o'qituvchini ochish uchun Boshqaruv â Xodimlar dan qaytadan
  // qidirishga to'g'ri kelardi. Ism xodimlar ro'yxatidan topilmasa (masalan
  // xodim o'chirilgan, yozuv esa tarixda qolgan) â avvalgidek oddiy matn.
  function renderSalaryTargetCell(e: TransactionEntry) {
    const sign = e.txType === "payIn" ? "+" : "â";
    const tone = e.txType === "payIn" ? "text-emerald-600" : "text-rose-600";
    const cls = `inline-flex items-center gap-1 text-[12px] ${tone}`;
    const empId = e.teacherName ? moderatorProfileId(e.teacherName) : undefined;
    if (empId === undefined) {
      return (
        <span title={salaryTargetLabel(e)} className={cls}>
          {sign} {e.teacherName}
        </span>
      );
    }
    return (
      <Link
        href={`/management-xodimlar/${empId}`}
        onClick={(ev) => ev.stopPropagation()}
        title={salaryTargetLabel(e)}
        className={`${cls} hover:underline`}
      >
        {sign} {e.teacherName}
      </Link>
    );
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setCashboxes(d.cashboxes);
        if (d.cashboxes.length > 0) setSelectedId(d.cashboxes[0].id);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
    // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
    fetch("/api/hr-employees/ref")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setEmployees(d.employees);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredList = useMemo(
    () =>
      cashboxes.filter((c) => {
        if (statusFilter === "active") return !c.archived;
        if (statusFilter === "archived") return c.archived;
        return true;
      }),
    [cashboxes, statusFilter],
  );
  const selected = useMemo(
    () => cashboxes.find((c) => c.id === selectedId) || null,
    [cashboxes, selectedId],
  );

  function mask(n: number): string {
    return hideBalances ? "*** *** ***" : fmtNum(n);
  }

  // O'quvchilar ro'yxati BAZADAN (/api/pupils) â ilgari faqat shu kassada
  // to'lov QILGAN o'quvchilar chiqardi, ya'ni hali to'lov qilmagan
  // o'quvchini qidirib topib bo'lmasdi. Yozuvlarda uchraydigan, lekin
  // bazada yo'q ismlar ham qo'shiladi (o'chirilgan o'quvchi).
  const studentOptions = useMemo(
    () => [
      ...new Set([
        ...dbStudents,
        ...facets.studentNames,
      ]),
    ].sort(),
    [dbStudents, facets],
  );

  // O'qituvchilar ro'yxati XODIMLARDAN (/api/teachers) â ilgari bu yerda
  // yozuvlarning `moderator` maydoni ishlatilardi, ya'ni "O'qituvchini
  // qidiring" deb turib aslida kassa mas'uli bo'yicha filtrlanardi.
  // Yozuvlarda uchraydigan, lekin ro'yxatda yo'q ismlar ham qo'shiladi
  // (arxivlangan yoki o'chirilgan xodim).
  const teacherOptions = useMemo(
    () => [
      ...new Set([
        ...dbTeachers,
        ...facets.teacherNames,
      ]),
    ].sort(),
    [dbTeachers, facets],
  );

  // Referensdagi "Tranzaksiya turi" filtri. `txName` â tranzaksiya turlari
  // katalogidan keladigan nom ("O'quvchi to'ladi", "Hodimga avans", ...),
  // yuqoridagi "Tranzaksiya" filtri esa Kirim/Chiqim/Ko'chirish amali bo'yicha.
  // Ro'yxat Moliya â Tranzaksiya turi sahifasidagi BARCHA turlardan
  // (Kirim/Chiqim/Vaucher/Jarima) iborat; katalogda yo'q, lekin eski
  // yozuvlarda uchraydigan nomlar oxiriga qo'shiladi.
  const txNameOptions = useMemo(
    () => [
      ...txTypeNames,
      ...facets.txNames.filter((n) => !txTypeNames.includes(n)).sort(),
    ],
    [txTypeNames, facets],
  );

  // Server allaqachon filtrlab bergan â bu yer o'sha shartlarni yana bir
  // bor tekshiradi (himoya qatlami). Mos kelganda hech narsa o'zgarmaydi.
  const filteredEntries = useMemo(() => {
    if (!selectedId) return [];
    const wantedType = txType ? TX_TYPE_MAP[txType] : "";
    const wantedPayLabel = payType
      ? paymentMethods.find((m) => m.key === payType)?.name
      : "";
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    const studentQ = student.trim().toLowerCase();
    const teacherQ = teacher.trim().toLowerCase();
    return entries.filter((e) => {
      if (e.cashboxId !== selectedId) return false;
      if (startIso && e.date < startIso) return false;
      if (endIso && e.date > endIso) return false;
      if (wantedType && e.txType !== wantedType) return false;
      if (txName && e.txName !== txName) return false;
      if (studentQ && !e.studentName.toLowerCase().includes(studentQ))
        return false;
      if (wantedPayLabel && e.paymentType !== wantedPayLabel) return false;
      if (teacherQ && !(e.teacherName || "").toLowerCase().includes(teacherQ))
        return false;
      return true;
    });
    // `paymentMethods` ham bog'liqlikda: to'lov turlari asinxron yuklanadi,
    // ular kelgach "To'lov turi" filtri qayta hisoblanishi kerak.
  }, [
    entries,
    selectedId,
    dateRange,
    txType,
    txName,
    student,
    payType,
    teacher,
    paymentMethods,
  ]);

  // Qator raqami uchun â jadval serverdan sahifalab keladi, shu bois
  // `filteredEntries` allaqachon AYNAN shu sahifaning qatorlari.
  const entryStart = (page - 1) * pageSize;
  const entrySlice = filteredEntries;

  // Hisobotni yuklab olish menyusi â tanlangan kassa kartasi ichida.
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [exportMenuOpen]);

  const exportCols: {
    label: string;
    get: (e: TransactionEntry) => string | number;
  }[] = [
    { label: "Sana", get: fmtEntryDate },
    { label: "Kim", get: (e) => e.studentName || e.moderator || "" },
    { label: "Oyligiga", get: (e) => e.teacherName || "" },
    { label: "Izoh", get: (e) => e.note || "" },
    { label: "Tranzaksiya nomi", get: (e) => e.txName || "" },
    { label: "Miqdori", get: (e) => e.amount },
    { label: "Holati", get: (e) => e.status || "" },
    {
      label: "Tranzaksiya turi",
      get: (e) => TX_TYPE_LABELS[e.txType] || e.txType,
    },
    { label: "Turi", get: (e) => e.paymentType },
  ];

  // Eksport butun ro'yxat bo'yicha bo'lishi kerak, jadvaldagi 50 qator
  // bo'yicha emas. Bu kamdan-kam va ataylab bosiladigan amal, shu bois
  // og'ir so'rov aynan shu yerda o'rinli â jadval esa sahifalab o'qiydi.
  async function fetchAllForExport(): Promise<TransactionEntry[]> {
    const d = await fetch(
      `/api/transaction-entries?${entryQuery().toString()}`,
    ).then((r) => r.json());
    if (!d.ok) throw new Error(d.error || "yuklab bo'lmadi");
    return d.entries as TransactionEntry[];
  }

  async function exportEntriesCsv() {
    try {
      const all = await fetchAllForExport();
      const rows = [
        exportCols.map((c) => c.label).join(","),
        ...all.map((e) =>
          exportCols
            .map((c) => `"${String(c.get(e)).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      const blob = new Blob([rows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tranzaksiyalar-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("CSV fayl yuklab olindi");
    } catch {
      showError("CSV faylni yuklab bo'lmadi");
    }
  }

  async function exportEntriesExcel() {
    try {
      // xlsx (SheetJS) FAQAT shu yerda kerak â bosilganda. Statik import
      // bo'lganida u route'ning boshlang'ich JS to'plamiga kirardi:
      // 431 KB lik chunk 9 ta sahifada, eksport tugmasi bosilmasa ham.
      const XLSX = await import("xlsx");
      const all = await fetchAllForExport();
      const rows = all.map((e) =>
        Object.fromEntries(exportCols.map((c) => [c.label, c.get(e)])),
      );
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tranzaksiyalar");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `tranzaksiyalar-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  const segBase =
    "h-9 rounded-md inline-flex items-center justify-center gap-1.5 text-[13px] font-medium";
  function segCls(v: "active" | "archived" | "all") {
    return `${segBase} ${statusFilter === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-secondary"}`;
  }

  return (
    <div className="page-frame-row p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start">
      {/* Chap panel â kassa kartalari */}
      <aside className="page-frame-aside fc-aside w-full shrink-0 space-y-3">
        {/* Yangi kassa yaratish â kassaning O'ZINI boshqarish, ya'ni
            tahrirlash/bosh kassa qilish bilan bir toifada: faqat admin. */}
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi kassa qo&apos;shish</span>
          </button>
        )}

        {/* Holat filtri â segmentli tugmalar */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setStatusFilter("active")}
            className={segCls("active")}
          >
            <CircleCheckBig className="w-3.5 h-3.5" /> Aktiv
          </button>
          <button
            onClick={() => setStatusFilter("archived")}
            className={segCls("archived")}
          >
            <Archive className="w-3.5 h-3.5" /> Arxiv
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={segCls("all")}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Barchasi
          </button>
        </div>

        <div className="space-y-2">
          {filteredList.map((c) => {
            const isSelected = c.id === selectedId;
            const isDark = isSelected || c.isPrimary;
            // Arxivdagi kassada pul amaliyoti qilinmaydi (Kirim/Chiqim/
            // Ko'chirish, bosh kassa qilish, hisobot) â lekin TAHRIRLASH
            // kerak bo'ladi: arxivdan qaytarish, nomini yoki mas'ulini
            // to'g'rilash aynan shu oynadan qilinadi. Ilgari arxivdagi
            // kartada bitta ham tugma yo'q edi, ya'ni arxivga tushgan
            // kassani interfeys orqali qaytarib bo'lmasdi.
            const showActions = isSelected && !c.archived;
            // Arxivdagi kartadagi yagona tugma ham tahrirlash â u ham
            // faqat adminda (arxivdan qaytarish o'sha oynadan qilinadi).
            const showEditOnly = isSelected && c.archived && isAdmin;
            const showMore = cardMoreId === c.id;
            const labelMuted = isDark ? "text-white/70" : "text-slate-700";
            const textMuted = isDark ? "text-white/85" : "text-slate-700";
            const line = isDark
              ? "rgba(255,255,255,.22)"
              : "rgba(15,23,42,.14)";
            // Faqat puli bor to'lov turlari ko'rinadi â yangi turga kirim
            // bo'lishi bilan o'zi qo'shiladi (referens dizayndagi kabi).
            const methodRows = orderedMethods
              .map((m, i) => ({
                m,
                dot: methodDot(m.key, i),
                val: c.methodTotals[m.key] ?? 0,
              }))
              .filter((r) => r.val > 0);

            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`fc-card ${isDark ? "fc-card-dark" : "fc-card-light"} rounded-xl p-5 shadow-md cursor-pointer hover:shadow-lg transition-shadow relative`}
                style={{ color: isDark ? "#fff" : "#0f172a" }}
              >
                {c.isPrimary && !showActions && (
                  <Crown
                    className="absolute top-4 right-4 w-8 h-8"
                    style={{ color: "#f59e0b", fill: "#fde68a" }}
                  />
                )}

                <div
                  className="min-w-0"
                  style={
                    c.isPrimary && !showActions
                      ? { paddingRight: 46 }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`text-[14px] font-semibold truncate min-w-0 ${labelMuted}`}
                      >
                        {c.name}
                      </div>
                      {c.archived && (
                        <span
                          className={`text-[11px] font-medium shrink-0 ${labelMuted}`}
                          style={{
                            padding: "1px 8px",
                            borderRadius: 9999,
                            background: isDark
                              ? "rgba(255,255,255,.18)"
                              : "rgba(15,23,42,.10)",
                          }}
                        >
                          Arxiv
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[12px] font-medium truncate min-w-0 ${textMuted}`}
                      style={{ maxWidth: "60%" }}
                    >
                      {!c.moderator ? (
                        "mas'ul belgilanmagan"
                      ) : moderatorProfileId(c.moderator) ? (
                        <Link
                          href={`/management-xodimlar/${moderatorProfileId(c.moderator)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {c.moderator}
                        </Link>
                      ) : (
                        c.moderator
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHideBalances((h) => !h);
                        }}
                        title={
                          hideBalances
                            ? "Summalarni ko'rsatish"
                            : "Summalarni yashirish"
                        }
                        className="fc-card-btn shrink-0"
                        style={{ opacity: 0.75, height: 28, width: 28 }}
                      >
                        {hideBalances ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <div className="text-2xl font-bold tabular-nums truncate">
                        {mask(c.balance)} so&apos;m
                      </div>
                    </div>
                    {!isSelected && (
                      <ChevronDown
                        className="w-4 h-4 shrink-0"
                        style={{ opacity: 0.55 }}
                      />
                    )}
                  </div>
                </div>

                {showActions && (
                  <>
                    <div
                      className="flex items-center gap-1.5 mt-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setKirimTarget(c);
                          // Sahifa uzoq ochiq turgan bo'lsa ro'yxat
                          // eskirgan bo'lishi mumkin â qabulxona hozirgina
                          // qo'shgan o'quvchi kassirga ko'rinsin. FONDA:
                          // oyna kutmaydi, maydon o'chmaydi. Bosqichi
                          // ichkarida (sukut 60 s).
                          refreshStudents();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-medium shadow-sm whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> Kirim
                      </button>
                      <button
                        onClick={() => {
                          setAdjustState({ cashbox: c, mode: "chiqim" });
                          // Kirim tugmasidagi bilan bir xil: fonda, bosqich
                          // bilan. Drawer endi ro'yxatni o'zi so'ramaydi,
                          // shu bois keshni tashlash uni sovutmaydi.
                          refreshStudents();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium shadow-sm whitespace-nowrap"
                      >
                        <span className="font-bold">â</span> Chiqim
                      </button>
                      <button
                        onClick={() => setTransferToTarget(c)}
                        className="flex-1 inline-flex items-center justify-center h-9 rounded-lg bg-sky-400 hover:bg-sky-500 text-white text-[13px] font-medium shadow-sm whitespace-nowrap"
                      >
                        Ko&apos;chirish
                      </button>
                    </div>
                    {showMore && (
                      <div
                        className="flex items-center gap-1.5 mt-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setDividendTarget(c)}
                          className="flex-1 inline-flex items-center justify-center h-9 rounded-lg bg-amber-400 hover:bg-amber-500 text-amber-900 text-[13px] font-medium shadow-sm whitespace-nowrap"
                        >
                          Divident
                        </button>
                        <button
                          onClick={() => setInvestmentTarget(c)}
                          className="flex-1 inline-flex items-center justify-center h-9 rounded-lg bg-blue-400 hover:bg-blue-500 text-white text-[13px] font-medium shadow-sm whitespace-nowrap"
                        >
                          Sarmoya
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* To'lov turlari bo'yicha qoldiq. Qatorni bosish â shu turdan
                    boshqa turga ko'chirish; sudrab tashlash tartibni o'zgartiradi
                    (tartib localStorage'da saqlanadi). */}
                {isSelected && methodRows.length > 0 && (
                  <div
                    className="mt-4 pt-3 space-y-1.5"
                    style={{ borderTop: `1px solid ${line}` }}
                  >
                    {methodRows.map(({ m, dot, val }) => (
                      <div
                        key={m.key}
                        draggable={!c.archived}
                        onDragStart={() => setDragKey(m.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => reorderMethod(m.key)}
                        onDragEnd={() => setDragKey(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!c.archived)
                            setTransferState({ cashbox: c, from: m.key });
                        }}
                        title={
                          c.archived
                            ? m.name
                            : `${m.name} â boshqa to'lov turiga ko'chirish`
                        }
                        className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md ${c.archived ? "" : "cursor-grab active:cursor-grabbing"} ${dragKey === m.key ? "opacity-50" : ""}`}
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,.15)"
                            : "rgba(15,23,42,.05)",
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0"
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 9999,
                              background: dot,
                            }}
                          />
                          <span
                            className={`text-[12px] truncate ${labelMuted}`}
                          >
                            {m.name}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold tabular-nums shrink-0">
                          {mask(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {showEditOnly && (
                  <div
                    className="flex items-center mt-3 pt-3"
                    style={{ borderTop: `1px solid ${line}` }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <button
                      onClick={() => setEditTarget(c)}
                      title="Kassani o'zgartirish"
                      className="fc-card-btn"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {showActions && (
                  <div
                    className="flex items-center justify-between mt-3 pt-3"
                    style={{ borderTop: `1px solid ${line}` }}
                  >
                    {/* Tahrirlash / bosh kassa / hisobotni yuklab olish â
                        FAQAT ADMIN. Kassir o'z kassasida pul amallarini
                        bajaradi (Kirim/Chiqim/Ko'chirish), lekin kassaning
                        o'zini o'zgartirmaydi. Bo'sh <div/> â "More" tugmasi
                        o'ng chekkada qolishi uchun (justify-between). */}
                    {!isAdmin && <div />}
                    {isAdmin && (
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setEditTarget(c)}
                        title="Tahrirlash"
                        className="fc-card-btn"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!c.isPrimary) setPrimaryConfirmTarget(c);
                        }}
                        title={
                          c.isPrimary ? "Bosh kassa" : "Asosiy kassa qilish"
                        }
                        className="fc-card-btn"
                        style={{ color: "#fbbf24" }}
                      >
                        <Crown
                          className="w-4 h-4"
                          style={c.isPrimary ? { fill: "#fbbf24" } : undefined}
                        />
                      </button>
                      <div className="relative" ref={exportRef}>
                        <button
                          onClick={() => setExportMenuOpen((o) => !o)}
                          title="Hisobotni yuklab olish"
                          className="fc-card-btn"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>
                        {exportMenuOpen && (
                          <div className="absolute left-0 top-full mt-1 z-50 w-60 rounded-xl border border-border bg-card text-foreground shadow-xl overflow-hidden p-1">
                            <button
                              type="button"
                              onClick={() => {
                                exportEntriesCsv();
                                setExportMenuOpen(false);
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                <FileText className="w-4 h-4" />
                              </span>
                              <span>CSV faylini yuklab olish</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportEntriesExcel();
                                setExportMenuOpen(false);
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                                <FileSpreadsheet className="w-4 h-4" />
                              </span>
                              <span>EXCEL faylini yuklab olish</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardMoreId(showMore ? null : c.id);
                      }}
                      className="text-[12px] text-white/80 hover:text-white"
                    >
                      {showMore ? "Less" : "More"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredList.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
              {loading ? (
                <SpinnerBlock size={22} />
              ) : cashboxes.length === 0 ? (
                // Ro'yxat SERVERDA kesiladi: xodim faqat o'ziga
                // biriktirilgan kassani ko'radi. Bo'sh ekran "sayt buzildi"
                // deb tushunilmasin â nima uchun bo'shligi va kim
                // to'g'rilashi aytiladi.
                "Sizga kassa biriktirilmagan. Kassani Moliya â Kassalar bo'limida admin biriktiradi."
              ) : (
                "Bu bo'limda kassa yo'q"
              )}
            </div>
          )}
        </div>
      </aside>

      {/* O'ng qism â filtrlar + tanlangan kassaning tranzaksiyalari */}
      <div className="page-frame-col flex-1 min-w-0 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setPage(1);
            }}
            className="fc-range flex-1 min-w-[210px] max-w-[280px]"
          />
          <div className="relative flex-1 min-w-[140px]">
            <select
              value={txType}
              onChange={(e) => {
                setTxType(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              <option value="">Tranzaksiya</option>
              <option value="kirim">Kirim</option>
              <option value="chiqim">Chiqim</option>
              <option value="kochirish">Ko&apos;chirish</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <select
              value={txName}
              onChange={(e) => {
                setTxName(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              <option value="">Tranzaksiya turi</option>
              {txNameOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchFilter
            value={student}
            onChange={(v) => {
              setStudent(v);
              setPage(1);
            }}
            options={studentOptions}
            placeholder="O'quvchini qidiring..."
          />
          <div className="relative flex-1 min-w-[140px]">
            <select
              value={payType}
              onChange={(e) => {
                setPayType(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              <option value="">To&apos;lov turi</option>
              {paymentMethods.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          <SearchFilter
            value={teacher}
            onChange={(v) => {
              setTeacher(v);
              setPage(1);
            }}
            options={teacherOptions}
            placeholder="O'qituvchini qidiring..."
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="inline-flex items-center px-4 h-9 rounded-full bg-secondary/80 text-foreground text-[13px] font-medium">
            Tranzaksiya
          </span>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="inline-flex items-center gap-1 text-emerald-500 font-medium tabular-nums">
              <ArrowDownLeft className="w-3.5 h-3.5" />{" "}
              {mask(entryTotals.income)} so&apos;m
            </span>
            <span className="inline-flex items-center gap-1 text-rose-500 font-medium tabular-nums">
              <ArrowUpRight className="w-3.5 h-3.5" />{" "}
              {mask(entryTotals.expense)} so&apos;m
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
              <span className="text-muted-foreground">Umumiy soni:</span>
              <span className="font-bold tabular-nums">
                {entryTotal}
              </span>
            </div>
          </div>
        </div>

        <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-3 whitespace-nowrap w-14">
                    â
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Sana
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Kim</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Oyligiga
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Izoh
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Tranzaksiya nomi
                  </th>
                  <th className="text-right px-3 py-3 whitespace-nowrap">
                    Miqdori
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Holati
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Tranzaksiya turi
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Turi
                  </th>
                  <th className="text-right px-3 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {entrySlice.map((e, i) => {
                  // Qatorning istalgan joyiga bosilsa â tranzaksiya oynasi
                  // (to'lovni bekor qilish) ochiladi. "Kim" ustunidagi ism va
                  // o'ngdagi chek tugmasi bundan mustasno.
                  const dir =
                    e.txType === "transfer"
                      ? "transfer"
                      : e.amount >= 0
                        ? "in"
                        : "out";
                  const cancelled = e.status === "cancelled";
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setDetailEntry(e)}
                      className="border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors"
                      style={cancelled ? { opacity: 0.65 } : undefined}
                    >
                      <td className="px-3 py-3 text-foreground/70 tabular-nums text-[13px]">
                        {entryStart + i + 1}
                      </td>
                      <td className="px-3 py-3 text-foreground/80 text-[12px] tabular-nums whitespace-nowrap">
                        {fmtEntryDate(e)}
                      </td>
                      <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                        {renderWhoCell(e)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {e.teacherName ? (
                          renderSalaryTargetCell(e)
                        ) : (
                          <span className="text-[12px] text-muted-foreground">â</span>
                        )}
                      </td>
                      {/* IZOHNING O'ZI yoziladi.
                          Ilgari bu yerda "Izoh" degan qotib qolgan yorliq
                          turardi va haqiqiy matn faqat `title` da â ya'ni
                          sichqonchani ustida ushlab turmaguncha ko'rinmasdi.
                          Jadvalda esa izohlar aynan ma'noli: "Umidjon tarix
                          avgust", "turk tili kitob" â ular kimning qaysi oyi
                          uchun to'lov ekanini aytadi.
                          Uzun matn qatorni cho'zib yubormasin: kengligi
                          cheklangan va uchi qirqiladi, to'lig'i `title` da
                          hamda yozuv kartochkasida qoladi. */}
                      <td className="px-3 py-3">
                        {e.note ? (
                          <span
                            title={e.note}
                            className="block max-w-[220px] truncate text-[12.5px] text-foreground/80"
                          >
                            {e.note}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">â</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-foreground/80 whitespace-nowrap">
                        {e.txName || "â"}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap text-[13px]">
                        <span
                          style={
                            cancelled
                              ? { textDecoration: "line-through" }
                              : undefined
                          }
                        >
                          {mask(Math.abs(e.amount))}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusCell
                          entry={e}
                          onShowHistory={() => setHistoryEntry(e)}
                          onDecide={(d) => decideTransfer(e, d)}
                          deciding={decidingId === e.id}
                        />
                      </td>
                      <td className="px-3 py-3 text-[13px] text-foreground/80">
                        {TX_TYPE_LABELS[e.txType] || e.txType}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-foreground/80">
                        {e.paymentType}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {dir === "in" && (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          {dir === "out" && (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                          )}
                          {dir === "transfer" && (
                            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {!cancelled && (
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setReceiptEntry(e);
                              }}
                              title="Chek chiqarish"
                              className="h-7 w-7 rounded-md hover:bg-primary/10 inline-flex items-center justify-center text-primary"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {entrySlice.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-16 text-center">
                      {/* Bo'sh natija bilan XATONI farqlaymiz: ilgari
                          ikkalasi ham "topilmadi" deb ko'rinardi va
                          yuqoridagi nol summalar haqiqiy deb o'ylanardi. */}
                      <div className="text-[14px] font-semibold">
                        {entriesError
                          ? "Ma'lumotni yuklab bo'lmadi"
                          : "Ma'lumotlar topilmadi"}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-1">
                        {entriesError
                          ? "Aloqa yoki server xatosi â yuqoridagi summalar ham to'liq emas."
                          : "Filterni o'zgartirib ko'ring."}
                      </div>
                      {entriesError && (
                        <button
                          onClick={loadEntries}
                          className="mt-3 h-9 px-4 rounded-md bg-primary text-white text-[13px] font-medium"
                        >
                          Qayta urinish
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={entryTotal}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      </div>

      {addOpen && (
        <CashboxDrawer
          cashboxes={cashboxes}
          onClose={() => setAddOpen(false)}
          onSaved={(c) => {
            setCashboxes((prev) => [...prev, c]);
            setSelectedId(c.id);
          }}
        />
      )}
      {editTarget && (
        <CashboxDrawer
          cashbox={editTarget}
          cashboxes={cashboxes}
          onClose={() => setEditTarget(null)}
          onSaved={(c) =>
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)))
          }
          onDeleted={(id) => {
            setCashboxes((prev) => {
              const next = prev.filter((x) => x.id !== id);
              if (selectedId === id)
                setSelectedId(next.length > 0 ? next[0].id : null);
              if (cardMoreId === id) setCardMoreId(null);
              return next;
            });
          }}
        />
      )}
      {transferState && (
        <CashboxTransferDrawer
          cashbox={transferState.cashbox}
          initialFrom={transferState.from}
          onClose={() => setTransferState(null)}
          onSaved={(c) => {
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            loadEntries();
          }}
        />
      )}
      {adjustState && (
        <CashboxAdjustDrawer
          cashbox={adjustState.cashbox}
          mode={adjustState.mode}
          studentNames={dbStudents}
          studentByName={studentByName}
          studentsLoading={studentsLoading}
          studentsRefreshing={studentsRefreshing}
          onClose={() => setAdjustState(null)}
          onSaved={(c) => {
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            loadEntries();
          }}
        />
      )}
      {kirimTarget && (
        <CashboxKirimDrawer
          cashbox={kirimTarget}
          studentNames={dbStudents}
          studentByName={studentByName}
          studentsLoading={studentsLoading}
          studentsRefreshing={studentsRefreshing}
          onClose={() => setKirimTarget(null)}
          onSaved={(c) => {
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            loadEntries();
          }}
        />
      )}
      {dividendTarget && (
        <CashboxDividendDrawer
          cashbox={dividendTarget}
          onClose={() => setDividendTarget(null)}
          onSaved={(c) => {
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            loadEntries();
          }}
        />
      )}
      {investmentTarget && (
        <CashboxInvestmentDrawer
          cashbox={investmentTarget}
          onClose={() => setInvestmentTarget(null)}
          onSaved={(c) => {
            setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            loadEntries();
          }}
        />
      )}
      {transferToTarget && (
        <CashboxTransferToDrawer
          cashbox={transferToTarget}
          onClose={() => setTransferToTarget(null)}
          onSaved={({ from, to }) => {
            setCashboxes((prev) =>
              prev.map((x) =>
                x.id === from.id ? from : x.id === to.id ? to : x,
              ),
            );
            loadEntries();
          }}
        />
      )}
      {detailEntry && (
        <TransactionDetailDrawer
          entry={detailEntry}
          cashboxName={
            cashboxes.find((c) => c.id === detailEntry.cashboxId)?.name || ""
          }
          studentId={
            detailEntry.studentName
              ? studentIdByName.get(detailEntry.studentName.trim().toLowerCase())
              : undefined
          }
          employeeId={
            detailEntry.studentName && !studentIdByName.get(detailEntry.studentName.trim().toLowerCase())
              ? moderatorProfileId(detailEntry.studentName)
              : detailEntry.moderator
              ? moderatorProfileId(detailEntry.moderator)
              : undefined
          }
          onClose={() => setDetailEntry(null)}
          onChanged={(updated) => {
            setEntries((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            );
            setDetailEntry(updated);
            refreshCashboxes();
          }}
        />
      )}
      {historyEntry && (
        <EditHistoryModal
          entry={historyEntry}
          onClose={() => setHistoryEntry(null)}
        />
      )}
      {receiptEntry && (
        <ReceiptPreviewModal
          entry={receiptEntry}
          cashboxName={
            cashboxes.find((c) => c.id === receiptEntry.cashboxId)?.name || ""
          }
          onClose={() => setReceiptEntry(null)}
          onPrint={() => {
            const e = receiptEntry;
            const name =
              cashboxes.find((c) => c.id === e.cashboxId)?.name || "";
            setReceiptEntry(null);
            // Modal yopilib bo'lgach print oynasi ochilishi uchun bir tick kutamiz â
            // aks holda ba'zi brauzerlarda modal ostiga tushib qoladi.
            setTimeout(() => printReceipt(e, name), 0);
          }}
        />
      )}
      {primaryConfirmTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !settingPrimary && setPrimaryConfirmTarget(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">
              Bosh kassa qilmoqchimisiz?
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPrimaryConfirmTarget(null)}
                disabled={settingPrimary}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={confirmSetPrimary}
                disabled={settingPrimary}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {settingPrimary ? "Saqlanmoqdaâ¦" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
