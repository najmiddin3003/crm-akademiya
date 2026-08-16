"use client";

import { Suspense, type ReactNode } from "react";
import SettingsShell from "./SettingsShell";
import FunctionalityTab from "./FunctionalityTab";
import SettingsListTab from "./SettingsListTab";
import SettingsForm from "./SettingsForm";
import IntegrationsTab from "./IntegrationsTab";
import CheckTab from "./CheckTab";
import BillingTab from "./BillingTab";
import PublicOfertaTab from "./PublicOfertaTab";
import FieldSettingsTab from "./FieldSettingsTab";
import AutoSmsTab from "./AutoSmsTab";
import BotNotesTab from "./BotNotesTab";
import { LEAVE_REASON_TYPES } from "@/lib/settingsLists";
import {
  USER_FILTER_SETTINGS_GROUPS,
  APP_CONTENT_GROUPS,
  APP_TEACHER_GROUPS,
  APP_STUDENT_GROUPS,
  MANAGER_PAYMENT_GROUPS,
  FINANCE_KPI_GROUPS,
  KPI_GROUPS,
  STUDENT_DISCOUNT_GROUPS,
} from "@/constants/settingsForms";
import type { SettingsGroup } from "@/lib/settings";

// Bo'lim sahifasi uchun umumiy qobiq. Tab uchun tayyor komponent bo'lsa
// ko'rsatiladi, aks holda "hali qurilmagan" belgisi — bu yerda soxta forma
// ko'rsatmaymiz, chunki maydonlari referensdan hali ko'chirilmagan.
//
// Kalit: "<bo'lim>:<tab>" — ikkalasi ham constants/settings.js dagi slug.

const BUILT: Record<string, () => ReactNode> = {
  // ── Umumiy sozlamalar ────────────────────────────────────────────────
  "system:general": () => <FunctionalityTab />,

  "system:check": () => <CheckTab />,

  "system:billing": () => <BillingTab />,

  "system:holidays": () => (
    <SettingsListTab
      kind="holidays"
      addLabel="Bayram kunlari qo'shish"
      fields={[
        { key: "name", label: "Sarlavha", input: "text" },
        { key: "startDate", label: "Boshlanish kuni", input: "date" },
        { key: "endDate", label: "Tugash kuni", input: "date" },
      ]}
    />
  ),

  "system:public-oferta": () => <PublicOfertaTab />,

  "system:user-filter-settings": () => (
    <SettingsForm storageKey="system.user-filter" groups={USER_FILTER_SETTINGS_GROUPS as SettingsGroup[]} />
  ),

  // ── Moliya ───────────────────────────────────────────────────────────
  "finance:partners": () => (
    <SettingsListTab
      kind="partners"
      addLabel="Hamkor qo'shish"
      fields={[
        { key: "name", label: "To'liq ismi", input: "text" },
        { key: "phone", label: "Telefon raqam", input: "text" },
        { key: "share", label: "Ulashish", input: "text" },
      ]}
    />
  ),

  "finance:third-persons": () => (
    <SettingsListTab
      kind="third-persons"
      addLabel="3 - shaxs qo'shish"
      fields={[
        { key: "name", label: "Ism", input: "text" },
        { key: "phone", label: "Telefon raqam", input: "text" },
        { key: "balance", label: "Balans", input: "text", suffix: "UZS" },
      ]}
    />
  ),

  "finance:payment-methods": () => (
    <SettingsListTab
      kind="payment-methods"
      addLabel="To'lov turi"
      fields={[
        { key: "name", label: "Nomi", input: "text" },
        { key: "active", label: "Holati", input: "toggle" },
      ]}
    />
  ),

  "finance:payment-manager": () => (
    <SettingsForm storageKey="finance.payment-manager" groups={MANAGER_PAYMENT_GROUPS as SettingsGroup[]} />
  ),

  "finance:kpi-manager": () => (
    <SettingsForm storageKey="finance.kpi-manager" groups={FINANCE_KPI_GROUPS as SettingsGroup[]} />
  ),

  "finance:kvi": () => <SettingsForm storageKey="finance.kpi" groups={KPI_GROUPS as SettingsGroup[]} />,

  "finance:monthly": () => (
    <SettingsListTab
      kind="monthly-percents"
      addLabel="Foiz qo'shish"
      fields={[
        { key: "name", label: "Foiz nomi", input: "text" },
        // Xodim soni xodim kartochkasidan kelib chiqadi — bu yerda faqat ko'rsatiladi.
        { key: "staffCount", label: "Bog'langan xodim soni", input: "text", readOnly: true },
        { key: "percent", label: "Foiz", input: "text", suffix: "%" },
      ]}
    />
  ),

  "finance:payment-student": () => (
    <SettingsForm storageKey="finance.student-discount" groups={STUDENT_DISCOUNT_GROUPS as SettingsGroup[]} />
  ),

  // ── O'quv ────────────────────────────────────────────────────────────
  "study:reasons": () => (
    <SettingsListTab
      kind="reasons"
      addLabel="Sabab qo'shish"
      fields={[
        { key: "name", label: "Sabab", input: "text" },
        { key: "type", label: "Turi", input: "select", options: LEAVE_REASON_TYPES },
      ]}
    />
  ),

  "study:activities": () => (
    <SettingsListTab
      kind="activities"
      addLabel="Mashg'ulot qo'shish"
      fields={[{ key: "name", label: "Nomi", input: "text" }]}
    />
  ),

  "study:student-essessment-level": () => (
    <SettingsListTab
      kind="assessment-levels"
      addLabel="Daraja qo'shish"
      fields={[
        { key: "name", label: "Nomi", input: "text" },
        { key: "minPercent", label: "Minimal foiz", input: "text", suffix: "%" },
        { key: "maxPercent", label: "Maksimal foiz", input: "text", suffix: "%" },
        { key: "color", label: "Rangi", input: "color" },
      ]}
    />
  ),

  // ── Sotuv va marketing ───────────────────────────────────────────────
  "sale-marketing:color-list": () => (
    <SettingsListTab
      kind="lead-colors"
      addLabel="Rang qo'shish"
      fields={[
        { key: "emoji", label: "Belgi", input: "text" },
        { key: "name", label: "Nomi", input: "text" },
        { key: "color", label: "Rangi", input: "color" },
      ]}
    />
  ),

  "sale-marketing:hashtag": () => (
    <SettingsListTab
      kind="hashtags"
      addLabel="Hashtag qo'shish"
      fields={[{ key: "name", label: "Hashtag", input: "text" }]}
    />
  ),

  "sale-marketing:category": () => (
    <SettingsListTab
      kind="student-categories"
      addLabel="Tur qo'shish"
      fields={[{ key: "name", label: "Ism", input: "text" }]}
    />
  ),

  "sale-marketing:field": () => <FieldSettingsTab />,

  "sale-marketing:auto-sms": () => <AutoSmsTab />,

  "sale-marketing:bot-notes": () => <BotNotesTab />,

  "sale-marketing:sms-device": () => (
    <SettingsListTab
      kind="sms-devices"
      addLabel="Qurilma qo'shish"
      fields={[
        { key: "name", label: "Qurilma", input: "text" },
        { key: "company", label: "Kompaniya", input: "text" },
        { key: "imei", label: "IMEI", input: "text" },
        { key: "moderator", label: "Moderator", input: "text" },
        { key: "online", label: "Online/Offline", input: "toggle", onLabel: "Online", offLabel: "Offline" },
        { key: "active", label: "Holati", input: "toggle" },
      ]}
    />
  ),

  // ── Boshqaruv ────────────────────────────────────────────────────────
  "management:degrees-manager": () => (
    <SettingsListTab
      kind="degrees-manager"
      addLabel="Menejer qo'shish"
      fields={[
        { key: "name", label: "Lavozimi", input: "text" },
        { key: "halfRate", label: "Yarim stavka", input: "text", suffix: "UZS" },
        { key: "fullRate", label: "Bir stavka", input: "text", suffix: "UZS" },
      ]}
    />
  ),

  "management:degrees-teacher": () => (
    <SettingsListTab
      kind="degrees-teacher"
      addLabel="O'qituvchi qo'shish"
      fields={[
        { key: "name", label: "Lavozimi", input: "text" },
        { key: "fullRate", label: "Bir stavka", input: "text", suffix: "UZS" },
      ]}
    />
  ),

  // ── Integratsiyalar (chap panelsiz, tab kaliti bo'sh) ────────────────
  "integration:": () => <IntegrationsTab />,

  // ── Ilova sozlamalari ────────────────────────────────────────────────
  "app-settings:content": () => (
    <SettingsForm storageKey="app.content" groups={APP_CONTENT_GROUPS as SettingsGroup[]} />
  ),

  "app-settings:teacher": () => (
    <SettingsForm storageKey="app.teacher" groups={APP_TEACHER_GROUPS as SettingsGroup[]} />
  ),

  "app-settings:student": () => (
    <SettingsForm storageKey="app.student" groups={APP_STUDENT_GROUPS as SettingsGroup[]} />
  ),
};

function NotBuilt({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-10 text-center">
      <div className="text-[15px] font-semibold">{label}</div>
      <p className="text-[13px] text-muted-foreground mt-2 max-w-md mx-auto">
        Bu bo&apos;lim hali qurilmagan — maydonlari referens saytdan ko&apos;chirilishi kerak.
        Karkas va saqlash mexanizmi tayyor, faqat forma qo&apos;shiladi.
      </p>
    </div>
  );
}

export default function SettingsSectionPage({ sectionKey }: { sectionKey: string }) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-muted-foreground">Yuklanmoqda…</div>}>
      <SettingsShell sectionKey={sectionKey}>
        {(tab) => {
          const built = BUILT[`${sectionKey}:${tab}`];
          if (built) return built();
          return <NotBuilt label={tab || sectionKey} />;
        }}
      </SettingsShell>
    </Suspense>
  );
}
