"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, PhoneField, Segmented, TextInput } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import { useGroups } from "@/hooks/useGroups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import type { HrEmployee } from "@/lib/hrEmployees";
import { uzDateIso } from "@/lib/uzTime";
import type { WorkSchedule } from "@/lib/workSchedules";

// YANGI VERSIYA — «YANGI XODIM» (31-qism, rasm «Yangi xodim», yorug'/qorong'i). O'ngdan panel.
//
// Bo'limlar: Shaxsiy (ism, familiya, telefon — login shu raqam, tug'ilgan sana) → Ish (rol, yo'nalish,
// ishga kirgan sana, ish jadvali, filiallar, «Guruhni biriktirish» — o'qituvchiga) → Oylik (hisoblash
// usuli: oklad + foiz / oklad / foiz). Saqlash — POST /api/hr-employees, «Ishga olish» (CV) bilan bir xil
// shakl (lib/cvHire.ts): oklad — birinchi tanlangan filialning ish haqi qatori, foiz — `percent`.
// Ish jadvali tanlansa, uning vaqti xodimning ish vaqti bo'ladi (kechikish shundan o'lchanadi).
// «Login berish» o'chiq — kirish hisobi va SMS yaratilmaydi (lib/hrEmployeeCreate.ts → `login`).
// Tanlangan guruhlar — o'qituvchisi shu xodimga almashadi (PATCH /api/groups/:id). Tahrirlash — eski
// oyna (xodim kartasi). Jinsi ism oxiridan taxmin qilinadi (xodim kartasida tuzatiladi).

type Salary = "mixed" | "fixed" | "foiz";
interface RoleOpt {
  id: number;
  key?: string;
  name: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

export default function EmployeeCreateDrawerV2({ onClose, onCreated }: { onClose: () => void; onCreated: (emp: HrEmployee) => void }) {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { activeNames: courses } = useOfflineCourseList();
  const { groups } = useGroups();
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

  useEffect(() => {
    let alive = true;
    const get = (u: string) => fetch(u).then((r) => r.json()).catch(() => null);
    void Promise.all([get("/api/roles"), get("/api/work-schedules")]).then(([r, s]) => {
      if (!alive) return;
      if (r?.ok) setRoles((r.roles as RoleOpt[]).map((x) => ({ id: Number(x.id), key: x.key, name: String(x.name ?? "") })));
      if (s?.ok) setSchedules((s.schedules as WorkSchedule[]).filter((x) => x.active !== false));
    });
    return () => {
      alive = false;
    };
  }, []);

  const [ism, setIsm] = useState("");
  const [familiya, setFamiliya] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [roleId, setRoleId] = useState("");
  const [kurs, setKurs] = useState("");
  const [start, setStart] = useState(uzDateIso());
  const [scheduleId, setScheduleId] = useState("");
  const [branchIds, setBranchIds] = useState<number[]>(branch.branchId !== null ? [branch.branchId] : []);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [salary, setSalary] = useState<Salary>("mixed");
  const [oklad, setOklad] = useState("");
  const [percent, setPercent] = useState("");
  const [login, setLogin] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);

  const role = roles.find((r) => String(r.id) === roleId);
  const isTeacher = role?.key === "teacher";
  const schedule = schedules.find((s) => String(s.id) === scheduleId);
  const name = `${ism.trim()} ${familiya.trim()}`.trim();
  const branchName = (id: number) => branch.branches.find((b) => b.id === id)?.name ?? `#${id}`;

  // Sukut: o'qituvchiga «dars jadvali bo'yicha» jadval.
  const lessonsSchedule = schedules.find((s) => s.kind === "lessons");
  const effectiveScheduleId = scheduleId || (isTeacher && lessonsSchedule ? String(lessonsSchedule.id) : "");

  // Oklad shu oy uchun — ishga kirgan kundan oy oxirigacha (kalendar kunlari).
  const prorate = useMemo(() => {
    const amount = Number(oklad) || 0;
    if (!amount || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
    const y = Number(start.slice(0, 4));
    const m = Number(start.slice(5, 7));
    const dim = new Date(y, m, 0).getDate();
    const days = dim - Number(start.slice(8, 10)) + 1;
    return { month: MONTHS[m - 1], days, dim, value: (amount * days) / dim };
  }, [oklad, start]);

  const teacherGroups = useMemo(
    () => groups.filter((g) => ["gathering", "active", "frozen"].includes(g.status) && (!kurs || g.course === kurs)).slice(0, 8),
    [groups, kurs],
  );

  async function save(close: () => void) {
    if (!ism.trim() || !familiya.trim()) return showError(t("Ism va familiyani kiriting"));
    if (phone.replace(/\D/g, "").length !== 9) return showError(t("Telefon raqamini to'liq kiriting — 9 ta raqam (masalan 90 123 45 67)"));
    if (!role) return showError(t("Rolni tanlang"));
    if (isTeacher && !kurs) return showError(t("Yo'nalishni tanlang"));
    if (branchIds.length === 0) return showError(t("Kamida bitta filialni tanlang"));
    if (salary !== "foiz" && !(Number(oklad) > 0)) return showError(t("Okladni kiriting"));
    const pct = Number(percent.replace(",", "."));
    if (salary !== "fixed" && !(pct > 0 && pct <= 100)) return showError(t("Foizni kiriting — 1 dan 100 gacha"));

    const sid = effectiveScheduleId ? Number(effectiveScheduleId) : null;
    const fixedTime = schedule && schedule.kind !== "lessons" && schedule.start && schedule.end;
    setSaving(true);
    const res = await fetch("/api/hr-employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phone.replace(/\D/g, ""),
        centerRoleId: role.id,
        gender: /a$/i.test(ism.trim()) ? "female" : "male",
        birthDate,
        kurs: isTeacher ? kurs : "",
        percent: salary === "fixed" ? "" : String(Math.round(pct * 100) / 100),
        branchIds,
        payrollBranchId: branchIds[0],
        branchAssignments: branchIds.map((b, i) => ({ branchId: b, roleId: null, scheduleId: sid, salary: i === 0 && salary !== "foiz" ? Math.round(Number(oklad)) : 0 })),
        salaryStartDate: start || null,
        workStart: fixedTime ? schedule.start : null,
        workEnd: fixedTime ? schedule.end : null,
        login,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      setSaving(false);
      return showError(t(res?.error || "Xodim qo'shilmadi"));
    }
    const emp = res.employee as HrEmployee;
    // Guruhlar — o'qituvchisi yangi xodimga.
    const failed: string[] = [];
    for (const gid of groupIds) {
      const g = groups.find((x) => x.id === gid);
      const r = await fetch(`/api/groups/${gid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacher: name }) })
        .then((x) => x.json())
        .catch(() => null);
      if (!r?.ok) failed.push(g?.name ?? String(gid));
    }
    setSaving(false);
    onCreated(emp);
    if (failed.length) showError(t("Xodim qo'shildi, lekin guruh biriktirilmadi: {list}", { list: failed.join(", ") }));
    else if (!login) showSuccess(t("Xodim qo'shildi — {name}. Login keyin «Rollar → Login hisoblari»dan beriladi.", { name }));
    else if (res.smsSent) showSuccess(t("Xodim qo'shildi — {name}. Faollashtirish SMS'i yuborildi.", { name }));
    else showError(t("Xodim qo'shildi — {name}, lekin faollashtirish SMS'i yuborilmadi. Birozdan so'ng qayta urinib ko'ring.", { name }));
    close();
  }

  const branchOptions = branch.branches.filter((b) => !branchIds.includes(b.id));

  return (
    <V2Dialog
      variant="right"
      width={560}
      title={t("Yangi xodim")}
      subtitle={branch.branchId !== null ? t("{branch} filiali", { branch: branchName(branch.branchId) }) : undefined}
      onClose={onClose}
      saving={saving}
      dirty={Boolean(ism || familiya || phone)}
      footerStart={
        <span className="inline-flex items-center gap-2 text-v2-small text-v2-text">
          <V2Checkbox checked={login} onChange={setLogin} label={t("Login berish")} />
          {t("Login berish")}
        </span>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {t("Xodimni saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="text-v2-caption text-v2-text-3">{t("Shaxsiy ma'lumotlar")}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Ism")} htmlFor="emp-ism">
              <TextInput id="emp-ism" value={ism} onChange={(e) => setIsm(e.target.value)} />
            </Field>
            <Field label={t("Familiya")} htmlFor="emp-fam">
              <TextInput id="emp-fam" value={familiya} onChange={(e) => setFamiliya(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Telefon")} hint={login ? t("Login shu raqam · parol SMS bilan") : t("Login berilmaydi — keyin beriladi")}>
              <PhoneField value={phone} onChange={setPhone} id="emp-phone" />
            </Field>
            <Field label={t("Tug'ilgan sana")} optional>
              <IsoDateField value={birthDate} onChange={setBirthDate} />
            </Field>
          </div>
        </section>

        <section className="space-y-3 border-t border-v2-border pt-4">
          <div className="text-v2-caption text-v2-text-3">{t("Ish")}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Rol")}>
              <V2Select
                label={t("Rol")}
                placeholder={t("Tanlang")}
                value={roleId}
                onChange={setRoleId}
                options={roles.map((r) => ({ value: String(r.id), label: r.key === "teacher" ? `${r.name} · ${t("o'z guruhlari")}` : r.name }))}
              />
            </Field>
            <Field label={t("Yo'nalish")} optional={!isTeacher}>
              <V2Select label={t("Yo'nalish")} placeholder={t("Tanlang")} value={kurs} onChange={setKurs} options={courses.map((c) => ({ value: c, label: c }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Ishga kirgan sana")}>
              <IsoDateField value={start} onChange={setStart} />
            </Field>
            <Field label={t("Ish jadvali")} hint={schedule && schedule.kind !== "lessons" && schedule.start ? t("ish vaqti {a}–{b}", { a: schedule.start, b: schedule.end ?? "" }) : undefined}>
              <V2Select label={t("Ish jadvali")} placeholder={t("Tanlang")} value={effectiveScheduleId} onChange={setScheduleId} searchable={false} options={schedules.map((s) => ({ value: String(s.id), label: s.name }))} />
            </Field>
          </div>
          <Field label={t("Filiallar")}>
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-v2-md border border-v2-border-field px-2 py-1.5">
              {branchIds.map((id) => (
                <span key={id} className="inline-flex h-7 items-center gap-1 rounded-v2-sm bg-v2-brand-bg pl-2.5 pr-1 text-v2-small font-semibold text-v2-brand-text">
                  {branchName(id)}
                  <button type="button" onClick={() => setBranchIds((cur) => cur.filter((x) => x !== id))} aria-label={t("{name} — olib tashlash", { name: branchName(id) })} className="inline-flex size-5 items-center justify-center rounded-v2-sm hover:bg-v2-surface">
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </span>
              ))}
              {branchOptions.length > 0 &&
                (addingBranch ? (
                  <div className="w-48">
                    <V2Select
                      label={t("Filial qo'shish")}
                      placeholder={t("Tanlang")}
                      value=""
                      onChange={(v) => {
                        if (v) setBranchIds((cur) => [...cur, Number(v)]);
                        setAddingBranch(false);
                      }}
                      searchable={false}
                      options={branchOptions.map((b) => ({ value: String(b.id), label: b.name }))}
                    />
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingBranch(true)} className="inline-flex h-7 items-center gap-1 px-1.5 text-v2-small text-v2-text-2 hover:text-v2-text">
                    <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                    {t("Filial qo'shish")}
                  </button>
                ))}
            </div>
          </Field>
          {isTeacher && (
            <Field label={t("Guruhni biriktirish")} optional hint={teacherGroups.length === 0 ? t("Bu yo'nalishda faol guruh yo'q") : undefined}>
              <div className="space-y-2">
                {teacherGroups.map((g) => {
                  const on = groupIds.includes(g.id);
                  return (
                    <label key={g.id} className={`flex cursor-pointer gap-3 rounded-v2-md border px-3 py-2 ${on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border hover:bg-v2-surface-2"}`}>
                      <V2Checkbox checked={on} onChange={(v) => setGroupIds((cur) => (v ? [...cur, g.id] : cur.filter((x) => x !== g.id)))} label={g.name} />
                      <span className="min-w-0 text-v2-small">
                        <span className="flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                          <b className="font-semibold text-v2-text">{/^\d+$/.test(g.name) ? `${g.name} · ${g.course}` : g.name}</b>
                          <span className="text-v2-text-3">· {t("{n} o'quvchi", { n: g.students ?? 0 })}</span>
                        </span>
                        <span className="block text-v2-text-2">
                          {[g.day, timeLabel(g.time), roomLabel(g.room)].filter(Boolean).join(" · ")}
                          {g.teacher ? ` · ${t("hozir {name}da", { name: g.teacher })}` : ""}
                        </span>
                        {on && g.teacher && <span className="block text-v2-success">{t("O'qituvchi {from} → {to} ga almashadi", { from: g.teacher, to: name || t("yangi xodim") })}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
        </section>

        <section className="space-y-3 border-t border-v2-border pt-4">
          <div className="text-v2-caption text-v2-text-3">{t("Oylik")}</div>
          <Field label={t("Hisoblash usuli")}>
            <Segmented
              label={t("Hisoblash usuli")}
              value={salary}
              onChange={(v) => setSalary(v as Salary)}
              options={[
                { value: "mixed", label: t("Oklad + foiz") },
                { value: "fixed", label: t("Oklad") },
                { value: "foiz", label: t("Foiz") },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {salary !== "foiz" && (
              <Field label={t("Oklad")} hint={prorate ? t("{month}: {sum} · {d}/{dim} kun", { month: prorate.month.charAt(0).toUpperCase() + prorate.month.slice(1), sum: fmt(prorate.value), d: prorate.days, dim: prorate.dim }) : undefined}>
                <MoneyField value={oklad} onChange={setOklad} id="emp-oklad" compact />
              </Field>
            )}
            {salary !== "fixed" && (
              <Field label={t("Foiz")} hint={t("guruh o'quvchilari to'lovidan")}>
                <div className="relative">
                  <TextInput inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} className="pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">%</span>
                </div>
              </Field>
            )}
          </div>
        </section>
      </div>
    </V2Dialog>
  );
}
