"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";
import DateField from "@/components/ui/DateField";
import { useToast } from "@/components/ui/Toast";
import type { HrEmployee, EmployeeBranchAssignment } from "@/lib/hrEmployees";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Xodim profili → "Ish haqi" oynasi.
//
// NIMA UCHUN KERAK: ish haqini kiritish faqat YANGI xodim qo'shish oynasida
// bor edi, mavjud xodimda esa umuman yo'q. Shu sababli bazadagi 63 xodimning
// hech birida oylik sozlanmagan va oylik hisobi hech qachon haqiqiy
// ma'lumotga tayanolmagan.
//
// Bu yerda hech qanday standart summa TAKLIF QILINMAYDI — raqamlarni faqat
// admin kiritadi. Bo'sh qoldirilsa xodim "sozlanmagan" bo'lib qolaveradi.

const inputCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";


interface Row {
  checked: boolean;
  roleId: string;
  scheduleId: string;
  salary: string;
}
const EMPTY_ROW: Row = { checked: false, roleId: "", scheduleId: "", salary: "" };

interface NamedId { id: number; name: string }

export default function EmployeeSalaryConfigModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: HrEmployee;
  onClose: () => void;
  onSaved: (updated: HrEmployee) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [branches, setBranches] = useState<NamedId[]>([]);
  const [roles, setRoles] = useState<NamedId[]>([]);
  const [schedules, setSchedules] = useState<NamedId[]>([]);
  const [percentOpts, setPercentOpts] = useState<{ name: string; percent: string }[]>([]);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [percent, setPercent] = useState(employee.percent ?? "");
  // Plastik oylik — faqat raqamlardan iborat satr (MoneyInput kelishuvi).
  // Bo'sh satr = biriktirilmagan.
  const [plastik, setPlastik] = useState<string>("");
  // Ishga kirgan (oylik yoziladigan) sana, "YYYY-MM-DD". Bo'sh — cheklov
  // yo'q, oklad oy boshidan (lib/salary.ts → payrollOkladDays).
  const [startDate, setStartDate] = useState<string>(employee.salaryStartDate ?? "");
  // Ishdan ketgan sana (oxirgi ish kuni). Bo'sh — hali ishlayapti.
  const [endDate, setEndDate] = useState<string>(employee.salaryEndDate ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isTeacher = employee.turi === "teacher";

  useEffect(() => {
    let alive = true;
    const get = (u: string) => fetch(u).then((r) => r.json()).catch(() => null);
    Promise.all([
      get("/api/branches"),
      get("/api/roles"),
      get("/api/work-schedules"),
      get("/api/settings-lists?kind=monthly-percents"),
    ]).then(([b, r, s, p]) => {
      if (!alive) return;
      if (b?.ok) setBranches(b.branches ?? []);
      if (r?.ok) setRoles(r.roles ?? []);
      if (s?.ok) setSchedules(s.schedules ?? []);
      if (p?.ok) setPercentOpts((p.items ?? []).map((x: { name: string; percent?: string }) => ({ name: x.name, percent: x.percent ?? "" })));
      // Mavjud biriktiruvlarni oynaga qo'yamiz.
      const init: Record<number, Row> = {};
      for (const a of employee.branchAssignments ?? []) {
        init[a.branchId] = {
          checked: true,
          roleId: a.roleId ? String(a.roleId) : "",
          scheduleId: a.scheduleId ? String(a.scheduleId) : "",
          salary: a.salary ? String(a.salary) : "",
        };
      }
      setRows(init);
      // DIQQAT: `employee.plastikSalary ? String(...) : ""` YOZILMAYDI —
      // yuqoridagi `a.salary ? ... : ""` naqshi bu maydon uchun XATO
      // bo'lardi: u yerda 0 va "yo'q" bir xil, bu yerda esa farqli.
      setPlastik(employee.plastikSalary == null ? "" : String(employee.plastikSalary));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [employee]);

  const rowOf = (id: number): Row => rows[id] ?? EMPTY_ROW;
  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ROW), ...patch } }));

  const assignments: EmployeeBranchAssignment[] = branches
    .filter((b) => rowOf(b.id).checked)
    .map((b) => {
      const r = rowOf(b.id);
      return {
        branchId: b.id,
        roleId: r.roleId ? Number(r.roleId) : null,
        scheduleId: r.scheduleId ? Number(r.scheduleId) : null,
        salary: Number(String(r.salary).replace(/\D/g, "")) || 0,
      };
    });
  const total = assignments.reduce((s, a) => s + a.salary, 0);
  // Tanlangan daraja necha foiz — misol ko'rsatish uchun.
  const selectedPercentNum = (() => {
    const opt = percentOpts.find((o) => o.name === percent);
    if (!opt) return null;
    const n = Number(String(opt.percent).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  })();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/hr-employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `plastikSalary`: bo'sh maydon → `null` (biriktirilmagan), 0 EMAS.
        body: JSON.stringify({
          branchAssignments: assignments,
          percent,
          plastikSalary: plastik === "" ? null : Number(plastik),
          // Bo'sh → `null` (cheklov yo'q).
          salaryStartDate: startDate || null,
          salaryEndDate: endDate || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      showSuccess(total > 0 ? t("Ish haqi saqlandi") : t("Saqlandi — ish haqi kiritilmagani uchun xodim \"sozlanmagan\" bo'lib qoladi"));
      onSaved(data.employee as HrEmployee);
    } catch {
      showError(t("Tarmoq xatosi — saqlanmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare size="3xl" zIndex={50} panelClassName="overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="text-[15px] font-semibold">Ish haqi — {employee.name}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t("Filial bo'yicha oklad kiriting. Oylik hisobi va kassadagi chiqim chegarasi shu qiymatlarga tayanadi.")}</p>
          </div>
          <button type="button" onClick={modal.close} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">{t("Yuklanmoqda…")}</div>
          ) : (
            <>
              {isTeacher && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <label className="block text-[13px] font-medium mb-1.5">
                    {t("Oladigan foizi")}{" "}<span className="text-muted-foreground font-normal">{t("— o'qituvchi uchun asosiy")}</span>
                  </label>
                  <Select value={percent} onChange={(v) => setPercent(v)} options={percentOpts.map((p) => ({ value: p.name, label: `${p.name} (${p.percent}%)` }))} placeholder={t("Tanlanmagan")} clearable />
                  <p className="text-[11.5px] text-muted-foreground mt-1.5">
                    {t("O'qituvchi yaxlit oklad emas, o'quvchilari to'lagan puldan")}
                    <strong>{" "}{t("shu foizni")}</strong>{" "}{t("oladi. Oylik har oy tushumdan avtomatik hisoblanadi. Ro'yxat Sozlamalar → Moliya → Oylik foizlari dan.")}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-1">
                    {t("Pastda oklad ham kiritilsa — oklad + foiz: ikkalasi qo'shiladi (masalan 1 000 000 + 30%).")}
                  </p>
                  {selectedPercentNum !== null && (
                    <p className="text-[12px] mt-2">
                      {t("Masalan o'quvchi")}{" "}<strong>100 000</strong>{" "}{t("so'm to'lasa — o'qituvchiga")}{" "}<strong className="text-emerald-700">{Math.round(100000 * selectedPercentNum / 100).toLocaleString("ru-RU")}</strong>{" "}{t("so'm qo'shiladi.")}
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="text-[13px] font-medium mb-1">
                  Oklad (filial bo&apos;yicha)
                  {isTeacher && <span className="text-muted-foreground font-normal">{" "}{t("— ixtiyoriy: qat'iy maosh yoki foiz bilan birga (oklad + foiz)")}</span>}
                </div>
                <div className="grid grid-cols-4 gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-2">
                  <span>{t("Filial")}</span><span>{t("Rol")}</span><span>{t("Ish jadvali")}</span><span>{t("Ish haqi")}</span>
                </div>
                {branches.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground py-4">{t("Filial topilmadi — avval Boshqaruv → Filiallar da qo'shing.")}</div>
                ) : (
                  <div className="space-y-2">
                    {branches.map((branch) => {
                      const row = rowOf(branch.id);
                      const off = !row.checked;
                      return (
                        <div key={branch.id} className="grid grid-cols-4 gap-3 items-center">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={(e) => update(branch.id, { checked: e.target.checked })}
                              className="w-4 h-4 rounded border-border accent-primary"
                            />
                            <span className="text-sm">{branch.name}</span>
                          </label>
                          <Select value={row.roleId} onChange={(v) => update(branch.id, { roleId: v })} options={roles.map((r) => ({ value: String(r.id), label: r.name }))} placeholder={t("Rolni tanlang")} clearable disabled={off} />
                          <Select value={row.scheduleId} onChange={(v) => update(branch.id, { scheduleId: v })} options={schedules.map((s) => ({ value: String(s.id), label: s.name }))} placeholder={t("Ish jadvali")} clearable disabled={off} />
                          <MoneyInput
                            value={row.salary}
                            onChange={(v) => update(branch.id, { salary: v })}
                            disabled={off}
                            placeholder={t("Ish haqini kiriting")}
                            className={`${inputCls} tabular-nums disabled:opacity-40`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ISHGA KIRGAN SANA — oklad shu kundan hisoblanadi (29.09.2026:
                  "oy o'rtasidan kirsa ham to'liq oy uchun hisoblayapti").
                  Bo'sh qolsa — cheklov yo'q, avvalgidek oy boshidan. */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                {/* ISHGA KIRGAN va ISHDAN KETGAN sana yonma-yon (30.09.2026). */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium">{t("Ishga kirgan sana")}</label>
                    <DateField value={startDate} onChange={setStartDate} variant="form" placeholder="kk/oo/yyyy" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium">{t("Ishdan ketgan sana")}</label>
                    <DateField
                      value={endDate}
                      onChange={setEndDate}
                      variant="form"
                      placeholder="kk/oo/yyyy"
                      error={!!startDate && !!endDate && endDate < startDate}
                    />
                  </div>
                </div>
                {!!startDate && !!endDate && endDate < startDate && (
                  <p className="text-[12px] text-rose-600">{t("Ishdan ketgan sana ishga kirgan sanadan oldin bo'lishi mumkin emas")}</p>
                )}
                <p className="text-[12px] text-muted-foreground">
                  {t("Oklad faqat shu kunlar orasida hisoblanadi (oklad × ishlagan kun / oy kunlari). Ishga kirgan sana bo'sh — oy boshidan, ishdan ketgan sana bo'sh — hali ishlayapti. Ketgan xodim arxivlansa ham o'sha oy oylik ro'yxatida qoladi.")}
                </p>
              </div>

              {/* PLASTIK OYLIK — oklad yonida turadi, chunki bu ham ish
                  haqi sozlamasi. Xodimlar ro'yxatidagi tugmacha tez
                  o'zgartirish uchun qoladi, bu yer esa asosiy joyi. */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <label className="block text-[13px] font-medium" htmlFor="cfg-plastik">
                  {t("Plastik orqali beriladigan oylik")}
                </label>
                <div className="relative">
                  <MoneyInput
                    id="cfg-plastik"
                    value={plastik}
                    onChange={setPlastik}
                    placeholder={t("Masalan 2 000 000")}
                    className={`${inputCls} tabular-nums pr-14`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                    {t("so'm")}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Har oy shu summa kartaga o&apos;tkaziladi, qolgani naqd beriladi.
                  &ldquo;Plastik qismidan&rdquo; asosli soliq aynan shu summadan hisoblanadi.
                  Bo&apos;sh qoldirilsa xodim butun oyligini bitta kanal bilan oladi.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3 text-[13px]">
                {t("Jami oklad:")}{" "}<strong className="tabular-nums">{total.toLocaleString("ru-RU")} UZS</strong>
                {total === 0 && !(isTeacher && percent) && (
                  <span className="text-muted-foreground">{" "}{t("— kiritilmaguncha xodimning oylik hisobi ko'rsatilmaydi")}</span>
                )}
                {total === 0 && isTeacher && percent && (
                  <span className="text-emerald-700">{" "}{t("— o'qituvchi foiz bo'yicha ishlaydi, oklad shart emas")}</span>
                )}
                {/* OKLAD + FOIZ — ikkalasi ham kiritilgan (lib/payrollSources.ts). */}
                {total > 0 && isTeacher && percent && (
                  <span className="text-violet-700 dark:text-violet-400">
                    {" "}{t("— oklad + foiz: okladga o'quvchilar to'lovidan {percent}% qo'shiladi", { percent: selectedPercentNum ?? percent })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button type="button" onClick={modal.close} className="h-10 px-4 rounded-lg border border-border hover:bg-secondary text-sm">{t("Bekor qilish")}</button>
          <button type="button" onClick={save} disabled={saving || loading || (!!startDate && !!endDate && endDate < startDate)} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
