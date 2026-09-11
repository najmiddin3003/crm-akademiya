"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CV_QUESTIONS, PA_SHORT, PA_STEPS } from "@/constants/managementCv";
import Select from "@/components/ui/Select";

// Ommaviy ish arizasi sahifasi (/ariza) — referens HTML'dagi
// "OMMAVIY ARIZA SAHIFASI (#ariza)" bo'limining aynan o'zi: 3 bosqichli
// anketa, tepada bosqich indikatori, oxirida tasdiq ekrani.
//
// Havolani CRM dagi "Ariza havolasini ulashish" tugmasi beradi. Agar
// akademiya Google Sheets'ni ulagan bo'lsa, havola `#s=BASE64(url)` bilan
// keladi — u holda ariza bazaga ham, jadvalga ham yoziladi.

interface CvQuestion {
  k: string;
  q: string;
  req?: boolean;
  type?: "date" | "select" | "multi" | "textarea";
  opts?: string[];
}

const QUESTIONS = CV_QUESTIONS as CvQuestion[];
const SHORT = new Set(PA_SHORT as string[]);
const STEPS = PA_STEPS as { n: number; label: string; keys: string[] }[];

type Values = Record<string, string | string[]>;

function question(k: string): CvQuestion | undefined {
  return QUESTIONS.find((x) => x.k === k);
}

/**
 * Havola ichidagi Google Sheets manzili: /ariza#s=BASE64(url). CRM dagi
 * "Ariza havolasini ulashish" tugmasi shu ko'rinishda beradi — shunda nomzod
 * istalgan qurilmadan ochsa ham arizasi o'sha jadvalga tushadi. Sahifa
 * ko'rinishiga ta'sir qilmaydi, shuning uchun holat sifatida bir marta
 * o'qiymiz.
 */
function readSheetsUrlFromHash(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hash || "";
  if (!h.startsWith("#s=")) return "";
  try {
    const u = atob(decodeURIComponent(h.slice(3)));
    return /^https?:\/\//.test(u) ? u : "";
  } catch {
    return "";
  }
}

export default function CvApplyPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Values>({});
  const [warn, setWarn] = useState("");
  const [invalid, setInvalid] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ name: string; phone: string; sid: string; submitted: string } | null>(null);
  const [sheetsUrl] = useState(readSheetsUrlFromHash);
  const [sheetsNote, setSheetsNote] = useState("");

  function setField(k: string, v: string) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function toggleMulti(k: string, opt: string) {
    setData((d) => {
      const cur = (d[k] as string[]) || [];
      return { ...d, [k]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  function shake(k: string, msg: string) {
    setInvalid(k);
    setWarn(msg);
    setTimeout(() => setInvalid(""), 1600);
    setTimeout(() => setWarn(""), 2600);
    document.getElementById(`pa-${k}`)?.focus();
  }

  function next() {
    const val = (k: string) => String(data[k] ?? "").trim();
    if (step === 1) {
      if (!val("name")) return shake("name", "Ism va familiyani kiriting");
      if (!val("phone")) return shake("phone", "Telefon raqamingizni kiriting");
    }
    if (step === 2 && !val("position")) return shake("position", "Yo'nalishni tanlang");
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      submit();
    }
  }

  function back() {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo(0, 0);
    }
  }

  async function submit() {
    setSending(true);
    const sid = `pa${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const rec = {
      ...data,
      sid,
      priorities: ((data.priorities as string[]) || []).slice(0, 3),
      strengths: (data.strengths as string[]) || [],
    };
    try {
      const res = await fetch("/api/management-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      });
      const out = await res.json();
      if (!out.ok) {
        setWarn(out.error || "Ariza yuborilmadi — qaytadan urinib ko'ring");
        setTimeout(() => setWarn(""), 2600);
        return;
      }
      // Google Sheets ulangan bo'lsa — markaziy jadvalga ham yozamiz.
      if (sheetsUrl) {
        setSheetsNote("Yuborilmoqda...");
        fetch(sheetsUrl, { method: "POST", body: JSON.stringify(rec) })
          .then((r) => r.json())
          .then((j) =>
            setSheetsNote(
              j && j.ok ? "✓ Ariza markazga yetkazildi (Google Sheets)" : "Ariza saqlandi — aloqa tiklangach yetkaziladi",
            ),
          )
          .catch(() => setSheetsNote("Ariza saqlandi — aloqa tiklangach yetkaziladi"));
      }
      setDone({
        name: out.application.name,
        phone: out.application.phone,
        sid,
        submitted: out.application.submitted,
      });
      window.scrollTo(0, 0);
    } catch {
      setWarn("Serverga ulanib bo'lmadi — internetni tekshiring");
      setTimeout(() => setWarn(""), 2600);
    } finally {
      setSending(false);
    }
  }

  function restart() {
    setStep(1);
    setData({});
    setDone(null);
    setSheetsNote("");
    window.scrollTo(0, 0);
  }

  /* ---- Joriy bosqich maydonlari: kalta maydonlar ikkitadan bir qatorga ---- */
  const body = useMemo(() => {
    const cur = STEPS.find((s) => s.n === step);
    if (!cur) return null;

    const rows: ReactNode[] = [];
    let buf: ReactNode[] = [];
    const flush = () => {
      if (buf.length === 0) return;
      rows.push(
        <div className="pa-grid2" key={`g${rows.length}`}>
          {buf}
        </div>,
      );
      buf = [];
    };

    for (const k of cur.keys) {
      const q = question(k);
      if (!q) continue;
      const v = data[k];
      const isShort = SHORT.has(k) && q.type !== "multi";
      const cls = invalid === k ? "pa-invalid" : undefined;

      let input: ReactNode;
      if (q.type === "select") {
        input = (
          <Select value={String(v ?? "")} onChange={(v) => setField(k, v)} options={(q.opts || []).map((o) => ({ value: o, label: o }))} placeholder="Tanlang" clearable className={`${cls}`} id={`pa-${k}`} />
        );
      } else if (q.type === "multi") {
        const on = (v as string[]) || [];
        input = (
          <div className="pa-grid2" style={{ gap: 8 }}>
            {(q.opts || []).map((o) => (
              <label key={o} className={`pa-chk${on.includes(o) ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on.includes(o)}
                  onChange={() => toggleMulti(k, o)}
                  className="h-4 w-4 rounded border-border accent-primary"
                  style={{ width: 16, height: 16, padding: 0 }}
                />
                <span>{o}</span>
              </label>
            ))}
          </div>
        );
      } else if (q.type === "textarea" || (!SHORT.has(k) && q.type !== "date")) {
        input = (
          <textarea
            id={`pa-${k}`}
            className={cls}
            rows={2}
            placeholder="Javobingiz..."
            value={String(v ?? "")}
            onChange={(e) => setField(k, e.target.value)}
          />
        );
      } else {
        input = (
          <input
            id={`pa-${k}`}
            className={cls}
            type={q.type === "date" ? "date" : "text"}
            placeholder={q.type === "date" ? "" : "Javobingiz..."}
            value={String(v ?? "")}
            onChange={(e) => setField(k, e.target.value)}
          />
        );
      }

      const field = (
        <div className="pa-field" key={k}>
          <label htmlFor={`pa-${k}`}>
            {q.q}
            {q.req && <span style={{ color: "#f43f5e" }}> *</span>}
          </label>
          {input}
        </div>
      );

      if (isShort) {
        buf.push(field);
        if (buf.length === 2) flush();
      } else {
        flush();
        rows.push(field);
      }
    }
    flush();
    return rows;
  }, [step, data, invalid]);

  return (
    <div className="pa-root">
      <div className="pa-wrap">
        <div className="pa-card">
          {done ? (
            <div className="pa-success">
              <div className="big">✓</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Arizangiz qabul qilindi!</div>
              <div
                style={{
                  fontSize: 14,
                  color: "#475569",
                  marginTop: 8,
                  maxWidth: 400,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Hurmatli <b>{done.name}</b>, anketangiz Akademiya ma&apos;muriyatiga yetkazildi. Nomzodlar orasidan
                munosiblari tanlab olinadi va siz bilan <b>{done.phone}</b> raqami orqali bog&apos;lanamiz.
              </div>
              <div className="pa-note" style={{ marginTop: 14 }}>
                Ariza raqami: {done.sid.slice(-6).toUpperCase()} · {done.submitted}
              </div>
              <div className="pa-note" style={{ marginTop: 6, color: "#059669", fontWeight: 600 }}>
                {sheetsNote}
              </div>
              <div style={{ marginTop: 24 }}>
                <button className="pa-btn pa-btn-ghost" onClick={restart}>
                  Yana ariza topshirish
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="pa-hero">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="pa-logo">A</div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        color: "#2b38ff",
                        textTransform: "uppercase",
                      }}
                    >
                      Akademiya o&apos;quv markazi
                    </div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                      Jamoamizga qo&apos;shiling!
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 10, lineHeight: 1.5 }}>
                  Ishga qabul anketasini to&apos;ldiring. Faqat jiddiy nomzodlar ko&apos;rib chiqiladi — o&apos;rinlar
                  cheklangan, eng yaxshi nomzodlar suhbatga taklif qilinadi.
                </div>
              </div>

              <div className="pa-steps">
                {STEPS.map((s) => (
                  <div key={s.n} className={`pa-step${s.n === step ? " active" : s.n < step ? " done" : ""}`}>
                    <div className="dot">{s.n < step ? "✓" : s.n}</div>
                    <div className="lbl">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="pa-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{body}</div>

                {warn && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "10px 14px",
                      borderRadius: 11,
                      background: "#fff1f2",
                      color: "#e11d48",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ⚠ {warn}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 22 }}>
                  {step > 1 ? (
                    <button className="pa-btn pa-btn-ghost" onClick={back} disabled={sending}>
                      ← Orqaga
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < 3 ? (
                    <button className="pa-btn pa-btn-primary" onClick={next}>
                      Keyingisi →
                    </button>
                  ) : (
                    <button className="pa-btn pa-btn-submit" onClick={next} disabled={sending}>
                      {sending ? "Yuborilmoqda…" : "✓ Arizani yuborish"}
                    </button>
                  )}
                </div>

                <div className="pa-note" style={{ marginTop: 14, textAlign: "center" }}>
                  Bosqich {step} / 3 · Ma&apos;lumotlaringiz faqat ishga qabul jarayoni uchun ishlatiladi
                </div>
              </div>
            </>
          )}
        </div>
        <div className="text-center mt-4" style={{ color: "rgba(255,255,255,.75)", fontSize: 12 }}>
          Akademiya o&apos;quv markazi · Ishga qabul anketasi
        </div>
      </div>
    </div>
  );
}
