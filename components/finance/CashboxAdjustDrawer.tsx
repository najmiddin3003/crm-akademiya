"use client";

import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import StudentGroupsModal from "./StudentGroupsModal";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import type { StudentRow } from "@/lib/studentsData";
import { type Cashbox } from "@/lib/cashboxes";
import { txTarget, txTargetLabel } from "@/lib/txTarget";
import { payrollCashLeg, payrollPayout } from "@/lib/salary";
import { ROLE_LABELS } from "@/constants/employees";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useChiqimForm } from "./useChiqimForm";

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function fmtSum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
/** Sanadan "YYYY-MM". Sana bo'lmasa — bugungi oy (Kirim oynasidagi bilan bir xil). */
function monthOf(d: Date | null): string {
  const x = d ?? new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}

// Kassalar sahifasidagi "- Chiqim" — referens saytdagi oyna: Tranzaksiya
// (xarajat turi), O'quvchini/Xodimni tanlang, so'ng bir nechta Qiymat
// qatori — "+" bosilsa yana bir qator qo'shiladi (bitta xarajatni bir
// nechta band qilib yozish uchun), ularning yig'indisi "Umumiy summa"da
// avtomatik ko'rsatiladi. Pul harakati (methodTotals/balance) shu umumiy
// summa bo'yicha /api/cashboxes/:id/adjust orqali HAQIQIY, kategoriya/
// o'quvchi/sana/izoh bilan birga — "Tranzaksiyalar" va "Moliya hisobotlari/
// analitikasi" ko'radigan haqiqiy jurnalga yoziladi. "Tranzaksiya" ro'yxati
// — Moliya → Tranzaksiya turi (/finance-tx-types) sahifasidagi HAQIQIY,
// admin boshqaradigan ro'yxatdan (mainType: "chiqim").
//
// "QAYSI OY UCHUN" (04.10.2026) — FAQAT xodimga AVANS/OYLIK turida, sana
// yonida (Kirim oynasidagi kabi). Tanlangan oy `periodMonth` bo'lib
// yozuvga tushadi va oylik hisobi uni `monthMatch` bilan o'qiydi
// (lib/payrollSources.ts); chegara ham, "Oylik" qulflangan summasi ham
// AYNAN shu oy qatoridan. Sukut — sananing oyi.
//
// NIMA NOTO'G'RI EDI: oy yuborilmasdi va yozuv SANA oyiga tushardi —
// oktabrda berilgan SENTABR oyligi sentabr sahifasida ayrilmasdi,
// oktabrda "O'tgan oydan" kamaymasdi, keyin sentabr uchun "Oylikni
// chiqarish" uni IKKINCHI marta to'lardi. (Ilgari har qatorda turgan
// "Oyni tanlang" esa hech qayerga yuborilmasdi va olib tashlangan edi —
// bu boshqa narsa: bitta oy, butun yozuv uchun.) Boshqa chiqim turlarida
// oy tanlanmaydi va yuborilmaydi — ular hech kimning oyligiga tegmaydi.
export default function CashboxAdjustDrawer({
  cashbox,
  students,
  studentsLoading,
  studentsRefreshing,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  mode: "chiqim";
  /**
   * O'quvchilar ro'yxati OTA SAHIFADAN (CashboxesPage) keladi — bu oyna
   * uni O'ZI SO'RAMAYDI. Sabab CashboxKirimDrawer dagi bilan bir xil:
   * ota sahifa ro'yxatni allaqachon olgan, drawer esa uni bir xil kesh
   * kaliti bilan qaytadan so'rardi va TTL (30 s) o'tgach 546 KB / ~1.4 s
   * kutardi — o'sha paytda tanlov maydoni `disabled` bo'lib turardi.
   */
  students: StudentRow[];
  studentsLoading: boolean;
  /** Ro'yxat FONDA yangilanmoqda — maydon ishlaydi, faqat izoh chiqadi. */
  studentsRefreshing: boolean;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  const { t, months } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess } = useToast();
  // Mantiq va so'rov — yangi versiya «Kassa amali» bilan BITTA manba
  // (./useChiqimForm.ts, 19.10.2026 da shu fayldan aynan ko'chirildi).
  const {
    methodsLoading,
    categoryId,
    setCategoryId,
    personKey,
    setPersonKey,
    salaryOpen,
    setSalaryOpen,
    groupsOpen,
    setGroupsOpen,
    rows,
    method,
    setMethod,
    date,
    setDate,
    periodMonth,
    setPeriodMonth,
    periodTouched,
    setPeriodTouched,
    note,
    setNote,
    saving,
    categories,
    categoriesLoading,
    dateMonthKey,
    target,
    isSalaryPayoutCategory,
    period,
    payrollReady,
    periodFuture,
    periodClosed,
    periodBlocked,
    monthName,
    noteMonthNums,
    noteMismatch,
    noteTarget,
    resetPeriod,
    employeesLoading,
    activeEmployees,
    roleOf,
    selectedEmployee,
    studentOptions,
    studentNameOf,
    balanceOf,
    selectedStudent,
    studentBalance,
    teacherNames,
    teachersLoading,
    refundTeacher,
    setRefundTeacher,
    available,
    methodOptions,
    payrollOf,
    selectedPayroll,
    salaryConfigured,
    payrollPending,
    employeeOylik,
    isPlastikMethod,
    salaryBreakdown,
    remainingSalary,
    oylikLocked,
    total,
    salaryExhausted,
    salaryExceeds,
    exhaustedMessage,
    earnedLabel,
    pendingMonths,
    pendingMaybePaid,
    pendingTarget,
    carryHint,
    paidLater,
    studentBalanceExceeds,
    addRow,
    removeRow,
    updateRow,
    save,
  } = useChiqimForm({
    cashbox,
    students,
    onSuccess: ({ cashbox: updated }) => {
      onSaved(updated);
      showSuccess(t("Chiqim amalga oshirildi"));
      modal.close();
    },
  });

  return (
    <><Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Chiqim")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Tranzaksiya")}</label>
            <Select value={String(categoryId ?? "")} onChange={(v) => {
                  // Tur o'zgarsa avval tanlangan kishi kerak bo'lmay qolishi
                  // mumkin (o'quvchi → xodim yoki umuman tanlovsiz tur).
                  // Tozalanmasa, maydon yashirinib ketgan bo'lsa ham eski
                  // ism `studentName` bo'lib yozuvga tushardi.
                  const next = categories.find((tv) => tv.id === Number(v)) ?? null;
                  if (txTarget(next) !== target) {
                    setPersonKey("");
                    setRefundTeacher("");
                  }
                  // "Qaysi oy uchun" ham sananing oyiga qaytadi (`resetPeriod`) —
                  // faqat tur HAQIQATAN almashganda.
                  if ((next?.id ?? null) !== categoryId) resetPeriod();
                  setCategoryId(next?.id ?? null);
                }} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={selectPlaceholder(categoriesLoading, categories.length, "Chiqim turi qo'shilmagan")} clearable disabled={categoriesLoading} />
          </div>

          {/* Kim tanlanishi tranzaksiya turiga bog'liq (lib/txTarget.ts):
              xodimga oylik/avans → xodimlar, o'quvchiga pul qaytarildi →
              o'quvchilar, qolgan turlarda (List, Printer, Suv…) tanlov
              umuman ko'rsatilmaydi. */}
          {target !== null && (
            <div className="space-y-2">
              <StudentSearchSelect
                label={txTargetLabel(target)}
                value={personKey}
                onChange={(v) => {
                  setPersonKey(v);
                  // Boshqa o'quvchi — oldingisining ustozi qolib ketmasin;
                  // yangisi effektda oxirgi to'lovidan qayta to'ladi.
                  setRefundTeacher("");
                  // Boshqa xodim — oldingisi uchun tanlangan oy qolib ketmasin.
                  // Faqat HAQIQIY almashishda (oldin boshqa xodim tanlangan
                  // bo'lsa; tozalash ham shunga kiradi). BIRINCHI tanlovda
                  // (personKey bo'sh) oy tegilmaydi: kassir avval «Sentyabr»
                  // ni tanlab, xodimni keyin tanlasa, oy jimgina sananing
                  // oyiga qaytib, sentabr oyligi oktabrga yozilib ketardi
                  // (04.10.2026, ko'rib chiquvchi topgan).
                  if (personKey && v !== personKey) resetPeriod();
                }}
                options={target === "employee" ? activeEmployees.map((e) => e.name) : studentOptions}
                // O'quvchi turida variantlar ID, ko'rinadigan matn esa ism.
                labelOf={target === "student" ? studentNameOf : undefined}
                // Bitta tanlovni IKKI manba to'ldiradi — turga QARAB: xodim
                // turida xodimlar ro'yxati, aks holda o'quvchilar. Ikkalasini
                // birlashtirib yuborish xato bo'lardi — o'quvchi
                // tanlanayotganda xodimlar ro'yxati kutilmasligi kerak.
                loading={target === "employee" ? employeesLoading : studentsLoading}
                placeholder={target === "employee" ? t("Xodimni qidiring…") : t("Tanlang")}
                subtitleOf={target === "employee" ? (n) => ROLE_LABELS[roleOf(n) as keyof typeof ROLE_LABELS] ?? roleOf(n) : undefined}
                // Ism yonida shu oynada CHIQARISH MUMKIN bo'lgan summa —
                // tanlangan to'lov turiga qarab (naqd: kartadan keyingi
                // qoldiq; plastik: karta + naqd), jami hisoblangan emas.
                // Pastdagi `remainingSalary` bilan bir xil qoida.
                trailingOf={target === "employee" ? (n) => {
                  // Tanlangan oyning qatorlari hali kelmagan — "Sozlanmagan"
                  // deyilsa yolg'on bo'lardi.
                  if (!payrollReady) return <span className="text-muted-foreground">…</span>;
                  const p = payrollOf(n);
                  if (!p?.configured) return <span className="text-muted-foreground">{t("Sozlanmagan")}</span>;
                  const can = isPlastikMethod ? payrollPayout(p, period) : payrollCashLeg(p, period);
                  return <span className={can > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(can)}</span>;
                } : target === "student" ? (n) => {
                  const b = balanceOf(n);
                  return <span className={b > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(b)}</span>;
                } : undefined}
              />

              {/* Ro'yxat fonda yangilanayotgan payt. Faqat o'quvchi turida:
                  xodimlar ro'yxati boshqa manbadan keladi. Sababi ko'rinib
                  tursin — `StudentSearchSelect` erkin matn qabul qilmaydi,
                  ya'ni hozirgina qo'shilgan o'quvchini topa olmagan kassir
                  nima kutayotganini bilmasdi. */}
              {target === "student" && studentsRefreshing && (
                <p className="text-[11px] text-muted-foreground">{t("Ro'yxat yangilanmoqda…")}</p>
              )}

              {selectedStudent && (
                <div className="space-y-2">
                  <div className="text-[13px] rounded-md border border-border bg-secondary/20 px-2.5 py-2">
                    Balans:{" "}
                    <strong className={studentBalance > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                      {fmtUZS(studentBalance)}
                    </strong>
                  </div>
                  {studentBalanceExceeds && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      Summa o&apos;quvchi balansidan ({fmtUZS(studentBalance)}) ko&apos;p bo&apos;lishi mumkin emas.
                    </div>
                  )}
                  {/* Qaytarilgan pul qaysi ustozning tushumidan ayrilishi —
                      o'quvchining oxirgi to'lovidagi ustoz o'zi tushadi
                      (yuqoridagi effekt), kassir o'zgartira oladi. */}
                  <StudentSearchSelect
                    label={t("Ustozi (tushumidan ayriladi)")}
                    value={refundTeacher}
                    onChange={setRefundTeacher}
                    options={teacherNames}
                    loading={teachersLoading}
                    placeholder={t("Ism bo'yicha qidiring…")}
                  />
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    {t("Qaytarilgan summa o'quvchi balansidan va ustozning shu oydagi tushumidan ayriladi — ustozning foizli oyligi shu summaning foizi qadar kamayadi, qolgani markaz hisobidan ketadi.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setGroupsOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    {t("O'quvchi guruhlarini ko'rish")}
                  </button>
                </div>
              )}

              {selectedEmployee && (
                <>
                  {/* Xodim tanlangach — nimadan qancha chiqarish mumkinligi. */}
                  {/* Kelajak va yopilgan oyda hisob ko'rsatilmaydi — sababi
                      «Qaysi oy uchun» tagida aytiladi (`periodBlocked`).
                      Tanlangan oy qatori kelguncha — "Yuklanmoqda…",
                      "Sozlanmagan" emas. */}
                  {isSalaryPayoutCategory ? (
                    periodBlocked ? null
                    : payrollPending ? (
                      <div className="text-[12.5px] text-muted-foreground">{t("Yuklanmoqda…")}</div>
                    )
                    : salaryConfigured && salaryBreakdown ? (
                      // Hisob zanjiri OCHIQ yoziladi — kassir naqd nega
                      // kam (yoki 0) ekanini shu yerning o'zida ko'rsin:
                      // karta va soliq avval ayriladi. Plastik turida
                      // chegara karta + naqd, ya'ni karta qatori chiqmaydi.
                      <div className="text-[12.5px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2">
                        {isPlastikMethod ? t("Kartaga chiqarish mumkin: ") : t("Naqd chiqarish mumkin: ")}
                        <strong>{fmtUZS(remainingSalary)}</strong>
                        <span className="text-muted-foreground">
                          {" "}({earnedLabel} {fmtUZS(employeeOylik)}
                          {salaryBreakdown.tax > 0 ? t(" − soliq {tax}", { tax: fmtUZS(salaryBreakdown.tax) }) : ""}
                          {salaryBreakdown.carryOver > 0 ? t(" + o'tgan oydan {carryOver}", { carryOver: fmtUZS(salaryBreakdown.carryOver) }) : ""}
                          {salaryBreakdown.carryOver < 0 ? t(" − o'tgan oy qarzdorligi {carryOver}", { carryOver: fmtUZS(-salaryBreakdown.carryOver) }) : ""}
                          {salaryBreakdown.paid > 0 ? t(" − olingan {paid}", { paid: fmtUZS(salaryBreakdown.paid) }) : ""}
                          {!isPlastikMethod && salaryBreakdown.karta > 0 ? t(" − kartaga {karta}", { karta: fmtUZS(salaryBreakdown.karta) }) : ""}
                          )
                        </span>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2">
                        {t("Ish haqi sozlanmagan — chegara qo'llanmaydi. Xodim profilida oylikni kiriting.")}
                      </div>
                    )
                  ) : (
                    <div className="text-[13px] text-muted-foreground">
                      {!payrollReady ? t("Yuklanmoqda…") : salaryConfigured ? `${earnedLabel}: ${fmtUZS(employeeOylik)}` : t("Ish haqi sozlanmagan")}
                    </div>
                  )}
                  {isSalaryPayoutCategory && salaryExhausted && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      {exhaustedMessage}.
                    </div>
                  )}
                  {isSalaryPayoutCategory && !salaryExhausted && salaryExceeds && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      {`Summa ${isPlastikMethod ? "qolgan oylikdan" : "naqd chiqarish mumkin bo'lgan summadan"} (${fmtUZS(remainingSalary)}) ko'p bo'lishi mumkin emas.`}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSalaryOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    {t("Xodim ma'lumotlarini ko'rish")}
                  </button>
                </>
              )}
            </div>
          )}

          {oylikLocked ? (
            // "Oylik": bitta, faqat o'qiladigan maydon — summa xodimning
            // qoldig'idan (yuqoridagi `oylikLocked` izohi). Qator qo'shish
            // ham yo'q: oylik bir necha bandga bo'linmaydi.
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
              {/* Tanlangan oy qatori kelguncha bo'sh — boshqa oyning
                  qoldig'i bir lahza ham ko'rinmasin (`payroll` izohi). */}
              <input
                value={payrollPending || periodBlocked ? "" : groupNumber(remainingSalary)}
                placeholder={payrollPending ? t("Yuklanmoqda…") : undefined}
                readOnly
                type="text"
                className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
              />
              <div className="text-[12px] text-muted-foreground mt-1">
                {t("Oylik summasi hisobdan olinadi — qo'lda o'zgartirilmaydi.")}
              </div>
            </div>
          ) : (
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
                  <MoneyInput
                    value={row.amount}
                    onChange={(v) => updateRow(row.id, { amount: v })}
                    placeholder={t("Qiymat")}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="h-10 w-10 shrink-0 rounded-lg border border-border text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                    title={t("O'chirish")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="h-9 w-9 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center justify-center"
              title={t("Qator qo'shish")}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Umumiy summa")}</label>
            <input
              value={groupNumber(total)}
              readOnly
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            <Select value={method} onChange={(v) => setMethod(v)} options={methodOptions.map(({ m, bal }) => ({ value: m.key, label: `${m.name} (${t(fmtSum(bal))})` }))} placeholder={selectPlaceholder(methodsLoading, methodOptions.length, "Kassada mablag' yo'q")} clearable disabled={methodsLoading} />
            {available != null && (
              <div className="text-[12px] text-muted-foreground mt-1">Mavjud: {fmtUZS(available)}</div>
            )}
          </div>

          {/* Sana + "Qaysi oy uchun" — Kirim oynasidagi joylashuv. Oy faqat
              xodimga avans/oylikda chiqadi; boshqa turlarda grid bitta
              ustunga tushadi va faqat sana qoladi. */}
          <div className={isSalaryPayoutCategory ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Sanani tanlang")}</label>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  // Sana o'zgarsa oy ham ergashadi; oy QO'LDA tanlangan
                  // bo'lsa — tegilmaydi (`periodTouched` izohi).
                  if (d && !periodTouched) setPeriodMonth(monthOf(d));
                }}
                className="w-full"
              />
            </div>
            {isSalaryPayoutCategory && (
              <div>
                <label className="block text-[13px] font-medium mb-1.5">{t("Qaysi oy uchun")}</label>
                <MonthYearPicker
                  className="w-full"
                  value={{ month: Number(periodMonth.slice(5, 7)), year: Number(periodMonth.slice(0, 4)) }}
                  onChange={(v) => {
                    setPeriodMonth(`${v.year}-${String(v.month).padStart(2, "0")}`);
                    setPeriodTouched(true);
                  }}
                />
              </div>
            )}
          </div>
          {/* Oy bo'yicha izohlar — faqat avans/oylikda. Ustuvorlik: kelajak
              yoki yopilgan oy (saqlab bo'lmaydi) → izohdagi oy farqi →
              aks holda HAMMASI (birini boshqasi yashirmaydi): bu oy puli
              keyingi oyda berilgan bo'lishi mumkin (`paidLater`), o'tgan
              oylarda to'lanmagan qoldiq (`carryHint`; shu oyda ortiqcha
              oylik bo'lsa — "qayta chiqarmang", 04.10.2026) va oy sanadan
              farqli (pul qaysi oyning oyligidan ayrilishi). */}
          {isSalaryPayoutCategory && (periodFuture ? (
            <div className="-mt-1 text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
              {t("Kelajak oy uchun avans yoki oylik berilmaydi")}.
            </div>
          ) : periodClosed ? (
            <div className="-mt-1 text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
              {t("Yopilgan oy uchun avans yoki oylik berilmaydi")}.
            </div>
          ) : noteMismatch ? (
            <div className="-mt-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-400">
              {t("Izohda {note} yozilgan, lekin to'lov {month} oyiga yoziladi.", {
                note: noteMonthNums.map((m) => months[m - 1]).join(", "),
                month: monthName(periodMonth),
              })}{" "}
              {t("Oy yoki izoh to'g'rilanmaguncha saqlanmaydi.")}
              {noteTarget && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMonth(noteTarget);
                    setPeriodTouched(true);
                  }}
                  className="ml-1 font-semibold text-primary hover:underline"
                >
                  {t("{month} oyiga o'tkazish", { month: monthName(noteTarget) })}
                </button>
              )}
            </div>
          ) : (
            <>
              {paidLater && (
                <div className="-mt-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
                  {t("{month} qoldig'idan {amount} {later} oyida {later} yozuvi bo'lib berilgan bo'lishi mumkin — u yerda shuncha ortiqcha oylik bor. Qayta bermang: avval o'sha yozuvning oyini tekshiring.", {
                    month: monthName(periodMonth),
                    amount: fmtUZS(paidLater.amount),
                    later: monthName(paidLater.month),
                  })}
                </div>
              )}
              {carryHint && pendingMaybePaid > 0 ? (
                <div className="-mt-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
                  {t("{current} oyida {amount} ortiqcha oylik berilgan — bu {months} puli bo'lishi mumkin. O'sha oydan qayta chiqarmang: avval yozuvning oyini tekshiring.", {
                    current: monthName(periodMonth),
                    amount: fmtUZS(pendingMaybePaid),
                    months: pendingMonths.map((m) => monthName(m.month)).join(", "),
                  })}
                </div>
              ) : carryHint && (
                <div className="-mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                  {pendingMonths.length === 1
                    ? t("{month} oyidan {amount} to'lanmagan — u {current} hisobidan emas, {month} oyligidan chiqariladi.", {
                        month: monthName(pendingMonths[0].month),
                        amount: fmtUZS(pendingMonths[0].amount),
                        current: monthName(periodMonth),
                      })
                    : t("O'tgan oylardan to'lanmagan: {list} — ular {current} hisobidan emas, har biri o'z oyligidan chiqariladi.", {
                        list: pendingMonths.map((m) => `${monthName(m.month)} — ${fmtUZS(m.amount)}`).join(", "),
                        current: monthName(periodMonth),
                      })}
                  {pendingTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodMonth(pendingTarget);
                        setPeriodTouched(true);
                      }}
                      className="ml-1 font-semibold text-primary hover:underline"
                    >
                      {t("{month} oyiga o'tkazish", { month: monthName(pendingTarget) })}
                    </button>
                  )}
                </div>
              )}
              {periodMonth !== dateMonthKey && (
                <p className="-mt-1 text-[11px] text-amber-600">
                  {t("To'lov {month} oyiga yoziladi — xodimning o'sha oydagi oyligidan ayriladi.", { month: monthName(periodMonth) })}
                </p>
              )}
            </>
          ))}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button
            onClick={save}
            disabled={saving || salaryExceeds || salaryExhausted || studentBalanceExceeds || periodBlocked || payrollPending || noteMismatch}
            className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>{salaryOpen && selectedEmployee && (
        <EmployeeSalaryModal
          payroll={selectedPayroll}
          period={period}
          employeeName={selectedEmployee.name}
          onClose={() => setSalaryOpen(false)}
        />
      )}{groupsOpen && selectedStudent && (
        <StudentGroupsModal
          pupilId={selectedStudent.id}
          studentName={selectedStudent.name}
          balance={studentBalance}
          onClose={() => setGroupsOpen(false)}
        />
      )}</>
  );
}
