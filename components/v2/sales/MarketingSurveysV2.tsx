"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Loader2, Megaphone, Pencil, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, TextInput } from "@/components/v2/form/fields";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { B, NoticeBar, PageHead, PageShell, SearchBox, SummaryLine, TH } from "@/components/v2/students/lists/listKit";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import type { Survey } from "@/lib/surveys";

// YANGI VERSIYA — SOTUV VA MARKETING → «MARKETING» (/sales-marketing, rasmsiz — 53-qism, 20.11.2026).
// Eski versiyada — components/sales/SurveysPage.tsx, o'zgarmagan.
//
// Lid MANBALARI va ularning kodlari (Instagram — s26 …). Ma'lumot va amallar eski sahifa bilan BITTA:
// GET /api/surveys, POST /api/surveys, PATCH / DELETE /api/surveys/:id; yuboriladigan maydonlar,
// tekshiruv («Sarlavhani kiriting») va xabarlar — eskisidan aynan. Yangi yozuvda kod bo'sh bo'lsa
// backend keyingi kodni o'zi beradi (eskisi kabi `code` umuman yuborilmaydi).
//
// HAVOLA YASALMAYDI (lib/surveys.ts izohi): `?survey=` kodini o'qiydigan joy yo'q — ochiq
// /sorovnoma sahifasi ham o'qimaydi. Eski izohdagi «ommaviy lid formasi yo'q» degan gap
// /sorovnoma paydo bo'lgach eskirdi — bu yerda rosti yoziladi va kuzatiladigan havola uchun
// «Kampaniya havolalari» (36-qism) ko'rsatiladi.

type SalesSurveyDialog = { survey: Survey | null };

const SALES_SURVEY_ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
const SALES_SURVEY_TD = "px-2.5 py-2.5 align-middle";
const SALES_SURVEY_COLS = 4;

/** Manba rasmi — 32 px kvadrat; rasm bo'lmasa yoki ochilmasa — kulrang belgi. */
function SalesSurveyThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-text-3" aria-hidden>
        <Megaphone className="size-4" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setBroken(true)} className="size-8 shrink-0 rounded-v2-md border border-v2-border object-cover" />
  );
}

export default function MarketingSurveysV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const canSources = useCanOpen("/sales-sources");
  const canCampaigns = useCanOpen("/sales-campaigns");

  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState("");

  const [dialog, setDialog] = useState<SalesSurveyDialog | null>(null);
  const [delTarget, setDelTarget] = useState<Survey | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setSurveys(d.surveys);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const all = useMemo(() => surveys ?? [], [surveys]);
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter((s) => `${s.title} ${t(s.title)} ${s.code}`.toLowerCase().includes(query));
  }, [all, q, t]);
  const withCode = all.filter((s) => !!s.code).length;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(t("Kod nusxalandi"));
    } catch {
      showError(t("Nusxalab bo'lmadi"));
    }
  }

  async function confirmDelete() {
    if (!delTarget || deleting) return;
    const target = delTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/surveys/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setSurveys((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      showSuccess(t("So'rovnoma o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
      setDelTarget(null);
    }
  }

  return (
    <PageShell>
      <PageHead
        title={t("Marketing")}
        subtitle={t("Lid manbalari va ularning kodlari — kod lidning «So'rovnoma» maydoniga yoziladi")}
        actions={
          <>
            {canSources && (
              <Link href="/sales-sources" className={secondaryBtn}>
                <TrendingUp className="size-4" strokeWidth={1.75} aria-hidden />
                {t("O'quvchilar oqimi")}
              </Link>
            )}
            <button type="button" onClick={() => setDialog({ survey: null })} disabled={!surveys} className={`${primaryBtn} disabled:opacity-60`}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("So'rovnoma qo'shish")}
            </button>
          </>
        }
      />

      <NoticeBar
        action={
          canCampaigns ? (
            <Link href="/sales-campaigns" className="inline-flex shrink-0 items-center gap-1 text-v2-small font-semibold text-v2-brand-text hover:underline">
              {t("Kampaniya havolalari")}
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
            </Link>
          ) : undefined
        }
      >
        {t("Bu yerda havola yasalmaydi: ochiq so'rovnoma sahifasi bu kodni o'qimaydi. Kodni nusxalab lidning «So'rovnoma» maydoniga yozing; kuzatiladigan havola va QR kerak bo'lsa — Kampaniya havolalari.")}
      </NoticeBar>

      <div className="flex flex-wrap items-center gap-2">
        <SummaryLine
          items={[
            <span key="n">
              <B>{surveys ? all.length : "—"}</B> {t("ta manba")}
            </span>,
            surveys && withCode !== all.length ? (
              <span key="c">
                {t("kodsiz")}: <B>{all.length - withCode}</B>
              </span>
            ) : null,
          ]}
        />
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={q} onChange={setQ} placeholder={t("Manba yoki kod")} width={240} />
        </div>
      </div>

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[440px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={TH}>{t("Manba")}</th>
                <th className={`${TH} w-48`}>{t("Kod")}</th>
                <th className={`${TH} w-24 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!surveys &&
                !failed &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${SALES_SURVEY_TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SURVEY_TD}>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-v2-md bg-v2-skeleton" />
                        <div className="h-3 w-32 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    <td className={SALES_SURVEY_TD}><div className="h-5 w-14 rounded bg-v2-skeleton" /></td>
                    <td className={`${SALES_SURVEY_TD} pr-4`} />
                  </tr>
                ))}

              {(failed && !surveys) || (surveys && visible.length === 0) ? (
                <tr>
                  <td colSpan={SALES_SURVEY_COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Megaphone className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !surveys ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : q.trim() ? (
                        <div className="text-v2-section text-v2-text">{t("Topilmadi")}</div>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("So'rovnoma topilmadi")}</div>
                          <p className="max-w-[28rem] text-v2-small text-v2-text-2">{t("Instagram, Telegram, banner kabi har manbaga kod bering — lid qayerdan kelgani ko'rinadi.")}</p>
                          <button type="button" onClick={() => setDialog({ survey: null })} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("So'rovnoma qo'shish")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}

              {visible.map((s, i) => (
                <tr key={s.id} className={`h-14 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className={`${SALES_SURVEY_TD} pl-4 tabular-nums text-v2-text-3`}>{i + 1}</td>
                  <td className={`${SALES_SURVEY_TD} max-w-[320px]`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <SalesSurveyThumb src={s.image} alt={t(s.title)} />
                      <button
                        type="button"
                        onClick={() => setDialog({ survey: s })}
                        title={t(s.title)}
                        className="min-w-0 truncate text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
                      >
                        {t(s.title)}
                      </button>
                    </div>
                  </td>
                  <td className={SALES_SURVEY_TD}>
                    {s.code ? (
                      <div className="flex items-center gap-1">
                        <span className="max-w-[120px] truncate rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-v2-text" title={s.code}>
                          {s.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copy(s.code)}
                          title={t("Nusxalash")}
                          aria-label={`${s.code} — ${t("Nusxalash")}`}
                          className="inline-flex size-7 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                        >
                          <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="text-v2-text-3">—</span>
                    )}
                  </td>
                  <td className={`${SALES_SURVEY_TD} pr-4`}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => setDialog({ survey: s })} title={t("Tahrirlash")} aria-label={`${t(s.title)} — ${t("Tahrirlash")}`} className={SALES_SURVEY_ICON_BTN}>
                        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(s)}
                        title={t("O'chirish")}
                        aria-label={`${t(s.title)} — ${t("O'chirish")}`}
                        className={`${SALES_SURVEY_ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <SalesSurveyDialogV2
          survey={dialog.survey}
          onClose={() => setDialog(null)}
          onSaved={(saved, editing) =>
            // Eski sahifa kabi: tahrirlangani o'z o'rnida, yangisi — oxirida.
            setSurveys((prev) => {
              const list = prev ?? [];
              return editing ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
            })
          }
        />
      )}
      {delTarget && (
        <V2Confirm
          title={t("So'rovnomani o'chirasizmi?")}
          body={t("«{n}» manbasi ro'yxatdan olib tashlanadi. Lidlarga avval yozilgan kod o'zgarmaydi.", { n: t(delTarget.title) })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Qo'shish / tahrirlash oynasi ───────────────────────── */

function SalesSurveyDialogV2({
  survey,
  onClose,
  onSaved,
}: {
  survey: Survey | null;
  onClose: () => void;
  onSaved: (s: Survey, editing: boolean) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const editing = survey !== null;
  const init = { title: survey?.title ?? "", image: survey?.image ?? "", code: survey?.code ?? "" };
  const [form, setForm] = useState(init);
  const [titleErr, setTitleErr] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = form.title !== init.title || form.image !== init.image || form.code !== init.code;
  const imageUrl = form.image.trim();

  async function save() {
    if (saving) return;
    const title = form.title.trim();
    if (!title) {
      setTitleErr(t("Sarlavhani kiriting"));
      return;
    }
    setSaving(true);
    try {
      // Yuboriladigan maydonlar — eski sahifadagidek.
      const payload: Record<string, string> = { title, image: form.image };
      // Yangi yozuvda kod bo'sh bo'lsa — backend o'zi keyingi kodni beradi.
      if (form.code.trim() || editing) payload.code = form.code.trim();
      const res = await fetch(editing ? `/api/surveys/${survey.id}` : "/api/surveys", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.survey as Survey, editing);
      showSuccess(editing ? t("So'rovnoma yangilandi") : t("So'rovnoma qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={editing ? t("So'rovnomani tahrirlash") : t("So'rovnoma qo'shish")}
      subtitle={t("Lid manbasi — Instagram, Telegram, banner …")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Sarlavha")} htmlFor="sales-survey-title" error={titleErr || undefined}>
          <TextInput
            id="sales-survey-title"
            value={form.title}
            onChange={(e) => {
              setForm((f) => ({ ...f, title: e.target.value }));
              setTitleErr("");
            }}
            state={titleErr ? "error" : "default"}
            autoComplete="off"
            placeholder={t("Masalan: Instagram")}
          />
        </Field>

        <Field label={t("Rasm (URL)")} optional htmlFor="sales-survey-image">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                id="sales-survey-image"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                autoComplete="off"
                inputMode="url"
                placeholder="https://..."
              />
            </div>
            {imageUrl && (
              <span className="shrink-0 [&>*]:size-10!">
                <SalesSurveyThumb key={imageUrl} src={imageUrl} alt={form.title} />
              </span>
            )}
          </div>
        </Field>

        <Field label={t("Kod")} optional={!editing} htmlFor="sales-survey-code" hint={t("Manbaning kodi — buyurtmadagi \"So'rovnoma\" maydoniga shu qiymat yoziladi.")}>
          <TextInput
            id="sales-survey-code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder={editing ? "s30" : t("Bo'sh qoldirilsa avtomatik beriladi")}
          />
        </Field>
      </div>
    </V2Dialog>
  );
}
