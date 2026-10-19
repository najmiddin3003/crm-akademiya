"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Crown, Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useKirimForm } from "@/components/finance/useKirimForm";
import { useChiqimForm } from "@/components/finance/useChiqimForm";
import { useTransferToForm } from "@/components/finance/useTransferToForm";
import EmployeeSalaryModal from "@/components/finance/EmployeeSalaryModal";
import StudentGroupsModal from "@/components/finance/StudentGroupsModal";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2SuggestInput from "@/components/v2/form/V2SuggestInput";
import MonthChips, { MonthField, monthKeyOf, shiftMonth } from "@/components/v2/form/MonthChips";
import StudentSearchField, { studentPhoneLabel } from "@/components/v2/form/StudentSearchField";
import { Field, FieldError, FieldHint, FieldLabel, MoneyField, Segmented, TextInput, methodDot } from "@/components/v2/form/fields";
import { ROLE_LABELS } from "@/constants/employees";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { payrollCashLeg, payrollPayout } from "@/lib/salary";
import { txTarget } from "@/lib/txTarget";
import type { Cashbox } from "@/lib/cashboxes";
import type { StudentRow } from "@/lib/studentsData";
import { dropCashboxes, loadCashboxes, peekCashboxes } from "./cashboxesCache";
import { useHiddenBalances } from "./hiddenBalances";
import { preferStudentType } from "./kirimPrefs";
import { openReceipt } from "./ReceiptHost";

// YANGI VERSIYA — «KASSA AMALI» (rasm «Kassa amali · Chiqim», yorug'/qorong'i,
// 19.10.2026): sarlavha + «… kassasi»; tablar ↙ Kirim / ↗ Chiqim / ⇄ Ko'chirish;
// Kassa (ostida tanlangan turning qoldig'i — yashirilgan kassada «••••••»), Toifa
// («Ro'yxat Sozlamalarda o'zgartiriladi»), Summa + Sana va vaqt, To'lov turi,
// Izoh; pastda amal nomli tugma («Chiqimni saqlash»).
//
// HAR TABNING MANTIQI — eski oynalarniki, AYNAN (19.10.2026 da ko'chirilgan):
//   Kirim     → components/finance/useKirimForm.ts   (CashboxKirimDrawer)
//   Chiqim    → components/finance/useChiqimForm.ts  (CashboxAdjustDrawer: oylik
//               chegarasi, kelajak/yopilgan oy, o'quvchiga qaytarish)
//   Ko'chirish→ components/finance/useTransferToForm.ts (CashboxTransferToDrawer)
// Bu fayl faqat ko'rinish va maydon ostidagi tekshiruv.
//
// Tab ochilganda yaratiladi va boshqa tabga o'tilganda YO'QOLMAYDI (yashirinadi)
// — kiritilgan narsa saqlanib turadi. Saqlash tugmasi va «Saqlanmagan
// o'zgarishlar bor» — faol tabniki (tab o'z holatini `report` bilan aytadi).
//
// «Chek rasmi» (rasmdagi yuklash maydoni) hozircha YO'Q: tranzaksiya yozuvida
// fayl saqlanadigan joy yo'q (design/v2/SAVOLLAR.md 76).

export type CashTab = "kirim" | "chiqim" | "kochirish";

interface TabState {
  dirty: boolean;
  saving: boolean;
  /** Saqlash tugmasi o'chiq (masalan izohdagi oy farqi, oylik chegarasi). */
  blocked: boolean;
  /** Tanlangan to'lov turi — Kassa ostidagi qoldiq shu tur bo'yicha. */
  method: string;
}
interface TabApi {
  submit: () => void;
}
type Done =
  | { kind: "kirim"; cashbox: Cashbox; entryId?: number; detail: string[] }
  | { kind: "chiqim"; cashbox: Cashbox; detail: string[] }
  | { kind: "kochirish"; from: Cashbox; to: Cashbox; detail: string[] };

interface TabProps {
  cashbox: Cashbox;
  register: (tab: CashTab, api: TabApi) => void;
  report: (tab: CashTab, s: TabState) => void;
  onDone: (d: Done) => void;
}

function fmtNum(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ");
  return n < 0 ? `−${s}` : s;
}
function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join("") || "?";
}

/** Maydon ostidagi qizil / sariq blok. */
function Note({ tone, children }: { tone: "danger" | "warning"; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={`rounded-v2-md px-3 py-2 text-v2-caption font-normal ${tone === "danger" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-text"}`}>
      {children}
    </div>
  );
}

/** «Ro'yxat Sozlamalarda o'zgartiriladi» — tur ro'yxati Moliya → Tranzaksiya turi sahifasida. */
function TypesHint() {
  const { t } = useT();
  const can = useCanOpen("/finance-tx-types");
  // Bitta jumla, o'rtasida havola — tillarda so'z tartibi har xil, shu bois `{link}` bo'yicha bo'linadi.
  const [pre, post = ""] = t("Ro'yxat {link}da o'zgartiriladi").split("{link}");
  const label = t("Sozlamalar");
  return (
    <>
      {pre}
      {can ? (
        <Link href="/finance-tx-types" className="font-semibold text-v2-brand-text hover:underline">
          {label}
        </Link>
      ) : (
        label
      )}
      {post}
    </>
  );
}

/* ================================================================ Oyna */

export interface CashOperationModalProps {
  /** Kassalar (Kassalar sahifasidan); berilmasa — so'raladi («+ Yangi»). */
  cashboxes?: Cashbox[];
  initialCashboxId?: number;
  initialTab?: CashTab;
  /** Kirim — o'quvchi oldindan tanlangan (O'quvchilar → «To'lov», `?kirim=`). */
  presetStudent?: StudentRow | null;
  onClose: () => void;
  onSaved?: (r: { tab: CashTab; cashbox?: Cashbox; from?: Cashbox; to?: Cashbox }) => void;
}

export default function CashOperationModalV2(props: CashOperationModalProps) {
  const { showError } = useToast();
  const { cashboxes: given, onClose } = props;
  const [loaded, setLoaded] = useState<Cashbox[] | null>(() => (given ? null : peekCashboxes()));

  useEffect(() => {
    if (given || loaded) return;
    let cancelled = false;
    loadCashboxes()
      .then((list) => {
        if (cancelled) return;
        if (list.length === 0) {
          showError("Sizga biriktirilgan kassa yo'q");
          onClose();
          return;
        }
        setLoaded(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        showError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Serverga ulanib bo'lmadi");
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // Bir marta — oyna ochilganda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cashboxes = given ?? loaded;
  if (!cashboxes || cashboxes.length === 0) return null;
  return <CashOperationForm {...props} cashboxes={cashboxes} />;
}

function CashOperationForm({ cashboxes, initialCashboxId, initialTab = "kirim", presetStudent, onClose, onSaved }: CashOperationModalProps & { cashboxes: Cashbox[] }) {
  const { t } = useT();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const hiddenStore = useHiddenBalances();
  const { methods: allMethods } = usePaymentMethods();

  // Arxivdagi kassa amal uchun tanlanmaydi (kartochkadan ochilgani bundan mustasno).
  const usable = useMemo(() => cashboxes.filter((c) => !c.archived || c.id === initialCashboxId), [cashboxes, initialCashboxId]);
  const [cashboxId, setCashboxId] = useState(() => String((usable.find((c) => c.id === initialCashboxId) ?? usable.find((c) => c.isPrimary) ?? usable[0]).id));
  const cashbox = usable.find((c) => String(c.id) === cashboxId) ?? usable[0];

  const [tab, setTab] = useState<CashTab>(initialTab);
  const [visited, setVisited] = useState<CashTab[]>([initialTab]);
  const apis = useRef<Partial<Record<CashTab, TabApi>>>({});
  const [states, setStates] = useState<Partial<Record<CashTab, TabState>>>({});
  const register = useCallback((which: CashTab, api: TabApi) => {
    apis.current[which] = api;
  }, []);
  const report = useCallback((which: CashTab, s: TabState) => {
    setStates((cur) => {
      const p = cur[which];
      return p && p.dirty === s.dirty && p.saving === s.saving && p.blocked === s.blocked && p.method === s.method ? cur : { ...cur, [which]: s };
    });
  }, []);
  const active = states[tab];
  const saving = Object.values(states).some((s) => s?.saving);
  const dirty = Object.values(states).some((s) => s?.dirty);

  function switchTab(v: string) {
    if (saving) return;
    const next = v as CashTab;
    setTab(next);
    setVisited((cur) => (cur.includes(next) ? cur : [...cur, next]));
  }

  function done(d: Done) {
    dropCashboxes();
    if (d.kind === "kirim") {
      const { entryId, cashbox: c } = d;
      showToast({
        tone: "success",
        title: t("Kirim qo'shildi"),
        detail: d.detail,
        action: entryId ? { label: t("Chekni ko'rish"), onClick: () => openReceipt({ entryId, cashboxId: c.id, cashboxName: c.name }) } : undefined,
      });
      onSaved?.({ tab: "kirim", cashbox: c });
    } else if (d.kind === "chiqim") {
      showToast({ tone: "success", title: t("Chiqim saqlandi"), detail: d.detail });
      onSaved?.({ tab: "chiqim", cashbox: d.cashbox });
    } else {
      // "Ko'chirildi" DEB BO'LMAYDI: pul qabul qiluvchi ✓ bosgunicha shu kassada turadi.
      showToast({ tone: "success", title: t("Ko'chirma jo'natildi — tasdiq kutilmoqda"), detail: d.detail });
      onSaved?.({ tab: "kochirish", from: d.from, to: d.to });
    }
    modal.close();
  }

  /* ---- Kassa ostidagi qoldiq ---- */
  const hidden = hiddenStore.isHidden(cashbox.id);
  const money = (n: number) => (hidden ? "••••••" : fmtNum(n));
  const m = active?.method ?? "";
  const methodName = (key: string) => t(allMethods.find((x) => x.key === key)?.name ?? key);
  const amountOf = (key: string) =>
    tab === "kochirish" ? (cashbox.methodTotals[key] ?? 0) - (cashbox.pendingOut?.[key] ?? 0) : (cashbox.methodTotals[key] ?? 0);
  const kassaHint =
    (m
      ? t(tab === "kochirish" ? "{method} — jo'natish mumkin: {sum} so'm" : "{method} qoldig'i: {sum} so'm", { method: methodName(m), sum: money(amountOf(m)) })
      : t("Qoldiq: {sum} so'm", { sum: money(cashbox.balance) })) + (hidden ? ` · ${t("summalar yashirilgan")}` : "");

  const cashboxOptions: PickerOption[] = usable.map((c) => ({
    value: String(c.id),
    label: c.name,
    // Rasmdagidek: bosh kassada «· Bosh kassa», qolganida faqat nomi.
    sublabel: c.isPrimary ? t("Bosh kassa") : undefined,
    keywords: c.moderator,
    hint: `${hiddenStore.isHidden(c.id) ? "••••••" : fmtNum(c.balance)} ${t("so'm")}`,
    lead: (
      <span className={`flex size-6 items-center justify-center rounded-v2-sm ${c.isPrimary ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"}`} aria-hidden>
        {c.isPrimary ? <Crown className="size-3.5" strokeWidth={1.75} /> : <Wallet className="size-3.5" strokeWidth={1.75} />}
      </span>
    ),
  }));

  const tabOptions = [
    { value: "kirim", label: t("Kirim"), icon: <ArrowDownLeft className="size-4 shrink-0 text-v2-success" strokeWidth={2} aria-hidden /> },
    { value: "chiqim", label: t("Chiqim"), icon: <ArrowUpRight className="size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden /> },
    { value: "kochirish", label: t("Ko'chirish"), icon: <ArrowLeftRight className="size-4 shrink-0 text-v2-text-2" strokeWidth={2} aria-hidden /> },
  ];
  const submitLabel = tab === "kirim" ? t("Kirimni saqlash") : tab === "chiqim" ? t("Chiqimni saqlash") : t("Ko'chirmani jo'natish");
  const tabProps = { cashbox, register, report, onDone: done };

  return (
    <V2Dialog
      controller={modal}
      title={t("Kassa amali")}
      // «Rahbar kassasi» → o'zi; «Akademiya 4 Uchqo'rg'on» → «… kassasi» (rasmdagidek).
      subtitle={/kassa(si)?$/i.test(cashbox.name.trim()) ? cashbox.name : t("{name} kassasi", { name: cashbox.name })}
      onClose={onClose}
      dirty={dirty}
      saving={saving}
      onSubmit={() => apis.current[tab]?.submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={`${secondaryBtn} justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => apis.current[tab]?.submit()}
            disabled={saving || !!active?.blocked}
            className={`${primaryBtn} justify-center disabled:cursor-not-allowed disabled:bg-v2-border-strong disabled:text-v2-text-3 disabled:hover:brightness-100`}
          >
            {active?.saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            {active?.saving ? t("Saqlanmoqda…") : submitLabel}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Segmented value={tab} onChange={switchTab} options={tabOptions} label={t("Amal turi")} size="lg" />

        <Field label={t("Kassa")} hint={kassaHint}>
          <V2Picker value={cashboxId} onChange={setCashboxId} options={cashboxOptions} label={t("Kassa")} searchable={false} disabled={usable.length < 2 || saving} />
        </Field>

        {visited.includes("kirim") && (
          <div hidden={tab !== "kirim"}>
            <KirimTab {...tabProps} presetStudent={presetStudent} />
          </div>
        )}
        {visited.includes("chiqim") && (
          <div hidden={tab !== "chiqim"}>
            <ChiqimTab {...tabProps} />
          </div>
        )}
        {visited.includes("kochirish") && (
          <div hidden={tab !== "kochirish"}>
            <KochirishTab {...tabProps} />
          </div>
        )}
      </div>
    </V2Dialog>
  );
}

/* ================================================================ Kirim */

function KirimTab({ cashbox, register, report, onDone, presetStudent }: TabProps & { presetStudent?: StudentRow | null }) {
  const { t, months } = useT();
  const [chosen, setChosen] = useState<StudentRow | null>(presetStudent ?? null);
  const studentList = useMemo(() => (chosen ? [chosen] : []), [chosen]);
  const [submitted, setSubmitted] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const last = useRef<string[]>([]);
  const typeRef = useRef<HTMLDivElement>(null);
  const teacherRef = useRef<HTMLDivElement>(null);
  const studentRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);

  const k = useKirimForm({
    cashbox,
    students: studentList,
    initialStudentKey: presetStudent ? String(presetStudent.id) : undefined,
    // O'quvchidan kelgan to'lov — o'quvchi to'lovi turi; aks holda ro'yxat boshi (eskisidek).
    preferType: presetStudent ? preferStudentType : undefined,
    onSuccess: ({ cashbox: updated, entryId }) => onDone({ kind: "kirim", cashbox: updated, entryId, detail: last.current }),
  });

  function changeType(id: string) {
    const next = k.categories.find((tv) => String(tv.id) === id) ?? null;
    if ((next?.id ?? null) === k.categoryId) return;
    // Yagona darvoza (useKirimForm.pickType) — o'qituvchi, o'quvchi, summa va oy tozalanadi.
    k.pickType(next);
    setChosen(null);
  }
  function pickStudent(s: StudentRow | null) {
    setChosen(s);
    k.setStudentKey(s ? String(s.id) : "");
    if (s) requestAnimationFrame(() => amountRef.current?.querySelector<HTMLInputElement>("input")?.focus());
  }

  const nowKey = monthKeyOf(new Date());
  const chipKeys = [nowKey, shiftMonth(nowKey, 1), shiftMonth(nowKey, 2)];
  const pickMonth = (key: string) => {
    k.setPeriodMonth(key);
    k.setPeriodTouched(true);
  };
  const dateKey = k.date ? monthKeyOf(k.date) : "";

  const amountNum = k.showRows ? k.total : Number(k.amount);
  const errType = k.categoryId === null ? t("Toifani tanlang") : "";
  const errTeacher = k.showTeacher && !k.showStudent && !k.teacherName.trim() ? t("O'qituvchini tanlang") : "";
  const errStudent = k.showStudent && !k.studentKey ? t("O'quvchini tanlang") : "";
  const errAmount = !(amountNum > 0) ? t("Summani kiriting") : "";
  const errMethod = !k.method ? t("To'lov turini tanlang") : "";
  const showAmountErr = (submitted || amountTouched) && errAmount ? errAmount : "";

  function submit() {
    if (k.saving || k.categoriesLoading) return;
    const first = errType ? typeRef : errTeacher ? teacherRef : errStudent ? studentRef : errAmount ? amountRef : errMethod ? methodRef : null;
    if (first || k.noteMismatch) {
      setSubmitted(true);
      first?.current?.querySelector<HTMLElement>("input, [role=radio], button")?.focus();
      return;
    }
    const who = [k.category, chosen?.name || k.teacherName].filter(Boolean).join(" · ");
    last.current = [who, `${fmtNum(amountNum)} ${t("so'm")} · ${t(k.paymentMethods.find((x) => x.key === k.method)?.name ?? k.method)} · ${cashbox.name}`].filter(Boolean);
    void k.save();
  }

  const dirty = !!k.amount || k.rows.some((r) => !!r.amount) || !!k.note.trim() || !!k.method || (!presetStudent && !!chosen);
  const blocked = k.noteMismatch || k.categoriesLoading;
  useEffect(() => {
    register("kirim", { submit });
  });
  useEffect(() => {
    report("kirim", { dirty, saving: k.saving, blocked, method: k.method });
  }, [report, dirty, k.saving, blocked, k.method]);

  const typeOptions: PickerOption[] = k.categories.map((c) => ({ value: String(c.id), label: c.name }));
  const teacherOptions: PickerOption[] = k.teacherNames.map((n) => ({ value: n, label: n, sublabel: k.teacherPhoneOf(n) || undefined }));
  const methodOptions = k.paymentMethods.map((x) => ({ value: x.key, label: t(x.name), dot: methodDot(x.key) }));
  const balance = chosen ? (k.balances[chosen.id] ?? chosen.balance ?? 0) : 0;
  const disc = chosen && !k.showRows && k.pendingDisc && k.pendingDisc.key === k.discKey ? k.pendingDisc : null;

  return (
    <div className="space-y-4">
      <div ref={typeRef}>
        <Field label={t("Toifa")} error={submitted ? errType : ""} hint={<TypesHint />}>
          <V2Picker
            value={k.categoryId === null ? "" : String(k.categoryId)}
            onChange={changeType}
            options={typeOptions}
            label={t("Toifa")}
            loading={k.categoriesLoading}
            placeholder={k.categories.length === 0 ? t("Kirim turi qo'shilmagan") : t("Tanlang")}
            state={submitted && errType ? "error" : "default"}
          />
        </Field>
      </div>

      {/* O'qituvchi va O'quvchi — turning «Mijoz» katakchalariga qarab (eski oynadagi qoida). */}
      {k.showTeacher && (
        <div ref={teacherRef}>
          <Field label={t("O'qituvchi")} optional={k.showStudent} error={submitted ? errTeacher : ""}>
            <V2Picker
              value={k.teacherName}
              onChange={k.setTeacherName}
              options={teacherOptions}
              label={t("O'qituvchi")}
              placeholder={t("Tanlang")}
              loading={k.teachersLoading}
              searchPlaceholder={t("Ism yoki telefon…")}
              clearable
              state={submitted && errTeacher ? "error" : "default"}
            />
          </Field>
        </div>
      )}

      {k.showStudent && (
        <div ref={studentRef}>
          {chosen ? (
            <div>
              <FieldLabel>{t("O'quvchi")}</FieldLabel>
              <StudentCard s={chosen} balance={balance} onClear={k.saving ? undefined : () => pickStudent(null)} />
            </div>
          ) : (
            <Field label={t("O'quvchi")} error={submitted ? errStudent : ""}>
              <StudentSearchField onPick={pickStudent} invalid={submitted && !!errStudent} />
            </Field>
          )}
        </div>
      )}

      {disc && (
        <Note tone="warning">
          <div>
            <b className="font-semibold">{t("Tanga evaziga chegirma: −{sum} ({pct}%)", { sum: `${fmtNum(disc.amountSom)} ${t("so'm")}`, pct: disc.percent })}</b> — {disc.groupLabel}
          </div>
          {!disc.inGroup ? (
            <div className="text-v2-text-2">{t("O'quvchi o'sha guruhda emas — chegirma qo'llanmaydi.")}</div>
          ) : k.showTeacher && k.teacherName.trim() && disc.teacherName.trim() && k.key(k.teacherName) !== k.key(disc.teacherName) ? (
            <div>
              {t("Chegirma faqat {teacher} to'loviga qo'llanadi.", { teacher: disc.teacherName })}{" "}
              <button type="button" className="font-semibold text-v2-brand-text hover:underline" onClick={() => k.setTeacherName(disc.teacherName)}>
                {t("Shu o'qituvchini tanlash")}
              </button>
            </div>
          ) : (
            <div className="text-v2-text-2">{t("O'quvchidan shuncha kam oling — saqlanganda chegirma o'zi qo'llanadi.")}</div>
          )}
        </Note>
      )}

      {k.showRows ? (
        <>
          {/* UCHINCHI SHAXS — (Qiymat + Oy) qatorlari: kalkulyator, bitta yozuvga yig'iladi (useKirimForm.save izohi). */}
          <div ref={amountRef}>
            <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 text-v2-small font-medium text-v2-text">
              <span>{t("Qiymat")}</span>
              <span>{t("Oy")}</span>
              <span aria-hidden />
            </div>
            <div className="space-y-2">
              {k.rows.map((row, i) => (
                <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-2">
                  <MoneyField compact value={row.amount} onChange={(v) => k.updateRow(row.id, { amount: v })} onBlur={() => setAmountTouched(true)} ariaLabel={t("Qiymat")} state={i === 0 && showAmountErr ? "error" : "default"} />
                  <MonthField value={row.periodMonth} onChange={(v) => k.updateRow(row.id, { periodMonth: v })} />
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => k.removeRow(row.id)}
                      title={t("O'chirish")}
                      aria-label={t("O'chirish")}
                      className="inline-flex size-10 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-danger-bg hover:text-v2-danger"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  ) : (
                    <span aria-hidden />
                  )}
                </div>
              ))}
            </div>
            {showAmountErr && <FieldError>{showAmountErr}</FieldError>}
            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={k.addRow} className="inline-flex h-8 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                {t("Qator qo'shish")}
              </button>
              {k.rows.length > 1 && (
                <span className="text-v2-small text-v2-text-2">
                  {t("Umumiy summa")}: <b className="font-semibold tabular-nums text-v2-text">{fmtNum(k.total)} {t("so'm")}</b>
                </span>
              )}
            </div>
          </div>
          <Field label={t("Sana va vaqt")}>
            <V2DateField value={k.date} withTime onChange={k.setDate} />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div ref={amountRef}>
              <Field label={t("Summa")} error={showAmountErr}>
                <MoneyField value={k.amount} onChange={k.setAmount} onBlur={() => setAmountTouched(true)} state={showAmountErr ? "error" : "default"} />
              </Field>
            </div>
            <Field label={t("Sana va vaqt")}>
              <div className="[&>button]:h-12">
                <V2DateField
                  value={k.date}
                  withTime
                  onChange={(d) => {
                    k.setDate(d);
                    // Sana o'zgarsa oy ham ergashadi; oy QO'LDA tanlangan bo'lsa — tegilmaydi.
                    if (!k.periodTouched) k.setPeriodMonth(monthKeyOf(d));
                  }}
                />
              </div>
            </Field>
          </div>
          <div>
            <FieldLabel>{t("Qaysi oy uchun")}</FieldLabel>
            <MonthChips value={k.periodMonth} onChange={pickMonth} keys={chipKeys} currentKey={nowKey} />
            {k.noteMismatch ? (
              <div className="mt-2">
                <Note tone="danger">
                  {t("Izohda {note} yozilgan, lekin to'lov {month} oyiga yoziladi.", {
                    note: k.noteMonthNums.map((x) => months[x - 1]).join(", "),
                    month: k.monthName(k.periodMonth),
                  })}{" "}
                  {t("Oy yoki izoh to'g'rilanmaguncha saqlanmaydi.")}
                  {k.noteTarget && (
                    <button type="button" onClick={() => pickMonth(k.noteTarget!)} className="ml-1 font-semibold underline underline-offset-2 hover:no-underline">
                      {t("{month} oyiga o'tkazish", { month: k.monthName(k.noteTarget) })}
                    </button>
                  )}
                </Note>
              </div>
            ) : k.showTeacher && dateKey && k.periodMonth !== dateKey ? (
              <p className="mt-1.5 text-v2-caption font-normal text-v2-warning">
                {t("To'lov {month} oyiga yoziladi — o'qituvchining o'sha oydagi oyligiga qo'shiladi.", { month: k.monthName(k.periodMonth) })}
              </p>
            ) : (
              <FieldHint>{t("To'lov tanlangan oy hisobiga yoziladi")}</FieldHint>
            )}
          </div>
        </>
      )}

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

      <Field label={t("Izoh")} optional>
        <V2SuggestInput value={k.note} onChange={k.setNote} options={k.noteOptions} placeholder={t("Yozing yoki avvalgilaridan tanlang")} maxLength={300} ariaLabel={t("Izoh")} />
      </Field>
    </div>
  );
}

/** Tanlangan o'quvchi — ism, telefon, balans; × — boshqasini tanlash. */
function StudentCard({ s, balance, balanceLabel, onClear }: { s: StudentRow; balance: number; balanceLabel?: string; onClear?: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-3.5 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand-text" aria-hidden>
        {initialsOf(s.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-v2-body font-semibold text-v2-text" title={s.name}>
          {s.name}
        </div>
        <div className="truncate text-v2-caption font-normal tabular-nums text-v2-text-3">{studentPhoneLabel(s.phone) || "—"}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-v2-caption font-normal text-v2-text-3">{balanceLabel ?? t("Balans")}</div>
        <div className={`text-v2-small font-semibold tabular-nums ${balance < 0 ? "text-v2-danger" : "text-v2-text"}`}>
          {fmtNum(balance)} {t("so'm")}
        </div>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("Boshqa o'quvchi")}
          title={t("Boshqa o'quvchi")}
          className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface hover:text-v2-text"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/* ================================================================ Chiqim */

function ChiqimTab({ cashbox, register, report, onDone }: TabProps) {
  const { t, months } = useT();
  const [chosen, setChosen] = useState<StudentRow | null>(null);
  const studentList = useMemo(() => (chosen ? [chosen] : []), [chosen]);
  const [submitted, setSubmitted] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const last = useRef<string[]>([]);
  const typeRef = useRef<HTMLDivElement>(null);
  const personRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);

  const c = useChiqimForm({
    cashbox,
    students: studentList,
    onSuccess: ({ cashbox: updated }) => onDone({ kind: "chiqim", cashbox: updated, detail: last.current }),
  });
  const money = (n: number) => `${fmtNum(n)} ${t("so'm")}`;

  /** Tur almashishi — eski oynadagi onChange bilan bir xil. */
  function changeType(v: string) {
    const next = c.categories.find((tv) => String(tv.id) === v) ?? null;
    // Tur o'zgarsa avval tanlangan kishi kerak bo'lmay qolishi mumkin (o'quvchi ↔ xodim).
    if (txTarget(next) !== c.target) {
      c.setPersonKey("");
      c.setRefundTeacher("");
      setChosen(null);
    }
    // «Qaysi oy uchun» sananing oyiga qaytadi — faqat tur HAQIQATAN almashganda.
    if ((next?.id ?? null) !== c.categoryId) c.resetPeriod();
    c.setCategoryId(next?.id ?? null);
  }
  /** Kishi almashishi: boshqa xodim/o'quvchi — oldingisi uchun tanlangan oy va ustoz qolib ketmasin. */
  function pickPerson(v: string) {
    c.setPersonKey(v);
    c.setRefundTeacher("");
    // BIRINCHI tanlovda (personKey bo'sh) oy tegilmaydi (eski oynadagi izoh, 04.10.2026).
    if (c.personKey && v !== c.personKey) c.resetPeriod();
  }
  function pickStudent(s: StudentRow | null) {
    setChosen(s);
    pickPerson(s ? String(s.id) : "");
  }

  const methodOk = c.methodOptions.some((o) => o.m.key === c.method);
  const errType = c.categoryId === null ? t("Toifani tanlang") : "";
  const errPerson = c.target !== null && !c.personKey.trim() ? (c.target === "employee" ? t("Xodimni tanlang") : t("O'quvchini tanlang")) : "";
  const errAmount = !c.oylikLocked && !(c.total > 0) ? t("Summani kiriting") : "";
  const errMethod = !methodOk ? t("To'lov turini tanlang") : "";
  const overAvailable = methodOk && c.available != null && c.total > c.available;
  const amountMsg = (submitted || amountTouched) && errAmount ? errAmount : overAvailable ? t("Mablag' yetarli emas — mavjud {available}", { available: money(c.available ?? 0) }) : "";

  function submit() {
    if (c.saving || c.categoriesLoading) return;
    const first = errType ? typeRef : errPerson ? personRef : errAmount ? amountRef : errMethod ? methodRef : null;
    if (first) {
      setSubmitted(true);
      first.current?.querySelector<HTMLElement>("input, [role=radio], button")?.focus();
      return;
    }
    last.current = [
      [c.category, c.personName].filter(Boolean).join(" · "),
      `${fmtNum(c.total)} ${t("so'm")} · ${t(c.paymentMethods.find((x) => x.key === c.method)?.name ?? c.method)} · ${cashbox.name}`,
    ].filter(Boolean);
    // Qolgan qorovullar (mablag', oylik chegarasi, balans, oy) — useChiqimForm.save ichida, xabari bilan.
    void c.save();
  }

  const dirty = c.categoryId !== null || !!c.personKey || c.rows.some((r) => !!r.amount) || !!c.note.trim() || !!c.method;
  // Eski oynadagi «Saqlash» o'chiq bo'ladigan holatlar.
  const blocked = c.salaryExceeds || c.salaryExhausted || c.studentBalanceExceeds || c.periodBlocked || c.payrollPending || c.noteMismatch || c.categoriesLoading;
  useEffect(() => {
    register("chiqim", { submit });
  });
  useEffect(() => {
    report("chiqim", { dirty, saving: c.saving, blocked, method: c.method });
  }, [report, dirty, c.saving, blocked, c.method]);

  const typeOptions: PickerOption[] = c.categories.map((x) => ({ value: String(x.id), label: x.name }));
  const employeeOptions: PickerOption[] = c.activeEmployees.map((e) => {
    const role = c.roleOf(e.name);
    const p = c.payrollReady ? c.payrollOf(e.name) : undefined;
    // Ism yonida — shu oynada CHIQARISH MUMKIN bo'lgan summa (naqd: kartadan keyingi qoldiq; plastik: karta + naqd).
    const can = p?.configured ? (c.isPlastikMethod ? payrollPayout(p, c.period) : payrollCashLeg(p, c.period)) : null;
    return {
      value: e.name,
      label: e.name,
      sublabel: role ? t(ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role) : undefined,
      hint: !c.payrollReady ? "…" : can === null ? t("Sozlanmagan") : <span className={can > 0 ? "text-v2-success" : undefined}>{fmtNum(can)}</span>,
    };
  });
  const teacherOptions: PickerOption[] = c.teacherNames.map((n) => ({ value: n, label: n }));
  const methodOptions = c.methodOptions.map(({ m }) => ({ value: m.key, label: t(m.name), dot: methodDot(m.key) }));
  const pickMonth = (key: string) => {
    c.setPeriodMonth(key);
    c.setPeriodTouched(true);
  };
  const exceedsText = t("Summa {limit} dan ko'p bo'lishi mumkin emas", { limit: money(c.remainingSalary) });
  const sb = c.salaryBreakdown;

  return (
    <div className="space-y-4">
      <div ref={typeRef}>
        <Field label={t("Toifa")} error={submitted ? errType : ""} hint={<TypesHint />}>
          <V2Picker
            value={c.categoryId === null ? "" : String(c.categoryId)}
            onChange={changeType}
            options={typeOptions}
            label={t("Toifa")}
            loading={c.categoriesLoading}
            placeholder={c.categories.length === 0 ? t("Chiqim turi qo'shilmagan") : t("Tanlang")}
            state={submitted && errType ? "error" : "default"}
          />
        </Field>
      </div>

      {/* Kim — tur «Mijoz» iga qarab (lib/txTarget.ts): xodimga oylik/avans → xodim, o'quvchiga qaytarish → o'quvchi. */}
      {c.target === "employee" && (
        <div ref={personRef} className="space-y-2">
          <Field label={t("Xodim")} error={submitted ? errPerson : ""}>
            <V2Picker
              value={c.personKey}
              onChange={pickPerson}
              options={employeeOptions}
              label={t("Xodim")}
              placeholder={t("Xodimni qidiring…")}
              searchPlaceholder={t("Xodimni qidiring…")}
              loading={c.employeesLoading}
              state={submitted && errPerson ? "error" : "default"}
            />
          </Field>
          {c.selectedEmployee && (
            <>
              {c.isSalaryPayoutCategory ? (
                c.periodBlocked ? null : c.payrollPending ? (
                  <p className="text-v2-caption text-v2-text-3">{t("Yuklanmoqda…")}</p>
                ) : c.salaryConfigured && sb ? (
                  // Hisob zanjiri OCHIQ — kassir naqd nega kam (yoki 0) ekanini shu yerda ko'rsin.
                  <div className="rounded-v2-md bg-v2-success-bg px-3 py-2 text-v2-caption font-normal text-v2-text">
                    {c.isPlastikMethod ? t("Kartaga chiqarish mumkin: ") : t("Naqd chiqarish mumkin: ")}
                    <b className="font-semibold text-v2-success">{money(c.remainingSalary)}</b>
                    <span className="text-v2-text-2">
                      {" "}({c.earnedLabel} {money(c.employeeOylik)}
                      {sb.tax > 0 ? t(" − soliq {tax}", { tax: money(sb.tax) }) : ""}
                      {sb.carryOver > 0 ? t(" + o'tgan oydan {carryOver}", { carryOver: money(sb.carryOver) }) : ""}
                      {sb.carryOver < 0 ? t(" − o'tgan oy qarzdorligi {carryOver}", { carryOver: money(-sb.carryOver) }) : ""}
                      {sb.paid > 0 ? t(" − olingan {paid}", { paid: money(sb.paid) }) : ""}
                      {!c.isPlastikMethod && sb.karta > 0 ? t(" − kartaga {karta}", { karta: money(sb.karta) }) : ""})
                    </span>
                  </div>
                ) : (
                  <Note tone="warning">{t("Ish haqi sozlanmagan — chegara qo'llanmaydi. Xodim profilida oylikni kiriting.")}</Note>
                )
              ) : (
                <p className="text-v2-caption text-v2-text-2">
                  {!c.payrollReady ? t("Yuklanmoqda…") : c.salaryConfigured ? `${c.earnedLabel}: ${money(c.employeeOylik)}` : t("Ish haqi sozlanmagan")}
                </p>
              )}
              {c.isSalaryPayoutCategory && c.salaryExhausted && <Note tone="danger">{c.exhaustedMessage}.</Note>}
              {c.isSalaryPayoutCategory && !c.salaryExhausted && c.salaryExceeds && <Note tone="danger">{exceedsText}</Note>}
              <button type="button" onClick={() => c.setSalaryOpen(true)} className="text-v2-small font-medium text-v2-brand-text hover:underline">
                {t("Xodim ma'lumotlarini ko'rish")}
              </button>
            </>
          )}
        </div>
      )}

      {c.target === "student" && (
        <div ref={personRef} className="space-y-2">
          {chosen ? (
            <div>
              <FieldLabel>{t("O'quvchi")}</FieldLabel>
              <StudentCard s={chosen} balance={c.studentBalance} balanceLabel={t("Balans (naqd)")} onClear={c.saving ? undefined : () => pickStudent(null)} />
            </div>
          ) : (
            <Field label={t("O'quvchi")} error={submitted ? errPerson : ""}>
              <StudentSearchField onPick={pickStudent} invalid={submitted && !!errPerson} />
            </Field>
          )}
          {c.selectedStudent && (
            <>
              {c.studentBalanceExceeds && <Note tone="danger">{t("Summa o'quvchi balansidan ({studentBalance}) ko'p bo'lishi mumkin emas", { studentBalance: money(c.studentBalance) })}</Note>}
              {/* Qaytarilgan pul qaysi ustozning tushumidan ayriladi — oxirgi to'lovdagi ustoz o'zi tushadi. */}
              <Field label={t("Ustozi (tushumidan ayriladi)")} hint={t("Qaytarilgan summa o'quvchi balansidan va ustozning shu oydagi tushumidan ayriladi — ustozning foizli oyligi shu summaning foizi qadar kamayadi, qolgani markaz hisobidan ketadi.")}>
                <V2Picker value={c.refundTeacher} onChange={c.setRefundTeacher} options={teacherOptions} label={t("Ustozi")} placeholder={t("Tanlanmagan")} loading={c.teachersLoading} clearable />
              </Field>
              <button type="button" onClick={() => c.setGroupsOpen(true)} className="text-v2-small font-medium text-v2-brand-text hover:underline">
                {t("O'quvchi guruhlarini ko'rish")}
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div ref={amountRef}>
          {c.oylikLocked ? (
            // «Oylik» — summa qo'lda terilmaydi: xodimning shu oyda chiqarish mumkin bo'lgan qoldig'i.
            <Field label={t("Summa")} hint={t("Oylik summasi hisobdan olinadi — qo'lda o'zgartirilmaydi.")}>
              <MoneyField
                value={c.payrollPending || c.periodBlocked ? "" : String(Math.max(0, Math.round(c.remainingSalary)))}
                onChange={() => {}}
                readOnly
                placeholder={c.payrollPending ? t("Yuklanmoqda…") : "0"}
              />
            </Field>
          ) : (
            <Field label={t("Summa")} error={amountMsg}>
              <MoneyField
                value={c.rows[0]?.amount ?? ""}
                onChange={(v) => c.updateRow(c.rows[0].id, { amount: v })}
                onBlur={() => setAmountTouched(true)}
                state={amountMsg ? "error" : "default"}
              />
            </Field>
          )}
        </div>
        <Field label={t("Sana va vaqt")}>
          <div className="[&>button]:h-12">
            <V2DateField
              value={c.date}
              withTime
              onChange={(d) => {
                c.setDate(d);
                // Sana o'zgarsa oy ham ergashadi; oy QO'LDA tanlangan bo'lsa — tegilmaydi.
                if (!c.periodTouched) c.setPeriodMonth(monthKeyOf(d));
              }}
            />
          </div>
        </Field>
      </div>

      {/* QAYSI OY UCHUN — faqat xodimga avans/oylikda (yozuv shu oy oyligidan ayriladi). */}
      {c.isSalaryPayoutCategory && (
        <div className="space-y-2">
          <div>
            <FieldLabel>{t("Qaysi oy uchun")}</FieldLabel>
            <MonthChips
              value={c.periodMonth}
              onChange={pickMonth}
              keys={[shiftMonth(c.nowMonthKey, -1), c.nowMonthKey]}
              currentKey={c.nowMonthKey}
              // Kelajak oy hali ishlanmagan, yopilgan oy — nol-yopishgacha (server ham rad etadi).
              isDisabled={(key) => key > c.nowMonthKey || key <= c.closedThrough}
            />
          </div>
          {c.periodFuture ? (
            <Note tone="danger">{t("Kelajak oy uchun avans yoki oylik berilmaydi")}.</Note>
          ) : c.periodClosed ? (
            <Note tone="danger">{t("Yopilgan oy uchun avans yoki oylik berilmaydi")}.</Note>
          ) : c.noteMismatch ? (
            <Note tone="danger">
              {t("Izohda {note} yozilgan, lekin to'lov {month} oyiga yoziladi.", {
                note: c.noteMonthNums.map((x) => months[x - 1]).join(", "),
                month: c.monthName(c.periodMonth),
              })}{" "}
              {t("Oy yoki izoh to'g'rilanmaguncha saqlanmaydi.")}
              {c.noteTarget && (
                <button type="button" onClick={() => pickMonth(c.noteTarget!)} className="ml-1 font-semibold underline underline-offset-2 hover:no-underline">
                  {t("{month} oyiga o'tkazish", { month: c.monthName(c.noteTarget) })}
                </button>
              )}
            </Note>
          ) : (
            <>
              {c.paidLater && (
                <Note tone="danger">
                  {t("{month} qoldig'idan {amount} {later} oyida {later} yozuvi bo'lib berilgan bo'lishi mumkin — u yerda shuncha ortiqcha oylik bor. Qayta bermang: avval o'sha yozuvning oyini tekshiring.", {
                    month: c.monthName(c.periodMonth),
                    amount: money(c.paidLater.amount),
                    later: c.monthName(c.paidLater.month),
                  })}
                </Note>
              )}
              {c.carryHint && c.pendingMaybePaid > 0 ? (
                <Note tone="danger">
                  {t("{current} oyida {amount} ortiqcha oylik berilgan — bu {months} puli bo'lishi mumkin. O'sha oydan qayta chiqarmang: avval yozuvning oyini tekshiring.", {
                    current: c.monthName(c.periodMonth),
                    amount: money(c.pendingMaybePaid),
                    months: c.pendingMonths.map((x) => c.monthName(x.month)).join(", "),
                  })}
                </Note>
              ) : (
                c.carryHint && (
                  <Note tone="warning">
                    {c.pendingMonths.length === 1
                      ? t("{month} oyidan {amount} to'lanmagan — u {current} hisobidan emas, {month} oyligidan chiqariladi.", {
                          month: c.monthName(c.pendingMonths[0].month),
                          amount: money(c.pendingMonths[0].amount),
                          current: c.monthName(c.periodMonth),
                        })
                      : t("O'tgan oylardan to'lanmagan: {list} — ular {current} hisobidan emas, har biri o'z oyligidan chiqariladi.", {
                          list: c.pendingMonths.map((x) => `${c.monthName(x.month)} — ${money(x.amount)}`).join(", "),
                          current: c.monthName(c.periodMonth),
                        })}
                    {c.pendingTarget && (
                      <button type="button" onClick={() => pickMonth(c.pendingTarget!)} className="ml-1 font-semibold text-v2-brand-text hover:underline">
                        {t("{month} oyiga o'tkazish", { month: c.monthName(c.pendingTarget) })}
                      </button>
                    )}
                  </Note>
                )
              )}
              {c.periodMonth !== c.dateMonthKey && (
                <p className="text-v2-caption font-normal text-v2-warning">
                  {t("To'lov {month} oyiga yoziladi — xodimning o'sha oydagi oyligidan ayriladi.", { month: c.monthName(c.periodMonth) })}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* To'lov turi — faqat shu kassada mablag'i bor turlar (eski oynadagi qoida). */}
      <div ref={methodRef}>
        <FieldLabel>{t("To'lov turi")}</FieldLabel>
        {c.methodsLoading ? (
          <div className="h-11 animate-pulse rounded-v2-md bg-v2-skeleton" aria-hidden />
        ) : methodOptions.length === 0 ? (
          <p className="text-v2-small text-v2-text-3">{t("Kassada mablag' yo'q")}</p>
        ) : (
          <Segmented value={methodOk ? c.method : ""} onChange={c.setMethod} options={methodOptions} label={t("To'lov turi")} />
        )}
        {submitted && errMethod ? <FieldError>{errMethod}</FieldError> : methodOptions.length > 0 && <FieldHint>{t("Kassada mablag'i bor turlar")}</FieldHint>}
      </div>

      <Field label={t("Izoh")} optional>
        <TextInput
          value={c.note}
          onChange={(e) => c.setNote(e.target.value)}
          // Namuna turga mos: kishiga bog'liq bo'lmagan xarajatda — rasmdagidek, aks holda oy bilan.
          placeholder={
            c.target === null
              ? t("Masalan: {month} oyi internet to'lovi", { month: (months[Number(c.dateMonthKey.slice(5, 7)) - 1] ?? "").toLowerCase() })
              : t("Masalan: {month} oyi uchun", { month: (months[Number((c.isSalaryPayoutCategory ? c.periodMonth : c.dateMonthKey).slice(5, 7)) - 1] ?? "").toLowerCase() })
          }
          maxLength={300}
        />
      </Field>

      {c.salaryOpen && c.selectedEmployee && (
        <EmployeeSalaryModal payroll={c.selectedPayroll} period={c.period} employeeName={c.selectedEmployee.name} onClose={() => c.setSalaryOpen(false)} />
      )}
      {c.groupsOpen && c.selectedStudent && (
        <StudentGroupsModal pupilId={c.selectedStudent.id} studentName={c.selectedStudent.name} balance={c.studentBalance} onClose={() => c.setGroupsOpen(false)} />
      )}
    </div>
  );
}

/* ================================================================ Ko'chirish */

function KochirishTab({ cashbox, register, report, onDone }: TabProps) {
  const { t } = useT();
  const [submitted, setSubmitted] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const last = useRef<string[]>([]);
  const toRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);

  const tr = useTransferToForm({
    cashbox,
    onSuccess: ({ from, to }) => onDone({ kind: "kochirish", from, to, detail: last.current }),
  });
  const money = (n: number) => `${fmtNum(n)} ${t("so'm")}`;

  const methodOk = tr.methodOptions.some((o) => o.value === tr.method);
  const amountNum = Number(tr.amount);
  const errTo = !tr.toCashboxId ? t("Kassani tanlang") : "";
  const errAmount = !(amountNum > 0) ? t("Summani kiriting") : "";
  const errMethod = !methodOk ? t("To'lov turini tanlang") : "";
  const overAvailable = methodOk && tr.available !== null && amountNum > tr.available;
  const amountMsg = (submitted || amountTouched) && errAmount ? errAmount : overAvailable ? t("Mablag' yetarli emas — mavjud {available}", { available: money(tr.available ?? 0) }) : "";

  function submit() {
    if (tr.saving) return;
    const first = errTo ? toRef : errAmount || overAvailable ? amountRef : errMethod ? methodRef : null;
    if (first) {
      setSubmitted(true);
      first.current?.querySelector<HTMLElement>("input, [role=radio], button")?.focus();
      return;
    }
    const toName = tr.destinations.find((x) => String(x.id) === tr.toCashboxId)?.name ?? "";
    last.current = [`${cashbox.name} → ${toName}`, `${fmtNum(amountNum)} ${t("so'm")} · ${t(tr.paymentMethods.find((x) => x.key === tr.method)?.name ?? tr.method)}`];
    void tr.save();
  }

  const dirty = !!tr.toCashboxId || !!tr.amount || !!tr.note.trim() || !!tr.method;
  useEffect(() => {
    register("kochirish", { submit });
  });
  useEffect(() => {
    report("kochirish", { dirty, saving: tr.saving, blocked: false, method: tr.method });
  }, [report, dirty, tr.saving, tr.method]);

  const toOptions: PickerOption[] = tr.destinations.map((x) => ({
    value: String(x.id),
    label: x.name,
    hint: x.archived ? t("arxivda") : undefined,
    lead: (
      <span className="flex size-6 items-center justify-center rounded-v2-sm bg-v2-surface-2 text-v2-text-2" aria-hidden>
        <Wallet className="size-3.5" strokeWidth={1.75} />
      </span>
    ),
  }));
  const methodOptions = tr.methodOptions.map((o) => ({ value: o.value, label: t(o.label), dot: methodDot(o.value) }));

  return (
    <div className="space-y-4">
      {/* Manzil — TIZIMDAGI hamma kassa, faqat nomi (boshqa odamning puli ko'rinmaydi; useTransferToForm). */}
      <div ref={toRef}>
        <Field label={t("Qaysi kassaga")} error={submitted ? errTo : ""} hint={t("Pul qabul qiluvchi ✓ bosgunicha shu kassada turadi")}>
          <V2Picker
            value={tr.toCashboxId}
            onChange={tr.setToCashboxId}
            options={toOptions}
            label={t("Qaysi kassaga")}
            loading={tr.cashboxesLoading}
            placeholder={tr.destinations.length === 0 ? t("Boshqa kassa yo'q") : t("Tanlang")}
            disabled={!tr.cashboxesLoading && tr.destinations.length === 0}
            state={submitted && errTo ? "error" : "default"}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div ref={amountRef}>
          <Field label={t("Summa")} error={amountMsg}>
            <MoneyField value={tr.amount} onChange={tr.setAmount} onBlur={() => setAmountTouched(true)} state={amountMsg ? "error" : "default"} />
          </Field>
        </div>
        <Field label={t("Sana va vaqt")}>
          <div className="[&>button]:h-12">
            <V2DateField value={tr.date} withTime onChange={tr.setDate} />
          </div>
        </Field>
      </div>

      <div ref={methodRef}>
        <FieldLabel>{t("To'lov turi")}</FieldLabel>
        {tr.loadingMethods ? (
          <div className="h-11 animate-pulse rounded-v2-md bg-v2-skeleton" aria-hidden />
        ) : methodOptions.length === 0 ? (
          <p className="text-v2-small text-v2-text-3">{t("Kassada mablag' yo'q")}</p>
        ) : (
          <Segmented value={methodOk ? tr.method : ""} onChange={tr.setMethod} options={methodOptions} label={t("To'lov turi")} />
        )}
        {submitted && errMethod ? (
          <FieldError>{errMethod}</FieldError>
        ) : tr.held > 0 ? (
          <p className="mt-1.5 text-v2-caption font-normal text-v2-warning">{t("{held} tasdiq kutmoqda — bu summani qayta jo'natib bo'lmaydi.", { held: money(tr.held) })}</p>
        ) : (
          methodOptions.length > 0 && <FieldHint>{t("Kassada mablag'i bor turlar")}</FieldHint>
        )}
      </div>

      <Field label={t("Izoh")} optional>
        <TextInput value={tr.note} onChange={(e) => tr.setNote(e.target.value)} placeholder={t("Masalan: kunlik tushum")} maxLength={300} />
      </Field>
    </div>
  );
}
