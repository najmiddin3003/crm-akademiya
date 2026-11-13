"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Loader2, MoreHorizontal, Plus, RefreshCw, RotateCcw, UserCog } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useModalClose } from "@/components/ui/Modal";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Field, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { EmptyBlock } from "@/components/v2/students/profile/profileBits";
import type { Role } from "@/lib/roles";
import { roleAccessToSave } from "@/lib/accessRows";
import AccessMatrixV2 from "./AccessMatrixV2";
import EmployeeAccessPanelV2 from "./EmployeeAccessPanelV2";
import OverridesDialogV2 from "./OverridesDialogV2";
import LoginsTabV2 from "./LoginsTabV2";
import { unrestrictedEmployees, type MatrixData, type MatrixEmployee } from "./rolesBits";

// YANGI VERSIYA — BOSHQARUV → «ROLLAR VA HUQUQLAR» (25-qism, 12 rasm, 13.11.2026):
//   • sarlavha, o'ngda «Alohida ruxsatlar · N» (xodimga roldan farqli ruxsat) va ⋯ (Rol qo'shish,
//     eski ko'rinish);
//   • tablar: «Huquqlar · N rol · M xodim» (AccessMatrixV2) va «Login hisoblari · K» (LoginsTabV2,
//     faqat admin — tab DOIM o'rnatilgan, yorliqdagi son shundan);
//   • xodim paneli o'ngda (EmployeeAccessPanelV2) — rol, doira, alohida ruxsatlar, tarix.
// Ma'lumot: GET /api/roles/matrix. Rol ruxsati darhol saqlanadi — PATCH /api/roles/:id.
// Eski sahifa: /management-rollar?classic=1 (components/management/RolesPage.tsx).

type Tab = "rights" | "logins";

function RoleDialog({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: (r: Role, created: boolean) => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = name !== (role?.name ?? "") || description !== (role?.description ?? "");

  async function submit() {
    if (!name.trim()) return setErr(t("Rol nomini kiriting"));
    setErr("");
    setSaving(true);
    try {
      const res = await fetch(role ? `/api/roles/${role.id}` : "/api/roles", {
        method: role ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // Yangi rolda hamma bo'lim YOPIQ — ruxsat jadvalda ataylab beriladi.
        body: JSON.stringify(role ? { name: name.trim(), description } : { name: name.trim(), description, permissions: [] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setErr(t(d.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(d.role as Role, !role);
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={role ? t("Rolni tahrirlash") : t("Rol qo'shish")}
      subtitle={role ? t(role.name) : t("Yangi rolda hamma bo'lim yopiq — jadvalda ochasiz")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {role ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label={t("Nomi")} htmlFor="role-v2-name" error={err || undefined}>
          <TextInput
            id="role-v2-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 60));
              if (err) setErr("");
            }}
            placeholder={t("Masalan: Qabul administratori")}
            state={err ? "error" : "default"}
            autoFocus
          />
        </Field>
        <Field label={t("Izoh")} optional htmlFor="role-v2-desc">
          <TextInput id="role-v2-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} placeholder={t("Bu rol kimlar uchun")} />
        </Field>
      </div>
    </V2Dialog>
  );
}

export default function RolesPageV2() {
  const { t } = useT();
  const { showToast, showError } = useToast();
  const [data, setData] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("rights");
  const [loginNone, setLoginNone] = useState<number | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<number | null>(null);
  // «Alohida ruxsatlar» oynasi; `role` — ustun menyusidagi «Xodimlari» (shu rol ichida).
  const [overrides, setOverrides] = useState<null | { role: Role | null }>(null);
  const overridesOpen = overrides !== null;
  const [roleDialog, setRoleDialog] = useState<null | { role: Role | null }>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/roles/matrix")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setData({ me: d.me, roles: d.roles, employees: d.employees, branches: d.branches });
          setError(null);
        } else setError(String(d.error || "Ma'lumot yuklanmadi"));
      })
      .catch(() => alive && setError("Serverga ulanib bo'lmadi"));
    return () => {
      alive = false;
    };
  }, [version]);

  const isAdmin = Boolean(data?.me.isAdmin);
  const overrideCount = useMemo(() => (data ? data.employees.filter((e) => e.override !== null && !e.admin).length : 0), [data]);
  const loose = useMemo(() => (data ? unrestrictedEmployees(data.employees) : []), [data]);
  const panelEmp = data && panelId !== null ? data.employees.find((e) => e.id === panelId) ?? null : null;

  // Panel ochiq — Esc bilan yopiladi. Ochiq oyna (panel ichidan ochilgan tasdiq ham — u portalda)
  // Esc'ni o'zi ushlaydi: Modal `window`da tinglaydi, bu yer `document`da — shuning uchun panel
  // TASHQARISIDA ochiq oyna bo'lsa panelga tegilmaydi. Panelning o'zi ham `role="dialog"` —
  // `data-roles-panel` bilan ajratiladi.
  useEffect(() => {
    if (panelId === null || overridesOpen || roleDialog || deleting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if ([...modals].some((d) => !d.closest("[data-roles-panel]"))) return;
      setPanelId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelId, overridesOpen, roleDialog, deleting]);

  const replaceRole = useCallback((role: Role) => setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === role.id ? role : r)) } : d)), []);

  async function saveRole(role: Role, next: string[], key: string, summary: string) {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: roleAccessToSave(next) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        showError(t(d.error || "Saqlanmadi"));
        return;
      }
      replaceRole(d.role as Role);
      showToast({ tone: "success", title: t("Saqlandi"), detail: summary });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteRole(role: Role) {
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        showError(t(d.error || "O'chirilmadi"));
        return;
      }
      setData((x) => (x ? { ...x, roles: x.roles.filter((r) => r.id !== role.id) } : x));
      showToast({ tone: "success", title: t("Rol o'chirildi"), detail: t(role.name) });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(null);
    }
  }

  function patchEmployee(patch: Partial<MatrixEmployee> & { id: number }) {
    setData((d) => (d ? { ...d, employees: d.employees.map((e) => (e.id === patch.id ? { ...e, ...patch } : e)) } : d));
  }

  const tabBtn = (on: boolean) =>
    `relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-1 text-v2-body font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
      on ? "border-v2-brand text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"
    }`;

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <p className="text-v2-caption text-v2-text-3">{t("Boshqaruv")}</p>
          <h1 className="text-v2-page text-v2-text">{t("Rollar va huquqlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Har rol qaysi bo'limni ko'radi va o'zgartiradi. Menyu, «Yangi» tugmasi va bildirishnomalar shu jadvalga qarab chiqadi.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOverrides({ role: null })} disabled={!data} className={`${secondaryBtn} disabled:opacity-60`}>
            <UserCog className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Alohida ruxsatlar")}
            <span className="tabular-nums text-v2-text-2">· {overrideCount}</span>
          </button>
          <ActionMenu
            items={[
              { key: "add", label: t("Rol qo'shish"), icon: Plus, disabled: !data, onSelect: () => setRoleDialog({ role: null }) },
              { key: "reload", label: t("Yangilash"), icon: RefreshCw, onSelect: () => setVersion((v) => v + 1) },
              { key: "d", divider: true },
              { key: "classic", label: t("Eski ko'rinishda ochish"), icon: RotateCcw, href: "/management-rollar?classic=1" },
            ]}
            label={t("Qo'shimcha amallar")}
            width={240}
          >
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
        </div>
      </div>

      {/* 2. Tablar */}
      <div className="flex items-end gap-6 border-b border-v2-border" role="tablist" aria-label={t("Rollar va huquqlar")}>
        <button type="button" role="tab" aria-selected={tab === "rights"} onClick={() => setTab("rights")} className={tabBtn(tab === "rights")}>
          {t("Huquqlar")}
          {data && (
            <span className="text-v2-caption font-normal tabular-nums text-v2-text-3">
              {t("{r} rol · {e} xodim", { r: data.roles.length + 1, e: data.employees.length })}
            </span>
          )}
        </button>
        {isAdmin && (
          <button type="button" role="tab" aria-selected={tab === "logins"} onClick={() => setTab("logins")} className={tabBtn(tab === "logins")}>
            {t("Login hisoblari")}
            {loginNone !== null && loginNone > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-v2-full bg-v2-warning-bg px-1.5 text-v2-caption font-semibold tabular-nums text-v2-warning">{loginNone}</span>
            )}
          </button>
        )}
      </div>

      {/* 3. Huquqlar */}
      <div className={tab === "rights" ? "flex min-h-0 flex-col gap-3 lg:flex-1" : "hidden"} role="tabpanel">
        {error ? (
          <div className="rounded-v2-lg border border-v2-border p-6">
            <EmptyBlock
              icon={<Info className="size-5" strokeWidth={1.75} aria-hidden />}
              title={t(error)}
              action={
                <button type="button" onClick={() => { setError(null); setVersion((v) => v + 1); }} className={secondaryBtn}>
                  <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Qayta urinish")}
                </button>
              }
            />
          </div>
        ) : !data ? (
          <div className="flex min-h-[40vh] flex-col gap-2 rounded-v2-lg border border-v2-border p-4" aria-busy="true">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="h-8 rounded bg-v2-skeleton" />
            ))}
          </div>
        ) : (
          <>
            {loose.length > 0 && (
              <div className="flex gap-2.5 rounded-v2-md border border-v2-warning/30 bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
                <span>
                  <b className="font-semibold">{t("{n} xodimning lavozimi belgilanmagan", { n: loose.length })}</b>{" "}
                  <span className="text-v2-text-2">{t("— rol ruxsatlari ularga qo'llanmaydi, hamma bo'limni ko'radi:")}</span>{" "}
                  {loose.slice(0, 8).map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && ", "}
                      <button type="button" onClick={() => setPanelId(e.id)} className="font-medium underline-offset-2 hover:underline">
                        {e.name || `#${e.id}`}
                      </button>
                    </span>
                  ))}
                  {loose.length > 8 && <span className="text-v2-text-2"> {t("va yana {n} ta", { n: loose.length - 8 })}</span>}
                </span>
              </div>
            )}
            <AccessMatrixV2
              data={data}
              savingKey={savingKey}
              onSave={(role, next, key, summary) => void saveRole(role, next, key, summary)}
              onRename={(role) => setRoleDialog({ role })}
              onDelete={(role) => setDeleting(role)}
              onShowEmployees={(role) => setOverrides({ role })}
            />
          </>
        )}
      </div>

      {/* 4. Login hisoblari — faqat admin; DOIM o'rnatilgan (yorliqdagi son shundan) */}
      {isAdmin && data && (
        <div className={tab === "logins" ? "flex min-h-0 flex-col gap-4 lg:flex-1" : "hidden"} role="tabpanel">
          <LoginsTabV2 roles={data.roles} branches={data.branches} onCounts={(c) => setLoginNone(c.none)} />
        </div>
      )}

      {/* 5. Xodim paneli */}
      {data && panelEmp && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:absolute" onClick={() => setPanelId(null)} aria-hidden />
          <div data-roles-panel className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] lg:absolute">
            <EmployeeAccessPanelV2 key={panelEmp.id} employee={panelEmp} data={data} onClose={() => setPanelId(null)} onChanged={patchEmployee} />
          </div>
        </>
      )}

      {overrides && data && (
        <OverridesDialogV2 data={data} role={overrides.role} onClose={() => setOverrides(null)} onPick={(id) => setPanelId(id)} />
      )}
      {roleDialog && (
        <RoleDialog
          role={roleDialog.role}
          onClose={() => setRoleDialog(null)}
          onSaved={(r, created) => {
            if (created) setData((d) => (d ? { ...d, roles: [...d.roles, r] } : d));
            else replaceRole(r);
            showToast({ tone: "success", title: created ? t("Rol qo'shildi") : t("Saqlandi"), detail: t(r.name) });
          }}
        />
      )}
      {deleting && (
        <V2Confirm
          title={t("Rolni o'chirish")}
          body={t("«{name}» roli o'chiriladi. Bu rol xodimga berilgan bo'lsa o'chmaydi — avval ularning rolini almashtiring.", { name: t(deleting.name) })}
          confirmLabel={t("O'chirish")}
          tone="danger"
          onConfirm={() => void deleteRole(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
