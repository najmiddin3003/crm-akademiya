"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import TimeField from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/components/staff-tasks/api";
import { enrollOrderInGroup } from "@/lib/enrollStudent";
import type { Group } from "@/lib/groups";
import { sinovOf, type LeadGuruh, type LeadHolat, type LeadSinov } from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import { DAY_MS, uzDateOf } from "@/lib/staffTasks";
import type { Teacher } from "@/lib/teachersData";
import type { LeadFmt } from "./leadsCommon";
import { sameBranchPool } from "@/lib/branchPools";

// HOLAT OYNALARI — prototipdagi modal(): «Sinov darsiga yozish», «Guruhga
// qo'shish», «Rad etish sababi». ui/Modal — kirish/chiqish animatsiyasi
// bilan, drawer ustida ochiladi (Esc faqat shu oynani yopadi).
//
// Saqlash POST /api/orders/:id/holat (lib/leadHolatServer.ts). Guruhga
// qo'shishda AVVAL o'quvchi haqiqatan guruhga yoziladi (lib/enrollStudent.ts
// — o'quvchi yo'q bo'lsa lid ma'lumotidan yaratiladi), keyin holat.

export type HolatSetBody = {
  to: LeadHolat;
  sinov?: LeadSinov;
  guruh?: LeadGuruh;
  radSabab?: string;
  /** «Guruhga qo'shish» — lid aylangan o'quvchi (gamifikatsiya TZ 4.12). */
  pupilId?: number;
};

/** Holat so'rovi — javobda yangilangan lid. */
export async function postHolat(orderId: number, body: HolatSetBody | { action: "undo" }) {
  return api<{ order: Order }>(`/api/orders/${orderId}/holat`, {
    method: "POST",
    body: "action" in body ? body : { action: "set", ...body },
  });
}

interface BaseProps {
  order: Order;
  branchName: string;
  nowMs: number;
  fmt: LeadFmt;
  onClose: () => void;
  /** Saqlandi — yangi nusxa va toast matni. */
  onDone: (order: Order, message: string) => void;
  /** Server "holat o'zgargan" (409) dedi — ro'yxatni yangilash kerak. */
  onConflict: () => void;
}

const norm = (s: string | undefined) => String(s ?? "").trim().toLowerCase();

// ── Sinov darsi ─────────────────────────────────────────────────────────

export function SinovModal({ order, branchName, nowMs, fmt, onClose, onDone, onConflict, teachers }: BaseProps & { teachers: Teacher[] }) {
  const { t } = fmt;
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const current = sinovOf(order);
  const today = uzDateOf(nowMs);
  const [sana, setSana] = useState(current && current.sana >= today ? current.sana : uzDateOf(nowMs + DAY_MS));
  const [vaqt, setVaqt] = useState(current?.vaqt || "16:00");
  const curTeacher = current?.oqituvchi ?? "";
  // O'qituvchilar: shu kursni o'qitadiganlar tepada (prototipdagidek).
  const options = useMemo(() => {
    const c = norm(order.course);
    const list = [...teachers].sort((a, b) => {
      const ma = c && norm(a.kurs).includes(c) ? 0 : 1;
      const mb = c && norm(b.kurs).includes(c) ? 0 : 1;
      return ma - mb || a.name.localeCompare(b.name);
    });
    const opts = list.map((x) => ({ value: x.name, label: x.name }));
    if (curTeacher && !opts.some((x) => x.value === curTeacher)) opts.unshift({ value: curTeacher, label: curTeacher });
    return opts;
  }, [teachers, order.course, curTeacher]);
  const [oqituvchi, setOqituvchi] = useState(curTeacher || options[0]?.value || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!sana || !vaqt) return setErr(t("Sana va vaqtni kiriting."));
    if (sana < today) return setErr(t("Sana bugundan oldin bo'lmasin."));
    setErr("");
    setBusy(true);
    const r = await postHolat(order.id, { to: "sinov", sinov: { sana, vaqt, oqituvchi } });
    setBusy(false);
    if (!r.ok) {
      showError(r.error);
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, current ? t("Sinov darsi ko'chirildi") : t("Holat: {holat}", { holat: fmt.holatNom("sinov") }));
    modal.close();
  };

  return (
    <Modal
      controller={modal}
      onClose={onClose}
      title={current ? t("Sinov darsini ko'chirish") : t("Sinov darsiga yozish")}
      size="md"
      locked={busy}
      zIndex={110}
      footer={
        <>
          <Button variant="outline" onClick={modal.close} disabled={busy}>
            {t("Bekor qilish")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Saqlash")}
          </Button>
        </>
      }
    >
      <p className="ld-msub">{[order.name, order.course, branchName].filter(Boolean).join(" · ")}</p>
      <div className="ld-mgrid">
        <div className="ld-mf">
          <span>{t("Sana")}</span>
          <DateField value={sana} onChange={setSana} variant="form" error={!!err && !sana} />
        </div>
        <div className="ld-mf">
          <span>{t("Vaqt")}</span>
          <TimeField value={vaqt} onChange={setVaqt} variant="form" error={!!err && !vaqt} />
        </div>
      </div>
      <div className="ld-mf">
        <span>{t("O'qituvchi")}</span>
        <Select size="md" value={oqituvchi} onChange={setOqituvchi} options={options} placeholder={t("O'qituvchini tanlang")} searchPlaceholder="O'qituvchini qidirish" clearable />
      </div>
      <p className="ld-mnote">{t("Sinov kuni ro'yxatda «Bugun sinov» belgisi chiqadi.")}</p>
      {err && <p className="ld-merr">{err}</p>}
    </Modal>
  );
}

// ── Guruhga qo'shish ────────────────────────────────────────────────────

type GroupWithBranch = Group & { branchId?: number };

export function GuruhModal({ order, branchName, nowMs, fmt, onClose, onDone, onConflict, groups }: BaseProps & { groups: Group[] | null }) {
  const { t } = fmt;
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const today = uzDateOf(nowMs);
  const sinov = sinovOf(order);
  const [boshlash, setBoshlash] = useState(sinov && sinov.sana >= today ? sinov.sana : today);
  const [showAll, setShowAll] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Yakunlangan guruhga yozilmaydi; filiali ma'lum bo'lsa — shu filial (yoki
  // u bilan bitta hovuzdagi filial, lib/branchPools.ts) guruhi.
  const { match, other } = useMemo(() => {
    const live = ((groups ?? []) as GroupWithBranch[]).filter(
      (g) => g.status !== "finished" && (g.branchId === undefined || order.branchId === undefined || sameBranchPool(g.branchId, order.branchId)),
    );
    const c = norm(order.course);
    const isMatch = (g: Group) => !!c && norm(g.course) === c;
    const byName = (a: Group, b: Group) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
    return { match: live.filter(isMatch).sort(byName), other: live.filter((g) => !isMatch(g)).sort(byName) };
  }, [groups, order.course, order.branchId]);
  const list = showAll || match.length === 0 ? [...match, ...other] : match;
  const chosen = list.find((g) => g.id === pick) ?? null;

  const submit = async () => {
    if (!chosen) return setErr(t("Guruhni tanlang."));
    if (!boshlash) return setErr(t("Birinchi dars sanasini kiriting."));
    setErr("");
    setBusy(true);
    const enrolled = await enrollOrderInGroup(order, chosen.id, undefined, { joinedAt: boshlash });
    if (!enrolled.ok) {
      setBusy(false);
      showError(enrolled.error || "Guruhga qo'shishda xatolik yuz berdi");
      return;
    }
    const r = await postHolat(order.id, {
      to: "guruh",
      guruh: { id: chosen.id, nom: String(chosen.name || chosen.id), kun: chosen.day || "", vaqt: chosen.time || "", boshlash },
      pupilId: enrolled.pupil?.id,
    });
    setBusy(false);
    if (!r.ok) {
      // O'quvchi guruhda — faqat lid holati yozilmadi; qayta bosish xavfsiz
      // (guruhga qo'shish takrorlanmaydi, $addToSet).
      setErr(t("O'quvchi guruhga qo'shildi, lekin lid holati saqlanmadi: {error}", { error: t(r.error) }));
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, t("Guruhga qo'shildi — o'quvchi O'quvchilar bo'limiga o'tdi"));
    modal.close();
  };

  return (
    <Modal
      controller={modal}
      onClose={onClose}
      title={t("Guruhga qo'shish")}
      size="md"
      locked={busy}
      zIndex={110}
      footer={
        <>
          <Button variant="outline" onClick={modal.close} disabled={busy}>
            {t("Bekor qilish")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !chosen}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Guruhga qo'shish")}
          </Button>
        </>
      }
    >
      <div className="ld-mgrid">
        <label className="ld-mf">
          <span>{t("Kurs")}</span>
          <input className="ld-input" value={order.course || "—"} disabled />
        </label>
        <label className="ld-mf">
          <span>{t("Filial")}</span>
          <input className="ld-input" value={branchName || "—"} disabled />
        </label>
      </div>
      <div>
        <span className="ld-mlab">{t("Guruh")}</span>
        {groups === null ? (
          <div className="ld-mempty">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="ld-mempty">{t("Faol guruh topilmadi — avval Guruhlar bo'limida guruh oching.")}</div>
        ) : (
          <div className="ld-mlist" role="listbox" aria-label={t("Guruh")}>
            {match.length === 0 && other.length > 0 && <p className="ld-mnote">{t("«{course}» kursi bo'yicha guruh yo'q — barcha guruhlar ko'rsatilmoqda.", { course: order.course || "—" })}</p>}
            {list.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={pick === g.id}
                className={`ld-mopt ${pick === g.id ? "on" : ""}`}
                onClick={() => {
                  setPick(g.id);
                  setErr("");
                }}
              >
                <b>{g.name || g.id}</b>
                <small>{[g.course !== order.course ? g.course : "", [g.day, g.time].filter(Boolean).join(" · "), g.teacher].filter(Boolean).join(" · ") || "—"}</small>
                <em>{t("{n} o'quvchi", { n: g.students ?? 0 })}</em>
              </button>
            ))}
          </div>
        )}
        {match.length > 0 && other.length > 0 && (
          <button type="button" className="ld-link mt-2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("Faqat shu kurs guruhlari") : t("Boshqa kurslar guruhlari ({n})", { n: other.length })}
          </button>
        )}
      </div>
      <div className="ld-mf">
        <span>{t("Birinchi dars sanasi")}</span>
        <DateField value={boshlash} onChange={setBoshlash} variant="form" />
      </div>
      <p className="ld-mnote">{t("Saqlangach o'quvchi O'quvchilar bo'limiga shu guruh bilan qo'shiladi. Darslar (to'lov hisobi) shu sanadan sanaladi.")}</p>
      {err && <p className="ld-merr">{err}</p>}
    </Modal>
  );
}

// ── Rad etish ───────────────────────────────────────────────────────────

export function RadModal({ order, fmt, onClose, onDone, onConflict, reasons }: Omit<BaseProps, "branchName" | "nowMs"> & { reasons: string[] }) {
  const { t } = fmt;
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const [busy, setBusy] = useState<string | null>(null);
  const [other, setOther] = useState("");

  const submit = async (sabab: string) => {
    const s = sabab.trim();
    if (!s || busy) return;
    setBusy(s);
    const r = await postHolat(order.id, { to: "rad", radSabab: s });
    setBusy(null);
    if (!r.ok) {
      showError(r.error);
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, t("Holat: {holat}", { holat: fmt.holatNom("rad") }));
    modal.close();
  };

  return (
    <Modal controller={modal} onClose={onClose} title={t("Rad etish sababi")} size="sm" locked={busy !== null} zIndex={110}>
      <div className="ld-mlist" style={{ maxHeight: "none" }}>
        {reasons.map((s) => (
          <button key={s} type="button" className={`ld-mopt ${busy === s ? "on" : ""}`} disabled={busy !== null} onClick={() => void submit(s)}>
            <b>{t(s)}</b>
            {busy === s && (
              <em>
                <Loader2 className="h-4 w-4 animate-spin" />
              </em>
            )}
          </button>
        ))}
      </div>
      <div>
        <span className="ld-mlab">{t("Boshqa sabab")}</span>
        <div className="ld-izoh" style={{ marginTop: 0 }}>
          <input
            className="ld-input"
            value={other}
            maxLength={200}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit(other);
            }}
            placeholder={t("Sababni yozing")}
            disabled={busy !== null}
          />
          <Button variant="outline" onClick={() => void submit(other)} disabled={!other.trim() || busy !== null}>
            {t("Saqlash")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
