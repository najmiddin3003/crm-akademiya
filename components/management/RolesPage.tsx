"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Pencil, Search, Trash2, UserCog } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { HrEmployee } from "@/lib/hrEmployees";
import { ALL_PERMISSION_PATHS, PERMISSION_GROUPS } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// Ma'lumot HAQIQIY — /api/roles va /api/hr-employees.
//
// IKKI XIL ROL (lib/roles.ts):
//   O'RNATILGAN — O'qituvchi / Moderator. `hr_employees.turi` ga bog'langan,
//   ya'ni o'sha lavozimdagi barcha xodimlarga o'zi qo'llanadi. Nomi
//   o'zgarmaydi, o'chirilmaydi.
//   QO'LDA QO'SHILGAN — nomi, izohi, ruxsatlari erkin; o'chirsa bo'ladi.
//
// Bundan tashqari XODIM KESIMIDA istisno bor ("Xodimga alohida ruxsat"):
// u `hr_employees.permissions` ga yoziladi va lavozimdan ustun turadi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

/** /api/roles/coverage javobi — rol zanjiridagi "jim uzilish"lar. */
interface RoleCoverage {
  unknownTuri: { id: number; name: string; turi: string }[];
  noLogin: { id: number; name: string; turi: string }[];
  adminBypass: { id: number; name: string; turi: string }[];
}

/**
 * Ruxsat berildi, lekin ta'sir qilmaydigan holatlar paneli.
 *
 * NIMA UCHUN: rolga cheklov qo'yilgani bilan u ishlamay qolishi mumkin va
 * ekranda buning izi qolmasdi. Zanjir uzun —
 * `users.hrEmployeeId → hr_employees.turi → roles.key → permissions` — va
 * uning istalgan bo'g'ini uzilsa xodim CHEKLOVSIZ bo'lib qoladi
 * (lib/rolePermissions.ts, ataylab shunday). Amalda shu bo'ldi: bir odamga
 * ikkita xodim yozuvi bor edi, login esa `turi` maydoni BO'SH bo'lganiga
 * bog'langan — Moderatorga qo'yilgan cheklov hech narsaga ta'sir qilmadi.
 */
function CoveragePanel({ data }: { data: RoleCoverage }) {
  const rows = ([
    {
      tone: "rose",
      title: "Lavozimi belgilanmagan",
      hint: "rol ruxsatlari bu xodimga QO'LLANMAYDI — u hamma bo'limni ko'radi",
      people: data.unknownTuri,
    },
    {
      tone: "amber",
      title: "Login hisobi yo'q",
      hint: "lavozimi to'g'ri, lekin tizimga kira olmaydi — cheklovni sinab bo'lmaydi",
      people: data.noLogin,
    },
    {
      tone: "sky",
      title: "Admin — cheklovdan ozod",
      hint: "ataylab: aks holda admin o'ziga Rollar sahifasini yopib qo'yishi mumkin edi",
      people: data.adminBypass,
    },
  ] as const).filter((r) => r.people.length > 0);

  if (rows.length === 0) return null;

  const tones = {
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400",
  };

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.title} className={`rounded-xl border px-4 py-3 ${tones[r.tone]}`}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-semibold">{r.title}</span>
            <span className="text-[12px] tabular-nums opacity-80">{r.people.length} ta</span>
            <span className="text-[12px] text-muted-foreground">— {r.hint}</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-foreground/80">
            {r.people.map((p) => p.name || `#${p.id}`).join(", ")}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RolesPage() {
  const modal = useModalClose(closeAll);
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [coverage, setCoverage] = useState<RoleCoverage | null>(null);
  const [loading, setLoading] = useState(true);

  // Bir vaqtda faqat bittasi ochiq bo'ladi.
  const [roleTarget, setRoleTarget] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [empListOpen, setEmpListOpen] = useState(false);
  const [empTarget, setEmpTarget] = useState<HrEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const [name, setName] = useState("");
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
      // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
      // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
      fetch("/api/hr-employees/ref").then((r) => r.json()),
      // Ogohlantirish paneli uchun. Yiqilsa sahifa baribir ochiladi —
      // panel shunchaki ko'rinmaydi.
      fetch("/api/roles/coverage").then((r) => r.json()).catch(() => null),
    ]).then(([rolesRes, empRes, covRes]) => {
      if (cancelled) return;
      if (rolesRes.ok) setRoles(rolesRes.roles);
      if (empRes.ok) setEmployees(empRes.employees);
      if (covRes?.ok) setCoverage(covRes as RoleCoverage);
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

  function openCreate() {
    setName("");
    setDescription("");
    // Yangi rolda hamma bo'lim YOPIQ — ruxsat ataylab beriladi.
    setChosenList([]);
    setCreateOpen(true);
  }

  function openRole(r: Role) {
    setName(r.name);
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
    setCreateOpen(false);
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

  /**
   * HAMMASI belgilangan bo'lsa `null` — "cheklov yo'q". Bu shunchaki yorliq
   * emas: cheklovsiz rolga sidebarga KEYIN qo'shilgan sahifalar ham
   * avtomatik ochiq bo'ladi. To'liq ro'yxat saqlansa, yangi sahifa har
   * safar qo'lda belgilanishi kerak bo'lardi.
   */
  const permissionsToSave = () =>
    chosen.size === ALL_PERMISSION_PATHS.length ? null : chosenList;

  async function saveRole() {
    const creating = createOpen;
    if (!creating && !roleTarget) return;
    if ((creating || !roleTarget?.key) && !name.trim()) {
      showError("Rol nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(creating ? "/api/roles" : `/api/roles/${roleTarget!.id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, permissions: permissionsToSave() }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      if (creating) {
        setRoles((prev) => [...prev, data.role]);
        showSuccess("Rol qo'shildi");
      } else {
        setRoles((prev) => prev.map((x) => (x.id === data.role.id ? data.role : x)));
        showSuccess("Ruxsatlar saqlandi");
      }
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setRoles((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("Rol o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
      setDeleteTarget(null);
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

  // Nomi tahrirlanadigan holat: yangi rol yoki qo'lda qo'shilgan rol.
  const nameEditable = createOpen || (roleTarget !== null && !roleTarget.key);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ Rol qo&apos;shish</span>
        </button>
        <button
          onClick={() => { setEmpSearch(""); setEmpListOpen(true); }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium shrink-0"
        >
          <UserCog className="w-4 h-4" />
          <span>Xodimga alohida ruxsat</span>
          {overrideCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] tabular-nums">
              {overrideCount}
            </span>
          )}
        </button>
      </div>

      {coverage && <CoveragePanel data={coverage} />}

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{roles.length}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Nomi</th>
                <th className="px-5 py-3 text-left">Izoh</th>
                <th className="px-5 py-3 text-left">Ko&apos;rinadigan bo&apos;limlar</th>
                <th className="px-5 py-3 text-right">Xodimlar</th>
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium">{r.name}</span>
                    {r.key && (
                      <span className="ml-2 inline-flex items-center h-5 px-1.5 rounded border border-border text-[10.5px] text-muted-foreground align-middle">
                        lavozim
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{r.description || "-"}</td>
                  <td className="px-5 py-3"><PermBadge permissions={r.permissions} /></td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {/* Faqat o'rnatilgan rollar xodimga bog'langan (`turi`).
                        Qo'lda qo'shilgan rolni xodimga biriktirish usuli
                        hali yo'q — soxta 0 ko'rsatmaymiz. */}
                    {r.key ? (countByTuri.get(r.key) ?? 0) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openRole(r)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Ruxsatlarni sozlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!r.key && (
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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

      {/* ── Xodimni tanlash ─────────────────────────────────────────────── */}
      {empListOpen && (
        <Modal onClose={closeAll} controller={modal} bare size="2xl" zIndex={110} panelClassName="h-[80vh]">
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
                      {roleNameOf(e.turi)} Â· {e.phone}
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
                onClick={modal.close}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
              >
                Yopish
              </button>
            </div>
          </Modal>
      )}

      {/* ── Ruxsatlar oynasi: yangi rol / rol / xodim uchun bir xil ────── */}
      {(createOpen || roleTarget || empTarget) && (
        <Modal onClose={closeAll} controller={modal} locked={saving} bare zIndex={110} panelClassName="w-[90vw] h-[90vh]">
            <div className="shrink-0 px-6 pt-5 pb-4 space-y-3">
              {empTarget ? (
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
                    <h3 className="text-[17px] font-semibold truncate">{empTarget.name} — alohida ruxsat</h3>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Lavozimi: {roleNameOf(empTarget.turi)}.{" "}
                      {Array.isArray(empTarget.permissions)
                        ? "Hozir alohida ro'yxat amal qilmoqda."
                        : "Hozir lavozim ro'yxati amal qilmoqda — saqlasangiz istisno yaratiladi."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-[17px] font-semibold">
                      {createOpen ? "Yangi rol" : `${roleTarget!.name} — ruxsatlar`}
                    </h3>
                    {roleTarget?.key && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {countByTuri.get(roleTarget.key) ?? 0} ta xodimga qo&apos;llanadi
                        {overrideCount > 0 && " (alohida istisnosi borlardan tashqari)"}.
                      </p>
                    )}
                  </div>
                  <div className={`grid grid-cols-1 gap-4 ${nameEditable ? "md:grid-cols-2" : ""}`}>
                    {nameEditable && (
                      <div>
                        <label className="block text-[13px] font-medium mb-1.5">Nomi</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={inputCls}
                          placeholder="Masalan: Filial direktori"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={inputCls}
                        placeholder="Bu rol nima qilishini qisqacha yozing"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <PermissionPicker
              chosen={chosen}
              onToggleItem={toggleItem}
              onSetMany={setMany}
              forRole={!empTarget}
            />

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
                onClick={modal.close}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => (empTarget ? saveEmployee() : saveRole())}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={saving} bare size="sm" zIndex={120} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">
              &laquo;{deleteTarget.name}&raquo; rolini o&apos;chirmoqchimisiz?
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={modal.close}
                disabled={saving}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </>)}</Modal>
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
 * `forRole` — faqat matn uchun: ROL sozlamasida hammasi belgilangan holat
 * "cheklovsiz" deb saqlanadi, xodim istisnosida esa yo'q (RolesPage dagi
 * `saveEmployee` izohiga qarang).
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
