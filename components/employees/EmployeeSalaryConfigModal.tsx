"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import type { HrEmployee, EmployeeBranchAssignment } from "@/lib/hrEmployees";

// Xodim profili → "Ish haqi" oynasi.
//
// NIMA UCHUN KERAK: ish haqini kiritish faqat YANGI xodim qo'shish oynasida
// bor edi, mavjud xodimda esa umuman yo'q. Shu sababli bazadagi 63 xodimning
// hech birida oylik sozlanmagan va oylik hisobi hech qachon haqiqiy
// ma'lumotga tayanolmagan.
//
// Bu yerda hech qanday standart summa TAKLIF QILINMAYDI — raqamlarni faqat
// admin kiritadi. Bo'sh qoldirilsa xodim "sozlanmagan" bo'lib qolaveradi.

const selectCls = "h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

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
  const { showSuccess, showError } = useToast();
  const [branches, setBranches] = useState<NamedId[]>([]);
  const [roles, setRoles] = useState<NamedId[]>([]);
  const [schedules, setSchedules] = useState<NamedId[]>([]);
  const [percentOpts, setPercentOpts] = useState<{ name: string; percent: string }[]>([]);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [percent, setPercent] = useState(employee.percent ?? "");
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
        body: JSON.stringify({ branchAssignments: assignments, percent }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      showSuccess(total > 0 ? "Ish haqi saqlandi" : "Saqlandi — ish haqi kiritilmagani uchun xodim \"sozlanmagan\" bo'lib qoladi");
      onSaved(data.employee as HrEmployee);
    } catch {
      showError("Tarmoq xatosi — saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="text-[15px] font-semibold">Ish haqi — {employee.name}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">Filial bo&apos;yicha oklad kiriting. Oylik hisobi va kassadagi chiqim chegarasi shu qiymatlarga tayanadi.</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">Yuklanmoqda…</div>
          ) : (
            <>
              {isTeacher && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <label className="block text-[13px] font-medium mb-1.5">
                    Oladigan foizi <span className="text-muted-foreground font-normal">— o&apos;qituvchi uchun asosiy</span>
                  </label>
                  <div className="relative">
                    <select className={selectCls} value={percent} onChange={(e) => setPercent(e.target.value)}>
                      <option value="">Tanlanmagan</option>
                      {percentOpts.map((p) => (
                        <option key={p.name} value={p.name}>{`${p.name} (${p.percent}%)`}</option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-1.5">
                    O&apos;qituvchi yaxlit oklad emas, o&apos;quvchilari to&apos;lagan puldan
                    <strong> shu foizni</strong> oladi. Oylik har oy tushumdan avtomatik hisoblanadi.
                    Ro&apos;yxat Sozlamalar → Moliya → Oylik foizlari dan.
                  </p>
                  {selectedPercentNum !== null && (
                    <p className="text-[12px] mt-2">
                      Masalan o&apos;quvchi <strong>100 000</strong> so&apos;m to&apos;lasa —
                      o&apos;qituvchiga <strong className="text-emerald-700">{Math.round(100000 * selectedPercentNum / 100).toLocaleString("ru-RU")}</strong> so&apos;m qo&apos;shiladi.
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="text-[13px] font-medium mb-1">
                  Oklad (filial bo&apos;yicha)
                  {isTeacher && <span className="text-muted-foreground font-normal"> — ixtiyoriy, faqat qat&apos;iy maosh oladigan o&apos;qituvchi uchun</span>}
                </div>
                <div className="grid grid-cols-4 gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-2">
                  <span>Filial</span><span>Rol</span><span>Ish jadvali</span><span>Ish haqi</span>
                </div>
                {branches.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground py-4">Filial topilmadi — avval Boshqaruv → Filiallar da qo&apos;shing.</div>
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
                          <div className="relative">
                            <select className={`${selectCls} disabled:opacity-40`} disabled={off} value={row.roleId} onChange={(e) => update(branch.id, { roleId: e.target.value })}>
                              <option value="">Rolni tanlang</option>
                              {roles.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                            </select>
                            <Chevron />
                          </div>
                          <div className="relative">
                            <select className={`${selectCls} disabled:opacity-40`} disabled={off} value={row.scheduleId} onChange={(e) => update(branch.id, { scheduleId: e.target.value })}>
                              <option value="">Ish jadvali</option>
                              {schedules.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                            </select>
                            <Chevron />
                          </div>
                          <MoneyInput
                            value={row.salary}
                            onChange={(v) => update(branch.id, { salary: v })}
                            disabled={off}
                            placeholder="Ish haqini kiriting"
                            className={`${inputCls} tabular-nums disabled:opacity-40`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3 text-[13px]">
                Jami oklad: <strong className="tabular-nums">{total.toLocaleString("ru-RU")} UZS</strong>
                {total === 0 && !(isTeacher && percent) && (
                  <span className="text-muted-foreground"> — kiritilmaguncha xodimning oylik hisobi ko&apos;rsatilmaydi</span>
                )}
                {total === 0 && isTeacher && percent && (
                  <span className="text-emerald-700"> — o&apos;qituvchi foiz bo&apos;yicha ishlaydi, oklad shart emas</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-border hover:bg-secondary text-sm">Bekor qilish</button>
          <button type="button" onClick={save} disabled={saving || loading} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
