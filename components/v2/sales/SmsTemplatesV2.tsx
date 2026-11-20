"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldLabel, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import { Badge, PageHead, PageShell, SearchBox, SegmentPills, TH, type BadgeTone } from "@/components/v2/students/lists/listKit";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { SMS_AUDIENCES, SMS_PLACEHOLDERS, renderSmsPreview, type SmsTemplate } from "@/lib/smsTemplates";

// YANGI VERSIYA — SOTUV VA MARKETING → «SMS SHABLONLARI» (/sales-sms, rasmsiz — 53-qism, 20.11.2026).
// Eski versiyada — components/sales/SmsTemplatesPage.tsx, o'zgarmagan.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/sms-templates, POST /api/sms-templates,
// PATCH / DELETE /api/sms-templates/:id; yuboriladigan maydonlar { title, audience, text } (trim
// qilingan), tekshiruv («Sarlavhani kiriting», «SMS matnini kiriting») va xabarlar — eskisidan.
// Shablonlar SMS yuborish oynalarida tanlanadi (components/orders/SmsModal.tsx, ommaviy SMS —
// components/v2/students/lists/BulkSmsDialogV2.tsx).
//
// Yangisi faqat ko'rinishda: «Turi» tabletkalari + qidiruv (brauzerda), jadvalda matn 2 qatorgacha
// (eskisida 20 belgi), oynada o'rinbosar KURSOR joyiga qo'yiladi (eskisida — matn oxiriga) va
// namuna ko'rinish (lib/smsTemplates.ts → renderSmsPreview, namuna qiymatlar bilan).

type SalesSmsTplTab = "all" | string;

const SALES_SMS_TPL_TONE: Record<string, BadgeTone> = {
  "O'quvchi": "success",
  "Ota-ona": "info",
  Moderator: "warning",
  "O'qituvchi": "neutral",
};

/** Namuna ko'rinish uchun qiymatlar (faqat oynada ko'rsatiladi — hech qayerga yuborilmaydi). */
const SALES_SMS_TPL_SAMPLE: Record<string, string> = {
  name: "Aliyev Vali",
  group: "Ingliz tili · 1-bosqich",
  amount: "450 000",
  date: "20.11.2026",
};

const SALES_SMS_TPL_ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
const SALES_SMS_TPL_TD = "px-2.5 py-2.5 align-middle";
const SALES_SMS_TPL_COLS = 5;

export default function SmsTemplatesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();

  const [templates, setTemplates] = useState<SmsTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [tab, setTab] = useState<SalesSmsTplTab>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [dialog, setDialog] = useState<{ template: SmsTemplate | null } | null>(null);
  const [delTarget, setDelTarget] = useState<SmsTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms-templates")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setTemplates(d.templates);
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

  const all = useMemo(() => templates ?? [], [templates]);
  // Tabletkalar: ro'yxatdagi turlar + bazada uchragan boshqa turlar (eski yozuvlar).
  const audiences = useMemo(() => {
    const extra = Array.from(new Set(all.map((x) => x.audience).filter((a) => a && !SMS_AUDIENCES.includes(a))));
    return [...SMS_AUDIENCES, ...extra];
  }, [all]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((x) => {
      if (tab !== "all" && x.audience !== tab) return false;
      if (query && !`${x.title} ${t(x.title)} ${x.text}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [all, tab, q, t]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const anyFilter = tab !== "all" || !!q.trim();

  async function confirmDelete() {
    if (!delTarget || deleting) return;
    const target = delTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sms-templates/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setTemplates((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      showSuccess(t("Shablon o'chirildi"));
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
        title={t("SMS shablonlari")}
        subtitle={t("Tayyor matnlar — SMS yuborish oynalarida tanlanadi")}
        actions={
          <button type="button" onClick={() => setDialog({ template: null })} disabled={!templates} className={`${primaryBtn} disabled:opacity-60`}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("SMS shablon qo'shish")}
          </button>
        }
      />

      {/* Turi tabletkalari + qidiruv */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills<SalesSmsTplTab>
          items={[
            { key: "all", label: t("Hammasi"), count: all.length },
            ...audiences.map((a) => ({ key: a, label: t(a), count: all.filter((x) => x.audience === a).length })),
          ]}
          value={tab}
          onChange={(k) => {
            setTab(k);
            setPage(1);
          }}
        />
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder={t("Sarlavha yoki matn")}
            width={240}
          />
        </div>
      </div>

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[720px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={`${TH} w-[26%]`}>{t("Sarlavha")}</th>
                <th className={`${TH} w-36`}>{t("Turi")}</th>
                <th className={TH}>{t("SMS matni")}</th>
                <th className={`${TH} w-24 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!templates &&
                !failed &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${SALES_SMS_TPL_TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_TPL_TD}><div className="h-3 w-36 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_TPL_TD}><div className="h-5 w-16 rounded-v2-full bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_TPL_TD}><div className="h-3 w-64 rounded bg-v2-skeleton" /></td>
                    <td className={`${SALES_SMS_TPL_TD} pr-4`} />
                  </tr>
                ))}

              {(failed && !templates) || (templates && slice.length === 0) ? (
                <tr>
                  <td colSpan={SALES_SMS_TPL_COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <MessageSquareText className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !templates ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : anyFilter ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Topilmadi")}</div>
                          <button
                            type="button"
                            onClick={() => {
                              setTab("all");
                              setQ("");
                              setPage(1);
                            }}
                            className={`${secondaryBtn} mt-2`}
                          >
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Shablon topilmadi")}</div>
                          <p className="max-w-[28rem] text-v2-small text-v2-text-2">{t("To'lov eslatmasi, dars vaqti o'zgargani kabi tez-tez yuboriladigan matnlarni shablon qilib qo'ying.")}</p>
                          <button type="button" onClick={() => setDialog({ template: null })} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("SMS shablon qo'shish")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}

              {slice.map((tv, i) => (
                <tr key={tv.id} className={`h-14 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className={`${SALES_SMS_TPL_TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                  <td className={`${SALES_SMS_TPL_TD} max-w-[260px]`}>
                    <button
                      type="button"
                      onClick={() => setDialog({ template: tv })}
                      title={t(tv.title)}
                      className="block max-w-full truncate text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
                    >
                      {t(tv.title)}
                    </button>
                  </td>
                  <td className={`${SALES_SMS_TPL_TD} whitespace-nowrap`}>
                    {tv.audience ? <Badge tone={SALES_SMS_TPL_TONE[tv.audience] ?? "neutral"}>{t(tv.audience)}</Badge> : <span className="text-v2-text-3">—</span>}
                  </td>
                  <td className={`${SALES_SMS_TPL_TD} max-w-[520px]`}>
                    <span className="line-clamp-2 whitespace-pre-line text-v2-small text-v2-text-2" title={tv.text}>
                      {tv.text}
                    </span>
                  </td>
                  <td className={`${SALES_SMS_TPL_TD} pr-4`}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => setDialog({ template: tv })} title={t("Tahrirlash")} aria-label={`${t(tv.title)} — ${t("Tahrirlash")}`} className={SALES_SMS_TPL_ICON_BTN}>
                        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(tv)}
                        title={t("O'chirish")}
                        aria-label={`${t(tv.title)} — ${t("O'chirish")}`}
                        className={`${SALES_SMS_TPL_ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}
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
        <V2Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      {dialog && (
        <SalesSmsTplDialogV2
          template={dialog.template}
          onClose={() => setDialog(null)}
          onSaved={(saved, editing) =>
            // Eski sahifa kabi: tahrirlangani o'z o'rnida, yangisi — oxirida.
            setTemplates((prev) => {
              const list = prev ?? [];
              return editing ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
            })
          }
        />
      )}
      {delTarget && (
        <V2Confirm
          title={t("Shablonni o'chirasizmi?")}
          body={t("«{n}» SMS yuborish oynalaridagi tanlovdan ham yo'qoladi. Yuborilgan xabarlar jurnalda qoladi.", { n: t(delTarget.title) })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Qo'shish / tahrirlash oynasi ───────────────────────── */

function SalesSmsTplDialogV2({
  template,
  onClose,
  onSaved,
}: {
  template: SmsTemplate | null;
  onClose: () => void;
  onSaved: (tpl: SmsTemplate, editing: boolean) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const editing = template !== null;
  const init = { title: template?.title ?? "", audience: template?.audience ?? SMS_AUDIENCES[0], text: template?.text ?? "" };
  const [form, setForm] = useState(init);
  const [errors, setErrors] = useState<{ title?: string; text?: string }>({});
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const dirty = form.title !== init.title || form.audience !== init.audience || form.text !== init.text;
  // Bazadagi eski yozuvda ro'yxatda yo'q tur bo'lsa — u ham variant bo'lib turadi (yo'qolib ketmasin).
  const audienceOptions = SMS_AUDIENCES.includes(form.audience) || !form.audience ? SMS_AUDIENCES : [...SMS_AUDIENCES, form.audience];
  const preview = renderSmsPreview(form.text, SALES_SMS_TPL_SAMPLE);

  /** O'rinbosarni kursor joyiga qo'yadi (maydon fokusda bo'lmasa — oxiriga). */
  function insert(token: string) {
    const el = ta.current;
    const text = form.text;
    const a = el && document.activeElement === el ? (el.selectionStart ?? text.length) : text.length;
    const b = el && document.activeElement === el ? (el.selectionEnd ?? a) : a;
    setForm((f) => ({ ...f, text: text.slice(0, a) + token + text.slice(b) }));
    setErrors((e) => ({ ...e, text: undefined }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  }

  async function save() {
    if (saving) return;
    const title = form.title.trim();
    const text = form.text.trim();
    // Tekshiruv — eski sahifadagi ikki shart, xatolar maydon ostida.
    const next: typeof errors = {};
    if (!title) next.title = t("Sarlavhani kiriting");
    if (!text) next.text = t("SMS matnini kiriting");
    setErrors(next);
    if (next.title || next.text) return;
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/sms-templates/${template.id}` : "/api/sms-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, audience: form.audience, text }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.template as SmsTemplate, editing);
      showSuccess(editing ? t("Shablon yangilandi") : t("Shablon qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={editing ? t("Shablonni tahrirlash") : t("SMS shablon qo'shish")}
      subtitle={t("SMS yuborish oynalarida tayyor matn sifatida tanlanadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={600}
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
        <Field label={t("Sarlavha")} htmlFor="sales-sms-tpl-title" error={errors.title}>
          <TextInput
            id="sales-sms-tpl-title"
            value={form.title}
            onChange={(e) => {
              setForm((f) => ({ ...f, title: e.target.value }));
              setErrors((x) => ({ ...x, title: undefined }));
            }}
            state={errors.title ? "error" : "default"}
            autoComplete="off"
            placeholder={t("Masalan: To'lov qiling")}
          />
        </Field>

        <div>
          <FieldLabel>{t("Turi")}</FieldLabel>
          <Segmented
            label={t("Turi")}
            value={form.audience}
            onChange={(v) => setForm((f) => ({ ...f, audience: v }))}
            options={audienceOptions.map((a) => ({ value: a, label: t(a) }))}
          />
        </div>

        <Field label={t("SMS matni")} htmlFor="sales-sms-tpl-text" error={errors.text}>
          <textarea
            id="sales-sms-tpl-text"
            ref={ta}
            value={form.text}
            onChange={(e) => {
              setForm((f) => ({ ...f, text: e.target.value }));
              setErrors((x) => ({ ...x, text: undefined }));
            }}
            rows={5}
            placeholder="Hurmatli {name}, ..."
            className={fieldCls(errors.text ? "error" : "default", "h-auto! resize-y py-2 leading-5")}
          />
        </Field>
        <div className="-mt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-v2-small text-v2-text-2">{t("O'zgaruvchi qo'shish — bosing")}</span>
            {SMS_PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insert(p)}
                className="rounded-v2-sm border border-v2-border bg-v2-surface px-2 py-0.5 font-mono text-[12px] text-v2-text transition-colors hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                {p}
              </button>
            ))}
            <span className="ml-auto text-v2-caption tabular-nums text-v2-text-3">{t("{n} belgi", { n: form.text.trim().length })}</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-v2-small font-medium text-v2-text">{t("Namuna")}</div>
          <div className="rounded-v2-md bg-v2-surface-2 p-3">
            <div className="max-w-[340px] rounded-v2-md bg-v2-surface p-3 text-v2-small leading-5 text-v2-text shadow-v2-sm">
              {preview.trim() ? <div className="whitespace-pre-line break-words">{preview}</div> : <div className="text-v2-text-3">{t("Matn yozilganda shu yerda ko'rinadi")}</div>}
            </div>
            <p className="mt-2 text-v2-caption text-v2-text-3">{t("Namuna qiymatlar bilan. Yuborishda oyna o'zi biladigan qiymatni qo'yadi (ism — doim); qolgan o'zgaruvchi matnda o'zicha qoladi — yuborishdan oldin qo'lda to'g'rilang.")}</p>
          </div>
        </div>
      </div>
    </V2Dialog>
  );
}
