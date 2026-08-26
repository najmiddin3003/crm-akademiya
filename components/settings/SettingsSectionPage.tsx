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
import ModuleNotEnabledTab from "./ModuleNotEnabledTab";
import { loadMonthlyPercentStaffCounts } from "./monthlyPercentStaff";
import SettingsNote from "./SettingsNote";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { LEAVE_REASON_TYPES, TAX_TYPES } from "@/lib/settingsLists";
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

// Quyidagi formalar qiymatni bazaga to'g'ri yozadi, ammo mahsulotda uni
// O'QIYDIGAN kod hali yo'q (grep bilan tekshirildi: "finance.payment-manager",
// "finance.kpi-manager", "finance.kpi", "finance.student-discount",
// "app.content", "app.teacher", "app.student" kalitlariga faqat shu sahifa
// murojaat qiladi). Tab o'chirilmaydi — sozlama haqiqiy va saqlanadi — lekin
// foydalanuvchi "yoqdim, ishladi" deb o'ylamasligi uchun rost izoh qo'yiladi.
const PAYROLL_NOT_WIRED_NOTE = (
  <SettingsNote>
    Bu qiymatlar saqlanadi, lekin oylik hisobi (Moliya &rarr; Oylik) hozircha ularni
    o&apos;qimaydi: bonus va jarima qatorlari faqat qo&apos;lda kiritiladi. Ya&apos;ni bu yerdagi
    o&apos;zgarish hech qanday hisob-kitobga ta&apos;sir qilmaydi.
  </SettingsNote>
);

const DISCOUNT_NOT_WIRED_NOTE = (
  <SettingsNote>
    Bu qiymatlar saqlanadi, lekin chegirmani avtomatik qo&apos;llaydigan kod hali yo&apos;q:
    o&apos;quvchi nechta guruhga qatnashidan qat&apos;i nazar, to&apos;lov summasi o&apos;zgarmaydi.
  </SettingsNote>
);

const APP_NOT_WIRED_NOTE = (
  <SettingsNote>
    Bu sozlamalar saqlanadi, lekin ularni o&apos;qiydigan mobil ilova bu tizimga hali
    ulanmagan &mdash; hozircha veb-panel xulqiga ham ta&apos;sir qilmaydi.
  </SettingsNote>
);

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

  // "system.user-filter" ham xuddi shu holatda: jadval sahifalari filtr
  // ko'rinishini o'z ichida hal qiladi va bu hujjatni o'qimaydi.
  "system:user-filter-settings": () => (
    <SettingsForm
      storageKey="system.user-filter"
      groups={USER_FILTER_SETTINGS_GROUPS as SettingsGroup[]}
      note={
        <SettingsNote>
          Tanlov saqlanadi, lekin jadval sahifalari filtr ko&apos;rinishini hozircha shu
          sozlamadan olmaydi &mdash; har bir sahifa o&apos;z ko&apos;rinishini o&apos;zi belgilaydi.
        </SettingsNote>
      }
    />
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

  // Maydonlar referensdagi "To'lov turi qo'shish" oynasidan: Nomi + Aktiv
  // va to'lov turi qaysi amallarda tanlash uchun chiqishini belgilovchi
  // uchta belgi.
  "finance:payment-methods": () => (
    <SettingsListTab
      kind="payment-methods"
      addLabel="To'lov turi"
      fields={[
        { key: "name", label: "Nomi", input: "text" },
        { key: "active", label: "Aktiv", input: "toggle" },
        { key: "showInIncomeExpense", label: "Daromad xarajatlarini ko'rsatish", input: "toggle" },
        { key: "showInTransfer", label: "Transferda ko'rsatish", input: "toggle" },
        { key: "showInInvestment", label: "Sarmoya va dividentda ko'rsatish", input: "toggle" },
      ]}
    />
  ),

  "finance:payment-manager": () => (
    <SettingsForm
      storageKey="finance.payment-manager"
      groups={MANAGER_PAYMENT_GROUPS as SettingsGroup[]}
      note={PAYROLL_NOT_WIRED_NOTE}
    />
  ),

  "finance:kpi-manager": () => (
    <SettingsForm
      storageKey="finance.kpi-manager"
      groups={FINANCE_KPI_GROUPS as SettingsGroup[]}
      note={PAYROLL_NOT_WIRED_NOTE}
    />
  ),

  "finance:kvi": () => (
    <SettingsForm
      storageKey="finance.kpi"
      groups={KPI_GROUPS as SettingsGroup[]}
      note={PAYROLL_NOT_WIRED_NOTE}
    />
  ),

  // "Bog'langan xodim soni" — yozuvda saqlanadigan maydon EMAS. Xodim
  // kartochkasidagi "Oladigan foizi" shu daraja nomini ko'rsatadi, shuning
  // uchun son har safar /api/hr-employees dan sanaladi
  // (monthlyPercentStaff.ts). Ilgari u yozuvdagi qotib qolgan `staffCount`
  // dan o'qirdi va xodim qo'shilsa ham o'zgarmasdi.
  "finance:monthly": () => (
    <SettingsListTab
      kind="monthly-percents"
      addLabel="Foiz qo'shish"
      fields={[
        { key: "name", label: "Foiz nomi", input: "text" },
        { key: "percent", label: "Foiz", input: "text", suffix: "%" },
      ]}
      computed={{
        label: "Bog'langan xodim soni",
        afterKey: "name",
        load: loadMonthlyPercentStaffCounts,
      }}
    />
  ),

  // Soliq. Har bir yozuv — bitta soliq turi: yo FOIZ (hisoblangan oylikdan),
  // yo ANIQ SUMMA. Faqat "Faol" yozuvlar hisobga olinadi va faqat kartasida
  // soliq YOQILGAN xodimga qo'llanadi (Boshqaruv → Xodimlar dagi tugmacha).
  // Hisob-kitob: lib/taxes.ts va lib/salary.ts → payrollTaxLines.
  "finance:tax": () => (
    <SettingsListTab
      kind="taxes"
      addLabel="Soliq qo'shish"
      fields={[
        { key: "name", label: "Soliq nomi", input: "text" },
        { key: "taxType", label: "Turi", input: "select", options: [...TAX_TYPES] },
        { key: "percent", label: "Foiz", input: "text", suffix: "%" },
        { key: "amount", label: "Aniq summa", input: "text", suffix: "UZS" },
        { key: "active", label: "Holati", input: "toggle" },
      ]}
    />
  ),

  "finance:payment-student": () => (
    <SettingsForm
      storageKey="finance.student-discount"
      groups={STUDENT_DISCOUNT_GROUPS as SettingsGroup[]}
      note={DISCOUNT_NOT_WIRED_NOTE}
    />
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
    <SettingsForm
      storageKey="app.content"
      groups={APP_CONTENT_GROUPS as SettingsGroup[]}
      note={APP_NOT_WIRED_NOTE}
    />
  ),

  "app-settings:teacher": () => (
    <SettingsForm
      storageKey="app.teacher"
      groups={APP_TEACHER_GROUPS as SettingsGroup[]}
      note={APP_NOT_WIRED_NOTE}
    />
  ),

  "app-settings:student": () => (
    <SettingsForm
      storageKey="app.student"
      groups={APP_STUDENT_GROUPS as SettingsGroup[]}
      note={APP_NOT_WIRED_NOTE}
    />
  ),

  // ── Gamifikatsiya ────────────────────────────────────────────────────
  // Modul sotib olinmagani uchun referensda ikkala tab ham bo'sh —
  // ModuleNotEnabledTab.tsx dagi izohga qarang.
  "gamification:general": () => <ModuleNotEnabledTab title="Funksionallik" />,

  "gamification:auto-coin": () => <ModuleNotEnabledTab title="Auto coin" />,
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
    <Suspense fallback={<div className="p-5"><SpinnerBlock /></div>}>
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
