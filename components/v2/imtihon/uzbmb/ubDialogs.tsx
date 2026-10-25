"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, FileUp, Loader2, Trash2, UserPlus } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT, type TFn } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Confirm from "@/components/v2/form/V2Confirm";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import { Field, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { intOf, normHeader, readFileRows } from "@/components/imtihon/importUtils";
import { uzDateIso } from "@/lib/uzTime";
import { EMPTY_CELLS, defaultTestName, r1, schemeMax, type UbCells, type UbScheme, type UbTest, type UbTestRow } from "@/lib/uzbmb";
import { dateToIso, fmtNum, isoToDate, type Dir, type SheetRow } from "./ubCore";

// YANGI VERSIYA — UZBMB OYNALARI (12-qism, 25.10.2026): test yaratish / tahrirlash (o'chirish — faqat
// natijasiz), o'quvchini varaqqa qo'shish (qidiruv; yangi o'quvchi — «Yangi o'quvchi» oynasi) va
// Excel'dan yuklash (natija JADVALGA qo'yiladi, saqlash — «Natijalarni saqlash» bilan).

const dangerText =
  "inline-flex h-9 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-danger hover:bg-v2-danger-bg focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/* ── Test ───────────────────────────────────────────────────────────────── */

export function UbTestDialog({
  test,
  nextNo,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** Tahrirlash; `null` — yangi test. */
  test: UbTestRow | null;
  /** Yangi testning raqami (nom sukuti «UzBMB sinov testi №N»). */
  nextNo: number;
  onClose: () => void;
  onSaved: (t: UbTest) => void;
  onDeleted?: (id: number) => void;
}) {
  const { t } = useT();
  const { showSuccess } = useToast();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(test?.name ?? "");
  const [date, setDate] = useState<Date | null>(isoToDate(test?.date ?? uzDateIso()));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const dirty = test ? name.trim() !== test.name || (date ? dateToIso(date) : "") !== test.date : Boolean(name.trim());

  async function submit() {
    if (!date) return setErr(t("Test sanasini tanlang"));
    if (test && !name.trim()) return setErr(t("Test nomini kiriting"));
    setSaving(true);
    try {
      const res = await fetch(test ? `/api/imtihon/uzbmb/tests/${test.id}` : "/api/imtihon/uzbmb/tests", {
        method: test ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, date: dateToIso(date) }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErr(t(d.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(d.test as UbTest);
      showSuccess(test ? t("Test saqlandi") : t("«{name}» yaratildi", { name: (d.test as UbTest).name }));
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  async function remove() {
    if (!test) return;
    setAskDelete(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/imtihon/uzbmb/tests/${test.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) {
        setErr(t(d.error || "O'chirilmadi"));
        setSaving(false);
        return;
      }
      onDeleted?.(test.id);
      showSuccess(t("«{name}» o'chirildi", { name: test.name }));
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <>
      <V2Dialog
        title={test ? t("Testni tahrirlash") : t("Yangi test")}
        subtitle={test ? t("№{no} · ball tuzilishi test yaratilganda belgilangan", { no: test.no }) : t("Ball tuzilishi hozirgi sozlamadan olinadi")}
        onClose={onClose}
        controller={modal}
        dirty={dirty}
        saving={saving}
        onSubmit={() => void submit()}
        width={460}
        footerStart={
          test ? (
            <button
              type="button"
              onClick={() => setAskDelete(true)}
              disabled={saving || test.resultCount > 0}
              title={test.resultCount > 0 ? t("Natijasi bor test o'chirilmaydi") : undefined}
              className={dangerText}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Testni o'chirish")}
            </button>
          ) : undefined
        }
        footer={(api) => (
          <>
            <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
              {t("Bekor qilish")}
            </button>
            <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
              {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
              {test ? t("Saqlash") : t("Testni yaratish")}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label={t("Nomi")} htmlFor="ub-test-name" optional={!test} error={err || undefined}>
            <TextInput
              id="ub-test-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (err) setErr("");
              }}
              maxLength={80}
              placeholder={test ? undefined : defaultTestName(nextNo)}
              autoComplete="off"
            />
          </Field>
          <Field label={t("Sana")}>
            <V2DateField
              value={date}
              onChange={(d) => {
                setDate(d);
                if (err) setErr("");
              }}
            />
          </Field>
        </div>
      </V2Dialog>
      {askDelete && test && (
        <V2Confirm
          title={t("Testni o'chirasizmi?")}
          body={t("«{name}» butunlay o'chiriladi.", { name: test.name })}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setAskDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

/* ── O'quvchi qo'shish ──────────────────────────────────────────────────── */

export function UbAddPupilDialog({
  existing,
  onClose,
  onPick,
  onNewPupil,
}: {
  /** Varaqdagi o'quvchilar — qayta qo'shilmaydi. */
  existing: Set<number>;
  onClose: () => void;
  onPick: (p: { id: number; name: string }) => void;
  /** «Yangi o'quvchi» oynasi (guruhga ham qo'shiladi). */
  onNewPupil: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [err, setErr] = useState("");
  return (
    <V2Dialog
      title={t("O'quvchi qo'shish")}
      subtitle={t("Faqat shu testga — guruh tarkibi o'zgarmaydi")}
      onClose={onClose}
      controller={modal}
      width={480}
      footerStart={
        <button
          type="button"
          onClick={() => {
            modal.close();
            onNewPupil();
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg focus-visible:outline-none focus-visible:shadow-v2-focus"
        >
          <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yangi o'quvchi")}
        </button>
      }
      footer={(api) => (
        <button type="button" onClick={api.requestClose} className={secondaryBtn}>
          {t("Yopish")}
        </button>
      )}
    >
      <Field label={t("O'quvchi")} error={err || undefined} hint={t("Boshqa guruhdan yoki testga tashqaridan kelgan o'quvchi — natijasi shu guruh varag'ida saqlanadi.")}>
        <StudentSearchField
          autoFocus
          invalid={Boolean(err)}
          onPick={(s) => {
            if (existing.has(s.id)) {
              setErr(t("{name} jadvalda bor", { name: s.name }));
              return;
            }
            onPick({ id: s.id, name: s.name });
            modal.close();
          }}
        />
      </Field>
    </V2Dialog>
  );
}

/* ── Excel'dan yuklash ──────────────────────────────────────────────────── */

const normName = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`'"]/g, "").replace(/\s+/g, " ").trim();

interface ImportResult {
  cells: Record<number, UbCells>;
  matched: number;
  missing: string[];
  errors: string[];
}

/** Ustunlar sarlavha bo'yicha (shablondagi nomlar yoki fan nomi); ism — guruh varag'idagilarga. */
function parseImport(table: string[][], rows: SheetRow[], scheme: UbScheme, dir: Dir, t: TFn): ImportResult | { error: string } {
  const max = schemeMax(scheme);
  let head = -1;
  let h: string[] = [];
  for (let i = 0; i < Math.min(table.length, 8); i++) {
    const cand = table[i].map(normHeader);
    if (cand.some((x) => /oquvchi|ism|fio|familiya|name|student/.test(x))) {
      head = i;
      h = cand;
      break;
    }
  }
  if (head < 0) return { error: "Faylda «O'quvchi» ustuni topilmadi — shablondan foydalaning" };
  const find = (test: (x: string) => boolean) => h.findIndex(test);
  const nameCol = find((x) => /oquvchi|ism|fio|familiya|name|student/.test(x));
  let b1 = find((x) => x.includes("1blok") && !x.includes("sert"));
  let b2 = find((x) => x.includes("2blok") && !x.includes("sert"));
  const b1m = find((x) => x.includes("1blok") && x.includes("sert"));
  const b2m = find((x) => x.includes("2blok") && x.includes("sert"));
  const m1 = find((x) => x.includes("onatili") && !x.includes("blok") && !x.includes("adabiyot"));
  const m2 = find((x) => x.includes("matematika") && !x.includes("blok"));
  const m3 = find((x) => x.includes("tarix") && !x.includes("blok"));
  if (b1 < 0 && dir.b1s) b1 = find((x) => x === normHeader(dir.b1s));
  if (b2 < 0 && dir.b2s) b2 = find((x) => x === normHeader(dir.b2s));
  if (b1 < 0 && b2 < 0 && m1 < 0 && m2 < 0 && m3 < 0) return { error: "Faylda natija ustunlari topilmadi — shablondan foydalaning" };

  const byName = new Map<string, number>();
  for (const r of rows) {
    byName.set(normName(r.name), r.pupilId);
    byName.set(normName(r.name.split(/\s+/).reverse().join(" ")), r.pupilId);
  }
  const out: ImportResult = { cells: {}, matched: 0, missing: [], errors: [] };
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  for (let i = head + 1; i < table.length; i++) {
    const r = table[i];
    const name = cell(r, nameCol);
    if (!name) continue;
    const raw = { b1: cell(r, b1), b2: cell(r, b2), b1m: cell(r, b1m), b2m: cell(r, b2m), m1: cell(r, m1), m2: cell(r, m2), m3: cell(r, m3) };
    if (Object.values(raw).every((v) => v === "")) continue;
    const pupilId = byName.get(normName(name));
    if (pupilId === undefined) {
      out.missing.push(name);
      continue;
    }
    const count = (v: string, q: number, label: string): number | null | "bad" => {
      if (v === "") return null;
      const n = intOf(v);
      if (n > q) {
        out.errors.push(t("{name}: {label} — {q} dan oshmasin", { name, label: t(label), q }));
        return "bad";
      }
      return n;
    };
    const ball = (v: string, cap: number, label: string): number | null | "bad" => {
      if (v === "") return null;
      const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n > cap) {
        out.errors.push(t("{name}: {label} — {cap} balldan oshmasin", { name, label: t(label), cap }));
        return "bad";
      }
      return r1(n);
    };
    const c1m = ball(raw.b1m, max.b1, "1-blok sertifikati");
    const c2m = ball(raw.b2m, max.b2, "2-blok sertifikati");
    const c1 = c1m === null ? count(raw.b1, scheme.b1.q, "1-blok") : null;
    const c2 = c2m === null ? count(raw.b2, scheme.b2.q, "2-blok") : null;
    const cm = [count(raw.m1, scheme.maj.q, "Ona tili"), count(raw.m2, scheme.maj.q, "Matematika"), count(raw.m3, scheme.maj.q, "Tarix")];
    if ([c1m, c2m, c1, c2, ...cm].includes("bad")) continue;
    const num = (v: number | null | "bad") => (v === "bad" ? null : v);
    out.cells[pupilId] = {
      ...EMPTY_CELLS,
      b1cert: c1m !== null,
      b1m: num(c1m),
      b1c: num(c1),
      b2cert: c2m !== null,
      b2m: num(c2m),
      b2c: num(c2),
      m1: num(cm[0]),
      m2: num(cm[1]),
      m3: num(cm[2]),
    };
    out.matched += 1;
  }
  return out;
}

export function UbImportDialog({
  title,
  scheme,
  dir,
  rows,
  onClose,
  onApply,
}: {
  /** «UzBMB sinov testi №3 · Biologiya · 9-11-sinflar · 12». */
  title: string;
  scheme: UbScheme;
  dir: Dir;
  rows: SheetRow[];
  onClose: () => void;
  onApply: (cells: Record<number, UbCells>) => void;
}) {
  const { t, lang } = useT();
  const modal = useModalClose(onClose, "center");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");

  async function readFile(f: File) {
    setBusy(true);
    setErr("");
    setRes(null);
    setFileName(f.name);
    try {
      const table = await readFileRows(f);
      const out = parseImport(table, rows, scheme, dir, t);
      if ("error" in out) setErr(t(out.error));
      else if (!out.matched && !out.errors.length) setErr(t("Fayldagi ismlar guruh o'quvchilariga mos kelmadi"));
      else setRes(out);
    } catch (e) {
      setErr(t(e instanceof Error ? e.message : "Fayl o'qilmadi"));
    }
    setBusy(false);
  }

  async function template() {
    const XLSX = await import("xlsx");
    const head = [
      "№",
      t("O'quvchi"),
      `${t("1-blok")} (${dir.b1s || "—"}) — ${t("to'g'ri")} / ${scheme.b1.q}`,
      `${t("1-blok")} ${t("sertifikat")} (${t("ball")})`,
      `${t("2-blok")} (${dir.b2s || "—"}) — ${t("to'g'ri")} / ${scheme.b2.q}`,
      `${t("2-blok")} ${t("sertifikat")} (${t("ball")})`,
      `${t("Ona tili")} / ${scheme.maj.q}`,
      `${t("Matematika")} / ${scheme.maj.q}`,
      `${t("Tarix")} / ${scheme.maj.q}`,
    ];
    const aoa = [head, ...rows.map((r, i) => [i + 1, r.name, "", "", "", "", "", "", ""])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 4 }, { wch: 28 }, { wch: 26 }, { wch: 20 }, { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UzBMB");
    XLSX.writeFile(wb, `UzBMB_shablon_${fmtNum(schemeMax(scheme).total, lang)}.xlsx`);
  }

  const ok = res ? res.matched : 0;
  return (
    <V2Dialog
      title={t("Excel'dan yuklash")}
      subtitle={title}
      onClose={onClose}
      controller={modal}
      dirty={Boolean(res)}
      width={540}
      onSubmit={() => {
        if (res && ok) {
          onApply(res.cells);
          modal.close();
        }
      }}
      footerStart={
        <button type="button" onClick={() => void template()} className="inline-flex h-9 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg focus-visible:outline-none focus-visible:shadow-v2-focus">
          <FileSpreadsheet className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Shablon (.xlsx)")}
        </button>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              if (!res) return;
              onApply(res.cells);
              modal.close();
            }}
            className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {t("Jadvalga qo'yish")}
          </button>
        </>
      )}
    >
      <p className="text-v2-small text-v2-text-2">
        {t("Shablonda guruh o'quvchilari ro'yxati bor — har biriga to'g'ri javoblar sonini yozing. Sertifikati bor fanda ballni «sertifikat» ustuniga yozing. Natija avval jadvalga qo'yiladi — tekshirib, «Natijalarni saqlash» bosiladi.")}
      </p>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-v2-lg border border-dashed border-v2-border-strong bg-v2-surface-2 px-4 py-6 text-center transition-colors hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus"
      >
        {busy ? <Loader2 className="size-6 animate-spin text-v2-text-3" aria-hidden /> : <FileUp className="size-6 text-v2-text-3" strokeWidth={1.5} aria-hidden />}
        <span className="text-v2-small font-semibold text-v2-text">{fileName || t("Faylni tanlang")}</span>
        <span className="text-v2-caption font-normal text-v2-text-3">{t(".xlsx, .xls yoki .csv")}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv"
        className="hidden"
        aria-label={t("Excel'dan yuklash")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void readFile(f);
        }}
      />
      {err && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2.5 text-v2-small text-v2-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />
          {err}
        </div>
      )}
      {res && (
        <div className="mt-3 space-y-1.5 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2.5 text-v2-small">
          <div className={`font-semibold ${ok ? "text-v2-success" : "text-v2-danger"}`}>
            {ok ? t("{n} ta o'quvchining natijasi o'qildi", { n: ok }) : t("Yaroqli qator topilmadi")}
          </div>
          {res.missing.length > 0 && (
            <div className="text-v2-text-2">
              {t("Guruhda topilmadi: {names}", { names: res.missing.slice(0, 4).join(", ") + (res.missing.length > 4 ? ` … +${res.missing.length - 4}` : "") })}
            </div>
          )}
          {res.errors.slice(0, 4).map((e) => (
            <div key={e} className="text-v2-danger">
              {e}
            </div>
          ))}
        </div>
      )}
    </V2Dialog>
  );
}
