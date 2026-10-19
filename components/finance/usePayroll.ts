"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBranch, useBranchChangedElsewhere } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { branchPool } from "@/lib/branchPools";
import { invalidateTransactions } from "@/lib/cacheKeys";
import type { Cashbox } from "@/lib/cashboxes";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import {
  payrollCashLeg,
  payrollDebt,
  payrollEarned,
  payrollMonthKey,
  payrollPayout,
  payrollPendingMaybePaid,
  payrollPeriod,
  payrollPeriodOf,
  payrollPlastikLeg,
  payrollTax,
  pendingMaybePaidByMonth,
  type BranchPayouts,
  type CarryPendingMonth,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// Moliya → OYLIK CHIQARISH — ma'lumot va mantiq, IKKALA versiya uchun bitta
// manba: eski sahifa (components/finance/SalaryCreatePage.tsx) va yangi
// versiya (components/v2/finance/PayrollV2.tsx). Versiyani almashtirgan
// xodim aynan o'sha qatorlarni, o'sha summalarni ko'radi va chiqarish bir xil
// so'rov bilan ketadi. Raqamlarning o'zi — lib/salary.ts (server ham shu
// funksiyalarni chaqiradi: app/api/salary-runs/route.ts).
//
// 19.10.2026 da eski sahifadan AYNAN ko'chirildi (izohlari bilan) — xulq
// o'zgarmadi. Faqat qo'shimcha: `stats.soliq`, `loadedAt` va chiqarishga
// ixtiyoriy izoh (`submitPayout(…, note)`) — yangi versiya oynasi uchun.

function fmtSum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " so'm";
}

/** Filtr: hisoblash usuli. */
export type HisoblashFilter = "all" | "foiz" | "fixed" | "mixed";

/** Xodim turi yorlig'i — filtr ro'yxati uchun (t() bilan o'raladi). */
export function payrollTuriLabel(tv: string): string {
  return tv === "teacher" ? "O'qituvchilar" : tv === "moderator" ? "Moderatorlar" : tv === "admin" ? "Adminlar" : tv === "staff" ? "Boshqa xodimlar" : tv;
}

/**
 * Qatorlarning o'z oyidan chiqariladigan qoldiqlarini (`carryPendingMonths`)
 * OY BO'YICHA jamlaydi, eskidan yangiga. Faqat ko'rsatish uchun — bu summa
 * shu oyda to'lanmaydi (SalaryCreatePage boshidagi "faqat o'z oyidan" izohi).
 *
 * Shu oyda shu oy yozuvi bo'lib berilgan bo'lishi MUMKIN bo'lgan qism
 * (`pendingMaybePaidByMonth`, 04.10.2026 o'tish davri qorovuli) AYRILADI:
 * "o'sha oy sahifasidan chiqariladi" deb aytilmasin — u yerda yana
 * chiqarilsa ikki marta to'lanadi. U qism alohida ogohlantiriladi.
 */
export function sumPendingByMonth(rows: readonly EmployeePayroll[], p: PayrollPeriod): CarryPendingMonth[] {
  const byMonth = new Map<string, number>();
  for (const e of rows) {
    const covered = pendingMaybePaidByMonth(e, p);
    for (const pm of e.carryPendingMonths ?? []) {
      const amount = pm.amount - (covered.find((x) => x.month === pm.month)?.amount ?? 0);
      if (amount > 0) byMonth.set(pm.month, (byMonth.get(pm.month) ?? 0) + amount);
    }
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, amount]) => ({ month, amount }));
}

// FILIAL BOSHQA OYNADA ALMASHTIRILSA (30.09.2026).
//
// Filial tanlovi `branch` cookie'sida (lib/branchScope.ts → BRANCH_COOKIE;
// modul server'niki, shu bois nom shu yerda takrorlanadi) va brauzerning
// HAMMA oynalari uchun BITTA. Bir oynada 1-filial ro'yxati ochiq turib,
// ikkinchisida 2-filial tanlansa, birinchisi eski ro'yxatni ko'rsatib
// turaverardi, «Oylikni chiqarish» esa server'da 2-filial ro'yxatidan
// qidirib "Xodim topilmadi" berardi (30.09.2026, 6 ta urinish). Endi:
//   • boshqa oynada navbardan filial almashsa, bu sahifa DARHOL to'liq qayta
//     yuklanadi (BroadcastChannel — components/shared/BranchContext.tsx);
//   • zaxira: oyna qaytib ochilganda cookie o'zgargani seziladi;
//   • server ham mos kelmagan filialni rad etadi (app/api/salary-runs/route.ts).

/** `branch` cookie'sining xom qiymati; yo'q bo'lsa "". */
function readBranchCookie(): string {
  const m = /(?:^|;\s*)branch=([^;]*)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Qayta yuklangandan keyin sababini aytish uchun belgi (sessionStorage). */
const BRANCH_CHANGED_FLAG = "payroll:branchChanged";

function reloadForBranchChange() {
  try { sessionStorage.setItem(BRANCH_CHANGED_FLAG, "1"); } catch { /* xabarsiz ham qayta yuklanadi */ }
  window.location.reload();
}

export function usePayroll() {
  const { t, months } = useT();
  const { showSuccess, showError } = useToast();
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  // Qatorlar QACHON hisoblangani (Toshkent "HH:mm") — chiqarish oynasida
  // «12:15 gacha hisoblandi» (yangi versiya). Javob kelguncha "".
  const [loadedAt, setLoadedAt] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  // Pul QAYSI kassadan chiqishi — oylik chiqarish haqiqiy chiqim yozuvlari
  // yaratadi, shuning uchun kassa va to'lov turi tanlanishi shart.
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  // Kassalar hali KELAYAPTIMI. Bunisiz tanlov ro'yxatida birinchi soniyalarda
  // "Kassa topilmadi" turardi — o'sha onda bu yolg'on, hali hech narsa
  // o'qilmagan edi.
  const [cashboxesLoading, setCashboxesLoading] = useState(true);
  const [cashboxId, setCashboxId] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  // PLASTIK oyog'ining to'lov turi — naqd turidan alohida. Bo'sh bo'lsa
  // quyida sukut qiymat hosila sifatida chiqariladi.
  const [plastikMethod, setPlastikMethod] = useState<string>("");
  const [query, setQuery] = useState("");
  const [turiFilter, setTuriFilter] = useState<string>("all");
  const [hisoblash, setHisoblash] = useState<HisoblashFilter>("all");

  // QAYSI OY hisoblanadi. Sukut — joriy oy, ya'ni sahifa ochilgandagi xulq
  // avvalgidek qoladi.
  //
  // NIMA UCHUN OY TANLAGICH KERAK: kassir Kirim oynasida sanani o'tgan oyga
  // qo'yishi mumkin va yozuv bazaga o'sha sana bilan tushadi. Ilgari oylik
  // hisobi doim server soatidagi joriy oyni olardi, ya'ni o'sha to'lov
  // o'qituvchining o'tgan oy foiziga hech qachon qo'shilmasdi — uni
  // ko'rsatadigan ekranning o'zi yo'q edi. Yangi oy boshlangan kuni esa
  // o'tgan oyning butun tushumi ko'zdan g'oyib bo'lardi.
  const currentMonthKey = useMemo(() => payrollMonthKey(payrollPeriod()), []);
  // Bugun (Toshkent) — ishdan ketish sanasi kelganmi, shuni bilish uchun.
  const todayIso = useMemo(() => uzDateIso(), []);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  // Oxirgi NOL-YOPISH oyi ("YYYY-MM", hozir 2026-08) — serverdan (04.10.2026).
  // O'sha oy va undan oldingilar uchun oylik CHIQARILMAYDI: server rad etadi
  // (app/api/salary-runs/route.ts), bu yerda tugmalar oldindan o'chadi.
  // Javob kelguncha "" — to'smaydi (server baribir to'sadi).
  const [closedThrough, setClosedThrough] = useState("");
  // BINO (10.10.2026): 1+2 «Akademiya Chortoq» navbarda BITTA qator, oylik
  // esa bino bo'yicha qoladi (lib/branchScope.ts → `payrollBuilding`). Sukut —
  // navbar filiali; almashtirgich faqat hovuzning ikkala binosiga ruxsat
  // bo'lsa chiqadi. Server ruxsatni o'zi tekshiradi.
  const { branchId: navBranchId, branches: allowedBranches } = useBranch();
  const buildings = useMemo(
    () => (navBranchId === null ? [] : branchPool(navBranchId).filter((id) => allowedBranches.some((b) => b.id === id))),
    [navBranchId, allowedBranches],
  );
  const [building, setBuilding] = useState<number | null>(null);
  const buildingQuery = building !== null ? `&building=${building}` : "";
  const period = useMemo(() => payrollPeriodOf(monthKey), [monthKey]);
  const isPastMonth = monthKey < currentMonthKey;
  // KELAJAK oy ham ko'riladi (o'quvchi oldindan to'lashi mumkin), lekin
  // undan pul CHIQARILMAYDI — hali ishlanmagan oy uchun oylik berilmaydi.
  // Server ham rad etadi, bu shunchaki tugmani oldindan o'chirib qo'yadi.
  const isFutureMonth = monthKey > currentMonthKey;
  // YOPILGAN oy (nol-yopish, 04.10.2026) — ko'riladi, lekin chiqarilmaydi.
  const isClosedMonth = !!closedThrough && monthKey <= closedThrough;
  // Chiqarish tugmalari bitta sabab bilan o'chadi (kelajak yoki yopilgan oy).
  const payoutBlockedReason = isFutureMonth
    ? t("Kelajak oy uchun oylik chiqarilmaydi")
    : isClosedMonth ? t("Yopilgan oy uchun oylik chiqarilmaydi") : "";
  const monthLabel = `${months[period.month]} ${period.year}`;
  /**
   * O'z oyidan chiqariladigan qoldiq oyining nomi: "2026-09" → "Sentabr";
   * sahifadagi oydan boshqa yilniki bo'lsa yil bilan ("Dekabr 2025").
   */
  function pendingMonthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    const name = months[m - 1] ?? key;
    return y === period.year ? name : `${name} ${y}`;
  }

  // Kechikkan javob YANGI oyning raqamlarini bosib ketmasin: har so'rovga
  // tartib raqami beriladi va faqat eng oxirgisi holatni yozadi (oy tez-tez
  // almashtirilsa javoblar tartibsiz kelishi mumkin).
  const reqSeq = useRef(0);
  // "Berilgan avans" va "To'langan oylik" kartochkalari — pul QAYSI FILIAL
  // KASSASIDAN chiqqani bo'yicha (lib/payrollSources.ts → attachBranchPayouts).
  // Qatorlar bilan BITTA javobda keladi, ya'ni oy va filial har doim bir xil.
  const [given, setGiven] = useState<BranchPayouts | null>(null);
  // Ro'yxat QAYSI FILIAL uchun tuzilgani (server javobidan) va o'sha paytdagi
  // `branch` cookie'si — boshqa oynada filial almashganini sezish uchun
  // (yuqoridagi `readBranchCookie` izohi).
  const [listBranchId, setListBranchId] = useState<number | null>(null);
  const branchCookieAtLoad = useRef<string | null>(null);
  const fetchRows = useCallback(() => {
    const seq = ++reqSeq.current;
    return fetch(`/api/salary-runs/employees-payroll?month=${monthKey}&given=1${buildingQuery}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== reqSeq.current || !d.ok) return;
        setEmployees(d.employees);
        setGiven(d.given ?? null);
        setListBranchId(typeof d.branchId === "number" ? d.branchId : null);
        if (typeof d.closedThrough === "string") setClosedThrough(d.closedThrough);
        setLoadedAt(uzTimeHm());
        branchCookieAtLoad.current = readBranchCookie();
      })
      .finally(() => { if (seq === reqSeq.current) setLoading(false); });
  }, [monthKey, buildingQuery]);

  // Boshqa oynada navbardan filial almashtirilsa — DARHOL qayta yuklanadi,
  // bu oynaga o'tishni kutmasdan (components/shared/BranchContext.tsx).
  useBranchChangedElsewhere(reloadForBranchChange);

  // Zaxira: oyna qayta ko'rinsa/fokus olsa — cookie o'zgarganmi (masalan
  // eski brauzerda xabar kelmagan bo'lsa). Qayta yuklangach sababi bir
  // marta aytiladi.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(BRANCH_CHANGED_FLAG)) {
        sessionStorage.removeItem(BRANCH_CHANGED_FLAG);
        showError(t("Filial boshqa oynada almashtirilgan edi — sahifa yangilandi. Filialni tekshirib, xodimlarni qayta belgilang."));
      }
    } catch { /* sessionStorage yopiq — izohsiz davom etadi */ }
    function check() {
      if (document.visibilityState !== "visible") return;
      const at = branchCookieAtLoad.current;
      if (at === null || readBranchCookie() === at) return;
      reloadForBranchChange();
    }
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [showError, t]);

  // OYNING TUSHUMI VA XARAJATI — "Jami tushum" kartochkasi uchun
  // (/api/salary-runs/month-cashflow). Xodimlar jadvali bilan bir xil
  // filialga kesilgan, ya'ni ikkala raqam bitta qamrovdan.
  //
  // `null` — hali kelmagan. Nol bilan almashtirilmaydi: bo'sh oy ham
  // 0 beradi va ikkalasini ajratib bo'lmasdi, kartochkada esa javob
  // kelguncha "0 so'm" turib qolardi.
  const [cashflow, setCashflow] = useState<
    { daromad: number; xarajat: number; hasCashbox: boolean } | null
  >(null);
  const cashflowSeq = useRef(0);
  const fetchCashflow = useCallback(() => {
    const seq = ++cashflowSeq.current;
    // Manzil QATTIQ yozilgan (shablon ichida emas): ruxsatlar jadvali
    // route fayllari bo'yicha yig'iladi va u chaqiruv manzilini matndan
    // topadi — scripts/gen-api-permissions.mjs.
    return fetch(`/api/salary-runs/month-cashflow?month=${monthKey}${buildingQuery}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== cashflowSeq.current || !d?.ok) return;
        setCashflow({ daromad: d.daromad, xarajat: d.xarajat, hasCashbox: !!d.hasCashbox });
      })
      .catch(() => {});
  }, [monthKey, buildingQuery]);
  useEffect(() => { fetchCashflow(); }, [fetchCashflow]);

  /** "Qayta hisoblash" tugmasi — spinnerni qayta yoqadi. */
  function load() {
    setLoading(true);
    setCashflow(null);
    fetchRows();
    fetchCashflow();
  }
  /**
   * Oyni almashtirish. Tanlov TOZALANADI — boshqa oyda tanlangan xodimlar
   * bo'yicha oylik chiqarib yuborish jiddiy xato bo'lardi.
   * `setLoading` shu yerda, effekt tanasida emas: birinchi renderda `loading`
   * allaqachon true va ortiqcha render zanjiri kerak emas.
   */
  function changeMonth(next: string) {
    if (next === monthKey) return;
    setMonthKey(next);
    setSelected(new Set());
    setLoading(true);
    // Eski oyning qatorlari TOZALANADI. Sarlavha darhol yangi oyni yozadi,
    // javob esa bir necha soniyadan keyin keladi — orada jadval "sentabr"
    // sarlavhasi ostida avgust qatorlarini ko'rsatib turardi (masalan
    // "450 000 × 50%"), ya'ni ekranda noto'g'ri fakt turardi. Endi o'rniga
    // yuklash belgisi chiqadi.
    setEmployees([]);
    // Kartochkadagi daromad/xarajat va kassa bo'yicha avans ham eski
    // oyniki — o'chiriladi.
    setCashflow(null);
    setGiven(null);
  }
  /**
   * Binoni almashtirish (1+2 «Akademiya Chortoq»). Oy almashgandagidek tanlov
   * va eski raqamlar TOZALANADI — boshqa bino ro'yxatidagi belgilangan xodim
   * bilan oylik chiqarib yuborish xato bo'lardi.
   */
  function changeBuilding(next: number) {
    if (next === (building ?? navBranchId)) return;
    setBuilding(next);
    setSelected(new Set());
    setLoading(true);
    setEmployees([]);
    setCashflow(null);
    setGiven(null);
  }
  // `fetchRows` oyga bog'langan — oy o'zgarsa qatorlar o'z-o'zidan qayta
  // yuklanadi.
  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Kassalar — arxivdagilar tanlovga chiqmaydi. Bosh kassa sukut bo'yicha
  // tanlanadi (odatda oylik shundan chiqariladi), lekin o'zgartirsa bo'ladi.
  // Oylik chiqarilgandan keyin ham qayta o'qiladi: kassadagi qoldiq
  // kamaygan bo'ladi va tanlov ro'yxatidagi summalar eskirmasligi kerak.
  function loadCashboxes() {
    return fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        const list = (d.cashboxes as Cashbox[]).filter((c) => !c.archived);
        setCashboxes(list);
        // Tanlov faqat BOSHIDA qo'yiladi — qayta yuklashda foydalanuvchi
        // tanlagan kassa bosh kassaga qaytib ketmasin.
        setCashboxId((cur) => cur || String((list.find((c) => c.isPrimary) ?? list[0])?.id ?? ""));
      })
      .catch(() => {})
      // So'rov muvaffaqiyatli tugadimi yoki xato berdimi — ro'yxat endi
      // "kelayotgan" holatda emas, ya'ni bo'sh-holat xabari haqiqatga aylanadi.
      .finally(() => setCashboxesLoading(false));
  }
  useEffect(() => { loadCashboxes(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (turiFilter !== "all" && e.turi !== turiFilter) return false;
      if (hisoblash !== "all" && e.salaryType !== hisoblash) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.phone.toLowerCase().includes(q);
    });
  }, [employees, query, turiFilter, hisoblash]);

  const allSelected = filtered.filter((e) => e.configured).length > 0
    && filtered.filter((e) => e.configured).every((e) => selected.has(e.id));
  const someSelected = selected.size > 0 && !allSelected;

  // "Hammasini tanlash" ham faqat sozlanganlarni oladi.
  const selectable = useMemo(() => filtered.filter((e) => e.configured), [filtered]);
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) { selectable.forEach((e) => next.delete(e.id)); }
      else { selectable.forEach((e) => next.add(e.id)); }
      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Faqat ish haqi SOZLANGAN xodimlar jamlanadi — sozlanmaganning
  // "hisoblangan"i 0 bo'ladi va uni yig'indiga qo'shish jami summani
  // haqiqatdan kichik ko'rsatgan bo'lardi.
  //
  // "Berilgan avans" va "To'langan oylik" bu yerda YIG'ILMAYDI — ular
  // qatorlardan emas, kassa bo'yicha keladi (`given`).
  const stats = useMemo(() => {
    let hisoblangan = 0, qolgan = 0, kartaga = 0, naqd = 0, otganOydan = 0, qarzdorlik = 0, soliq = 0;
    const configured = employees.filter((x) => x.configured);
    for (const e of configured) {
      hisoblangan += payrollEarned(e, period);
      // "Qolgan to'lanadigan" — kassadan CHIQADIGAN jami (lib/salary.ts →
      // payrollPayout = karta + naqd = musbat qoldiq). Karta va naqd
      // kesimi kartochka izohi uchun. Qarzdorlik ALOHIDA yig'iladi —
      // ishorali yig'indi bo'lganda bir xodimning qarzi boshqasiga
      // to'lanadigan pulni "yeb" qo'yardi.
      qolgan += payrollPayout(e, period);
      kartaga += payrollPlastikLeg(e, period);
      naqd += payrollCashLeg(e, period);
      qarzdorlik += payrollDebt(e, period);
      // Faqat SHU OYDA to'lanadigan qism (04.10.2026 dan): nol-yopish
      // oyining ulushi yoki qarzdorlik.
      otganOydan += e.carryOver;
      // Ushlanadigan soliq (yangi versiyadagi «Soliq» katagi).
      soliq += payrollTax(e, period);
    }
    // O'tgan oylarda to'lanmagan, lekin shu oyda TO'LANMAYDIGAN qoldiq —
    // `qolgan` ga ATAYLAB qo'shilmaydi (aks holda u ikki sahifadan
    // to'lanardi). Kartochkada alohida, oy nomi bilan ko'rinadi.
    const pendingMonths = sumPendingByMonth(configured, period);
    const pending = pendingMonths.reduce((s, x) => s + x.amount, 0);
    // Pending'dan shu oyda shu oy yozuvi bo'lib berilgan bo'lishi mumkin
    // bo'lgan qism — yuqoridagidan AYRILGAN, alohida ogohlantiriladi.
    const maybePaid = configured.reduce((s, e) => s + payrollPendingMaybePaid(e, period), 0);
    return { hisoblangan, qolgan, kartaga, naqd, otganOydan, qarzdorlik, soliq, pending, pendingMonths, maybePaid };
  }, [employees, period]);

  /**
   * SOF FOYDA — barcha chiqimlardan keyin o'quv markazda qoladigan pul.
   *
   *     sof foyda = oy tushumi − oy xarajati − qolgan to'lanadigan oylik
   *
   * XARAJAT ICHIDA allaqachon chiqarilgan avans va oylik BOR (oylik
   * chiqarish ham chiqim yozuvi yaratadi — app/api/salary-runs).
   * Shuning uchun ustiga `stats.qolgan` qo'shiladi, `stats.hisoblangan`
   * emas: aks holda to'langan qism ikki marta ayirilardi.
   *
   * Ko'chirmalar bu hisobga KIRMAYDI — server faqat `payIn`/`payOut`
   * yozuvlarini yig'adi, ya'ni rahbar kassaga topshirilgan tushum
   * "xarajat" bo'lib ko'rinmaydi.
   *
   * `hasCashbox: false` — filialga kassa bog'lanmagan, ya'ni tushum ham,
   * xarajat ham 0 bo'lib keladi. Bunda son KO'RSATILMAYDI: "0 − 0 −
   * oylik" manfiy raqami yolg'on bo'lardi (pul bor, u boshqa kassada).
   */
  const sofFoyda = cashflow ? cashflow.daromad - cashflow.xarajat - stats.qolgan : 0;
  const cashflowNoma = cashflow !== null && !cashflow.hasCashbox;

  // Sukut — ro'yxatdagi birinchi faol to'lov turi. Effektda setState
  // qilinmaydi: qiymat shu yerda HOSILA sifatida chiqariladi, aks holda
  // ro'yxat yuklangach ortiqcha qayta render bo'lardi.
  const methodKey = method || paymentMethods[0]?.key || "";

  // Kassadan CHIQADIGAN summa: tanlangan xodimlarning musbat qoldiqlari
  // (karta oyog'i + kartadan keyingi naqd). Qarzdor xodimga pul chiqmaydi
  // — server ham aynan shu funksiya bilan hisoblaydi
  // (app/api/salary-runs/route.ts).
  const payoutTotal = useMemo(() => {
    let sum = 0;
    for (const e of employees) {
      if (!selected.has(e.id) || !e.configured) continue;
      sum += payrollPayout(e, period);
    }
    return sum;
  }, [employees, selected, period]);

  // Tanlanganlarning O'TGAN OYLARDA to'lanmagan qoldig'i — bu chiqarishga
  // KIRMAYDI (04.10.2026, "faqat o'z oyidan"). Tasdiqlash oynasida ochiq
  // aytiladi, aks holda "sentabr qoldig'i ham shu bilan chiqdi" deb
  // o'ylanib, o'sha oy sahifasida ochiq qolib ketardi.
  const selectedPending = useMemo(
    () => sumPendingByMonth(employees.filter((e) => e.configured && selected.has(e.id)), period),
    [employees, selected, period],
  );
  const selectedPendingTotal = selectedPending.reduce((s, x) => s + x.amount, 0);

  // O'TGAN OY sahifasida: tanlanganlardan bu oy puli JORIY oyda allaqachon
  // berilgan bo'lishi mumkin bo'lganlari (`maybePaidIn`, 04.10.2026 o'tish
  // davri qorovuli). Tasdiqlash oynasida ogohlantiriladi va bir bosishda
  // tanlovdan chiqariladi — chiqarish summasi o'zi O'ZGARMAYDI.
  const selectedMaybePaid = useMemo(
    () => employees.filter((e) => e.configured && selected.has(e.id) && e.maybePaidIn && payrollPayout(e, period) > 0),
    [employees, selected, period],
  );

  // Ro'yxatda umuman plastik oyligi bor xodim bormi — ikkita qo'shimcha
  // ustun faqat shunda chiziladi.
  const anyPlastik = useMemo(() => employees.some((e) => e.plastikSalary > 0), [employees]);

  // Summaning KARTA va NAQD ga bo'linishi. Bu yerda hisob YO'Q — server
  // ham aynan shu funksiyalarni chaqiradi (lib/salary.ts), ya'ni ekrandagi
  // va kassadan chiqadigan raqam bir xil bo'lishi kafolatlangan.
  const { plastikTotal, naqdTotal } = useMemo(() => {
    let plastik = 0;
    let naqd = 0;
    for (const e of employees) {
      if (!selected.has(e.id) || !e.configured) continue;
      plastik += payrollPlastikLeg(e, period);
      naqd += payrollCashLeg(e, period);
    }
    return { plastikTotal: plastik, naqdTotal: naqd };
  }, [employees, selected, period]);

  // Plastik oyog'ining to'lov turi. Sukut — "plastik" kaliti (Sozlamalarda
  // o'chirilgan bo'lsa ro'yxatdagi birinchisi).
  const plastikMethodKey = plastikMethod
    || (paymentMethods.some((m) => m.key === PLASTIK_METHOD_KEY) ? PLASTIK_METHOD_KEY : "")
    || paymentMethods[0]?.key
    || "";

  const activeCashbox = cashboxes.find((c) => String(c.id) === cashboxId);
  // Chegara kassaning umumiy balansi emas, tanlangan TO'LOV TURIDAGI summa —
  // Kassalar sahifasidagi Chiqim oynasi ham shunday tekshiradi.
  const totalOf = (key: string) => (activeCashbox && key ? Number(activeCashbox.methodTotals?.[key]) || 0 : 0);
  const available = totalOf(methodKey);
  const plastikAvailable = totalOf(plastikMethodKey);
  // Har bir oyoq O'Z chelagidan yechiladi, shuning uchun yetarlilik ham
  // alohida tekshiriladi. Ikkalasi bir xil turga tushsa — bitta chelak.
  const sameMethod = plastikTotal > 0 && naqdTotal > 0 && plastikMethodKey === methodKey;
  const notEnough = sameMethod
    ? available < payoutTotal
    : (naqdTotal > available) || (plastikTotal > plastikAvailable);
  const needsPlastikMethod = plastikTotal > 0 && !plastikMethodKey;
  // Qancha YETMAYDI — har bir chelak o'zi bo'yicha. Ilgari xabarda doim
  // `payoutTotal − naqd` turardi: naqd yetarli-yu karta chelagi yetmaganda
  // u MANFIY son ("−57 000 000 so'm kam") chiqarardi.
  const shortfall = sameMethod
    ? Math.max(payoutTotal - available, 0)
    : Math.max(naqdTotal - available, 0) + Math.max(plastikTotal - plastikAvailable, 0);
  const canPayout =
    Boolean(cashboxId) && Boolean(methodKey) && payoutTotal > 0
    && !notEnough && !payoutBlockedReason && !sameMethod && !needsPlastikMethod;

  // «FAQAT KARTANI CHIQARISH» (30.09.2026) — bank kartaga o'tkazgan pulni
  // bir bosishda qayd etish: tanlanganlarning (hech kim tanlanmagan bo'lsa —
  // ro'yxatdagi kartasi bor HAMMANING) faqat karta oyog'i. Naqd qismi
  // "Qolgan" ustunida qoladi va keyin «Oylikni chiqarish» yoki kassadan
  // beriladi. Server aynan shu funksiya bilan hisoblaydi (`only: "karta"`).
  const kartaRows = employees
    .filter((e) => e.configured && (selected.size === 0 || selected.has(e.id)))
    .map((e) => ({ e, amount: payrollPlastikLeg(e, period) }))
    .filter((x) => x.amount > 0);
  const kartaTotal = kartaRows.reduce((s, x) => s + x.amount, 0);
  const kartaShort = Math.max(kartaTotal - plastikAvailable, 0);
  const canKarta =
    Boolean(cashboxId) && Boolean(plastikMethodKey) && kartaTotal > 0 && kartaShort === 0 && !payoutBlockedReason;

  /**
   * Chiqarish so'rovi (tasdiqlash oynasidagi «Ha, chiqarish»). Muvaffaqiyatda
   * `true`: tanlov tozalanadi, jadval va kassalar qayta o'qiladi — oynani
   * yopish chaqiruvchida. Xato — toast, `false`.
   *
   * `note` — ixtiyoriy izoh (yangi versiya oynasi): jurnal yozuvlari izohiga
   * va chiqarish hujjatiga qo'shiladi.
   */
  async function submitPayout(kartaOnly: boolean, note = ""): Promise<boolean> {
    setSaving(true);
    const noteText = note.replace(/\s+/g, " ").trim();
    const extra = noteText ? { note: noteText } : {};
    try {
      const res = await fetch("/api/salary-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `month` — pul QAYSI oy hisobi uchun chiqayotgani. Serverda
        // chiqim yozuvining sanasi ham shu oy ichida bo'ladi, aks holda
        // o'tgan oy qayta ochilganda summa yana "to'lanmagan" bo'lib
        // ko'rinardi (app/api/salary-runs/route.ts → entryDate).
        // `method` — NAQD oyog'i (va plastigi yo'q xodimlarning yagonasi).
        // `plastikMethod` faqat karta oyog'i bo'lganda ishlatiladi.
        // «Faqat karta»da naqd oyog'i yo'q — faqat plastik turi ketadi.
        // `branchId` — ro'yxat qaysi filialniki; boshqa oynada filial
        // almashgan bo'lsa server rad etadi (409, `branchChanged`).
        body: JSON.stringify(kartaOnly
          ? {
              employeeIds: kartaRows.map((x) => x.e.id),
              cashboxId: Number(cashboxId),
              plastikMethod: plastikMethodKey,
              month: monthKey,
              only: "karta",
              branchId: listBranchId ?? undefined,
              ...extra,
            }
          : {
              employeeIds: Array.from(selected),
              cashboxId: Number(cashboxId),
              method: methodKey,
              plastikMethod: plastikTotal > 0 ? plastikMethodKey : undefined,
              month: monthKey,
              branchId: listBranchId ?? undefined,
              ...extra,
            }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        setSaving(false);
        // Ro'yxat eskirgan (filial boshqa oynada almashgan) — sahifa yangi
        // filial bo'yicha qayta yuklanadi, sababi yuklangach aytiladi.
        if (data.branchChanged) {
          reloadForBranchChange();
          return false;
        }
        showError(t(data.error || "Oylik chiqarilmadi"));
        return false;
      }
      // Ilgari bu yerdan tarix sahifasiga o'tilardi — endi hisob-kitob
      // bo'limning BOSH sahifasi, shuning uchun shu yerda qolamiz va
      // jadvalni qayta yuklaymiz: "To'langan oylik" va "Qolgan" darhol
      // yangilanadi, ya'ni chiqarish natijasi ko'z oldida ko'rinadi.
      // Kassadagi qoldiq ham kamaygani uchun kassalar qayta o'qiladi.
      showSuccess(kartaOnly
        ? t("Kartaga chiqarildi — {kartaTotal}", { kartaTotal: fmtSum(kartaTotal) })
        : t("Oylik chiqarildi — {payoutTotal}", { payoutTotal: fmtSum(payoutTotal) }));
      setSelected(new Set());
      setSaving(false);
      load();
      loadCashboxes();
      return true;
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
      return false;
    }
  }

  const turiOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.turi));
    return Array.from(set);
  }, [employees]);

  return {
    // ro'yxat
    employees, loading, loadedAt, given, cashflow, closedThrough, listBranchId,
    // oy va bino
    currentMonthKey, todayIso, monthKey, period, isPastMonth, isFutureMonth, isClosedMonth,
    payoutBlockedReason, monthLabel, pendingMonthLabel, changeMonth,
    navBranchId, allowedBranches, buildings, building, changeBuilding, load,
    // filtr
    query, setQuery, turiFilter, setTuriFilter, hisoblash, setHisoblash, filtered, turiOptions,
    // tanlov
    selected, setSelected, selectable, allSelected, someSelected, toggleAll, toggleOne,
    // raqamlar
    stats, sofFoyda, cashflowNoma, anyPlastik,
    // kassa va to'lov turi
    paymentMethods, methodsLoading, cashboxes, cashboxesLoading, loadCashboxes,
    cashboxId, setCashboxId, activeCashbox, methodKey, setMethod, plastikMethodKey, setPlastikMethod,
    available, plastikAvailable,
    // chiqarish
    payoutTotal, plastikTotal, naqdTotal, selectedPending, selectedPendingTotal, selectedMaybePaid,
    sameMethod, notEnough, needsPlastikMethod, shortfall, canPayout,
    kartaRows, kartaTotal, kartaShort, canKarta,
    saving, submitPayout,
  };
}

export type PayrollState = ReturnType<typeof usePayroll>;
