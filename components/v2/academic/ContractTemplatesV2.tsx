"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileSignature, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useLang, useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { B, Badge, PageHead, PageShell, SearchBox, SummaryLine, TH, fmtNum } from "@/components/v2/students/lists/listKit";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { CONTRACT_FIELDS, CONTRACT_TYPES } from "@/constants/contracts";
import type { Contract } from "@/lib/contracts";

// YANGI VERSIYA — O'QUV BO'LIMI → «SHARTNOMA» (/contract, rasmsiz — 53-qism, 20.11.2026).
// Eski versiyada — components/contracts/ContractsPage.tsx, o'zgarmagan.
//
// Shartnoma ANDOZALARI (sarlavha + tur + boy matn). Ma'lumot va amallar eski sahifa bilan BITTA:
// GET /api/contracts, DELETE /api/contracts/:id; qidiruv (sarlavha yoki tur) va sahifalash — brauzerda.
// Yaratish/tahrirlash — o'sha /contract/add va /contract/[id]/edit (eski ContractFormPage: chapda
// birlashtirish maydonlari, o'ngda RichTextEditor) — ular bu bosqichda yangi dizaynga o'tmadi.
//
// Yangisi: qatorda matn boshlanishi va ishlatilgan maydonlar soni, «Ko'rish» oynasi — andoza matni
// hujjat ko'rinishida, {{token}} lar nomi bilan belgilangan. Matn foydalanuvchi yozgan HTML — oynaga
// qo'yishdan oldin xavfli teg/atributlar olib tashlanadi (contractTplPreviewHtml), rang uslublari
// ham (qorong'i temada qora matn o'qilmasin).
//
// Andozalar o'quvchi profilidagi «Shartnoma biriktirish» tabida tanlanadi
// (components/students/ShartnomaBiriktirishTabContent.tsx) — o'chirish tasdig'ida shu aytiladi.

const CONTRACT_TPL_TYPE_LABEL: Record<string, string> = Object.fromEntries(CONTRACT_TYPES.map((tv) => [tv.value, tv.label]));
const CONTRACT_TPL_FIELDS = CONTRACT_FIELDS as Record<string, { label: string; token: string }[]>;
const CONTRACT_TPL_TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
const CONTRACT_TPL_TOKEN_CLS = "rounded-v2-sm bg-v2-brand-bg px-1 py-px font-medium text-v2-brand-text";

const CONTRACT_TPL_ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
const CONTRACT_TPL_TD = "px-2.5 py-2.5 align-middle";
const CONTRACT_TPL_COLS = 6;

/** "DD.MM.YYYY" → mahalliy sana. */
function contractTplDate(s: string): Date | null {
  const [d, m, y] = (s || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

/** HTML → bir qatorli matn (jadvaldagi «matn boshlanishi» uchun). */
function contractTplPlain(html: string): string {
  return (html || "")
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Matnda ishlatilgan turli {{token}} lar soni. */
function contractTplTokenCount(html: string): number {
  return new Set(Array.from((html || "").matchAll(CONTRACT_TPL_TOKEN_RE), (m) => m[1])).size;
}

/**
 * Ko'rish oynasi uchun HTML: xavfli teglar (script, iframe, forma …), `on*` hodisa atributlari va
 * javascript:/data: havolalar olib tashlanadi; matn rangi va foni ham (qorong'i temada o'qilsin);
 * {{token}} — maydon nomi bilan belgilangan yorliq. Faqat brauzerda (DOMParser — skriptlar ishlamaydi,
 * rasmlar yuklanmaydi).
 */
function contractTplPreviewHtml(html: string, labels: Record<string, string>): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";
  root.querySelectorAll("script,style,iframe,frame,frameset,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,template").forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      const value = a.value.replace(/\s+/g, "").toLowerCase();
      const badUrl =
        ((name === "href" || name === "action" || name === "formaction" || name === "xlink:href") && /^(javascript|vbscript|data):/.test(value)) ||
        (name === "src" && /^(javascript|vbscript):/.test(value)) ||
        (name === "src" && value.startsWith("data:") && !value.startsWith("data:image/"));
      if (name.startsWith("on") || name === "srcdoc" || name === "color" || name === "bgcolor" || badUrl) el.removeAttribute(a.name);
    }
    if (el.style) {
      el.style.removeProperty("color");
      el.style.removeProperty("background");
      el.style.removeProperty("background-color");
    }
    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  });
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const node of texts) {
    const s = node.data;
    const matches = Array.from(s.matchAll(CONTRACT_TPL_TOKEN_RE));
    if (!matches.length) continue;
    const frag = doc.createDocumentFragment();
    let last = 0;
    for (const m of matches) {
      const at = m.index ?? 0;
      frag.append(s.slice(last, at));
      const chip = doc.createElement("span");
      chip.className = CONTRACT_TPL_TOKEN_CLS;
      chip.title = `{{${m[1]}}}`;
      chip.textContent = labels[m[1]] ?? m[1];
      frag.append(chip);
      last = at + m[0].length;
    }
    frag.append(s.slice(last));
    node.replaceWith(frag);
  }
  return root.innerHTML;
}

export default function ContractTemplatesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();

  const [rows, setRows] = useState<Contract[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [preview, setPreview] = useState<Contract | null>(null);
  const [delTarget, setDelTarget] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setRows(d.contracts);
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

  const typeLabel = (type: string) => t(CONTRACT_TPL_TYPE_LABEL[type] ?? type);

  const all = useMemo(() => rows ?? [], [rows]);
  // Qidiruv — eski sahifadagi shart (sarlavha yoki tur qiymati) + tur nomi.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        t(CONTRACT_TPL_TYPE_LABEL[r.type] ?? r.type).toLowerCase().includes(q),
    );
  }, [all, search, t]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  async function confirmDelete() {
    if (!delTarget || deleting) return;
    const target = delTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setRows((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      showSuccess(t("Shartnoma o'chirildi"));
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
        title={t("Shartnoma andozalari")}
        subtitle={t("O'quvchi profilidagi «Shartnoma biriktirish» shu matnlardan tanlaydi — belgilangan maydonlar o'quvchi ma'lumoti bilan to'ldiriladi")}
        actions={
          <Link href="/contract/add" className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Shartnoma yaratish")}
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SummaryLine
          items={[
            <span key="n">
              {t("Umumiy soni:")} <B>{rows ? fmtNum(filtered.length) : "—"}</B>
            </span>,
          ]}
        />
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder={t("Qidirish")}
            width={260}
          />
        </div>
      </div>

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[760px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={TH}>{t("Sarlavha")}</th>
                <th className={`${TH} w-36`}>{t("Shartnoma turi")}</th>
                <th className={`${TH} w-28 text-right`}>{t("Maydonlar")}</th>
                <th className={`${TH} w-40`}>{t("Yaratilgan sana")}</th>
                <th className={`${TH} w-32 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows &&
                !failed &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-16 border-b border-v2-border" aria-hidden>
                    <td className={`${CONTRACT_TPL_TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={CONTRACT_TPL_TD}>
                      <div className="space-y-1.5">
                        <div className="h-3 w-48 rounded bg-v2-skeleton" />
                        <div className="h-2.5 w-72 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    <td className={CONTRACT_TPL_TD}><div className="h-5 w-16 rounded-v2-full bg-v2-skeleton" /></td>
                    <td className={CONTRACT_TPL_TD}><div className="ml-auto h-3 w-8 rounded bg-v2-skeleton" /></td>
                    <td className={CONTRACT_TPL_TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={`${CONTRACT_TPL_TD} pr-4`} />
                  </tr>
                ))}

              {(failed && !rows) || (rows && slice.length === 0) ? (
                <tr>
                  <td colSpan={CONTRACT_TPL_COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <FileSignature className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !rows ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : search.trim() ? (
                        <div className="text-v2-section text-v2-text">{t("Topilmadi")}</div>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Shartnoma topilmadi")}</div>
                          <p className="max-w-[28rem] text-v2-small text-v2-text-2">{t("Andoza bir marta yoziladi — o'quvchi ismi, telefoni kabi joylar har o'quvchida o'zi to'ldiriladi.")}</p>
                          <Link href="/contract/add" className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Shartnoma yaratish")}
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}

              {slice.map((c, i) => {
                const plain = contractTplPlain(c.content);
                const tokens = contractTplTokenCount(c.content);
                const d = contractTplDate(c.createdAt);
                return (
                  <tr key={c.id} className={`h-16 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${CONTRACT_TPL_TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${CONTRACT_TPL_TD} max-w-[420px]`}>
                      <button
                        type="button"
                        onClick={() => setPreview(c)}
                        title={t(c.title)}
                        className="block max-w-full truncate text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
                      >
                        {t(c.title)}
                      </button>
                      <span className={`block truncate text-v2-small ${plain ? "text-v2-text-3" : "italic text-v2-text-3"}`}>{plain || t("Matn yozilmagan")}</span>
                    </td>
                    <td className={`${CONTRACT_TPL_TD} whitespace-nowrap`}>
                      <Badge tone="info">{typeLabel(c.type)}</Badge>
                    </td>
                    <td className={`${CONTRACT_TPL_TD} whitespace-nowrap text-right tabular-nums ${tokens ? "text-v2-text" : "text-v2-text-3"}`}>
                      {tokens ? t("{n} ta", { n: tokens }) : "—"}
                    </td>
                    <td className={`${CONTRACT_TPL_TD} whitespace-nowrap tabular-nums text-v2-text-2`} title={c.createdAt}>
                      {d ? dayMonthLabel(d, lang) : c.createdAt || "—"}
                    </td>
                    <td className={`${CONTRACT_TPL_TD} pr-4`}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => setPreview(c)} title={t("Ko'rish")} aria-label={`${t(c.title)} — ${t("Ko'rish")}`} className={CONTRACT_TPL_ICON_BTN}>
                          <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                        <Link href={`/contract/${c.id}/edit`} title={t("Tahrirlash")} aria-label={`${t(c.title)} — ${t("Tahrirlash")}`} className={CONTRACT_TPL_ICON_BTN}>
                          <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDelTarget(c)}
                          title={t("O'chirish")}
                          aria-label={`${t(c.title)} — ${t("O'chirish")}`}
                          className={`${CONTRACT_TPL_ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {preview && <ContractTplPreviewDialog contract={preview} typeLabel={typeLabel(preview.type)} onClose={() => setPreview(null)} />}
      {delTarget && (
        <V2Confirm
          title={t("Shartnomani o'chirasizmi?")}
          body={t("«{n}» andozasi o'chiriladi va o'quvchi profilidagi «Shartnoma biriktirish» tanlovidan yo'qoladi.", { n: t(delTarget.title) })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Ko'rish oynasi (faqat ko'rish) ───────────────────────── */

function ContractTplPreviewDialog({ contract, typeLabel, onClose }: { contract: Contract; typeLabel: string; onClose: () => void }) {
  const { t } = useT();
  const [lang] = useLang();
  const labels = useMemo(
    () => Object.fromEntries((CONTRACT_TPL_FIELDS[contract.type] ?? []).map((f) => [f.token, t(f.label)])),
    [contract.type, t],
  );
  const html = useMemo(() => contractTplPreviewHtml(contract.content, labels), [contract.content, labels]);
  const tokens = contractTplTokenCount(contract.content);
  const d = contractTplDate(contract.createdAt);
  const subtitle = [typeLabel, d ? dayMonthLabel(d, lang) : contract.createdAt, tokens ? t("{n} ta maydon", { n: tokens }) : ""].filter(Boolean).join(" · ");

  return (
    <V2Dialog
      title={t(contract.title)}
      subtitle={subtitle}
      onClose={onClose}
      width={760}
      footerStart={
        tokens ? (
          <span className="inline-flex items-center gap-2 text-v2-caption text-v2-text-3">
            <span className={CONTRACT_TPL_TOKEN_CLS}>{t("Ism")}</span>
            {t("— o'quvchi ma'lumoti bilan to'ldiriladi")}
          </span>
        ) : (
          <span />
        )
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.close} className={secondaryBtn}>
            {t("Yopish")}
          </button>
          <Link href={`/contract/${contract.id}/edit`} className={primaryBtn}>
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Tahrirlash")}
          </Link>
        </>
      )}
    >
      {html.trim() && contractTplPlain(contract.content) ? (
        <div
          className="overflow-x-auto break-words rounded-v2-md border border-v2-border bg-v2-surface p-4 text-v2-body sm:p-5 leading-6 text-v2-text shadow-v2-sm [&_a]:text-v2-brand-text [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-v2-border-strong [&_blockquote]:pl-3 [&_h1]:mb-3 [&_h1]:text-[20px] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-3 [&_hr]:border-v2-border [&_img]:max-w-full [&_li]:mb-1 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-v2-border [&_td]:p-1.5 [&_th]:border [&_th]:border-v2-border [&_th]:bg-v2-surface-2 [&_th]:p-1.5 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
          // Xavfli teg va atributlar contractTplPreviewHtml da olib tashlangan.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
          <FileSignature className="size-5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <div className="text-v2-section text-v2-text">{t("Matn yozilmagan")}</div>
          <Link href={`/contract/${contract.id}/edit`} className={`${secondaryBtn} mt-1`}>
            {t("Tahrirlash")}
          </Link>
        </div>
      )}
    </V2Dialog>
  );
}
