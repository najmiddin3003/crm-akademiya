"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Pencil, Search, UserCog } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { HrEmployee } from "@/lib/hrEmployees";
import { ALL_PERMISSION_PATHS, PERMISSION_GROUPS } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// Ma'lumot HAQIQIY — /api/roles va /api/hr-employees.
//
// IKKI QATLAM:
//   1) LAVOZIM (asosiy) — `teacher` / `moderator`. Rollar soni qat'iy
//      (lib/roles.ts), shu sabab qo'shish/o'chirish yo'q. Bu yerda
//      belgilangan ro'yxat o'sha lavozimdagi BARCHA xodimlarga qo'llanadi.
//   2) XODIM (istisno) — "Xodimga alohida ruxsat" tugmasi. Bitta xodimga
//      berilgan ro'yxat uning lavozimidan USTUN turadi.
//
// "Xodimlar" ustuni saqlanmaydi: /api/hr-employees dan shu lavozimdagi
// (`turi`) xodimlar sanaladi — istisnosi borlari ham shu songa kiradi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function RolesPage() {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  // Bir vaqtda faqat bittasi ochiq bo'ladi.
  const [roleTarget, setRoleTarget] = useState<Role | null>(null);
  const [empListOpen, setEmpListOpen] = useState(false);
  const [empTarget, setEmpTarget] = useState<HrEmployee | null>(null);

  const [description, setDescription] = useState("");
  // Modal ichida ruxsatlar DOIM massiv bo'lib turadi — galochkalar bevosita
  // shu ro'yxatni ko'rsatadi.
  const [chosenList, setChosenList] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/roles").then((r) => r.json()),
      fetch("/api/hr-employees").then((r) => r.json()),
    ]).then(([rolesRes, empRes]) => {
      if (cancelled) return;
      if (rolesRes.ok) setRoles(rolesRes.roles);
      if (empRes.ok) setEmployees(empRes.employees);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const countByTuri = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      if (!e.turi) continue;
      map.set(e.turi, (map.get(e.turi) ?? 0) + 1);
    }
    return map;
  }, [employees]);

  const overrideCount = useMemo(
    () => employees.filter((e) => Array.isArray(e.permissions)).length,
    [employees],
  );

  const roleNameOf = (turi: string) => roles.find((r) => r.key === turi)?.name ?? (turi || "—");

  /**
   * Xodim uchun galochkalarni oldindan to'ldirish.
   * Istisnosi bo'lsa — o'sha; bo'lmasa lavozim ro'yxati; lavozim ham
   * cheklovsiz bo'lsa — hammasi belgilangan holat.
   */
  function effectivePermsOf(e: HrEmployee): string[] {
    if (Array.isArray(e.permissions)) return [...e.permissions];
    const role = roles.find((r) => r.key === e.turi);
    return role && Array.isArray(role.permissions) ? [...role.permissions] : [...ALL_PERMISSION_PATHS];
  }

  function openRole(r: Role) {
    setDescription(r.description);
    // Cheklovsiz rol = hamma bo'lim ochiq, ya'ni hamma galochka belgilangan.
    setChosenList(Array.isArray(r.permissions) ? [...r.permissions] : [...ALL_PERMISSION_PATHS]);
    setRoleTarget(r);
  }

  function openEmployee(e: HrEmployee) {
    setChosenList(effectivePermsOf(e));
    setEmpTarget(e);
    setEmpListOpen(false);
  }

  function closeAll() {
    setRoleTarget(null);
    setEmpTarget(null);
    setEmpListOpen(false);
  }

  const chosen = useMemo(() => new Set(chosenList), [chosenList]);

  function toggleItem(href: string) {
    setChosenList((cur) => (cur.includes(href) ? cur.filter((x) => x !== href) : [...cur, href]));
  }
  function setMany(hrefs: string[], on: boolean) {
    setChosenList((cur) => {
      const next = new Set(cur);
      for (const h of hrefs) {
        if (on) next.add(h);
        else next.delete(h);
      }
      return [...next];
    });
  }

  async function saveRole() {
    if (!roleTarget) return;
    setSaving(true);
    try {
      // HAMMASI belgilangan bo'lsa `null` saqlaymiz — "cheklov yo'q". Bu
      // shunchaki yorliq emas: cheklovsiz rolga sidebarga KEYIN qo'shilgan
      // sahifalar ham avtomatik ochiq bo'ladi. To'liq ro'yxat saqlansa,
      // yangi sahifa har safar qo'lda belgilanishi kerak bo'lardi.
      const permissions = chosen.size === ALL_PERMISSION_PATHS.length ? null : chosenList;
      const res = await fetch(`/api/roles/${roleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, permissions }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setRoles((prev) => prev.map((x) => (x.id === data.role.id ? data.role : x)));
      showSuccess("Ruxsatlar saqlandi");
      setRoleTarget(null);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Xodim istisnosini saqlash. `reset` — istisnoni olib tashlash
   * (`permissions: null`), ya'ni xodim yana lavozim ro'yxatiga qaytadi.
   *
   * Rolga qaraganda farqi bor: bu yerda "hammasi belgilangan" `null` ga
   * AYLANTIRILMAYDI. Aks holda "bu xodimga hamma narsa ochiq" degan ongli
   * istisno jimgina yo'q bo'lib, lavozim cheklovi qaytib kelardi.
   */
  async function saveEmployee(reset = false) {
    if (!empTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hr-employees/${empTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: reset ? null : chosenList }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setEmployees((prev) => prev.map((x) => (x.id === data.employee.id ? data.employee : x)));
      showSuccess(reset ? "Istisno olib tashlandi" : "Xodim ruxsatlari saqlandi");
      setEmpTarget(null);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name?.toLowerCase().includes(q) || e.phone?.toLowerCase().includes(q),
    );
  }, [employees, empSearch]);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setEmpSearch(""); setEmpListOpen(true); }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm shrink-0"
        >
          <UserCog className="w-4 h-4" />
          <span>Xodimga alohida ruxsat</span>
          {overrideCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/20 text-[11px] tabular-nums">
              {overrideCount}
            </span>
          )}
        </button>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Lavozim</th>
                <th className="px-5 py-3 text-left">Izoh</th>
                <th className="px-5 py-3 text-left">Ko&apos;rinadigan bo&apos;limlar</th>
                <th className="px-5 py-3 text-right">Xodimlar</th>
                <th className="px-5 py-3 text-right pr-5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((r, i) => (
                <tr key={r.key} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{r.description || "-"}</td>
                  <td className="px-5 py-3"><PermBadge permissions={r.permissions} /></td>
                  <td className="px-5 py-3 text-right tabular-nums">{countByTuri.get(r.key) ?? 0}</td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openRole(r)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Ruxsatlarni sozlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Rol topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 1-qadam: xodimni tanlash ───────────────────────────────────── */}
      {empListOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAll} />
          <div className="relative w-full max-w-2xl h-[80vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="shrink-0 px-6 pt-5 pb-4 space-y-3">
              <div>
                <h3 className="text-[17px] font-semibold">Xodimga alohida ruxsat</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Ruxsatlarini o&apos;zgartirmoqchi bo&apos;lgan xodimni tanlang.
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Ism yoki telefon bo'yicha qidirish"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
              {filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => openEmployee(e)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{e.name}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      {roleNameOf(e.turi)} · {e.phone}
                    </div>
                  </div>
                  {Array.isArray(e.permissions) ? (
                    <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-600 text-[11px] font-medium whitespace-nowrap">
                      Alohida — {e.permissions.length} sahifa
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-md border border-border text-muted-foreground text-[11px] whitespace-nowrap">
                      Lavozim bo&apos;yicha
                    </span>
                  )}
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">Xodim topilmadi</p>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-end px-6 py-4 border-t border-border">
              <button
                onClick={closeAll}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ruxsatlar oynasi: lavozim uchun ham, xodim uchun ham bir xil ── */}
      {(roleTarget || empTarget) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && closeAll()} />
          {/* Ruxsatlar daraxti baland — oyna ekranning 90% ini egallaydi va
              ichida uch qavat: sarlavha, siljiydigan ro'yxat, tugmalar. Shu
              tufayli "Saqlash" doim ko'rinib turadi. */}
          <div className="relative w-[90vw] h-[90vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="shrink-0 px-6 pt-5 pb-4 space-y-3">
              {roleTarget ? (
                <>
                  <div>
                    <h3 className="text-[17px] font-semibold">{roleTarget.name} — ruxsatlar</h3>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {countByTuri.get(roleTarget.key) ?? 0} ta xodimga qo&apos;llanadi
                      {overrideCount > 0 && " (alohida istisnosi borlardan tashqari)"}.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={inputCls}
                      placeholder="Bu lavozim nima qilishini qisqacha yozing"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => { setEmpTarget(null); setEmpListOpen(true); }}
                    disabled={saving}
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-border hover:bg-secondary flex items-center justify-center disabled:opacity-60"
                    title="Xodimlar ro'yxatiga qaytish"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-semibold truncate">{empTarget!.name} — alohida ruxsat</h3>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Lavozimi: {roleNameOf(empTarget!.turi)}.{" "}
                      {Array.isArray(empTarget!.permissions)
                        ? "Hozir alohida ro'yxat amal qilmoqda."
                        : "Hozir lavozim ro'yxati amal qilmoqda — saqlasangiz istisno yaratiladi."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <PermissionPicker chosen={chosen} onToggleItem={toggleItem} onSetMany={setMany} forRole={!!roleTarget} />

            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              {empTarget && Array.isArray(empTarget.permissions) && (
                <button
                  onClick={() => saveEmployee(true)}
                  disabled={saving}
                  className="mr-auto h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
                >
                  Istisnoni olib tashlash
                </button>
              )}
              <button
                onClick={closeAll}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => (roleTarget ? saveRole() : saveEmployee())}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermBadge({ permissions }: { permissions?: string[] | null }) {
  if (Array.isArray(permissions)) {
    return (
      <span className="inline-flex items-center h-6 px-2 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-600 text-[11px] font-medium whitespace-nowrap">
        {permissions.length} / {ALL_PERMISSION_PATHS.length} sahifa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center h-6 px-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 text-[11px] font-medium whitespace-nowrap">
      Cheklovsiz
    </span>
  );
}

/**
 * "Ko'rinadigan bo'limlar" — sidebar daraxtining galochkali nusxasi.
 *
 * Daraxt DOIM ochiq: ilgari uni ko'rsatadigan "cheklash" kaliti bor edi,
 * ammo u ortiqcha bir bosishdan boshqa narsa bermasdi.
 *
 * `forRole` — faqat matn uchun: LAVOZIM sozlamasida hammasi belgilangan
 * holat "cheklovsiz" deb saqlanadi, xodim istisnosida esa yo'q (RolesPage
 * dagi `saveEmployee` izohiga qarang), shu farq yozib turiladi.
 */
function PermissionPicker({
  chosen,
  onToggleItem,
  onSetMany,
  forRole,
}: {
  chosen: Set<string>;
  onToggleItem: (href: string) => void;
  onSetMany: (hrefs: string[], on: boolean) => void;
  forRole: boolean;
}) {
  const all = chosen.size === ALL_PERMISSION_PATHS.length;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 border-y border-border bg-secondary/20">
        <span className="text-[13px] font-semibold">Ko&apos;rinadigan bo&apos;limlar</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {chosen.size} / {ALL_PERMISSION_PATHS.length} tanlandi
            {all && forRole && <span className="ml-1.5 text-emerald-600 font-medium">— cheklovsiz</span>}
          </span>
          <button
            type="button"
            onClick={() => onSetMany(ALL_PERMISSION_PATHS, true)}
            className="text-[12px] text-primary hover:underline"
          >
            Hammasi
          </button>
          <button
            type="button"
            onClick={() => onSetMany(ALL_PERMISSION_PATHS, false)}
            className="text-[12px] text-primary hover:underline"
          >
            Hech biri
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {PERMISSION_GROUPS.map((g) => {
            const selectable = g.items.filter((i) => !i.always).map((i) => i.href);
            const on = selectable.filter((h) => chosen.has(h)).length;
            const groupAll = selectable.length > 0 && on === selectable.length;
            return (
              <div key={g.key} className="rounded-lg border border-border overflow-hidden self-start">
                <button
                  type="button"
                  onClick={() => onSetMany(selectable, !groupAll)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-secondary/40 hover:bg-secondary text-left"
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${groupAll ? "bg-primary border-primary text-white" : on > 0 ? "bg-primary/30 border-primary" : "border-border"}`}>
                    {groupAll && <Check className="w-3 h-3" />}
                  </span>
                  <span className="text-[13px] font-semibold flex-1 truncate">{g.label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{on}/{selectable.length}</span>
                </button>
                <div className="p-1.5 space-y-0.5">
                  {g.items.map((it) => (
                    <label
                      key={it.href}
                      className={`flex items-center gap-2 px-2 py-1 rounded-md text-[12.5px] ${it.always ? "opacity-60" : "hover:bg-secondary cursor-pointer"}`}
                      title={it.always ? "Bu sahifa har doim ochiq" : it.href}
                    >
                      <input
                        type="checkbox"
                        checked={it.always || chosen.has(it.href)}
                        disabled={it.always}
                        onChange={() => onToggleItem(it.href)}
                        className="w-3.5 h-3.5 rounded border-border accent-primary"
                      />
                      <span className="flex-1 truncate">{it.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11.5px] text-muted-foreground leading-relaxed">
          Xira galochkalar — profil, xavfsizlik va qurilmalar: ular har doim ochiq, aks holda xodim
          o&apos;z parolini almashtira olmay qolardi. Ba&apos;zi sahifalar sidebarda ikki bo&apos;limda
          takrorlanadi (masalan &laquo;Kirim chiqim&raquo; — Moliya va Hisobotlarda); ular bitta sahifa,
          shuning uchun birini belgilasangiz ikkinchisi ham belgilanadi.
        </p>
      </div>
    </div>
  );
}
