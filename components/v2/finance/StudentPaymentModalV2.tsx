"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Loader2, Check, Wallet, X } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useKirimForm } from "@/components/finance/useKirimForm";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { timeLabel } from "@/components/v2/ui/groupStatus";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import MonthChips, { monthKeyOf, shiftMonth } from "@/components/v2/form/MonthChips";
import StudentSearchField, { studentPhoneLabel } from "@/components/v2/form/StudentSearchField";
import { Field, FieldError, FieldLabel, MoneyField, Segmented, TextInput, methodDot } from "@/components/v2/form/fields";
import type { Cashbox } from "@/lib/cashboxes";
import type { Group } from "@/lib/groups";
import type { StudentRow } from "@/lib/studentsData";
import { dropCashboxes, loadCashboxes, peekCashboxes, prefetchCashboxes } from "./cashboxesCache";
import { preferStudentType } from "./kirimPrefs";
import { openReceipt } from "./ReceiptHost";

// YANGI VERSIYA — «TO'LOV QABUL QILISH» (rasm «To'lov qabul qilish», yorug'/qorong'i,
// 19.10.2026): o'quvchi kartasi (balans bilan), Guruh (→ o'qituvchi), «Qaysi oy
// uchun» chiplari, Summa + Sana va vaqt, To'lov turi (segment), Kassa, Izoh;
// pastda «Enter saqlash · Esc yopish», «Bekor qilish», «To'lovni qabul qilish».
//
// Mantiq, tekshiruvlar va so'rov — eski Kassa → Kirim oynasi bilan BITTA
// (components/finance/useKirimForm.ts): tur — o'quvchi to'lovi («Kurs to'lovi
// (oylik)»), o'qituvchi — tanlangan guruhdan (guruhi yo'q o'quvchida — qo'lda),
// izohdagi oy qorovuli va tanga chegirmasi o'sha-o'sha.
//
// Ochiladi: o'quvchi tezkor panelidan (o'quvchi tanlangan) va «+ Yangi» dan
// (o'quvchi qidiriladi). Saqlangach — toast «To'lov qabul qilindi» +
// «Chekni ko'rish» (chek qobiqda ochiladi — ./ReceiptHost.tsx).

/** Tugma ustiga kelganda chaqiriladi — bosilganda oyna kutmasdan ochilsin. */
export function prefetchStudentPayment(): void {
  prefetchCashboxes();
}

function fmtNum(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ");
  return n < 0 ? `−${s}` : s;
}
function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join("") || "?";
}

/** Kartadagi holat — tezkor paneldagi qoida (SAVOLLAR 36): faol, hali to'lamagan → «Yangi o'quvchi». */
function statusLabel(s: StudentRow, balance: number): string {
  if (s.status === "Aktiv" && balance === 0) return "Yangi o'quvchi";
  return s.status;
}

export interface StudentPaymentModalProps {
  /** Tanlangan o'quvchi (tezkor paneldan); berilmasa — qidiriladi («+ Yangi»). */
  student?: StudentRow | null;
  /** Guruhlar (sahifada bo'lsa); berilmasa — so'raladi. */
  groups?: Group[];
  onClose: () => void;
  /** Saqlangach (yangilangan kassa bilan). */
  onSaved?: (cashbox: Cashbox) => void;
}

export default function StudentPaymentModalV2(props: StudentPaymentModalProps) {
  const { showError } = useToast();
  const { groups: givenGroups, onClose } = props;
  const [cashboxes, setCashboxes] = useState<Cashbox[] | null>(() => peekCashboxes());
  const [groups, setGroups] = useState<Group[] | null>(givenGroups ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!cashboxes) {
      loadCashboxes()
        .then((list) => {
          if (cancelled) return;
          if (list.length === 0) {
            showError("Sizga biriktirilgan kassa yo'q");
            onClose();
            return;
          }
          setCashboxes(list);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          showError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Serverga ulanib bo'lmadi");
          onClose();
        });
    }
    if (!groups) {
      fetch("/api/groups")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setGroups(d?.ok ? (d.groups as Group[]) : []);
        })
        .catch(() => {
          if (!cancelled) setGroups([]);
        });
    }
    return () => {
      cancelled = true;
    };
    // Bir marta — oyna ochilganda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cashboxes || cashboxes.length === 0 || !groups) return null;
  return <PaymentForm {...props} cashboxes={cashboxes} allGroups={groups} />;
}

function PaymentForm({
  student,
  allGroups,
  cashboxes,
  onClose,
  onSaved,
}: StudentPaymentModalProps & { cashboxes: Cashbox[]; allGroups: Group[] }) {
  const { t, months } = useT();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");

  const [cashboxId, setCashboxId] = useState(() => String((cashboxes.find((c) => c.isPrimary) ?? cashboxes[0]).id));
  const cashbox = cashboxes.find((c) => String(c.id) === cashboxId) ?? cashboxes[0];

  const [chosen, setChosen] = useState<StudentRow | null>(student ?? null);
  const studentList = useMemo(() => (chosen ? [chosen] : []), [chosen]);
  const groupsOf = (id: number) => allGroups.filter((g) => (g.studentIds ?? []).includes(id));
  const myGroups = useMemo(() => (chosen ? allGroups.filter((g) => (g.studentIds ?? []).includes(chosen.id)) : []), [allGroups, chosen]);
  const [groupId, setGroupId] = useState<number | null>(() => (student ? (groupsOf(student.id)[0]?.id ?? null) : null));

  const [submitted, setSubmitted] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const studentRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);
  // Saqlash paytidagi qiymatlar — toast matni uchun.
  const lastSubmit = useRef<{ amount: number; method: string; student: string } | null>(null);

  const k = useKirimForm({
    cashbox,
    students: studentList,
    initialStudentKey: student ? String(student.id) : undefined,
    initialTeacherName: student ? groupsOf(student.id)[0]?.teacher : undefined,
    preferType: preferStudentType,
    onSuccess: ({ cashbox: updated, entryId }) => {
      dropCashboxes();
      const info = lastSubmit.current;
      showToast({
        tone: "success",
        title: t("To'lov qabul qilindi"),
        detail: [info?.student ?? "", `${fmtNum(info?.amount ?? 0)} ${t("so'm")} · ${info?.method ?? ""} · ${updated.name}`].filter((x) => x.trim()),
        action: entryId ? { label: t("Chekni ko'rish"), onClick: () => openReceipt({ entryId, cashboxId: updated.id, cashboxName: updated.name }) } : undefined,
      });
      onSaved?.(updated);
      modal.close();
    },
  });

  /** Guruh almashsa — o'qituvchi ham (to'lov o'sha o'qituvchining foiziga hisoblanadi). */
  function pickGroup(id: number | null) {
    setGroupId(id);
    k.setTeacherName(myGroups.find((g) => g.id === id)?.teacher ?? "");
  }
  function pickStudent(s: StudentRow | null) {
    setChosen(s);
    k.setStudentKey(s ? String(s.id) : "");
    const first = s ? groupsOf(s.id)[0] : undefined;
    setGroupId(first?.id ?? null);
    k.setTeacherName(first?.teacher ?? "");
    // Tanlangach — darhol summaga.
    if (s) requestAnimationFrame(() => amountRef.current?.querySelector<HTMLInputElement>("input")?.focus());
  }

  /* ---- «Qaysi oy uchun»: joriy + keyingi ikki oy, qolgani «Boshqa oy» da ---- */
  const nowKey = monthKeyOf(new Date());
  const chipKeys = [nowKey, shiftMonth(nowKey, 1), shiftMonth(nowKey, 2)];
  const monthTitle = (key: string) => months[Number(key.slice(5, 7)) - 1] ?? key;
  const pickMonth = (key: string) => {
    k.setPeriodMonth(key);
    k.setPeriodTouched(true);
  };
  const dateKey = k.date ? monthKeyOf(k.date) : "";

  /* ---- Tekshiruv: maydon ostida (server ham tekshiradi — useKirimForm.save) ---- */
  const errStudent = !k.studentKey ? t("O'quvchini tanlang") : "";
  const errAmount = !(Number(k.amount) > 0) ? t("Summani kiriting") : "";
  const errMethod = !k.method ? t("To'lov turini tanlang") : "";
  const showAmountErr = (submitted || amountTouched) && errAmount ? errAmount : "";
  const busy = k.saving || k.categoriesLoading;

  function submit() {
    if (busy) return;
    if (errStudent || errAmount || errMethod || k.noteMismatch) {
      setSubmitted(true);
      const first = errStudent ? studentRef.current : errAmount ? amountRef.current : errMethod ? methodRef.current : null;
      first?.querySelector<HTMLElement>("input, [role=radio], button")?.focus();
      return;
    }
    lastSubmit.current = {
      amount: Number(k.amount),
      method: t(k.paymentMethods.find((m) => m.key === k.method)?.name ?? k.method),
      student: chosen?.name ?? "",
    };
    void k.save();
  }

  /* ---- Variantlar ---- */
  const methodOptions = k.paymentMethods.map((m) => ({ value: m.key, label: t(m.name), dot: methodDot(m.key) }));
  const groupOptions: PickerOption[] = myGroups.map((g) => ({
    value: String(g.id),
    label: g.course || t("Guruh"),
    sublabel: [g.teacher, [g.day, timeLabel(g.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    lead: <span className={`size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />,
    keywords: `${g.name} ${g.teacher}`,
  }));
  const teacherOptions: PickerOption[] = k.teacherNames.map((n) => ({ value: n, label: n, sublabel: k.teacherPhoneOf(n) || undefined }));
  const cashboxOptions: PickerOption[] = cashboxes.map((c) => ({
    value: String(c.id),
    label: c.name,
    // Rasmdagidek: bosh kassada «· Bosh kassa», qolganida faqat nomi.
    sublabel: c.isPrimary ? t("Bosh kassa") : undefined,
    keywords: c.moderator,
    lead: (
      <span className={`flex size-6 items-center justify-center rounded-v2-sm ${c.isPrimary ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"}`} aria-hidden>
        {c.isPrimary ? <Crown className="size-3.5" strokeWidth={1.75} /> : <Wallet className="size-3.5" strokeWidth={1.75} />}
      </span>
    ),
  }));

  // Balans — kassa yozuvlaridan (eski oynadagi manba); u yerda yo'q bo'lsa — kartadagisi.
  const balance = chosen ? (k.balances[chosen.id] ?? chosen.balance ?? 0) : 0;
  const disc = k.pendingDisc && k.pendingDisc.key === k.discKey ? k.pendingDisc : null;
  const dirty = !!k.amount || !!k.note.trim() || !!k.method || (!student && !!chosen);

  return (
    <V2Dialog
      controller={modal}
      title={t("To'lov qabul qilish")}
      onClose={onClose}
      dirty={dirty}
      saving={k.saving}
      onSubmit={submit}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={k.saving} className={`${secondaryBtn} justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || k.noteMismatch}
            className={`${primaryBtn} justify-center disabled:cursor-not-allowed disabled:bg-v2-border-strong disabled:text-v2-text-3 disabled:hover:brightness-100`}
          >
            {k.saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            {k.saving ? t("Saqlanmoqda…") : t("To'lovni qabul qilish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* O'quvchi */}
        <div ref={studentRef}>
          {chosen ? (
            <div className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-3.5 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-v2-small font-semibold text-v2-brand-text" aria-hidden>
                {initialsOf(chosen.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-v2-body font-semibold text-v2-text" title={chosen.name}>
                  {chosen.name}
                </div>
                <div className="truncate text-v2-caption font-normal tabular-nums text-v2-text-3">
                  {[studentPhoneLabel(chosen.phone), t(statusLabel(chosen, balance))].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-v2-caption font-normal text-v2-text-3">{t("Balans")}</div>
                <div className={`text-v2-body font-semibold tabular-nums ${balance < 0 ? "text-v2-danger" : "text-v2-text"}`}>
                  {fmtNum(balance)} {t("so'm")}
                </div>
              </div>
              {!student && (
                <button
                  type="button"
                  onClick={() => pickStudent(null)}
                  disabled={k.saving}
                  aria-label={t("Boshqa o'quvchi")}
                  title={t("Boshqa o'quvchi")}
                  className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface hover:text-v2-text"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ) : (
            <Field label={t("O'quvchi")} error={submitted ? errStudent : ""}>
              <StudentSearchField onPick={pickStudent} invalid={submitted && !!errStudent} autoFocus />
            </Field>
          )}
        </div>

        {/* Guruh → o'qituvchi. Guruhi yo'q o'quvchida — o'qituvchi qo'lda (eski oynadagidek). */}
        {chosen &&
          (myGroups.length > 0 ? (
            <Field label={t("Guruh")}>
              <V2Picker
                value={groupId === null ? "" : String(groupId)}
                onChange={(v) => pickGroup(v ? Number(v) : null)}
                options={groupOptions}
                label={t("Guruh")}
                searchable={false}
              />
            </Field>
          ) : (
            <Field label={t("O'qituvchi")} optional hint={t("O'quvchi guruhga qo'shilmagan — to'lov tanlangan o'qituvchi hisobiga yoziladi")}>
              <V2Picker
                value={k.teacherName}
                onChange={k.setTeacherName}
                options={teacherOptions}
                label={t("O'qituvchi")}
                placeholder={t("Tanlanmagan")}
                loading={k.teachersLoading}
                searchPlaceholder={t("Ism yoki telefon…")}
                clearable
              />
            </Field>
          ))}

        {/* Qaysi oy uchun */}
        <div>
          <FieldLabel>{t("Qaysi oy uchun")}</FieldLabel>
          <MonthChips value={k.periodMonth} onChange={pickMonth} keys={chipKeys} currentKey={nowKey} />
          {/* Izohdagi oy ≠ tanlangan oy — MAJBURIY (eski oynadagi qoida, server ham rad etadi). */}
          {k.noteMismatch ? (
            <div role="alert" className="mt-2 rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-caption font-normal text-v2-danger">
              {t("Izohda {note} yozilgan, lekin to'lov {month} oyiga yoziladi.", {
                note: k.noteMonthNums.map((m) => months[m - 1]).join(", "),
                month: k.monthName(k.periodMonth),
              })}{" "}
              {t("Oy yoki izoh to'g'rilanmaguncha saqlanmaydi.")}
              {k.noteTarget && (
                <button type="button" onClick={() => pickMonth(k.noteTarget!)} className="ml-1 font-semibold underline underline-offset-2 hover:no-underline">
                  {t("{month} oyiga o'tkazish", { month: k.monthName(k.noteTarget) })}
                </button>
              )}
            </div>
          ) : k.showTeacher && dateKey && k.periodMonth !== dateKey ? (
            <p className="mt-1.5 text-v2-caption font-normal text-v2-warning">
              {t("To'lov {month} oyiga yoziladi — o'qituvchining o'sha oydagi oyligiga qo'shiladi.", { month: k.monthName(k.periodMonth) })}
            </p>
          ) : (
            <p className="mt-1.5 text-v2-caption font-normal text-v2-text-3">{t("To'lov tanlangan oy hisobiga yoziladi")}</p>
          )}
        </div>

        {/* Tanga evaziga chegirma (gamifikatsiya) — eski oynadagi ogohlantirish. */}
        {chosen && disc && (
          <div className="rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-caption font-normal text-v2-text">
            <div>
              <b className="font-semibold">{t("Tanga evaziga chegirma: −{sum} ({pct}%)", { sum: `${fmtNum(disc.amountSom)} ${t("so'm")}`, pct: disc.percent })}</b> — {disc.groupLabel}
            </div>
            {!disc.inGroup ? (
              <div className="text-v2-text-2">{t("O'quvchi o'sha guruhda emas — chegirma qo'llanmaydi.")}</div>
            ) : k.teacherName.trim() && disc.teacherName.trim() && k.key(k.teacherName) !== k.key(disc.teacherName) ? (
              <div>
                {t("Chegirma faqat {teacher} to'loviga qo'llanadi.", { teacher: disc.teacherName })}{" "}
                <button
                  type="button"
                  className="font-semibold text-v2-brand-text hover:underline"
                  onClick={() => {
                    const g = myGroups.find((x) => k.key(x.teacher) === k.key(disc.teacherName));
                    if (g) pickGroup(g.id);
                    else k.setTeacherName(disc.teacherName);
                  }}
                >
                  {t("Shu o'qituvchini tanlash")}
                </button>
              </div>
            ) : (
              <div className="text-v2-text-2">{t("O'quvchidan shuncha kam oling — saqlanganda chegirma o'zi qo'llanadi.")}</div>
            )}
          </div>
        )}

        {/* Summa + Sana va vaqt */}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div ref={amountRef}>
            <Field label={t("Summa")} error={showAmountErr}>
              <MoneyField value={k.amount} onChange={k.setAmount} onBlur={() => setAmountTouched(true)} state={showAmountErr ? "error" : "default"} autoFocus={!!student} />
            </Field>
          </div>
          <Field label={t("Sana va vaqt")}>
            <div className="[&>button]:h-12">
              <V2DateField
                value={k.date}
                withTime
                onChange={(dt) => {
                  k.setDate(dt);
                  // Sana o'zgarsa oy ham ergashadi — oy QO'LDA tanlangan bo'lsa tegilmaydi (eski oynadek).
                  if (!k.periodTouched) k.setPeriodMonth(monthKeyOf(dt));
                }}
              />
            </div>
          </Field>
        </div>

        {/* To'lov turi — sukut yo'q: kassir ataylab tanlaydi. */}
        <div ref={methodRef}>
          <FieldLabel>{t("To'lov turi")}</FieldLabel>
          {k.methodsLoading ? (
            <div className="h-11 animate-pulse rounded-v2-md bg-v2-skeleton" aria-hidden />
          ) : methodOptions.length === 0 ? (
            <p className="text-v2-small text-v2-text-3">{t("Faol to'lov turi yo'q — Sozlamalar → Moliya → To'lov turlari")}</p>
          ) : (
            <Segmented value={k.method} onChange={k.setMethod} options={methodOptions} label={t("To'lov turi")} />
          )}
          {submitted && errMethod && <FieldError>{errMethod}</FieldError>}
        </div>

        {/* Kassa */}
        <Field label={t("Kassa")}>
          <V2Picker value={cashboxId} onChange={setCashboxId} options={cashboxOptions} label={t("Kassa")} searchable={false} disabled={cashboxes.length < 2} />
        </Field>

        {/* Izoh */}
        <Field label={t("Izoh")} optional>
          <TextInput
            value={k.note}
            onChange={(e) => k.setNote(e.target.value)}
            placeholder={t("Masalan: {month} oyi uchun", { month: monthTitle(k.periodMonth).toLowerCase() })}
            maxLength={300}
          />
        </Field>
      </div>
    </V2Dialog>
  );
}
