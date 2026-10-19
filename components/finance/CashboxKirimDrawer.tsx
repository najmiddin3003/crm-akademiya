"use client";

import Link from "@/components/ui/Link";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import DatePicker from "@/components/ui/DatePicker";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import SuggestInput from "@/components/ui/SuggestInput";
import type { StudentRow } from "@/lib/studentsData";
import { type Cashbox } from "@/lib/cashboxes";
import { useKirimForm } from "./useKirimForm";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function fmtSom(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " so'm";
}

// Kassalar sahifasidagi "+ Kirim" — referens saytdagi (edutizim.uz) oyna
// bilan bir xil maydonlar: Tranzaksiya (kategoriya), O'qituvchi, O'quvchi,
// Qiymat, To'lov turi, Sana, Izoh. Pul harakati (methodTotals/balance)
// /api/cashboxes/:id/adjust orqali HAQIQIY, kategoriya/o'qituvchi/o'quvchi/
// sana/izoh bilan birga — shu amal "Tranzaksiyalar" va "Moliya
// hisobotlari/analitikasi" sahifalari ko'radigan haqiqiy jurnalga yoziladi.
// "Tranzaksiya" ro'yxati — Moliya → Tranzaksiya turi (/finance-tx-types)
// sahifasidagi HAQIQIY, admin boshqaradigan ro'yxatdan (mainType: "kirim").
export default function CashboxKirimDrawer({
  cashbox,
  students,
  studentsLoading,
  studentsRefreshing,
  onClose,
  onSaved,
  initialStudentKey,
}: {
  cashbox: Cashbox;
  /**
   * O'quvchilar ro'yxati OTA SAHIFADAN keladi (CashboxesPage) — bu oyna
   * uni O'ZI SO'RAMAYDI.
   *
   * NEGA: ota sahifa aynan shu ro'yxatni allaqachon olgan va React
   * holatida ushlab turibdi. Ilgari drawer uni qaytadan so'rardi; kesh
   * kaliti bir xil ("pupils:light"), lekin TTL 30 s — ya'ni kassir
   * jurnalni ko'rib turib "+ Kirim" bosgan har safar 546 KB qaytadan
   * kelardi va `StudentSearchSelect` `disabled={loading}` bilan ~1.4 s
   * o'chib turardi. Endi so'rov umuman ketmaydi.
   */
  students: StudentRow[];
  studentsLoading: boolean;
  /** Ro'yxat FONDA yangilanmoqda — maydon ishlaydi, faqat izoh chiqadi. */
  studentsRefreshing: boolean;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
  /**
   * OLDINDAN TANLANGAN O'QUVCHI (`pupils.id`, satr) — O'quvchilar ro'yxatidagi
   * tezkor paneldan «To'lov qabul qilish» (18.10.2026, /finance-cash?kirim=<id>).
   * Faqat boshlang'ich qiymat: summa, tur, oy — kassirning o'zida; tur
   * almashtirilsa (`pickType`) odatdagidek tozalanadi.
   */
  initialStudentKey?: string;
}) {
  const { t, months } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess } = useToast();
  // Mantiq va so'rov — yangi versiya formalari bilan BITTA manba (./useKirimForm.ts,
  // 19.10.2026 da shu fayldan aynan ko'chirildi).
  const {
    paymentMethods,
    methodsLoading,
    teacherNames,
    teachersLoading,
    categoryId,
    teacherName,
    setTeacherName,
    studentKey,
    setStudentKey,
    amount,
    setAmount,
    method,
    setMethod,
    date,
    setDate,
    periodMonth,
    setPeriodMonth,
    periodTouched,
    setPeriodTouched,
    rows,
    note,
    setNote,
    noteOptions,
    saving,
    categories,
    categoriesLoading,
    key,
    studentOptions,
    nameOf,
    phoneOf,
    teacherPhoneOf,
    balanceOf,
    selectedStudent,
    selectedBalance,
    pendingDisc,
    discKey,
    showTeacher,
    showStudent,
    showRows,
    total,
    noteMonthNums,
    noteMismatch,
    noteTarget,
    monthName,
    pickType,
    addRow,
    removeRow,
    updateRow,
    save,
  } = useKirimForm({
    cashbox,
    students,
    initialStudentKey,
    onSuccess: ({ cashbox: updated }) => {
      onSaved(updated);
      showSuccess(t("Kirim qo'shildi"));
      modal.close();
    },
  });

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Kirim")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Tranzaksiya")}</label>
            <div className="relative">
              {/* Ikkala yo'l ham `pickType()` dan o'tadi — u yagona
                  darvoza (izohi funksiyaning o'zida). */}
              <Select value={String(categoryId ?? "")} onChange={(v) => {
                  const id = Number(v);
                  pickType(categories.find((tv) => tv.id === id) ?? null);
                }} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={selectPlaceholder(categoriesLoading, categories.length, "Kirim turi qo’shilmagan")} clearable disabled={categoriesLoading} />
              {categoryId !== null && (
                <button
                  type="button"
                  onClick={() => pickType(null)}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={t("Tozalash")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          {/* O'QITUVCHI va O'QUVCHI tanlovlari turning "Mijoz"
              katakchalariga qarab chiqadi (Sozlamalar → Moliya →
              Tranzaksiya turi). Hech biri belgilanmagan bo'lsa ikkalasi
              ham chiqmaydi — masalan "Kitob sotuvi" da pul odamga
              bog'liq emas va uning o'rniga (Qiymat + Oy) qatorlari
              turadi. */}
          {showTeacher && (
          <div>
            {/* O'quvchi tanlovi bilan bir xil qidiruvli ro'yxat. Ilgari bu
                oddiy <select> edi: bazada 43 o'qituvchi bor va kerakligini
                topish uchun butun ro'yxatni aylantirishga to'g'ri kelardi,
                telefon raqami esa umuman ko'rinmasdi. */}
            <StudentSearchSelect
              label={t("O'qituvchini tanlang")}
              value={teacherName}
              onChange={setTeacherName}
              options={teacherNames}
              loading={teachersLoading}
              placeholder={t("Ism yoki telefon bo'yicha qidiring…")}
              subtitleOf={(n) => teacherPhoneOf(n)}
            />
          </div>
          )}

          {showStudent && (
          <div>
            <StudentSearchSelect
              label={t("O'quvchini tanlang")}
              value={studentKey}
              onChange={setStudentKey}
              options={studentOptions}
              labelOf={nameOf}
              loading={studentsLoading}
              placeholder={t("Ism yoki telefon bo'yicha qidiring…")}
              subtitleOf={(n) => phoneOf(n)}
              trailingOf={(n) => {
                const b = balanceOf(n);
                return <span className={b < 0 ? "text-rose-600" : "text-muted-foreground"}>{t(fmtSom(b))}</span>;
              }}
            />
            {/* Ro'yxat fonda yangilanayotgan payt. Sababi ko'rinib tursin:
                `StudentSearchSelect` erkin matn qabul qilmaydi (qiymat faqat
                ro'yxatdagi tugmadan chiqadi), ya'ni qabulxona hozirgina
                qo'shgan o'quvchini topa olmagan kassir nima kutayotganini
                bilmasdi. */}
            {studentsRefreshing && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("Ro'yxat yangilanmoqda…")}</p>
            )}
            {/* Tanlangandan keyin — balans va telefon. */}
            {selectedStudent && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-[12px]">
                <div>
                  Balans:{" "}
                  <strong className={selectedBalance < 0 ? "text-rose-600" : "text-emerald-600"}>{t(fmtSom(selectedBalance))}</strong>
                  {selectedStudent.phone && <span className="text-muted-foreground"> · +998 {selectedStudent.phone}</span>}
                </div>
                <Link
                  href={`/student-edit/${selectedStudent.id}?src=list`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  {t("O'quvchi profilini ko'rish")}
                </Link>
              </div>
            )}
            {/* Tanga evaziga chegirma — shu oy to'loviga (yuqoridagi izoh). */}
            {selectedStudent && !showRows && pendingDisc && pendingDisc.key === discKey && (() => {
              const d = pendingDisc;
              const teacherSet = showTeacher && teacherName.trim() !== "";
              const mismatch = teacherSet && d.teacherName.trim() !== "" && key(teacherName) !== key(d.teacherName);
              return (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed">
                  <div>
                    🏷️ <strong>{t("Tanga evaziga chegirma: −{sum} ({pct}%)", { sum: t(fmtSom(d.amountSom)), pct: d.percent })}</strong> — {d.groupLabel}
                  </div>
                  {!d.inGroup ? (
                    <div className="text-muted-foreground">{t("O'quvchi o'sha guruhda emas — chegirma qo'llanmaydi.")}</div>
                  ) : mismatch ? (
                    <div>
                      {t("Chegirma faqat {teacher} to'loviga qo'llanadi.", { teacher: d.teacherName })}{" "}
                      <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setTeacherName(d.teacherName)}>
                        {t("Shu o'qituvchini tanlash")}
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{t("O'quvchidan shuncha kam oling — saqlanganda chegirma o'zi qo'llanadi.")}</div>
                  )}
                </div>
              );
            })()}
          </div>
          )}

          {/* ODATDAGI turlar — bitta Qiymat maydoni (bugungidek). */}
          {!showRows && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {/* UCHINCHI SHAXS — (Qiymat + Oy) juftlari. Bitta sotuv bir
              necha oyni qoplashi mumkin, shuning uchun qator qo'shiladi.
              Qatorlar KALKULYATOR: ular alohida jurnal yozuvi yaratmaydi,
              yig'indi bitta yozuvga ketadi (sabab `save()` izohida). */}
          {showRows && (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={row.id} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
                    <MoneyInput
                      value={row.amount}
                      onChange={(v) => updateRow(row.id, { amount: v })}
                      placeholder={t("Qiymat")}
                      className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-medium mb-1.5">{t("Oyni tanlang")}</label>
                    <MonthYearPicker
                      className="w-full"
                      value={{
                        month: Number(row.periodMonth.slice(5, 7)),
                        year: Number(row.periodMonth.slice(0, 4)),
                      }}
                      onChange={(v) =>
                        updateRow(row.id, {
                          periodMonth: `${v.year}-${String(v.month).padStart(2, "0")}`,
                        })
                      }
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

          {/* Yig'indi FAQAT bir nechta qator bo'lganda — bitta qatorda u
              yuqoridagi "Qiymat" ning takrori bo'lardi. Shart `showRows`
              ga EMAS: yuboriladigan summa ekranda ko'rinib turishi kerak. */}
          {rows.length > 1 && showRows && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Umumiy summa")}</label>
              <input
                value={groupNumber(total)}
                readOnly
                type="text"
                className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
              />
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            <Select value={method} onChange={(v) => setMethod(v)} options={paymentMethods.map((m) => ({ value: m.key, label: m.name }))} placeholder={selectPlaceholder(methodsLoading, paymentMethods.length, "To’lov turi qo’shilmagan")} clearable disabled={methodsLoading} />
          </div>

          {/* Uchinchi shaxs turida oy QATORLARDA tanlanadi, shu bois bu
              yerda faqat sana qoladi va grid bitta ustunga tushadi. */}
          <div className={showRows ? "" : "grid grid-cols-2 gap-3"}>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Sanani tanlang")}</label>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  // Sana o'zgarsa oy ham ergashadi — kassir odatda bugungi
                  // kun uchun to'lov qabul qiladi va ikkinchi maydonga
                  // umuman tegishi shart emas. Oy QO'LDA tanlangan bo'lsa
                  // — tegilmaydi (`periodTouched` izohi).
                  if (d && !periodTouched) setPeriodMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="w-full"
              />
            </div>
            {!showRows && (
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
          {/* To'lov sanasi va u qoplaydigan oy HAR DOIM bir xil emas:
              sentabrda kelgan pul avgust darslari uchun bo'lishi mumkin.
              O'qituvchining foizli oyligi aynan shu oyga hisoblanadi.
              Shart `showTeacher` ni ham tekshiradi: o'qituvchi tanlovi
              chiqmaydigan turda bu ogohlantirish YOLG'ON bo'lardi — u
              yerda hech kimning oyligi o'zgarmaydi. */}
          {noteMismatch ? (
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
          ) : !showRows && showTeacher && periodMonth !== (date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "") && (
            <p className="-mt-1 text-[11px] text-amber-600">
              {t("To'lov {month} oyiga yoziladi — o'qituvchining o'sha oydagi oyligiga qo'shiladi.", { month: monthName(periodMonth) })}
            </p>
          )}

          {/* IZOH — oddiy input, lekin ustiga bosilganda shu kassada ilgari
              yozilgan izohlar chiqadi va yozgan sari filtrlanadi. Ro'yxat
              MAJBURLAMAYDI: yangi matn ham bemalol yoziladi. */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <SuggestInput
              value={note}
              onChange={setNote}
              options={noteOptions}
              placeholder={t("Yozing yoki avvalgilaridan tanlang")}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving || noteMismatch} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
