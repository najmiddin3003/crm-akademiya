"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import { Switch } from "@/components/v2/settings/financeKit";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, TH } from "@/components/v2/students/lists/listKit";
import { BOT_NOTE_DEFAULTS, BOT_NOTE_TYPES } from "@/constants/settingsBotNotes";

// YANGI VERSIYA — AVTOMATIK XABARLAR → «DARS ESLATMALARI» (41-qism, rasmlar «Avtomatik xabarlar · dars eslatmalari»,
// «Dars eslatmalari (ota-ona, bot) · Telefon»). Shablonlar: dars boshlanishidan oldin / davomida / tugagach N
// daqiqada, matn va o'zgaruvchilar, ota-ona ko'rinishi, «Faol». Saqlash — eski «Bot eslatmalari» tabi bilan bir
// hujjat (`settings` «sale-marketing.bot-notes», /api/settings). YUBORUVCHI HALI YO'Q — xabar ketmaydi (SAVOLLAR 535).

interface Tpl {
  id: string;
  name: string;
  type: string;
  minutes: number;
  text: string;
  active: boolean;
}
const KEY = "sale-marketing.bot-notes";
const TYPES = BOT_NOTE_TYPES as string[];
const WHEN = [
  { value: TYPES[0], label: "Darsdan oldin", short: "oldin" },
  { value: TYPES[1], label: "Dars davomida", short: "davomida" },
  { value: TYPES[2], label: "Darsdan keyin", short: "keyin" },
];
const VARS = ["kurs", "subkurs", "guruh", "ustoz", "kunlar", "soat", "filial"];
const SAMPLE: Record<string, string> = { kurs: "Ingliz tili", subkurs: "2-bosqich", guruh: "Ingliz tili (201-guruh)", ustoz: "Nilufar Hamdamova", kunlar: "dush, chor, juma", soat: "16:00–18:00", filial: "Akademiya 1 Chortoq" };
const DEFAULT_TEXT: Record<string, string> = {
  [TYPES[0]]: "*Dars eslatmasi*\n{kurs} · {subkurs}\nBugun {soat}, {filial}\nUstoz: {ustoz}\nKechikmang!",
  [TYPES[1]]: "*Dars davom etmoqda*\n{kurs} · {subkurs}\nDars {soat}, {filial}",
  [TYPES[2]]: "*Dars tugadi*\n{kurs} · {subkurs}\nKeyingi dars: {kunlar}",
};
let seq = 0;
const newId = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `bn-${++seq}-${Math.random().toString(36).slice(2, 8)}`);

function render(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE[k] ?? `{${k}}`).replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
}
const whenOf = (type: string) => WHEN.find((w) => w.value === type) ?? WHEN[0];

export default function LessonRemindersV2({ onCount }: { onCount?: (n: number) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [list, setList] = useState<Tpl[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [del, setDel] = useState<Tpl | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/settings?key=${encodeURIComponent(KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        const saved = (d?.values?.templates ?? null) as Tpl[] | null;
        const l = Array.isArray(saved) ? saved : (BOT_NOTE_DEFAULTS as { templates: Tpl[] }).templates;
        setList(l.map((x) => ({ ...x, text: x.text || DEFAULT_TEXT[x.type] || "" })));
        onCount?.(l.length);
      })
      .catch(() => !off && setList([]));
    return () => {
      off = true;
    };
  }, [onCount]);

  async function persist(next: Tpl[], msg = "Saqlandi") {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: KEY, values: { templates: next } }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) {
      showError(t(r?.error || "Saqlab bo'lmadi"));
      return false;
    }
    setList(next);
    onCount?.(next.length);
    showSuccess(t(msg));
    return true;
  }

  if (!list)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const cur = list.find((x) => x.id === sel) ?? list[0] ?? null;
  const add = async () => {
    const x: Tpl = { id: newId(), name: t("Oldin — 10 daqiqa"), type: TYPES[0], minutes: 10, text: DEFAULT_TEXT[TYPES[0]], active: false };
    if (await persist([...list, x], "Qo'shildi")) setSel(x.id);
  };
  const before = list.find((x) => x.type === TYPES[0] && x.active);
  const after = list.find((x) => x.type === TYPES[2] && x.active);

  return (
    <div className="space-y-3">
      <NoticeBar>{t("Dars eslatmalarini yuboruvchi hali ulanmagan — shablonlar saqlanadi, lekin botdan xabar ketmaydi. Yoqish rahbar qarori bilan.")}</NoticeBar>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="font-semibold text-v2-text">{t("Dars eslatmalari")}</h2>
            <button type="button" onClick={() => void add()} className={secondaryBtn}>
              <Plus className="size-4" aria-hidden /> {t("Shablon qo'shish")}
            </button>
          </div>
          <div className="overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[560px] border-collapse text-v2-body">
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-4`}>{t("Shablon")}</th>
                  <th className={TH}>{t("Kimga")}</th>
                  <th className={TH}>{t("Kanal")}</th>
                  <th className={`${TH} pr-4`}>{t("Holat")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} onClick={() => setSel(x.id)} className={`cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover ${cur?.id === x.id ? "bg-v2-brand-bg" : ""}`}>
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${x.active ? "bg-v2-success" : "bg-v2-border-strong"}`} aria-hidden />
                        <span className="font-semibold text-v2-text">{x.name}</span>
                      </div>
                      <div className="pl-4 text-v2-small text-v2-text-2">{t("{n} daqiqa · {w}", { n: x.minutes, w: t(whenOf(x.type).label).toLowerCase() })}</div>
                    </td>
                    <td className="px-3 py-2.5 text-v2-small text-v2-text">{t("o'quvchi va ota-ona")}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-small font-semibold text-v2-info">Telegram</span>
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-v2-small text-v2-text-3">{x.active ? t("faol · yuborilmaydi") : t("o'chiq")}</td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-v2-small text-v2-text-3">{t("Shablon yo'q")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-v2-border bg-v2-surface-2 px-4 py-3">
            <div className="flex flex-wrap justify-between gap-2 text-v2-small">
              <span className="font-semibold text-v2-text">{t("Bir dars misolida")}</span>
              <span className="text-v2-text-2">{t("Ingliz tili · dushanba 16:00–18:00")}</span>
            </div>
            <div className="relative mx-6 mb-6 mt-8 h-3 rounded-full border border-v2-brand/40 bg-v2-brand-bg">
              {[
                { pos: 0, label: t("oldin"), time: before ? `-${before.minutes}′` : "—", on: !!before },
                { pos: 50, label: t("davomida"), time: "17:00", on: list.some((x) => x.type === TYPES[1] && x.active) },
                { pos: 100, label: t("keyin"), time: after ? `+${after.minutes}′` : "—", on: !!after },
              ].map((m) => (
                <span key={m.label} className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${m.pos}%` }}>
                  <span className={`text-v2-caption font-semibold tabular-nums ${m.on ? "text-v2-brand" : "text-v2-text-3"}`}>{m.time}</span>
                  <span className={`h-8 w-0.5 ${m.on ? "bg-v2-brand" : "bg-v2-border-strong"}`} />
                  <span className="text-v2-caption text-v2-text-2">{m.label}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
        {cur ? <Editor key={cur.id + cur.text + cur.active + cur.minutes + cur.type} tpl={cur} onSave={(x) => persist(list.map((y) => (y.id === x.id ? x : y)))} onDelete={() => setDel(cur)} /> : <div />}
      </div>
      {del && (
        <V2Confirm
          title={t("Shablonni o'chirasizmi?")}
          body={t("«{n}» o'chiriladi.", { n: del.name })}
          confirmLabel={t("O'chirish")}
          onConfirm={() => {
            const d = del;
            setDel(null);
            void persist(
              list.filter((x) => x.id !== d.id),
              "O'chirildi",
            );
          }}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}

function Editor({ tpl, onSave, onDelete }: { tpl: Tpl; onSave: (x: Tpl) => Promise<boolean>; onDelete: () => void }) {
  const { t } = useT();
  const [x, setX] = useState(tpl);
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const dirty = JSON.stringify(x) !== JSON.stringify(tpl);
  function insert(v: string) {
    const el = ta.current;
    const tok = `{${v}}`;
    if (!el) return setX({ ...x, text: x.text + tok });
    const a = el.selectionStart ?? x.text.length;
    const b = el.selectionEnd ?? a;
    setX({ ...x, text: x.text.slice(0, a) + tok + x.text.slice(b) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + tok.length, a + tok.length);
    });
  }
  const w = whenOf(x.type);
  return (
    <aside className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div>
          <h2 className="text-[17px] font-semibold text-v2-text">{x.name || t("Shablon")}</h2>
          <p className="text-v2-small text-v2-text-2">{t("o'quvchi va ota-onaga · Telegram bot")}</p>
        </div>
        {dirty && <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("Saqlanmagan")}</span>}
      </div>
      <div className="space-y-3 p-4 pt-2">
        <div>
          <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Qachon yuboriladi")}</div>
          <Segmented label={t("Qachon yuboriladi")} value={x.type} onChange={(v) => setX({ ...x, type: v })} options={WHEN.map((o) => ({ value: o.value, label: t(o.label) }))} />
          <div className="mt-2 flex items-center gap-2 text-v2-small text-v2-text-2">
            <span className="w-20">
              <TextInput inputMode="numeric" value={String(x.minutes)} onChange={(e) => setX({ ...x, minutes: Math.min(600, Number(e.target.value.replace(/\D/g, "")) || 0) })} aria-label={t("daqiqa")} />
            </span>
            {w.short === "oldin" ? t("daqiqa — dars boshlanishidan oldin") : w.short === "keyin" ? t("daqiqa — dars tugagach") : t("daqiqa — dars boshlangach")}
          </div>
        </div>
        <label className="block text-v2-small font-semibold text-v2-text">
          {t("Shablon nomi")}
          <TextInput className="mt-1.5" value={x.name} maxLength={60} onChange={(e) => setX({ ...x, name: e.target.value })} />
        </label>
        <div>
          <label htmlFor="ln-text" className="mb-1.5 block text-v2-small font-semibold text-v2-text">
            {t("Matn")}
          </label>
          <textarea id="ln-text" ref={ta} value={x.text} onChange={(e) => setX({ ...x, text: e.target.value })} rows={6} maxLength={1000} className={fieldCls("default", "h-auto py-2 font-mono text-[13px] leading-5")} />
          <div className="mt-1.5 text-v2-small text-v2-text-2">{t("O'zgaruvchi qo'shish — bosing")}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VARS.map((v) => (
              <button key={v} type="button" onClick={() => insert(v)} className="rounded-v2-sm border border-v2-border bg-v2-surface px-2 py-0.5 font-mono text-[12px] text-v2-text hover:bg-v2-hover">{`{${v}}`}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("O'quvchi shunday ko'radi")}</div>
          <div className="rounded-v2-md bg-v2-surface-2 p-3">
            <div className="max-w-[300px] rounded-v2-md bg-v2-surface p-3 text-v2-small leading-5 text-v2-text shadow-v2-sm">
              <div className="whitespace-pre-line [&_b]:font-semibold" dangerouslySetInnerHTML={{ __html: render(x.text) }} />
              <div className="mt-1 text-right text-v2-caption text-v2-text-3">{t("Tizimli bot")}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Har guruhning har darsi uchun alohida ketadi. Bot ulanmagan o'quvchiga eslatma bormaydi — SMS bilan almashtirilmaydi.")}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-v2-border p-4">
        <button type="button" onClick={onDelete} aria-label={t("O'chirish")} className="mr-auto flex size-9 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2">
          <Trash2 className="size-4" aria-hidden />
        </button>
        <span className="text-v2-small text-v2-text-2">{t("Faol")}</span>
        <Switch on={x.active} label={t("Faol")} onChange={(v) => setX({ ...x, active: v })} />
        <button
          type="button"
          disabled={!dirty || saving || !x.name.trim()}
          onClick={async () => {
            setSaving(true);
            await onSave({ ...x, name: x.name.trim() });
            setSaving(false);
          }}
          className={`${primaryBtn} disabled:opacity-50`}
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("Saqlash")}
        </button>
      </div>
    </aside>
  );
}
