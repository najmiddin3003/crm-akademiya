"use client";

import type { ReactNode } from "react";
import { HOUR_MS, ms, redeadlineOf, windowStart, type StaffTask } from "@/lib/staffTasks";
import type { StaffFmt } from "./format";

// MUDDAT CHIZIG'I — topshiriq qayerda turgani bir qarashda: berilgan payt,
// deadline (55% da), qayta muddat oxiri (100%) va "hozir" belgisi.
// Keng ekranda gorizontal chiziq, telefonda vertikal ro'yxat (tasks.css).
// Mantiq prototipdagi railNodes() ning aynan o'zi.

interface Node {
  p: number;
  lbl: string;
  time: string;
  cls: string;
  em?: string;
  emc?: string;
}

const P1 = 55;

function frac(x: number, lo: number, hi: number): number {
  if (hi > lo) return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return x >= hi ? 1 : 0;
}

export default function DeadlineRail({ task, nowMs, fmt, graceHours }: { task: StaffTask; nowMs: number; fmt: StaffFmt; graceHours: number }) {
  const { t, stamp, rel, num } = fmt;
  const start = windowStart(task);
  const dl = ms(task.deadline);
  const rd = redeadlineOf(task, graceHours);
  const grace = Math.max(1, Math.round((rd - dl) / HOUR_MS));
  const pos = (x: number) => (x <= dl ? P1 * frac(x, start, dl) : P1 + (100 - P1) * frac(x, dl, rd));
  const fineShort = t("jarima {n}", { n: num(task.fine?.amount ?? task.fineAmount) });

  const n0: Node = { p: 0, lbl: t(task.returnCount ? "Qaytarildi" : "Berildi"), time: stamp(start, nowMs), cls: "done" };
  const n1: Node = { p: P1, lbl: t("Deadline"), time: stamp(dl, nowMs), cls: "" };
  const n2: Node = { p: 100, lbl: t("+{n} soat", { n: grace }), time: stamp(rd, nowMs), cls: "" };
  let cur: { p: number; lbl: string; cls: string } | null = null;
  let fill = 0;
  let fillC = "pri";
  let note = "";

  switch (task.status) {
    case "yangi":
    case "qaytarildi":
      n1.cls = "cur";
      n2.cls = "off";
      n2.em = fineShort;
      cur = { p: pos(nowMs), lbl: t("hozir, {rel}", { rel: rel(dl, nowMs) }), cls: "" };
      fill = cur.p;
      note = t("«Bajardim» bosilgan vaqt asos olinadi — undan keyin deadline o'tsa ham muddati o'tgan hisoblanmaydi.");
      break;
    case "muddati_otdi":
      n1.cls = "done hot";
      n1.em = t("o'tdi");
      n1.emc = "c-hot";
      n2.cls = "cur hot";
      n2.em = fineShort;
      n2.emc = "c-bad";
      cur = { p: pos(nowMs), lbl: t("hozir, {rel}", { rel: rel(rd, nowMs) }), cls: "hot" };
      fill = cur.p;
      fillC = "hot";
      note = t("Qayta muddat faqat 1 marta. Shu vaqt ichida «Bajardim» bosilsa jarima yozilmaydi («kechikib bajarildi» deb belgilanadi).");
      break;
    case "tasdiq_kutilmoqda":
      if (task.isLate) {
        n1.cls = "done hot";
        n1.em = t("o'tdi");
        n1.emc = "c-hot";
        n2.cls = "done ok";
        n2.em = t("ichida bajarildi");
        n2.emc = "c-ok";
      } else {
        n1.cls = "done ok";
        n1.em = t("o'z vaqtida");
        n1.emc = "c-ok";
        n2.cls = "off";
        n2.time = t("kerak bo'lmadi");
      }
      cur = { p: pos(ms(task.doneAt)), lbl: t("Bajardim, {stamp}", { stamp: stamp(task.doneAt, nowMs) }), cls: "ok" };
      fill = cur.p;
      fillC = "ok";
      note = t("Rahbar tasdiqlasa yakunlanadi; qaytarsa yangi deadline bilan sanoq qaytadan boshlanadi.");
      break;
    case "yakunlandi": {
      const x = ms(task.doneAt ?? task.completedAt);
      if (task.completedLate) {
        n1.cls = "done hot";
        n1.em = t("o'tdi");
        n1.emc = "c-hot";
        n2.cls = "done ok";
        n2.em = t("jarimasiz");
        n2.emc = "c-ok";
      } else {
        n1.cls = "done ok";
        n1.em = t("o'z vaqtida");
        n1.emc = "c-ok";
        n2.cls = "off";
        n2.time = t("kerak bo'lmadi");
      }
      cur = { p: Number.isFinite(x) ? pos(x) : P1, lbl: t("Bajardim, {stamp}", { stamp: stamp(x, nowMs) }), cls: "ok" };
      fill = cur.p;
      fillC = "ok";
      break;
    }
    case "bajarilmadi":
      n1.cls = "done hot";
      n1.em = t("o'tdi");
      n1.emc = "c-hot";
      n2.cls = "done bad";
      n2.em = task.fine?.status === "bekor" ? t("jarima bekor") : fineShort;
      n2.emc = "c-bad";
      cur = { p: 100, lbl: t("Bajarilmadi, {stamp}", { stamp: stamp(task.failedAt, nowMs) }), cls: "bad" };
      fill = 100;
      fillC = "bad";
      break;
    default:
      n0.cls = "off";
      n1.cls = "off";
      n2.cls = "off";
      n2.time = "—";
      note = t("Topshiriq bekor qilingan — jarima yozilmaydi.");
  }

  const nodes = [n0, n1, n2];
  const label = (n: Node) => (
    <>
      <b>{n.lbl}</b>
      <span>{n.time}</span>
      {n.em && <em className={n.emc ?? ""}>{n.em}</em>}
    </>
  );
  const curSide = cur ? (cur.p < 12 ? " l" : cur.p > 88 ? " rt" : "") : "";
  // Vertikal ro'yxatda "hozir" belgisi tegishli bosqichlar orasiga qo'yiladi.
  const nowIdx = cur ? (cur.p <= P1 ? 1 : cur.p < 100 ? 2 : 3) : -1;
  const vItems: { key: string; cls: string; body: ReactNode }[] = nodes.map((n, i) => ({ key: `n${i}`, cls: n.cls, body: label(n) }));
  if (cur) vItems.splice(nowIdx, 0, { key: "now", cls: `now ${cur.cls}`, body: <b>{cur.lbl}</b> });

  return (
    <>
      <div className="stk-rail">
        <div className="stk-track">
          <span className={`stk-fill c-${fillC}`} style={{ width: `${fill}%` }} />
          {nodes.map((n, i) => (
            <span key={`dot${i}`}>
              <span className={`stk-node ${n.cls}`} style={{ left: `${n.p}%` }} />
              <div className={`stk-lab${i === 0 ? " l" : i === 2 ? " rt" : ""}`} style={{ left: `${n.p}%` }}>
                {label(n)}
              </div>
            </span>
          ))}
          {cur && (
            <div className={`stk-cur ${cur.cls}${curSide}`} style={{ left: `${cur.p}%` }}>
              {cur.lbl}
            </div>
          )}
        </div>
      </div>
      <ul className="stk-vrail">
        {vItems.map((it) => (
          <li key={it.key} className={it.cls}>
            <i />
            {it.body}
          </li>
        ))}
      </ul>
      {note && <div className="stk-tl-note">{note}</div>}
    </>
  );
}
