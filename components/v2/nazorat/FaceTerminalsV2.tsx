"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Link2, Loader2, Pencil, Plus, RefreshCw, ScanFace, Settings2, Unlink } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Confirm from "@/components/v2/form/V2Confirm";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { TH } from "@/components/v2/students/lists/listKit";
import type { HikOverview, PersonRef, TerminalView, UnknownPerson } from "@/lib/hikAdmin";
import FaceTerminalGuideV2, { type GuideTerminal } from "./FaceTerminalGuideV2";

// YUZ TERMINALLARI (Hikvision, 21.11.2026 — egasi: «HTTP listening yo'lini boshla»). Nazorat → Xodimlar
// davomati → «Belgilash usuli» ostida, FAQAT ADMIN. Terminal qo'shiladi (nom + filial) → terminal web
// sahifasiga yoziladigan manzil ko'rsatiladi; terminal tanigan, lekin CRM'da bog'lanmagan odamlar ro'yxati
// (terminaldagi ism aniq mos kelsa — bitta bosishda bog'lash). Server: /api/hik/terminals, /api/hik/persons
// (lib/hikAdmin.ts); voqealar — /api/hik/listen/<kalit> (lib/hikTerminal.ts).

type Dialog =
  | { kind: "terminal"; terminal: TerminalView | null }
  // Yo'riqnoma: id — qaysi terminal qiymatlari ko'rsatiladi (null — birinchisi); extra — hozirgina qo'shilgan
  // terminal (ro'yxat qayta yuklanguncha).
  | { kind: "setup"; id: number | null; extra: GuideTerminal | null }
  | { kind: "link"; employeeNo: string; deviceName: string | null }
  | { kind: "unlink"; employeeNo: string; name: string };

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

export default function FaceTerminalsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [d, setD] = useState<HikOverview | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busyNo, setBusyNo] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let off = false;
    const load = () => {
      setLoading(true);
      void fetch("/api/hik/terminals", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (off) return;
          if (j?.ok) {
            setD(j);
            setErr("");
          } else setErr(String(j?.error || "Ma'lumot olinmadi"));
        })
        .catch(() => !off && setErr("Tarmoq xatosi"))
        .finally(() => !off && setLoading(false));
    };
    load();
    // Terminal sozlanayotganda «Ulangan» o'zi chiqsin.
    const id = window.setInterval(load, 30_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, [ver]);

  const reload = () => setVer((v) => v + 1);
  // Oyna yopilish animatsiyasidan keyin chaqiriladi — shu orada boshqa oyna ochilgan bo'lsa (qo'shilgach yo'riqnoma), unga tegmaydi.
  const closeIf = (kind: Dialog["kind"]) => () => setDialog((cur) => (cur?.kind === kind ? null : cur));

  const when = (isoAt: string | null) => {
    if (!isoAt) return "";
    const local = new Date(isoAt);
    const day = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const hm = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    const today = new Date();
    const sameDay = local.toDateString() === today.toDateString();
    return sameDay ? hm : `${fmt.dayMonth(day)} ${hm}`;
  };

  async function quickLink(u: UnknownPerson, p: PersonRef) {
    setBusyNo(u.employeeNo);
    const res = await send("/api/hik/persons", "POST", { employeeNo: u.employeeNo, personType: p.personType, personId: p.personId });
    setBusyNo("");
    if (!res.ok) return showError(t(res.error || "Saqlab bo'lmadi"));
    linked(String(res.name ?? p.name), Number(res.replayed) || 0);
  }

  function linked(name: string, replayed: number) {
    showSuccess(replayed > 0 ? t("{name} bog'landi — {n} ta o'tish davomatga yozildi", { name, n: replayed }) : t("{name} bog'landi", { name }));
    reload();
  }

  async function unlink(employeeNo: string) {
    const res = await send(`/api/hik/persons?employeeNo=${encodeURIComponent(employeeNo)}`, "DELETE");
    if (!res.ok) return showError(t(res.error || "Saqlab bo'lmadi"));
    showSuccess(t("Bog'lanish uzildi"));
    reload();
  }

  const termState = (x: Pick<TerminalView, "active" | "lastSeenAt">): GuideTerminal["state"] => (!x.active ? "off" : x.lastSeenAt ? "on" : "wait");
  const guideTerminals = useMemo<GuideTerminal[]>(
    () => (d?.terminals ?? []).filter((x) => x.listenPath).map((x) => ({ id: x.id, name: x.name, ip: x.ip, listenPath: x.listenPath, state: termState(x) })),
    [d],
  );

  const linkedRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = d?.linked ?? [];
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.employeeNo.toLowerCase().includes(q)) : rows;
  }, [d, filter]);

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-v2-border p-5">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
            <ScanFace className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Yuz terminallari")}</h2>
            <p className="mt-0.5 max-w-2xl text-v2-small text-v2-text-2">
              {t("Hikvision terminali yuzni tanisa, xodim va o'quvchi davomati o'zi yoziladi. Terminal har bir o'tishni shu saytga yuboradi (HTTP listening).")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reload} className={secondaryIcon} aria-label={t("Yangilash")} title={t("Yangilash")}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" onClick={() => setDialog({ kind: "setup", id: null, extra: null })} className={secondaryBtn} disabled={!d}>
            <BookOpen className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Ulash yo'riqnomasi")}
          </button>
          <button type="button" onClick={() => setDialog({ kind: "terminal", terminal: null })} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Terminal qo'shish")}
          </button>
        </div>
      </div>

      {err && <p className="px-5 py-4 text-v2-small text-v2-danger">{t(err)}</p>}
      {!d && !err && (
        <div className="flex items-center gap-2 px-5 py-4 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {d && (
        <>
          {d.terminals.length === 0 ? (
            <p className="px-5 py-8 text-center text-v2-small text-v2-text-3">{t("Hali terminal qo'shilmagan")}</p>
          ) : (
            <ul className="divide-y divide-v2-border">
              {d.terminals.map((x) => {
                const state = termState(x);
                return (
                  <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                    <div className="min-w-[14rem] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-v2-text">{x.name}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-v2-caption font-semibold ${
                            state === "on" ? "bg-v2-success-bg text-v2-success" : state === "wait" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"
                          }`}
                        >
                          {state === "on" ? t("Ulangan") : state === "wait" ? t("Hali ulanmagan") : t("To'xtatilgan")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-v2-small text-v2-text-2">
                        {[
                          x.branchName || t("Filial biriktirilmagan"),
                          x.lastEventAt ? t("oxirgi o'tish {time}", { time: when(x.lastEventAt) }) : x.lastSeenAt ? t("oxirgi aloqa {time}", { time: when(x.lastSeenAt) }) : t("terminaldan hali xabar kelmagan"),
                          t("bugun {n} ta yozildi", { n: x.today }),
                          x.ip ? `IP ${x.ip}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {x.listenPath && (
                        <button type="button" onClick={() => setDialog({ kind: "setup", id: x.id, extra: null })} className={secondaryBtn}>
                          <Settings2 className="size-4" strokeWidth={1.75} aria-hidden />
                          {t("Sozlash yo'riqnomasi")}
                        </button>
                      )}
                      <button type="button" onClick={() => setDialog({ kind: "terminal", terminal: x })} className={secondaryIcon} aria-label={t("Tahrirlash")} title={t("Tahrirlash")}>
                        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {d.unknown.length > 0 && (
            <div className="border-t border-v2-border">
              <div className="px-5 pt-4">
                <h3 className="font-semibold text-v2-text">
                  {t("Bog'lanmagan odamlar")} <span className="text-v2-text-3">{d.unknown.length}</span>
                </h3>
                <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Terminal tanidi, lekin CRM'da kimligi bog'lanmagan. Bog'lasangiz, oxirgi 7 kundagi o'tishlari ham davomatga yoziladi.")}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="mt-3 w-full min-w-[680px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-y border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-5`}>{t("Terminal raqami")}</th>
                      <th className={TH}>{t("Terminaldagi ism")}</th>
                      <th className={`${TH} text-right`}>{t("O'tishlar")}</th>
                      <th className={TH}>{t("Oxirgisi")}</th>
                      <th className={`${TH} pr-5 text-right`} />
                    </tr>
                  </thead>
                  <tbody>
                    {d.unknown.map((u) => (
                      <tr key={u.employeeNo} className="border-b border-v2-border last:border-b-0">
                        <td className="py-3 pl-5 pr-3 font-semibold tabular-nums text-v2-text">{u.employeeNo}</td>
                        <td className="px-3 py-3 text-v2-text">{u.deviceName || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{u.count}</td>
                        <td className="px-3 py-3 tabular-nums text-v2-text-2">{when(u.lastAt)}</td>
                        <td className="py-3 pl-3 pr-5">
                          <div className="flex justify-end gap-2">
                            {u.suggestion && (
                              <button type="button" disabled={busyNo === u.employeeNo} onClick={() => void quickLink(u, u.suggestion as PersonRef)} className={`${primaryBtn} disabled:opacity-60`}>
                                {busyNo === u.employeeNo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                                {u.suggestion.personType === "employee" ? t("Bog'lash: {name} (xodim)", { name: u.suggestion.name }) : t("Bog'lash: {name} (o'quvchi)", { name: u.suggestion.name })}
                              </button>
                            )}
                            <button type="button" onClick={() => setDialog({ kind: "link", employeeNo: u.employeeNo, deviceName: u.deviceName })} className={secondaryBtn}>
                              <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
                              {u.suggestion ? t("Boshqasi") : t("Bog'lash")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {d.terminals.length > 0 && (
            <div className="border-t border-v2-border">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
                <div>
                  <h3 className="font-semibold text-v2-text">
                    {t("Bog'langan odamlar")} <span className="text-v2-text-3">{d.linked.length}</span>
                  </h3>
                  <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Terminaldagi «Employee No.» → CRM'dagi xodim yoki o'quvchi.")}</p>
                </div>
                <div className="flex gap-2">
                  {d.linked.length > 8 && (
                    <div className="w-56">
                      <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Qidirish")} aria-label={t("Qidirish")} />
                    </div>
                  )}
                  <button type="button" onClick={() => setDialog({ kind: "link", employeeNo: "", deviceName: null })} className={secondaryBtn}>
                    <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Qo'lda bog'lash")}
                  </button>
                </div>
              </div>
              {d.linked.length === 0 ? (
                <p className="px-5 py-6 text-v2-small text-v2-text-3">{t("Hali hech kim bog'lanmagan — terminal birinchi o'tishlarni yuborgach, ular yuqorida «Bog'lanmagan odamlar» bo'lib chiqadi.")}</p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="mt-3 w-full min-w-[560px] border-collapse text-v2-body">
                    <thead>
                      <tr className="border-y border-v2-border bg-v2-surface-2 text-left">
                        <th className={`${TH} pl-5`}>{t("Terminal raqami")}</th>
                        <th className={TH}>{t("Kim")}</th>
                        <th className={TH}>{t("Turi")}</th>
                        <th className={`${TH} pr-5 text-right`} />
                      </tr>
                    </thead>
                    <tbody>
                      {linkedRows.slice(0, 200).map((r) => (
                        <tr key={r.employeeNo} className="border-b border-v2-border last:border-b-0">
                          <td className="py-2.5 pl-5 pr-3 font-semibold tabular-nums text-v2-text">{r.employeeNo}</td>
                          <td className="px-3 py-2.5 text-v2-text">{r.name}</td>
                          <td className="px-3 py-2.5 text-v2-text-2">{r.personType === "employee" ? t("Xodim") : t("O'quvchi")}</td>
                          <td className="py-2.5 pl-3 pr-5 text-right">
                            <button type="button" onClick={() => setDialog({ kind: "unlink", employeeNo: r.employeeNo, name: r.name })} className={secondaryIcon} aria-label={t("Uzish")} title={t("Uzish")}>
                              <Unlink className="size-4" strokeWidth={1.75} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {dialog?.kind === "terminal" && d && (
        <TerminalDialog
          terminal={dialog.terminal}
          branches={d.branches}
          onClose={closeIf("terminal")}
          onSaved={(msg, created) => {
            showSuccess(msg);
            reload();
            if (created) setDialog({ kind: "setup", id: created.id, extra: created });
          }}
        />
      )}
      {dialog?.kind === "setup" && (
        <FaceTerminalGuideV2
          terminals={dialog.extra && !guideTerminals.some((x) => x.id === dialog.extra?.id) ? [dialog.extra, ...guideTerminals] : guideTerminals}
          initialId={dialog.id}
          onAddTerminal={() => setDialog({ kind: "terminal", terminal: null })}
          onClose={closeIf("setup")}
        />
      )}
      {dialog?.kind === "link" && d && (
        <LinkDialog
          employeeNo={dialog.employeeNo}
          deviceName={dialog.deviceName}
          employees={d.employees}
          onClose={closeIf("link")}
          onLinked={linked}
        />
      )}
      {dialog?.kind === "unlink" && (
        <V2Confirm
          title={t("{name} terminaldan uzilsinmi?", { name: dialog.name })}
          body={t("Yozilgan davomat qoladi. Keyingi o'tishlari «Bog'lanmagan odamlar»ga tushadi.")}
          confirmLabel={t("Uzish")}
          onCancel={closeIf("unlink")}
          onConfirm={() => {
            const no = dialog.employeeNo;
            setDialog(null);
            void unlink(no);
          }}
        />
      )}
    </section>
  );
}

function TerminalDialog({
  terminal,
  branches,
  onClose,
  onSaved,
}: {
  terminal: TerminalView | null;
  branches: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (message: string, created: GuideTerminal | null) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(terminal?.name ?? "");
  const [branch, setBranch] = useState(terminal?.branchId ? String(terminal.branchId) : branches.length === 1 ? String(branches[0].id) : "");
  const [serial, setSerial] = useState("");
  const [active, setActive] = useState(terminal ? (terminal.active ? "on" : "off") : "on");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = terminal ? name.trim() !== terminal.name || branch !== String(terminal.branchId ?? "") || active !== (terminal.active ? "on" : "off") : Boolean(name.trim() || serial.trim());

  async function submit() {
    if (!name.trim()) return setErr(t("Terminal nomini kiriting"));
    if (!branch) return setErr(t("Filialni tanlang"));
    setErr("");
    setSaving(true);
    const res = terminal
      ? await send("/api/hik/terminals", "PATCH", { id: terminal.id, name: name.trim(), branchId: Number(branch), active: active === "on" })
      : await send("/api/hik/terminals", "POST", { name: name.trim(), branchId: Number(branch), deviceId: serial.trim() || undefined });
    setSaving(false);
    if (!res.ok) return setErr(t(res.error || "Saqlanmadi"));
    if (terminal) {
      const n = Number(res.replayed) || 0;
      onSaved(n > 0 ? t("Saqlandi — kutib turgan {n} ta o'tish davomatga yozildi", { n }) : t("Saqlandi"), null);
    } else {
      const created = res.terminal as { id: number; name: string; listenPath: string | null };
      onSaved(t("Terminal qo'shildi"), { id: created.id, name: created.name, ip: null, listenPath: created.listenPath, state: "wait" });
    }
    modal.close();
  }

  return (
    <V2Dialog
      title={terminal ? t("Terminalni tahrirlash") : t("Terminal qo'shish")}
      subtitle={terminal ? terminal.deviceId : t("Qo'shilgach, terminal web sahifasiga yoziladigan manzil chiqadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {terminal ? t("Saqlash") : t("Terminal qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="hik-name">
          <TextInput id="hik-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("Masalan: Asosiy kirish")} autoComplete="off" />
        </Field>
        <Field label={t("Filial")} hint={t("Terminal qaysi binoda turibdi — davomat shu filialga yoziladi")}>
          <V2Select label={t("Filial")} placeholder={t("Tanlang")} value={branch} onChange={setBranch} clearable={false} options={branches.map((b) => ({ value: String(b.id), label: b.name }))} />
        </Field>
        {!terminal && (
          <Field label={t("Seriya raqami")} optional htmlFor="hik-serial" hint={t("Terminal orqasidagi SN, masalan GW3040284 — faqat ajratib olish uchun")}>
            <TextInput id="hik-serial" value={serial} onChange={(e) => setSerial(e.target.value.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 64))} autoComplete="off" />
          </Field>
        )}
        {terminal && (
          <Field label={t("Holati")}>
            <Segmented
              value={active}
              onChange={setActive}
              label={t("Holati")}
              options={[
                { value: "on", label: t("Ishlaydi") },
                { value: "off", label: t("To'xtatilgan") },
              ]}
            />
          </Field>
        )}
        {err && <p className="text-v2-small text-v2-danger">{err}</p>}
      </div>
    </V2Dialog>
  );
}

function LinkDialog({
  employeeNo: givenNo,
  deviceName,
  employees,
  onClose,
  onLinked,
}: {
  employeeNo: string;
  deviceName: string | null;
  employees: { id: number; name: string }[];
  onClose: () => void;
  onLinked: (name: string, replayed: number) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [no, setNo] = useState(givenNo);
  const [type, setType] = useState<"employee" | "student">("employee");
  const [emp, setEmp] = useState("");
  const [student, setStudent] = useState<{ id: number; name: string } | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const personId = type === "employee" ? Number(emp) : (student?.id ?? 0);

  async function submit() {
    if (!no.trim()) return setErr(t("Terminal raqamini kiriting"));
    if (!personId) return setErr(type === "employee" ? t("Xodimni tanlang") : t("O'quvchini tanlang"));
    setErr("");
    setSaving(true);
    const res = await send("/api/hik/persons", "POST", { employeeNo: no.trim(), personType: type, personId });
    setSaving(false);
    if (!res.ok) return setErr(t(res.error || "Saqlanmadi"));
    onLinked(String(res.name ?? ""), Number(res.replayed) || 0);
    modal.close();
  }

  return (
    <V2Dialog
      title={t("Terminal odamini bog'lash")}
      subtitle={deviceName ? t("Terminaldagi ism: {name}", { name: deviceName }) : t("Terminaldagi «Employee No.» qaysi odamga tegishli")}
      onClose={onClose}
      controller={modal}
      dirty={Boolean(personId) || no !== givenNo}
      saving={saving}
      onSubmit={() => void submit()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {t("Bog'lash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Terminal raqami")} htmlFor="hik-no" hint={givenNo ? undefined : t("Terminalda odamga berilgan «Employee No.»")}>
          <TextInput id="hik-no" value={no} readOnly={Boolean(givenNo)} onChange={(e) => setNo(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32))} autoComplete="off" />
        </Field>
        <Field label={t("Kim")}>
          <Segmented
            value={type}
            onChange={(v) => setType(v === "student" ? "student" : "employee")}
            label={t("Kim")}
            options={[
              { value: "employee", label: t("Xodim") },
              { value: "student", label: t("O'quvchi") },
            ]}
          />
        </Field>
        {type === "employee" ? (
          <Field label={t("Xodim")}>
            <V2Select label={t("Xodim")} placeholder={t("Tanlang")} value={emp} onChange={setEmp} searchable clearable={false} options={employees.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
        ) : student ? (
          <Field label={t("O'quvchi")}>
            <div className="flex items-center justify-between gap-3 rounded-v2-md border border-v2-border px-3 py-2">
              <span className="font-semibold text-v2-text">{student.name}</span>
              <button type="button" onClick={() => setStudent(null)} className="text-v2-small font-semibold text-v2-brand hover:underline">
                {t("O'zgartirish")}
              </button>
            </div>
          </Field>
        ) : (
          <Field label={t("O'quvchi")}>
            <StudentSearchField onPick={(s) => setStudent({ id: s.id, name: s.name })} placeholder={t("Ism yoki telefon")} />
          </Field>
        )}
        {err && <p className="text-v2-small text-v2-danger">{err}</p>}
      </div>
    </V2Dialog>
  );
}
