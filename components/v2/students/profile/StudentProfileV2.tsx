"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  History,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Pencil,
  PhoneCall,
  RefreshCw,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import SmsModal from "@/components/orders/SmsModal";
import StudentStatusModal from "@/components/students/StudentStatusModal";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import { openReceipt } from "@/components/v2/finance/ReceiptHost";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import type { ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { invalidateStudents } from "@/hooks/useStudents";
import type { ProfileEntry, ProfileGroup } from "@/lib/pupilProfile";
import type { StudentRow } from "@/lib/studentsData";
import { buildActivity } from "./profileActivity";
import { pupilTone, useProfileFmt } from "./profileBits";
import { buildLedger } from "./profileLedger";
import { PROFILE_TABS, type PayPreset, type ProfileTab, type TabProps } from "./profileTypes";
import { useStudentProfile } from "./useStudentProfile";
import ProfileAttendanceTab from "./ProfileAttendanceTab";
import ProfileHistoryTab from "./ProfileHistoryTab";
import ProfileOverviewTab from "./ProfileOverviewTab";
import ProfilePaymentsTab from "./ProfilePaymentsTab";
import StudentEditDialogV2 from "./StudentEditDialogV2";
import StudentSideCardV2 from "./StudentSideCardV2";

// YANGI VERSIYA — O'QUVCHI SAHIFASI (rasmlar «O'quvchi sahifasi · Umumiy / To'lovlar /
// Davomat» va «Yangi o'quvchi · Bo'sh holatlar», yorug'/qorong'i, 23.10.2026):
//
//   «← O'quvchilar ro'yxati › Ism»; chapda kartochka (./StudentSideCardV2.tsx), o'ngda
//   tablar Umumiy | To'lovlar [qarz] | Davomat | Tarix (`?tab=` — manzil server so'rovisiz
//   almashadi: window.history.replaceState, Next hujjatidagi «Native History API»).
//
// Ma'lumot — bitta so'rov GET /api/pupils/:id/profile (./useStudentProfile.ts); hisoblar —
// ./profileLedger.ts (qarz qoidasi — SAVOLLAR 149), tarix — ./profileActivity.ts.
//
// Oynalar: «To'lov qabul qilish» — yangi (StudentPaymentModalV2; «Shu oyni to'lash» oy,
// guruh va summani oldindan qo'yadi), «Tahrirlash» — yangi (./StudentEditDialogV2.tsx);
// SMS, holat va guruh tanlash — hozircha eski oynalar (O'quvchilar ro'yxatidagidek).
// Guruhga qo'shish / ko'chirish / chiqarish — guruh sahifasidagi bilan bir xil so'rovlar
// (POST/DELETE /api/groups/:id/students). Eski profilning qolgan tablari (parol, SMS
// tarixi, vazifalar, shartnomalar …) — «⋯» dan eski ko'rinishda (`?classic=1&tab=…`).

/** Eski profil tablari — «⋯» havolalari (components/students/StudentEditPage.tsx → TABS). */
const CLASSIC_LINKS: { tab: string; label: string; icon: typeof History }[] = [
  { tab: "parol", label: "Parol o'rnatish", icon: KeyRound },
  { tab: "sms", label: "SMS tarixi", icon: MessagesSquare },
  { tab: "qongiroqlar", label: "Qo'ng'iroqlar tarixi", icon: PhoneCall },
  { tab: "vazifa", label: "Vazifalar", icon: ListChecks },
  { tab: "shartnomalar", label: "Shartnomalar", icon: FileText },
];

export default function StudentProfileV2({ id, initialTab }: { id: number; initialTab?: string }) {
  const { t } = useT();
  const router = useRouter();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const canPay = useCanOpen("/finance-cash");
  const canGroups = useCanOpen("/groups");
  const { state, reload } = useStudentProfile(id);

  const [tab, setTab] = useState<ProfileTab>(() => (PROFILE_TABS.includes(initialTab as ProfileTab) ? (initialTab as ProfileTab) : "umumiy"));
  const [pay, setPay] = useState<PayPreset | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [moveFrom, setMoveFrom] = useState<ProfileGroup | null>(null);
  const [removeFrom, setRemoveFrom] = useState<ProfileGroup | null>(null);
  const [edit, setEdit] = useState<{ focus?: "birth" | "parents" } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = state.kind === "ok" ? state.data : null;
  const ledger = useMemo(() => (data ? buildLedger(data.groups, data.entries, data.asOf) : null), [data]);
  const activity = useMemo(() => (data ? buildActivity(data) : []), [data]);

  const goTab = useCallback((next: ProfileTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "umumiy") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  /* ── Yuklanish, topilmadi, xato ── */
  if (state.kind === "loading") return <ProfileSkeleton />;
  if (!data || !ledger) {
    return (
      <div data-ui="v2" className="flex min-h-full flex-col items-start gap-3 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
        <p className="text-v2-body text-v2-text-2">
          {state.kind === "notfound" ? t("O'quvchi topilmadi yoki boshqa filialga tegishli.") : t("Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {state.kind === "error" && (
            <button type="button" onClick={reload} className={secondaryBtn}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qayta urinish")}
            </button>
          )}
          <Link href="/students-list" className={secondaryBtn}>
            {t("O'quvchilar ro'yxati")}
          </Link>
        </div>
      </div>
    );
  }

  const p = data.pupil;
  const name = `${p.firstName} ${p.lastName}`.trim() || t("Nomsiz o'quvchi");
  const tone = pupilTone(p.status, ledger.paymentsCount === 0);
  const studentRow: StudentRow = {
    id: p.id,
    name,
    phone: p.phone,
    balance: ledger.totalPaid,
    coin: data.coins,
    createdAt: p.createdAt,
    moderator: p.moderator,
    source: p.source,
    groups: "",
    category: p.category,
    status: p.status,
    statusReason: p.statusReason,
    statusChangedAt: p.statusChangedAt,
  };
  const base = `/student-edit/${p.id}?src=list`;

  /* ── Guruh amallari (guruh sahifasidagi bilan bir xil so'rovlar) ── */
  async function addTo(groupId: number): Promise<boolean> {
    const res = await fetch(`/api/groups/${groupId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: p.id }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      showError(t(res?.error || "Guruhga qo'shishda xatolik yuz berdi"));
      return false;
    }
    return true;
  }
  async function removeFromGroup(groupId: number): Promise<boolean> {
    const res = await fetch(`/api/groups/${groupId}/students?pupilId=${p.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    return !!res?.ok;
  }

  const menu: ActionMenuEntry[] = [
    { key: "h", heading: name },
    { key: "status", label: t("Holatni o'zgartirish"), icon: UserCog, onSelect: () => setStatusOpen(true) },
    { key: "group", label: t("Guruhga qo'shish"), icon: UserPlus, onSelect: () => setAddOpen(true) },
    { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEdit({}) },
    { key: "d1", divider: true },
    ...CLASSIC_LINKS.map((c) => ({ key: c.tab, label: t(c.label), icon: c.icon, href: `${base}&classic=1&tab=${c.tab}` }) as ActionMenuEntry),
    { key: "classic", label: t("Eski ko'rinishda ochish"), icon: History, href: `${base}&classic=1` },
    { key: "d2", divider: true },
    // To'lovi bor karta o'chirilmaydi (server ham rad etadi — lib/pupilDeleteGuard.ts): band o'chiq, sababi bilan.
    {
      key: "delete",
      label: t("O'quvchini o'chirish"),
      icon: Trash2,
      danger: true,
      disabled: data.entries.length > 0,
      title: data.entries.length > 0 ? t("To'lovi bor o'quvchi o'chirilmaydi — «Holatni o'zgartirish» orqali arxivlang") : undefined,
      onSelect: () => setDeleteOpen(true),
    },
  ];

  const tabProps: TabProps = {
    data,
    ledger,
    activity,
    fmt,
    canPay,
    canGroups,
    onPay: (preset) => setPay(preset ?? {}),
    onSms: () => setSmsOpen(true),
    onAddGroup: () => setAddOpen(true),
    onTransfer: (g) => setMoveFrom(g),
    onRemove: (g) => setRemoveFrom(g),
    onReceipt: (e: ProfileEntry) => openReceipt({ entryId: e.id, cashboxId: e.cashboxId, cashboxName: e.cashboxName, pupilId: p.id }),
    goTab,
  };

  const tabs: { key: ProfileTab; label: string; badge?: string }[] = [
    { key: "umumiy", label: t("Umumiy") },
    { key: "tolovlar", label: t("To'lovlar"), badge: ledger.debt > 0 ? t("qarz") : undefined },
    { key: "davomat", label: t("Davomat") },
    { key: "tarix", label: t("Tarix") },
  ];

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* Yo'l */}
      <nav aria-label={t("Yo'l")} className="flex min-w-0 items-center gap-1.5 text-v2-small">
        <Link href="/students-list" className="inline-flex shrink-0 items-center gap-1.5 text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("O'quvchilar ro'yxati")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={2} aria-hidden />
        <span className="truncate font-medium text-v2-text">{name}</span>
      </nav>

      <div className="grid items-start gap-4 min-[64rem]:grid-cols-[18.5rem_minmax(0,1fr)] min-[90rem]:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <StudentSideCardV2
            data={data}
            ledger={ledger}
            fmt={fmt}
            canPay={canPay}
            menu={menu}
            onPay={() => setPay({})}
            onSms={() => setSmsOpen(true)}
            onEdit={(focus) => setEdit({ focus })}
          />
        </div>

        <div className="@container min-w-0">
          <div role="tablist" aria-label={t("O'quvchi sahifasi")} className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--v2-border)]">
            {tabs.map((x) => {
              const on = tab === x.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  id={`tab-${x.key}`}
                  aria-selected={on}
                  aria-controls={`panel-${x.key}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => goTab(x.key)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const at = tabs.findIndex((y) => y.key === tab);
                    const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                    goTab(next.key);
                    requestAnimationFrame(() => document.getElementById(`tab-${next.key}`)?.focus());
                  }}
                  className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-v2-body transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                    on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"
                  }`}
                >
                  {x.label}
                  {x.badge && <span className="rounded-v2-full bg-v2-danger-bg px-1.5 py-px text-v2-caption font-medium text-v2-danger">{x.badge}</span>}
                  {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "umumiy" && <ProfileOverviewTab {...tabProps} />}
            {tab === "tolovlar" && <ProfilePaymentsTab {...tabProps} />}
            {tab === "davomat" && <ProfileAttendanceTab {...tabProps} />}
            {tab === "tarix" && <ProfileHistoryTab {...tabProps} />}
          </div>
        </div>
      </div>

      {/* ── Oynalar ── */}
      {pay && (
        <StudentPaymentModalV2
          student={studentRow}
          initialGroupId={pay.groupId ?? null}
          initialMonth={pay.month}
          initialAmount={pay.amount}
          summary={{ balance: ledger.credit - ledger.debt, statusLabel: tone.label }}
          onClose={() => setPay(null)}
          onSaved={() => {
            invalidateStudents();
            reload();
          }}
        />
      )}
      {smsOpen && (
        <SmsModal
          studentName={name}
          phone={p.phone}
          onClose={() => setSmsOpen(false)}
          onSent={({ simulated }) => {
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("SMS yuborildi"));
            setSmsOpen(false);
          }}
          onError={(m) => showError(t(m))}
        />
      )}
      {statusOpen && (
        <StudentStatusModal
          student={{ id: p.id, name, status: p.status, statusReason: p.statusReason }}
          onClose={() => setStatusOpen(false)}
          onSaved={() => {
            setStatusOpen(false);
            invalidateStudents();
            reload();
          }}
        />
      )}
      {addOpen && (
        <GroupPickerModal
          onClose={() => setAddOpen(false)}
          onSelect={async (group) => {
            if (data.groups.some((g) => g.current && g.id === group.id)) {
              showError(t("O'quvchi allaqachon shu guruhda"));
              return;
            }
            if (!(await addTo(group.id))) return;
            showSuccess(t("{name} — \"{id}\" guruhiga qo'shildi", { name, id: group.name || group.id }));
            setAddOpen(false);
            invalidateStudents();
            reload();
          }}
        />
      )}
      {moveFrom && (
        <GroupPickerModal
          onClose={() => setMoveFrom(null)}
          onSelect={async (target) => {
            if (busy) return;
            if (target.id === moveFrom.id || data.groups.some((g) => g.current && g.id === target.id)) {
              showError(t("O'quvchi allaqachon shu guruhda"));
              return;
            }
            setBusy(true);
            const added = await addTo(target.id);
            if (!added) {
              setBusy(false);
              return;
            }
            const removed = await removeFromGroup(moveFrom.id);
            setBusy(false);
            setMoveFrom(null);
            invalidateStudents();
            reload();
            if (!removed) {
              showError(t("Yangi guruhga qo'shildi, ammo eskisidan chiqarib bo'lmadi"));
              return;
            }
            showSuccess(t("{moveFor} — \"{id}\" guruhiga ko'chirildi", { moveFor: name, id: target.name || target.id }));
          }}
        />
      )}
      {removeFrom && (
        <V2Confirm
          title={t("Guruhdan chiqarish")}
          body={t("{name} «{group}» guruhidan chiqariladi. O'tgan darslari hisobda qoladi, o'quvchining o'zi o'chirilmaydi.", { name, group: removeFrom.label })}
          confirmLabel={t("Chiqarish")}
          onCancel={() => setRemoveFrom(null)}
          onConfirm={async () => {
            const g = removeFrom;
            setRemoveFrom(null);
            if (!(await removeFromGroup(g.id))) {
              showError(t("Guruhdan chiqarib bo'lmadi"));
              return;
            }
            showSuccess(t("{name} guruhdan chiqarildi", { name }));
            invalidateStudents();
            reload();
          }}
        />
      )}
      {edit && <StudentEditDialogV2 pupil={p} focus={edit.focus} onClose={() => setEdit(null)} onSaved={reload} />}
      {deleteOpen && (
        <V2Confirm
          title={t("O'quvchini o'chirish")}
          body={t("{name} butunlay o'chiriladi va guruhlardan chiqariladi. Bu amalni qaytarib bo'lmaydi.", { name })}
          confirmLabel={t("O'chirish")}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            setDeleteOpen(false);
            const res = await fetch(`/api/pupils/${p.id}`, { method: "DELETE" })
              .then((r) => r.json())
              .catch(() => null);
            if (!res?.ok) {
              showError(t(res?.error || "O'chirishda xatolik yuz berdi"));
              return;
            }
            invalidateStudents();
            showSuccess(t("O'quvchi o'chirildi"));
            router.push("/students-list");
          }}
        />
      )}
    </div>
  );
}

/* ── Skelet — sahifa shaklida ─────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 sm:p-5" aria-busy>
      <div className="h-4 w-56 rounded bg-v2-skeleton" />
      <div className="grid items-start gap-4 min-[64rem]:grid-cols-[18.5rem_minmax(0,1fr)] min-[90rem]:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-3 rounded-v2-lg border border-v2-border p-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-v2-skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-v2-skeleton" />
              <div className="h-3 w-1/2 rounded bg-v2-skeleton" />
            </div>
          </div>
          <div className="h-20 rounded-v2-md bg-v2-skeleton" />
          <div className="h-9 rounded-v2-md bg-v2-skeleton" />
          <div className="h-48 rounded-v2-md bg-v2-skeleton" />
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 border-b border-v2-border pb-3">
            <div className="h-4 w-16 rounded bg-v2-skeleton" />
            <div className="h-4 w-20 rounded bg-v2-skeleton" />
            <div className="h-4 w-16 rounded bg-v2-skeleton" />
            <div className="h-4 w-12 rounded bg-v2-skeleton" />
          </div>
          <div className="h-24 rounded-v2-lg bg-v2-skeleton" />
          <div className="h-36 rounded-v2-lg bg-v2-skeleton" />
          <div className="grid gap-4 min-[48rem]:grid-cols-2">
            <div className="h-40 rounded-v2-lg bg-v2-skeleton" />
            <div className="h-40 rounded-v2-lg bg-v2-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
