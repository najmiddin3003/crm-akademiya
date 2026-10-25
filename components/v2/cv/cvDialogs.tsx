"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, CalendarCheck, Info, Loader2, Phone, X } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2TimeField, { isTime } from "@/components/v2/form/V2TimeField";
import { Chip, Field, FieldError, MoneyField, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { fmtSum, initialsOf } from "@/components/v2/employees/employeeBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { CV_REJECT_REASONS } from "@/constants/managementCv";
import type { CvApplication } from "@/lib/managementCv";
import { uzDateIso } from "@/lib/uzTime";
import {
  addDaysIso,
  cvExpPhrase,
  cvPhoneShow,
  cvTel,
  cvTrackText,
  dateOfIso,
  interviewParts,
  isoOfDate,
  placeText,
  roleForPosition,
  type CvPlace,
  type CvRole,
} from "./cvBits";

// YANGI VERSIYA — ISHGA QABUL (CV) OYNALARI (13-qism, 25.10.2026):
//   • «Suhbatga chaqirish» / «Suhbat vaqtini o'zgartirish» — sana, vaqt, joy (sukut: nomzod
//     tanlagan filial nomi va manzili); PATCH /api/management-cv/:id;
//   • «Rad etish» — tez sabablar + izoh (sabab majburiy — ro'yxatda holat ostida ko'rinadi);
//   • «Ishga olish» (rasm «Ishga olish oynasi») — lavozim, filial, ish boshlash sanasi, kurs
//     (o'qituvchida), oylik: Oklad + foiz / Oklad / Foiz; pastda oklad qanday bo'linishi
//     (lib/salary.ts `payrollOkladDays` bilan bir xil: kirgan kuni ham sanaladi).
//     POST /api/management-cv/:id/hire — xodim «Xodim qo'shish» yo'lidan yaratiladi.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function patchCv(id: number, body: Record<string, unknown>): Promise<{ ok: true; application: CvApplication } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/management-cv/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    return d.ok ? { ok: true, application: d.application as CvApplication } : { ok: false, error: String(d.error || "Saqlanmadi") };
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

/** Oyna tepasidagi nomzod qatori — kim haqida gap ketayotgani. */
function CandidateRow({ cv }: { cv: CvApplication }) {
  const { t } = useT();
  const line = [cvTrackText(cv, t), cvExpPhrase(cv, t)].filter(Boolean).join(" · ");
  const phone = cvPhoneShow(cv.phone);
  return (
    <div className="flex items-center gap-3 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3.5 py-3">
      {cv.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cv.photoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-v2-small font-semibold text-v2-brand-text" aria-hidden>
          {initialsOf(cv.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-v2-body font-semibold text-v2-text">{cv.name}</div>
        {line && <div className="truncate text-v2-caption font-normal text-v2-text-2">{line}</div>}
      </div>
      {phone && (
        <a href={`tel:${cvTel(cv.phone)}`} className="hidden shrink-0 items-center gap-1.5 text-v2-small tabular-nums text-v2-text-2 hover:text-v2-text sm:inline-flex">
          <Phone className="size-3.5" strokeWidth={1.75} aria-hidden />
          {phone}
        </a>
      )}
    </div>
  );
}

/* ═══════════════════════ Suhbatga chaqirish ═══════════════════════ */

export function CvInterviewDialog({
  cv,
  places,
  onClose,
  onSaved,
}: {
  cv: CvApplication;
  places: CvPlace[];
  onClose: () => void;
  onSaved: (app: CvApplication) => void;
}) {
  const { t } = useT();
  const branch = useBranch();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const today = uzDateIso();
  const reschedule = cv.status === "interview";
  const cur = interviewParts(cv.interviewAt);

  const [initial] = useState(() => ({
    date: cur && cur.iso >= today ? cur.iso : addDaysIso(today, 1),
    time: cur?.hm || "15:00",
  }));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  // `null` — tegilmagan: sukut (nomzod filiali, bo'lmasa navbar filiali) ko'rinadi.
  const [placeRaw, setPlace] = useState<string | null>(cv.interviewPlace ? cv.interviewPlace : null);
  const defaultPlace = placeText(places.find((p) => p.id === (typeof cv.branchId === "number" ? cv.branchId : branch.branchId)));
  const place = placeRaw ?? defaultPlace;

  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);

  const errDate = !date ? t("Sanani tanlang") : date < today ? t("Sana bugundan oldin bo'lmasin.") : "";
  const errTime = !isTime(time) ? t("Vaqtni «16:00» ko'rinishida kiriting") : "";
  const dirty = date !== initial.date || time !== initial.time || placeRaw !== (cv.interviewPlace ? cv.interviewPlace : null);

  async function submit() {
    if (busy) return;
    setTried(true);
    if (errDate || errTime) return;
    setBusy(true);
    const payload = { interviewAt: `${date}T${time}`, interviewPlace: place.trim() };
    const r = await patchCv(cv.id, reschedule ? payload : { status: "interview", ...payload });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      return;
    }
    onSaved(r.application);
    modal.close();
  }

  const placeChips = places.filter((p) => p.name.trim());
  const phone = cvPhoneShow(cv.phone);
  return (
    <V2Dialog
      title={reschedule ? t("Suhbat vaqtini o'zgartirish") : t("Suhbatga chaqirish")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={busy}
      width={520}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" strokeWidth={1.75} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : reschedule ? t("Saqlash") : t("Suhbatga chaqirish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <CandidateRow cv={cv} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Sana")} error={tried ? errDate : ""}>
            <V2DateField value={date ? dateOfIso(date) : null} onChange={(d) => setDate(isoOfDate(d))} state={tried && errDate ? "error" : "default"} />
          </Field>
          <Field label={t("Vaqt")} error={(tried || timeTouched) && errTime ? errTime : ""}>
            <V2TimeField value={time} onChange={setTime} onBlur={() => setTimeTouched(true)} state={(tried || timeTouched) && errTime ? "error" : "default"} />
          </Field>
        </div>
        <Field label={t("Joy")} optional htmlFor="cv-iv-place">
          <TextInput id="cv-iv-place" value={place} onChange={(e) => setPlace(e.target.value.slice(0, 160))} placeholder={t("Filial va manzil")} />
          {placeChips.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {placeChips.map((p) => {
                const text = placeText(p);
                return (
                  <Chip key={p.id} on={place === text} onClick={() => setPlace(text)} title={text}>
                    {p.name}
                  </Chip>
                );
              })}
            </div>
          )}
        </Field>
        <div className="flex items-start gap-2.5 rounded-v2-lg bg-v2-info-bg px-3.5 py-3 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <p>
            {phone
              ? t("Nomzodga xabar avtomatik ketmaydi — vaqtni telefonda kelishib oling: {phone}.", { phone: `+998 ${phone}` })
              : t("Nomzodga xabar avtomatik ketmaydi — vaqtni o'zi bilan kelishib oling.")}
          </p>
        </div>
      </div>
    </V2Dialog>
  );
}

/* ═══════════════════════ Rad etish ═══════════════════════ */

export function CvRejectDialog({ cv, onClose, onSaved }: { cv: CvApplication; onClose: () => void; onSaved: (app: CvApplication) => void }) {
  const { t } = useT();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const text = reason && note.trim() ? `${reason}: ${note.trim()}` : reason || note.trim();
  const err = !text ? t("Sababni tanlang yoki yozing") : text.length > 300 ? t("Sabab juda uzun") : "";

  async function submit() {
    if (busy) return;
    setTried(true);
    if (err) return;
    setBusy(true);
    const r = await patchCv(cv.id, { status: "rejected", rejectReason: text });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      return;
    }
    onSaved(r.application);
    modal.close();
  }

  return (
    <V2Dialog
      title={t("Nomzodni rad etish")}
      onClose={onClose}
      controller={modal}
      dirty={Boolean(reason || note.trim())}
      saving={busy}
      width={520}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : t("Rad etish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <CandidateRow cv={cv} />
        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Sabab")}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Sabab")}>
            {CV_REJECT_REASONS.map((r) => (
              <Chip key={r} on={reason === r} onClick={() => setReason(reason === r ? "" : r)}>
                {t(r)}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={reason ? t("Izoh") : t("Yoki o'zingiz yozing")} optional={Boolean(reason)} htmlFor="cv-rej-note">
          <textarea
            id="cv-rej-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            rows={3}
            placeholder={t("Masalan: ingliz tili darajasi B1, bizga C1 kerak")}
            className={`${fieldCls(tried && err ? "error" : "default")} h-auto! min-h-[4.5rem] resize-y py-2`}
          />
          {tried && err && <FieldError>{err}</FieldError>}
        </Field>
        <p className="text-v2-caption font-normal text-v2-text-3">{t("Ariza «Rad etildi» kartasiga o'tadi — keyin «Qayta ko'rib chiqish» bilan qaytarsa bo'ladi.")}</p>
      </div>
    </V2Dialog>
  );
}

/* ═══════════════════════ Ishga olish ═══════════════════════ */

type SalaryType = "mixed" | "fixed" | "foiz";

const lc = (s: string) => (s || "").toLowerCase().replace(/[‘’ʻʼ`']/g, "'").trim();

export function CvHireDialog({
  cv,
  onClose,
  onSaved,
}: {
  cv: CvApplication;
  onClose: () => void;
  onSaved: (app: CvApplication, emp: { id: number; name: string }, smsSent: boolean) => void;
}) {
  const { t, months } = useT();
  const f = useProfileFmt();
  const branch = useBranch();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const today = uzDateIso();

  /* ---- Ro'yxatlar: rollar (Boshqaruv → Rollar), faol kurslar ---- */
  const [roles, setRoles] = useState<CvRole[] | null>(null);
  const [courses, setCourses] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    const get = (url: string) => fetch(url).then((r) => r.json()).catch(() => null);
    void Promise.all([get("/api/roles"), get("/api/offline-courses")]).then(([r, c]) => {
      if (!alive) return;
      setRoles(r?.ok ? (r.roles as CvRole[]).map((x) => ({ id: Number(x.id), key: x.key, name: String(x.name ?? "") })) : []);
      setCourses(c?.ok ? (c.courses as { name: string; active?: boolean }[]).filter((x) => x.active !== false).map((x) => x.name) : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- Maydonlar (`null` — tegilmagan: sukut ko'rinadi) ---- */
  const [roleRaw, setRole] = useState<number | null>(null);
  const roleId = roleRaw ?? (roles ? roleForPosition(cv, roles) : null);
  const role = roles?.find((r) => r.id === roleId);
  const teacher = role?.key === "teacher";

  const [branchRaw, setBranchPick] = useState<number | null>(null);
  const cvBranchOk = typeof cv.branchId === "number" && branch.branches.some((b) => b.id === cv.branchId);
  const branchId = branchRaw ?? (cvBranchOk ? (cv.branchId as number) : branch.branchId);

  const [startRaw, setStart] = useState<string | null>(null);
  const start = startRaw ?? (DATE_RE.test(cv.startDate || "") && cv.startDate >= today ? cv.startDate : today);

  const [kursRaw, setKurs] = useState<string | null>(null);
  const defaultKurs = useMemo(() => {
    if (!courses) return "";
    const wanted = (cv.subjects?.length ? cv.subjects : (cv.subject || "").split(",")).map(lc).filter(Boolean);
    return courses.find((c) => wanted.includes(lc(c))) ?? "";
  }, [courses, cv.subjects, cv.subject]);
  const kurs = kursRaw ?? defaultKurs;

  const [typeRaw, setType] = useState<SalaryType | null>(null);
  const salaryType: SalaryType = typeRaw ?? (teacher ? "foiz" : "fixed");
  const [oklad, setOklad] = useState("");
  const [percent, setPercent] = useState("");

  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const dirty = roleRaw !== null || branchRaw !== null || startRaw !== null || kursRaw !== null || typeRaw !== null || oklad !== "" || percent !== "";

  const okladNum = Number(oklad || 0);
  const pctNum = Number(percent.replace(",", "."));
  const errs = {
    role: roleId === null ? t("Lavozimni tanlang") : "",
    branch: branchId === null ? t("Filialni tanlang") : "",
    start: !DATE_RE.test(start) ? t("Ish boshlash sanasini tanlang") : "",
    kurs: teacher && !kurs ? t("Yo'nalishni tanlang") : "",
    oklad: salaryType !== "foiz" && !(okladNum > 0) ? t("Okladni kiriting") : "",
    percent: salaryType !== "fixed" && !(Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100) ? t("Foizni kiriting — 1 dan 100 gacha") : "",
  };
  const hasErr = Object.values(errs).some(Boolean);

  async function submit() {
    if (busy) return;
    setTried(true);
    if (hasErr) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/management-cv/${cv.id}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerRoleId: roleId,
          branchId,
          startDate: start,
          kurs: teacher ? kurs : "",
          salaryType,
          oklad: salaryType === "foiz" ? 0 : okladNum,
          percent: salaryType === "fixed" ? 0 : pctNum,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        showToast({ tone: "error", title: t("Ishga olib bo'lmadi"), detail: t(d.error || "Saqlanmadi") });
        setBusy(false);
        return;
      }
      onSaved(d.application as CvApplication, d.employee as { id: number; name: string }, Boolean(d.smsSent));
      modal.close();
    } catch {
      showToast({ tone: "error", title: t("Ishga olib bo'lmadi"), detail: t("Serverga ulanib bo'lmadi") });
      setBusy(false);
    }
  }

  /* ---- Variantlar ---- */
  // O'rnatilgan rollar (o'qituvchi, moderator) nomi tarjima qilinadi; qo'lda qo'shilgani — o'z nomi.
  const roleOptions = useMemo<PickerOption[]>(() => (roles ?? []).map((r) => ({ value: String(r.id), label: r.key ? t(r.name) : r.name })), [roles, t]);
  const branchOptions = useMemo<PickerOption[]>(() => branch.branches.map((b) => ({ value: String(b.id), label: b.name })), [branch.branches]);
  const courseOptions = useMemo<PickerOption[]>(() => (courses ?? []).map((c) => ({ value: c, label: c })), [courses]);

  /* ---- Oklad qanday bo'linadi (lib/salary.ts payrollOkladDays: kirgan kuni ham sanaladi) ---- */
  let prorate = "";
  if (salaryType !== "foiz" && okladNum > 0 && DATE_RE.test(start)) {
    const [y, m, d] = start.split("-").map(Number);
    const daysIn = new Date(y, m, 0).getDate();
    const month = months[m - 1] ?? "";
    prorate =
      d === 1
        ? t("{month} oyligi to'liq hisoblanadi: {oklad} so'm.", { month, oklad: fmtSum(okladNum) })
        : t("{month} oyligi {date}dan boshlab hisoblanadi: {oklad} × {days}/{daysIn} kun.", {
            month,
            date: f.dayMonth(start),
            oklad: fmtSum(okladNum),
            days: daysIn - d + 1,
            daysIn,
          });
  }
  // Rasmdagidek: «Maftuna Ismoilova · Ingliz tili · suhbatdan o'tdi».
  const subtitle = [cv.name, cvTrackText(cv, t), cv.status === "interview" ? t("suhbatdan o'tdi") : ""].filter(Boolean).join(" · ");

  return (
    <V2Dialog
      title={t("Ishga olish")}
      subtitle={subtitle}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={busy}
      width={480}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy || roles === null} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Briefcase className="size-4" strokeWidth={1.75} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : t("Ishga olish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Lavozim")} error={tried ? errs.role : ""}>
            <V2Picker
              value={roleId === null ? "" : String(roleId)}
              onChange={(v) => setRole(v ? Number(v) : null)}
              options={roleOptions}
              label={t("Lavozim")}
              // `loading` qo'yilmaydi: o'chiq tanlov oyna ochilgandagi fokusni «Filial»ga o'tkazib yuborardi.
              placeholder={roles === null ? t("Yuklanmoqda...") : t("Lavozimni tanlang")}
              state={tried && errs.role ? "error" : "default"}
            />
          </Field>
          <Field label={t("Filial")} error={tried ? errs.branch : ""}>
            <V2Picker
              value={branchId === null ? "" : String(branchId)}
              onChange={(v) => setBranchPick(v ? Number(v) : null)}
              options={branchOptions}
              label={t("Filial")}
              placeholder={t("Filialni tanlang")}
              searchable={false}
              state={tried && errs.branch ? "error" : "default"}
            />
          </Field>
          <Field label={t("Ish boshlash sanasi")} error={tried ? errs.start : ""}>
            <V2DateField value={DATE_RE.test(start) ? dateOfIso(start) : null} onChange={(d) => setStart(isoOfDate(d))} state={tried && errs.start ? "error" : "default"} />
          </Field>
          {teacher && (
            <Field label={t("Yo'nalish")} error={tried ? errs.kurs : ""}>
              <V2Picker
                value={kurs}
                onChange={(v) => setKurs(v)}
                options={courseOptions}
                label={t("Yo'nalish")}
                placeholder={t("Tanlang")}
                searchPlaceholder={t("Kursni qidirish")}
                loading={courses === null}
                state={tried && errs.kurs ? "error" : "default"}
              />
            </Field>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-v2-small font-medium text-v2-text">{t("Oylik hisoblash usuli")}</div>
          <Segmented
            value={salaryType}
            onChange={(v) => setType(v as SalaryType)}
            label={t("Oylik hisoblash usuli")}
            options={[
              { value: "mixed", label: t("Oklad + foiz") },
              { value: "fixed", label: t("Oklad") },
              { value: "foiz", label: t("Foiz") },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {salaryType !== "foiz" && (
            <Field label={t("Oklad")} htmlFor="cv-hire-oklad" error={tried ? errs.oklad : ""} hint={t("oyiga, kunlarga bo'lib hisoblanadi")}>
              <MoneyField id="cv-hire-oklad" value={oklad} onChange={setOklad} compact state={tried && errs.oklad ? "error" : "default"} />
            </Field>
          )}
          {salaryType !== "fixed" && (
            <Field label={t("Foiz")} htmlFor="cv-hire-pct" error={tried ? errs.percent : ""} hint={t("guruh o'quvchilari to'lovidan")}>
              <div className="relative">
                <TextInput
                  id="cv-hire-pct"
                  inputMode="decimal"
                  autoComplete="off"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
                  placeholder="40"
                  state={tried && errs.percent ? "error" : "default"}
                  className="pr-9 font-medium tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">%</span>
              </div>
            </Field>
          )}
        </div>
        <div className="flex items-start gap-2.5 rounded-v2-lg bg-v2-info-bg px-3.5 py-3 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <p className="min-w-0">
            {t("«Xodimlar» ro'yxatiga qo'shiladi va oylik hisobiga ulanadi.")}
            {prorate && <span className="tabular-nums"> {prorate}</span>}
          </p>
        </div>
      </div>
    </V2Dialog>
  );
}
