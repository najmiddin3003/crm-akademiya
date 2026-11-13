"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Info, Loader2, Lock, RefreshCw, Send, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import {
  NOTIFY_COLUMN_LABEL,
  NOTIFY_COLUMNS,
  NOTIFY_GROUPS,
  type NotifyColumn,
  type NotifyColumnInfo,
  type NotifyEvent,
  type NotifyRules,
} from "@/lib/notificationRules";

// SOZLAMALAR → UMUMIY → «BILDIRISHNOMALAR» (`/settings-notifications`, 23-qism, 13.11.2026;
// rasm «Sozlamalar · Bildirishnomalar», yorug'/qorong'i).
//
// Jadval: hodisa × rol (Rahbar, Menejer, Qabul admin., O'qituvchi, Moderator) + «Muhim».
// Qoidalar, rollarning haqiqiy rollarga mosligi va HALOL HOLAT — lib/notificationRules.ts:
// qo'ng'iroq bu jadvalni hali o'qimaydi, shuni sahifa o'zi ham aytadi (pastdagi izoh).
//
// O'zgarishlar qoralamada yig'iladi, «Saqlash» bilan yoziladi; «Bekor qilish» saqlanganiga
// qaytaradi. Faqat ADMIN (sahifa va API ikkalasi tekshiradi).

interface RulesView {
  rules: NotifyRules;
  saved: boolean;
  updatedAt: string | null;
  columns: NotifyColumnInfo[];
  others: string[];
  timing: { missedAfterMin: number; absentAfterMin: number };
}

const URL = "/api/notification-rules";

/** «Muhim» qatori — danger foni (ui/table.ts ROW_TINT dagi tirqishsiz usul). */
const IMPORTANT_TINT = "bg-v2-danger-bg shadow-[inset_0_0_0_9999px_var(--v2-danger-bg)]";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-v2-brand" : "bg-v2-border-strong"
      }`}
    >
      {/* Inline transform — klass generatsiyasiga bog'liq emas (EmployeeToggle izohi). */}
      <span
        aria-hidden
        className="inline-block size-4 rounded-full bg-v2-surface shadow-v2-sm transition-transform"
        style={{ transform: `translateX(${checked ? 18 : 2}px)` }}
      />
    </button>
  );
}

const same = (a: NotifyRules | null, b: NotifyRules | null) => JSON.stringify(a) === JSON.stringify(b);

export default function NotificationRulesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<RulesView | null>(null);
  const [draft, setDraft] = useState<NotifyRules | null>(null);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchJson<RulesView>(URL)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setDraft(d.rules);
        setProblem(null);
      })
      .catch((e) => {
        if (alive) setProblem(e instanceof ApiError && e.status === 403 ? "denied" : "failed");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const dirty = !!data && !!draft && !same(data.rules, draft);
  const columnInfo = useMemo(() => new Map((data?.columns ?? []).map((c) => [c.key, c.roles])), [data]);

  function setRole(key: string, col: NotifyColumn, on: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const cur = new Set(d[key]?.roles ?? []);
      if (on) cur.add(col);
      else cur.delete(col);
      return { ...d, [key]: { ...d[key], roles: NOTIFY_COLUMNS.filter((c) => cur.has(c)) } };
    });
  }

  function setImportant(key: string, on: boolean) {
    setDraft((d) => (d ? { ...d, [key]: { ...d[key], important: on } } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const d = await fetchJson<RulesView>(URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: draft }),
      });
      setData(d);
      setDraft(d.rules);
      showSuccess(t("Bildirishnoma sozlamalari saqlandi"));
    } catch (e) {
      showError(t(e instanceof ApiError && e.status === 403 ? "Faqat administrator uchun" : "Saqlanmadi"));
    } finally {
      setSaving(false);
    }
  }

  function hintOf(e: NotifyEvent, view: RulesView): string {
    return e.hintParam ? t(e.hint, { n: view.timing[e.hintParam] }) : t(e.hint);
  }

  function columnTitle(col: NotifyColumn): string {
    const roles = columnInfo.get(col) ?? [];
    return roles.length ? roles.map((r) => t(r)).join(", ") : t("Bu markazda bunday rol yo'q");
  }

  const row = (e: NotifyEvent, view: RulesView, rules: NotifyRules) => {
    const rule = rules[e.key];
    const important = !e.locked && !!rule?.important;
    return (
      <tr key={e.key} className={`border-b border-v2-border ${important ? IMPORTANT_TINT : ""}`}>
        <td className="px-4 py-2.5" title={t(e.nowNote)}>
          <div className="text-v2-body font-semibold text-v2-text">{t(e.label)}</div>
          <div className="mt-0.5 text-v2-caption text-v2-text-2">
            {hintOf(e, view)}
            {e.nazorat && (
              <>
                {" · "}
                <Link href="/settings-nazorat" className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
                  {t("Nazorat qoidasi")}
                </Link>
              </>
            )}
          </div>
        </td>
        {e.locked ? (
          <>
            <td colSpan={NOTIFY_COLUMNS.length} className="px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text-2">
                <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                {t("Doim:")} <b className="font-semibold text-v2-text">{t(e.locked)}</b>
              </span>
            </td>
            <td className="px-3 py-2.5 text-center text-v2-text-3">—</td>
          </>
        ) : (
          <>
            {NOTIFY_COLUMNS.map((col) => (
              <td key={col} className="px-2 py-2.5 text-center">
                <V2Checkbox
                  checked={!!rule?.roles.includes(col)}
                  disabled={saving}
                  label={`${t(e.label)} — ${t(NOTIFY_COLUMN_LABEL[col])}`}
                  onChange={(on) => setRole(e.key, col, on)}
                />
              </td>
            ))}
            <td className="px-3 py-2.5 text-center">
              <span className="inline-flex align-middle">
                <Switch checked={important} disabled={saving} label={`${t("Muhim")}: ${t(e.label)}`} onChange={(on) => setImportant(e.key, on)} />
              </span>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="min-w-0 max-w-[44rem]">
        <div className="text-v2-caption text-v2-text-2">{t("Umumiy")}</div>
        <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Bildirishnomalar")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">
          {t("Qaysi hodisa kimga boradi — rollar bo'yicha. Qo'ng'iroq belgisidagi ro'yxat shu jadvaldan to'ladi.")}
        </p>
      </div>

      {problem === "denied" && <p className="text-v2-small text-v2-text-2">{t("Faqat administrator uchun")}</p>}
      {problem === "failed" && (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t("Yuklanmadi")}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      )}
      {!data && !problem && <Loader2 className="size-5 animate-spin text-v2-text-2" aria-label={t("Yuklanmoqda...")} />}

      {data && draft && (
        <>
          {/* 2. Kanal */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-v2-small text-v2-text-2">{t("Kanal:")}</span>
            <span
              aria-current="true"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-v2-brand bg-v2-brand-bg px-3 text-v2-small font-medium text-v2-brand-text"
            >
              <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
              {t("Tizim ichida (qo'ng'iroq belgisi)")}
            </span>
            <span
              aria-disabled="true"
              title={t("Telegram kanali keyingi bosqichda qo'shiladi")}
              className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full border border-v2-border bg-v2-surface px-3 text-v2-small text-v2-text-2"
            >
              <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Telegram — keyingi bosqichda")}
            </span>
          </div>

          {/* 3. Jadval */}
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            {/* `relative` — telefonda faqat jadval o'zi yonga aylanadi (sahifa kengaymaydi). */}
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th scope="col" className="px-4 py-2.5 text-v2-caption font-medium text-v2-text-2">
                      {t("Hodisa")}
                    </th>
                    {NOTIFY_COLUMNS.map((col) => (
                      <th key={col} scope="col" title={columnTitle(col)} className="w-[96px] px-2 py-2.5 text-center text-v2-caption font-medium text-v2-text-2">
                        {t(NOTIFY_COLUMN_LABEL[col])}
                      </th>
                    ))}
                    <th scope="col" className="w-[72px] px-3 py-2.5 text-center text-v2-caption font-medium text-v2-text-2">
                      {t("Muhim")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFY_GROUPS.map((g) => [
                    <tr key={`g:${g.title}`} className="border-b border-v2-border">
                      <th scope="colgroup" colSpan={NOTIFY_COLUMNS.length + 2} className="bg-v2-surface-2 px-4 py-1.5 text-left text-v2-caption font-medium text-v2-text-2">
                        {t(g.title)}
                      </th>
                    </tr>,
                    ...g.events.map((e) => row(e, data, draft)),
                  ])}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Halol holat — qo'ng'iroq bu jadvalni hali o'qimaydi */}
          <p className="flex max-w-[60rem] items-start gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              {t(
                "Tanlov saqlanadi, lekin qo'ng'iroq hali unga qaramaydi: hozir u yerga yangi arizalar, to'lovlar va topshiriqlar bo'lim ruxsati bo'yicha, e'lonlar esa hammaga tushadi. Davomat, kelmagan va kechikkan xodim xabarlari Telegram'ga boradi. Qolgan hodisalar keyingi bosqichda ulanadi — sichqonchani hodisa ustiga olib borsangiz, u hozir qayerga borishi ko'rinadi.",
              )}
            </span>
          </p>

          {/* 5. Izohlar */}
          <ul className="space-y-1.5 text-v2-caption text-v2-text-2">
            <li className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              {t("«Muhim» — hal bo'lguncha ro'yxat tepasida turadi.")}
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              {t("Vaqtlar — amaldagi qoidalardan: davomat va o'qituvchi kelmagani «Nazorat qoidalari»da, kechikishga ruxsat — filial sozlamasida.")}
            </li>
            {data.others.length > 0 && (
              <li className="flex items-start gap-2">
                <Users className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                {t("{roles} faqat o'ziga tegishlisini oladi — «Doim» qatorlari.", { roles: data.others.join(", ") })}
              </li>
            )}
          </ul>

          {/* 6. Amallar */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setDraft(data.rules)} disabled={!dirty || saving} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              {t("Bekor qilish")}
            </button>
            <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
              {t("Saqlash")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
