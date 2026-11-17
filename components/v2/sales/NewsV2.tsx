"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, MoreHorizontal, Plus, Send, Trash2, X } from "lucide-react";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2TimeField from "@/components/v2/form/V2TimeField";
import { Field, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SegmentPills, TH } from "@/components/v2/students/lists/listKit";
import { useBranchOptions, useReportData } from "@/components/v2/reports/reportHooks";
import { NEWS_ICONS, type NewsIcon, type NewsRow, type NewsState, type NewsType, type NewsWho } from "@/lib/cabinetNewsTypes";
import { NEWS_ICON_VIEW } from "./newsIcons";

// YANGI VERSIYA — SOTUV VA MARKETING → «YANGILIKLAR VA HIKOYALAR» (36-qism, rasmlar «Yangiliklar», «Yangilik
// qo'shish»). Eski «Yangiliklar» va «Hikoya» sahifalari bitta joyda: tepada 24 soatlik hikoyalar, pastda yangiliklar
// jadvali (Kimga, Ko'rdi / jami, Vaqti, Holat). Qo'shish oynasi — rasm, sarlavha, matn, kimga (hammaga / filial /
// kurs / guruh, faqat ota-onalar / o'quvchilar), qachon, Telegram; o'ngda kabinetdagi ko'rinishi.
// Server: /api/cabinet-news (lib/cabinetNews.ts).

type Data = { ok: true; rows: NewsRow[]; groups: { id: number; name: string; course: string }[]; courses: string[] };
type Tab = "all" | "published" | "scheduled" | "draft";

const STATE: Record<NewsState, { label: string; cls: string }> = {
  published: { label: "E'lon qilingan", cls: "bg-v2-success-bg text-v2-success" },
  scheduled: { label: "Rejalashtirilgan", cls: "bg-v2-info-bg text-v2-info" },
  draft: { label: "Qoralama", cls: "bg-v2-surface-2 text-v2-text-2" },
  expired: { label: "Tugagan", cls: "bg-v2-surface-2 text-v2-text-3" },
};

const uzParts = (iso: string) => {
  const d = new Date(Date.parse(iso) + 5 * 3600_000).toISOString();
  return { day: d.slice(0, 10), hm: d.slice(11, 16) };
};

export default function NewsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const branchOptions = useBranchOptions();
  const [tab, setTab] = useState<Tab>("all");
  const [who, setWho] = useState("");
  const [branch, setBranch] = useState("");
  const [edit, setEdit] = useState<{ type: NewsType; row: NewsRow | null } | null>(null);
  const { data: d, error, reload } = useReportData<Data>(`/api/cabinet-news${branch ? `?branch=${branch}` : ""}`);
  const { showSuccess, showError } = useToast();

  const news = (d?.rows ?? []).filter((r) => r.type === "news");
  const stories = (d?.rows ?? []).filter((r) => r.type === "story" && (r.state === "published" || r.state === "scheduled"));
  const count = (s: Tab) => (s === "all" ? news.length : news.filter((r) => r.state === s).length);
  const rows = news.filter((r) => (tab === "all" || r.state === tab) && (!who || r.audience.scope === who));
  const when = (iso: string) => {
    const p = uzParts(iso);
    return `${fmt.dayMonth(p.day)} | ${p.hm}`;
  };
  const hoursLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) + 24 * 3600_000 - Date.parse(new Date().toISOString())) / 3600_000));

  async function remove(r: NewsRow) {
    const res = await fetch("/api/cabinet-news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, delete: true }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!res?.ok) return showError(t(res?.error || "O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Yangiliklar va hikoyalar")}
        subtitle={t("O'quvchi va ota-ona kabinetidagi yangiliklar lentasi va 24 soat ko'rinadigan hikoyalar")}
        actions={
          <>
            <button type="button" onClick={() => setEdit({ type: "story", row: null })} className={secondaryBtn}>
              <Plus className="size-4" aria-hidden /> {t("Hikoya qo'shish")}
            </button>
            <button type="button" onClick={() => setEdit({ type: "news", row: null })} className={primaryBtn}>
              <Plus className="size-4" aria-hidden /> {t("Yangilik qo'shish")}
            </button>
          </>
        }
      />
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && (
        <>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
              <h2 className="font-semibold text-v2-text">{t("Hikoyalar")}</h2>
              <span className="text-v2-small text-v2-text-2">{t("kabinet tepasida doira bo'lib chiqadi · 24 soatdan keyin o'zi yashirinadi")}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_96px]">
              {stories.map((s) => {
                const v = NEWS_ICON_VIEW[s.icon];
                return (
                  <button key={s.id} type="button" onClick={() => setEdit({ type: "story", row: s })} className="flex items-center gap-3 rounded-v2-md border border-v2-border p-3 text-left hover:bg-v2-hover">
                    <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 border-v2-brand p-0.5">
                      <span className={`flex size-full items-center justify-center rounded-full ${v.bg} ${v.tx}`}>
                        <v.Icon className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-semibold leading-snug text-v2-text">{s.title}</span>
                      <span className="text-v2-small text-v2-text-2">{s.state === "scheduled" ? t("{d} da chiqadi", { d: when(s.publishAt) }) : t("{v} ko'rdi · {h} soat qoldi", { v: s.views, h: hoursLeft(s.publishAt) })}</span>
                    </span>
                  </button>
                );
              })}
              <button type="button" onClick={() => setEdit({ type: "story", row: null })} className="flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-v2-md border border-dashed border-v2-border-strong text-v2-small text-v2-text-2 hover:bg-v2-hover">
                <Plus className="size-4" aria-hidden /> {t("Qo'shish")}
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="flex flex-wrap items-center gap-2 p-3">
              <SegmentPills<Tab>
                items={[
                  { key: "all", label: t("Hammasi"), count: count("all") },
                  { key: "published", label: t("E'lon qilingan"), count: count("published") },
                  { key: "scheduled", label: t("Rejalashtirilgan"), count: count("scheduled") },
                  { key: "draft", label: t("Qoralama"), count: count("draft") },
                ]}
                value={tab}
                onChange={setTab}
              />
              <div className="ml-auto flex flex-wrap gap-2">
                <V2Select
                  variant="chip"
                  label={t("Kimga")}
                  emptyLabel="Hammasi"
                  value={who}
                  onChange={setWho}
                  searchable={false}
                  options={[
                    { value: "all", label: t("Hammaga") },
                    { value: "branch", label: t("Filial") },
                    { value: "course", label: t("Kurs") },
                    { value: "group", label: t("Guruh") },
                  ]}
                />
                {branchOptions.length > 1 && <V2Select variant="chip" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />}
              </div>
            </div>
            <div className="overflow-x-auto border-t border-v2-border">
              <table className="w-full min-w-[860px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-4`}>{t("Yangilik")}</th>
                    <th className={TH}>{t("Kimga")}</th>
                    <th className={TH}>{t("Ko'rdi")}</th>
                    <th className={TH}>{t("Vaqti")}</th>
                    <th className={TH}>{t("Holat")}</th>
                    <th className={`${TH} w-12 pr-4`}>
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const v = NEWS_ICON_VIEW[r.icon];
                    const p = r.total ? Math.round((r.views / r.total) * 100) : 0;
                    return (
                      <tr key={r.id} className="border-b border-v2-border last:border-b-0 hover:bg-v2-hover">
                        <td className="max-w-[360px] py-2.5 pl-4 pr-3">
                          <button type="button" onClick={() => setEdit({ type: "news", row: r })} className="flex w-full items-center gap-3 text-left">
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${v.bg} ${v.tx}`}>
                              <v.Icon className="size-4" strokeWidth={1.75} aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-v2-text">{r.title}</span>
                              <span className="block truncate text-v2-small text-v2-text-2">{r.body || "—"}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-v2-text">{r.state === "draft" && r.audience.scope === "all" ? "—" : t(r.audienceLabel.main)}</div>
                          <div className="text-v2-small text-v2-text-2">{t(r.audienceLabel.sub)}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          {r.state === "published" || r.state === "expired" ? (
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-v2-surface-2">
                                <span className="block h-full rounded-full bg-v2-brand" style={{ width: `${Math.min(100, p)}%` }} />
                              </span>
                              <span className="tabular-nums text-v2-text">
                                {r.views} <span className="text-v2-text-2">/ {r.total}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-v2-text-3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-v2-text">{r.state === "draft" ? "—" : when(r.publishAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${STATE[r.state].cls}`}>{t(STATE[r.state].label)}</span>
                          {r.telegram && r.tgSent !== undefined && <div className="mt-0.5 text-v2-caption text-v2-text-3">{t("Telegram: {n} ta", { n: r.tgSent })}</div>}
                        </td>
                        <td className="py-2.5 pl-3 pr-4 text-right">
                          <ActionMenu
                            label={t("Amallar")}
                            items={[
                              { key: "edit", label: t("Tahrirlash"), onSelect: () => setEdit({ type: "news", row: r }) },
                              { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => void remove(r) },
                            ]}
                          >
                            {(trigger) => (
                              <button type="button" {...trigger} aria-label={t("Amallar")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover">
                                <MoreHorizontal className="size-4" aria-hidden />
                              </button>
                            )}
                          </ActionMenu>
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-v2-small text-v2-text-3">
                        {t("Yangilik yo'q")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">{t("Ko'rdi — kabinetni ochib yangilikni ko'rgan o'quvchi va ota-onalar · jami — tanlangan auditoriyadagi faol o'quvchilar")}</p>
          </section>
        </>
      )}
      {edit && d && <NewsDialog type={edit.type} row={edit.row} data={d} onClose={() => setEdit(null)} onDone={reload} />}
    </PageShell>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function NewsDialog({ type, row, data, onClose, onDone }: { type: NewsType; row: NewsRow | null; data: Data; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { branchId } = useBranch();
  const branchOptions = useBranchOptions();
  const story = type === "story";
  const init = row ? uzParts(row.publishAt) : null;
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [image, setImage] = useState(row?.image ?? "");
  const [icon, setIcon] = useState<NewsIcon>(row?.icon ?? (story ? "trophy" : "info"));
  const [scope, setScope] = useState<string>(row?.audience.scope ?? "all");
  const [aBranch, setABranch] = useState(String(row?.audience.branchId ?? branchId ?? ""));
  const [course, setCourse] = useState(row?.audience.course ?? "");
  const [group, setGroup] = useState(row?.audience.groupId ? String(row.audience.groupId) : "");
  const [whoV, setWhoV] = useState<NewsWho>(row?.audience.who ?? "all");
  const [now, setNow] = useState(!row || row.state === "draft" || row.state === "published");
  const [day, setDay] = useState<Date | null>(init ? new Date(`${init.day}T00:00:00`) : null);
  const [hm, setHm] = useState(init?.hm ?? "09:00");
  const [tg, setTg] = useState(row?.telegram ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const groupOpts = useMemo(() => data.groups.map((g) => ({ value: String(g.id), label: g.name, hint: g.course })), [data.groups]);

  async function upload(f: File) {
    if (f.size > 5 * 1024 * 1024) return showError(t("Rasm hajmi 5 MB dan oshmasin"));
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("folder", "news");
    const res = await fetch("/api/upload/image", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => null);
    setUploading(false);
    if (!res?.ok) return showError(t(res?.error || "Rasm yuklanmadi"));
    setImage(res.url);
  }

  async function save(draft: boolean, close: () => void) {
    if (!title.trim()) return setErr(t("Sarlavhani yozing"));
    let publishAt: string | undefined;
    if (!now && !draft) {
      if (!day) return showError(t("Sanani tanlang"));
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}T${hm || "09:00"}:00+05:00`;
      publishAt = new Date(iso).toISOString();
    }
    if (now && row && row.state === "published") publishAt = row.publishAt;
    setSaving(true);
    const res = await fetch("/api/cabinet-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(row ? { id: row.id } : {}),
        type,
        title,
        body,
        image,
        icon,
        draft,
        publishAt,
        telegram: tg,
        audience: { scope, who: whoV, branchId: Number(aBranch) || undefined, course, groupId: Number(group) || undefined },
      }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(draft ? t("Qoralama saqlandi") : now ? t("E'lon qilindi") : t("Rejalashtirildi"));
    close();
    onDone();
  }

  const v = NEWS_ICON_VIEW[icon];
  const previewWhen = now ? t("Bugun") : day ? fmt.dayMonth(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`) : "—";

  return (
    <V2Dialog
      title={row ? (story ? t("Hikoyani tahrirlash") : t("Yangilikni tahrirlash")) : story ? t("Hikoya qo'shish") : t("Yangilik qo'shish")}
      subtitle={story ? t("Kabinet tepasida 24 soat ko'rinadi") : t("O'quvchi va ota-ona kabinetidagi lentaga chiqadi")}
      onClose={onClose}
      saving={saving}
      width={960}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={`${secondaryBtn} mr-auto`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(true, api.close)} disabled={saving} className={secondaryBtn}>
            {t("Qoralama")}
          </button>
          <button type="button" onClick={() => void save(false, api.close)} disabled={saving || uploading} className={`${primaryBtn} disabled:opacity-50`}>
            <Send className="size-4" aria-hidden /> {now ? t("E'lon qilish") : t("Rejalashtirish")}
          </button>
        </>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Field label={t("Rasm")} optional>
            {image ? (
              <div className="relative overflow-hidden rounded-v2-md border border-v2-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary) */}
                <img src={image} alt="" className="aspect-[16/7] w-full object-cover" />
                <button type="button" onClick={() => setImage("")} aria-label={t("Rasmni olib tashlash")} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-5 text-v2-small text-v2-text-2 hover:bg-v2-hover">
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                {t("Rasmni tanlang · 16:9, 5 MB gacha")}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </Field>
          <Field label={t("Belgi")} hint={t("rasm bo'lmasa kabinetda shu belgi va rang chiqadi")}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Belgi")}>
              {NEWS_ICONS.map((k) => {
                const x = NEWS_ICON_VIEW[k];
                return (
                  <button key={k} type="button" role="radio" aria-checked={icon === k} aria-label={t(x.label)} title={t(x.label)} onClick={() => setIcon(k)} className={`flex size-9 items-center justify-center rounded-v2-md ${x.bg} ${x.tx} ${icon === k ? "ring-2 ring-v2-brand ring-offset-1 ring-offset-v2-surface" : ""}`}>
                    <x.Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("Sarlavha")} error={err}>
            <TextInput value={title} onChange={(e) => (setTitle(e.target.value), setErr(""))} maxLength={120} placeholder={story ? t("Masalan: Haftaning eng faol o'quvchisi") : t("Masalan: Ota-onalar majlisi · 24-oktabr | 17:00")} />
          </Field>
          <Field label={t("Matn")} optional={story}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} className={fieldCls("default", "h-auto min-h-[84px] py-2")} />
          </Field>
          <Field label={t("Kimga")}>
            <Segmented
              label={t("Kimga")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: t("Hammaga") },
                { value: "branch", label: t("Filial") },
                { value: "course", label: t("Kurs") },
                { value: "group", label: t("Guruh") },
              ]}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {scope === "branch" && <V2Select label={t("Filial")} value={aBranch} onChange={setABranch} options={branchOptions} searchable={false} />}
              {scope === "course" && <V2Select label={t("Kurs")} value={course} onChange={setCourse} options={data.courses.map((c) => ({ value: c, label: c }))} placeholder={t("Tanlang")} />}
              {scope === "group" && <V2Select label={t("Guruh")} value={group} onChange={setGroup} options={groupOpts} placeholder={t("Tanlang")} />}
              <V2Select
                label={t("Kim ko'radi")}
                value={whoV}
                onChange={(x) => setWhoV(x as NewsWho)}
                searchable={false}
                options={[
                  { value: "all", label: t("O'quvchi va ota-ona") },
                  { value: "students", label: t("Faqat o'quvchilar") },
                  { value: "parents", label: t("Faqat ota-onalar") },
                ]}
              />
            </div>
          </Field>
          <Field label={t("Qachon")}>
            <label className="mb-2 flex items-center gap-2 text-v2-small text-v2-text">
              <V2Checkbox checked={now} onChange={setNow} label={t("Hozir e'lon qilish")} />
              {t("Hozir e'lon qilish")}
            </label>
            {!now && (
              <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                <V2DateField value={day} onChange={setDay} />
                <V2TimeField value={hm} onChange={setHm} />
              </div>
            )}
          </Field>
          <div className="flex items-center gap-3 rounded-v2-md border border-v2-border px-3 py-2.5">
            <Switch on={tg} label={t("Telegram botga ham yuborish")} onChange={setTg} />
            <div>
              <div className="text-v2-small font-semibold text-v2-text">{t("Telegram botga ham yuborish")}</div>
              <div className="text-v2-caption text-v2-text-2">{t("botga ulangan o'quvchi va ota-onalarga, e'lon vaqtida bir marta")}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-v2-small text-v2-text-2">{t("Kabinetda shunday ko'rinadi")}</div>
          <div className="rounded-[28px] border border-v2-border bg-v2-bg p-3">
            {story ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <span className="flex size-[72px] items-center justify-center rounded-full border-[3px] border-v2-brand p-0.5">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
                    <img src={image} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <span className={`flex size-full items-center justify-center rounded-full ${v.bg} ${v.tx}`}>
                      <v.Icon className="size-6" strokeWidth={1.75} aria-hidden />
                    </span>
                  )}
                </span>
                <span className="max-w-[160px] text-center text-v2-caption text-v2-text-2">{title || t("Sarlavha")}</span>
              </div>
            ) : (
              <>
                <div className="mb-2 px-1 text-v2-small font-semibold text-v2-text-2">{t("Yangiliklar")}</div>
                <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
                    <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
                  ) : (
                    <div className={`flex h-20 items-end px-3 pb-2 ${v.bg}`}>
                      <span className={`text-v2-caption font-bold uppercase ${v.tx}`}>{t(v.label)}</span>
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-semibold text-v2-text">{title || t("Sarlavha")}</div>
                    {body && <p className="mt-1 line-clamp-3 text-v2-small text-v2-text-2">{body}</p>}
                    <div className="mt-2 text-v2-caption text-v2-text-3">{previewWhen}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </V2Dialog>
  );
}
