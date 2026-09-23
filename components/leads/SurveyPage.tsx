"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { darajaInfo, hasDaraja, type LeadFan, type LeadYonalish } from "@/lib/leadSettings";
import { maskSurveyPhone, phone9, type SurveyConfig, type SurveySubmission } from "@/lib/survey";
import { SurveyIcon, hasFlag } from "./surveyIcons";

// OMMAVIY SO'ROVNOMA — «Bepul sinov darsiga yoziling» (/sorovnoma).
// Prototip: «lidlar-tayyorlangan-ohiri» → «Ochiq sayt» xonasi.
//
//   1-qadam: yo'nalish plitkasi → kurs/fan → daraja (chet tili) yoki sinf;
//   2-qadam: filial (manzil, telefon) va qulay vaqt;
//   3-qadam: ism, telefon, «qayerdan bildingiz?», izoh → Yuborish;
//   rahmat oynasi — javoblar qisqacha va filial telefoni.
//
// Ro'yxatlar serverdan (app/sorovnoma/page.tsx → lib/surveyServer.ts).
// Javob POST /api/sorovnoma ga ketadi va Lidlar sahifasiga "Sayt
// so'rovnomasi" manbasi bilan, filialning Telegram topigiga tushadi.
// Spamdan himoya: yashirin `website` maydoni va to'ldirish vaqti (`ms`).

const SALOM = ["Hello", "Привет", "Merhaba", "안녕", "مرحبا", "Hallo"];

type Step = 1 | 2 | 3 | 4;

/** "Ertalab (08:00–12:00)" → ["Ertalab", "08:00–12:00"]; "A — B" ham. */
function splitLabel(v: string): [string, string] {
  let m = /^(.*) — (.*)$/.exec(v);
  if (m) return [m[1], m[2]];
  m = /^(.*) \((.*)\)$/.exec(v);
  if (m) return [m[1], m[2]];
  return [v, ""];
}

function Opt({ on, icon, title, sub, tel, onClick, fallback }: { on: boolean; icon: string; title: string; sub?: string; tel?: string; onClick: () => void; fallback?: string }) {
  return (
    <button type="button" className="opt" aria-pressed={on} onClick={onClick}>
      <span className={`oi ${hasFlag(icon) ? "f" : ""}`}>
        <SurveyIcon name={icon} fallback={fallback} />
      </span>
      <span className="ot">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
        {tel && (
          <span className="otel">
            <SurveyIcon name="_aloqa" />
            {tel}
          </span>
        )}
      </span>
      <span className="oc">✓</span>
    </button>
  );
}

function QHead({ badge, badgeCls = "", eyebrow, title }: { badge: string; badgeCls?: string; eyebrow: string; title: string }) {
  return (
    <div className="qhead">
      <span className={`qbadge ${badgeCls}`}>
        <SurveyIcon name={badge} />
      </span>
      <div>
        <small>{eyebrow}</small>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function DirArt({ id, salom, fade }: { id: string; salom: string; fade: boolean }): ReactNode {
  if (id === "fan") {
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <g className="orbit" fill="none" stroke="#150e7a" strokeWidth="3">
          <ellipse cx="60" cy="45" rx="36" ry="12" />
          <ellipse cx="60" cy="45" rx="36" ry="12" transform="rotate(60 60 45)" />
          <ellipse cx="60" cy="45" rx="36" ry="12" transform="rotate(120 60 45)" />
        </g>
        <circle cx="60" cy="45" r="6" fill="#291ddb" />
        <text className="floaty" x="4" y="20" fontFamily="Manrope,system-ui,sans-serif" fontWeight="800" fontSize="17" fill="#150e7a">
          x²
        </text>
        <text className="floaty f2" x="100" y="18" fontFamily="Manrope,system-ui,sans-serif" fontWeight="800" fontSize="18" fill="#291ddb">
          π
        </text>
        <text className="floaty f3" x="98" y="86" fontFamily="Manrope,system-ui,sans-serif" fontWeight="800" fontSize="17" fill="#150e7a">
          ∑
        </text>
      </svg>
    );
  }
  if (id === "til") {
    return (
      <span className="bubbles" aria-hidden="true">
        <span className={`bub ${fade ? "fade" : ""}`}>{salom}</span>
        <span className="bub2">Aa</span>
      </span>
    );
  }
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true">
      <path className="star" d="M60 5l3.5 7.6 8.3.9-6.2 5.6 1.8 8.2L60 23.1l-7.4 4.2 1.8-8.2-6.2-5.6 8.3-.9z" fill="#ffd400" />
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M26 44L60 31l34 13z" />
        <path d="M30 48h60" />
        <path d="M37 52v24M51 52v24M69 52v24M83 52v24" />
        <path d="M26 80h68M22 86h76" />
      </g>
    </svg>
  );
}

/** Fanlar ro'yxati — ketma-ket bir xil `guruh`lilar bitta sarlavha ostida. */
function groupFans(fanlar: LeadFan[]): { nom: string; items: LeadFan[] }[] {
  const out: { nom: string; items: LeadFan[] }[] = [];
  for (const f of fanlar) {
    const g = f.guruh ?? "";
    const last = out[out.length - 1];
    if (last && last.nom === g) last.items.push(f);
    else out.push({ nom: g, items: [f] });
  }
  return out;
}

const smooth = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

/** Sahifa ochilgandan beri o'tgan vaqt (ms) — faqat hodisa ichida chaqiriladi. */
const clockMs = () => performance.now();

export default function SurveyPage({ config }: { config: SurveyConfig }) {
  const { t } = useT();
  const cfg = config;
  const [yonId, setYonId] = useState<string | null>(null);
  const [fan, setFan] = useState<string | null>(null);
  const [lvl, setLvl] = useState(0);
  const [test, setTest] = useState(false);
  const [sinf, setSinf] = useState("");
  const [filial, setFilial] = useState<number | null>(null);
  const [vaqt, setVaqt] = useState<string | null>(null);
  const [ism, setIsm] = useState("");
  const [tel, setTel] = useState("+998 ");
  const [manba, setManba] = useState<string | null>(null);
  const [izoh, setIzoh] = useState("");
  const [website, setWebsite] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [back, setBack] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [salomIdx, setSalomIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  const yon: LeadYonalish | null = cfg.yonalishlar.find((y) => y.id === yonId) ?? null;
  const daraja = yon ? hasDaraja(yon.id) : false;
  const branch = cfg.filiallar.find((b) => b.id === filial) ?? null;
  const steps = cfg.bosqichlar;
  const stepPct = 100 / Math.max(1, steps.length - 1);
  const info = darajaInfo({ lvl, test }, steps);
  const nearIdx = Math.round(lvl / stepPct);
  const cities = useMemo(() => [...new Set(cfg.filiallar.map((b) => b.shahar).filter(Boolean))].join(" · "), [cfg.filiallar]);

  // To'ldirish vaqti sanog'i — sahifa ochilgan lahzadan (spamdan himoya).
  useEffect(() => {
    startedAt.current = clockMs();
  }, []);

  // «Salom» plitkasi — so'zlar almashib turadi (harakat kamaytirilgan
  // rejimda to'xtaydi).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let inner = 0;
    const id = window.setInterval(() => {
      setFade(true);
      inner = window.setTimeout(() => {
        setSalomIdx((k) => (k + 1) % SALOM.length);
        setFade(false);
      }, 250);
    }, 1600);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(inner);
    };
  }, []);

  const scrollCard = () => requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: smooth(), block: "start" }));

  const pickYon = (id: string) => {
    const first = yonId === null;
    setYonId(id);
    setFan(null);
    setSinf("");
    setErr("");
    setBack(false);
    setStep(1);
    if (first) window.setTimeout(scrollCard, 60);
  };

  const pickFan = (nom: string) => {
    setFan(nom);
    setErr("");
    // Keyingi savol (daraja/sinf) ekrandan pastda qolsa — unga suriladi.
    requestAnimationFrame(() => {
      const el = nextRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: smooth(), block: "center" });
    });
  };

  const go = (n: Step) => {
    if (n === 2 && step === 1) {
      if (!yon) return setErr(t("Yo'nalishni tanlang."));
      if (!fan) return setErr(t("Kurs yoki fanni tanlang."));
      if (!daraja && !sinf) return setErr(t("Sinfni tanlang."));
    }
    if (n === 3 && step === 2) {
      if (!branch) return setErr(t("Filialni tanlang."));
      if (!vaqt) return setErr(t("Qulay vaqtni tanlang."));
    }
    setErr("");
    setBack(n < step);
    setStep(n);
    scrollCard();
  };

  const submit = async () => {
    if (ism.trim().length < 3) return setErr(t("Ism familiyani to'liq yozing."));
    if (phone9(tel).length !== 9) return setErr(t("Telefon raqamni to'liq kiriting."));
    if (!manba) return setErr(t("Bizni qayerdan eshitganingizni belgilang."));
    if (!yon || !fan || !branch || !vaqt) return setErr(t("Barcha savollarga javob bering."));
    setErr("");
    setSending(true);
    const body: SurveySubmission = {
      yonalish: yon.id,
      fan,
      ...(daraja ? { lvl, test } : { sinf }),
      filialId: branch.id,
      vaqt,
      ism: ism.trim(),
      tel,
      manba,
      izoh: izoh.trim(),
      ms: Math.round(clockMs() - startedAt.current),
      website,
    };
    try {
      const res = await fetch("/api/sorovnoma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setErr(t(String(data?.error || "Yuborib bo'lmadi — birozdan keyin qayta urinib ko'ring.")));
        return;
      }
      setBack(false);
      setStep(4);
      scrollCard();
    } catch {
      setErr(t("Internet aloqasini tekshirib, qayta yuboring."));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setYonId(null);
    setFan(null);
    setLvl(0);
    setTest(false);
    setSinf("");
    setFilial(null);
    setVaqt(null);
    setIsm("");
    setTel("+998 ");
    setManba(null);
    setIzoh("");
    setErr("");
    setBack(false);
    setStep(1);
    startedAt.current = clockMs();
    window.scrollTo({ top: 0, behavior: smooth() });
  };

  const dirsCls = `dirs ${yonId ? "has" : ""} ${cfg.yonalishlar.length === 2 ? "n2" : cfg.yonalishlar.length === 1 ? "n1" : ""}`;
  const telDigits = phone9(tel);

  return (
    <div className="site-in">
      <div className="device">
        <div className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element -- statik logotip, o'lchami CSS'da */}
          <img className="logo" src="/sorovnoma/logo.png" alt={t("Akademiya o'quv markazi")} width={382} height={95} />
          <h1>
            <em>{t("Bepul")}</em> {t("sinov darsiga yoziling")}
          </h1>
        </div>

        {cfg.yonalishlar.length === 0 ? (
          <p className="ask">{t("So'rovnoma vaqtincha yopiq — filialga qo'ng'iroq qiling.")}</p>
        ) : (
          <>
            <p className="ask">{t("Nimani o'rganmoqchisiz?")}</p>
            <div className={dirsCls}>
              {cfg.yonalishlar.map((y) => (
                <button key={y.id} type="button" className={`dir d-${y.id}`} aria-pressed={yonId === y.id} onClick={() => pickYon(y.id)}>
                  <span className="ok">✓</span>
                  <span className="art">
                    <DirArt id={y.id} salom={SALOM[salomIdx]} fade={fade} />
                  </span>
                  <b>{t(y.nom)}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {yon && (
          <div className="card" ref={cardRef} data-y={yon.id}>
            {step < 4 && (
              <div className="steps" aria-hidden="true">
                {[1, 2, 3].map((k) => (
                  <div key={k} className={k <= step ? "on" : ""} />
                ))}
              </div>
            )}

            {step === 1 && (
              <div key={`q1-${yon.id}`} className={`qstep ${back ? "back" : ""}`}>
                <div className="q">
                  <QHead badge={`_${yon.id}`} badgeCls={`b-${yon.id}`} eyebrow={t("1-qadam · {nom}", { nom: t(yon.nom) })} title={t(yon.savol)} />
                  {groupFans(yon.fanlar).map((g, gi) => {
                    const opts = (
                      <div className="opts">
                        {g.items.map((f) => (
                          <Opt key={f.nom} on={fan === f.nom} icon={f.nom} fallback={`_${yon.id}`} title={t(f.nom)} onClick={() => pickFan(f.nom)} />
                        ))}
                      </div>
                    );
                    return g.nom ? (
                      <div key={gi} className="ogroup">
                        <p className="olabel">{t(g.nom)}</p>
                        {opts}
                      </div>
                    ) : (
                      <div key={gi} className="ogroup">
                        {opts}
                      </div>
                    );
                  })}
                </div>

                <div ref={nextRef}>
                  {fan && daraja && (
                    <div className="q reveal">
                      <QHead badge="_daraja" badgeCls="b-til" eyebrow={t(yon.nom)} title={t("Darajangiz")} />
                      <p className="qsub">{t("Tugmani o'zingizga yaqin joyga suring")}</p>
                      <div className={`ms ${test ? "off" : ""}`}>
                        <p className="ms-read">
                          <span>{info.test ? t("Daraja testi kerak") : info.aniq ? t(info.near) : t("{lo} — {hi} orasida", { lo: t(info.lo), hi: t(info.hi) })}</span>
                          <span className="tag">{info.test ? t("test") : info.aniq ? t("aniq bosqich") : t("{near} ga yaqin", { near: t(info.near) })}</span>
                        </p>
                        <div className="ms-wrap">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={lvl}
                            aria-label={t("Daraja bosqichi")}
                            style={{ "--p": `${lvl}%` } as CSSProperties}
                            onChange={(e) => setLvl(Number(e.target.value))}
                          />
                          <div className="ms-ticks">
                            {steps.map((s, i) => (
                              <i key={s} className={!test && i === nearIdx ? "near" : ""} style={{ left: `${i * stepPct}%` }} />
                            ))}
                          </div>
                          <div className="ms-labels">
                            {steps.map((s, i) => (
                              <b key={s} className={!test && i === nearIdx ? "near" : ""} style={{ left: `${i * stepPct}%` }}>
                                <span className="lg">{t(s)}</span>
                                <span className="sh">{i}</span>
                              </b>
                            ))}
                          </div>
                        </div>
                      </div>
                      <label className="ck">
                        <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
                        <span>
                          {t("Bilmayman —")} <b>{t("daraja testi")}</b> {t("topshiraman")}
                        </span>
                      </label>
                    </div>
                  )}
                  {fan && !daraja && (
                    <div className="q reveal">
                      <QHead badge="_sinf" eyebrow={t("O'quvchi")} title={t("Nechanchi sinf?")} />
                      <div className="sinfs" role="group" aria-label={t("Nechanchi sinf?")}>
                        {cfg.sinflar.map((v) => {
                          const n = parseInt(v, 10);
                          return (
                            <button
                              key={v}
                              type="button"
                              className={`sn ${Number.isNaN(n) ? "grad" : ""}`}
                              aria-pressed={sinf === v}
                              title={t(v)}
                              onClick={() => {
                                setSinf(v);
                                setErr("");
                              }}
                            >
                              {Number.isNaN(n) ? (
                                t(v)
                              ) : (
                                <span>
                                  {n}
                                  <small>{t("sinf")}</small>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {err && <p className="err">{err}</p>}
                <button type="button" className="cta" onClick={() => go(2)}>
                  {t("Davom etish →")}
                </button>
              </div>
            )}

            {step === 2 && (
              <div key="q2" className={`qstep ${back ? "back" : ""}`}>
                <div className="q">
                  <QHead badge="_filial" eyebrow={t("2-qadam")} title={t("Qaysi filial?")} />
                  <div className="opts wide">
                    {cfg.filiallar.map((b) => (
                      <Opt
                        key={b.id}
                        on={filial === b.id}
                        icon="_filial"
                        title={b.nom}
                        sub={b.manzil}
                        tel={b.telefon}
                        onClick={() => {
                          setFilial(b.id);
                          setErr("");
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="q">
                  <QHead badge="_vaqt" eyebrow={t("2-qadam")} title={t("Qaysi vaqt qulay?")} />
                  <div className="opts">
                    {cfg.vaqtlar.map((v) => {
                      const [title, sub] = splitLabel(v);
                      return (
                        <Opt
                          key={v}
                          on={vaqt === v}
                          icon={title}
                          fallback="_vaqt"
                          title={t(title)}
                          sub={sub}
                          onClick={() => {
                            setVaqt(v);
                            setErr("");
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                {err && <p className="err">{err}</p>}
                <div className="rowbtn">
                  <button type="button" className="cta back" onClick={() => go(1)}>
                    {t("← Orqaga")}
                  </button>
                  <button type="button" className="cta" onClick={() => go(3)}>
                    {t("Davom etish →")}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div key="q3" className={`qstep ${back ? "back" : ""}`}>
                <QHead badge="_aloqa" eyebrow={t("3-qadam")} title={t("Siz bilan qanday bog'lanamiz?")} />
                <div className="grid2">
                  <label className="fld">
                    <span>{t("Ism familiya")}</span>
                    <input value={ism} maxLength={80} placeholder={t("Ismingiz")} autoComplete="name" onChange={(e) => setIsm(e.target.value)} />
                  </label>
                  <label className="fld">
                    <span>{t("Telefon")}</span>
                    <input value={tel} inputMode="tel" autoComplete="tel-national" placeholder="+998 __ ___ __ __" onChange={(e) => setTel(maskSurveyPhone(e.target.value))} />
                  </label>
                </div>
                {/* Yashirin maydon — odam ko'rmaydi va to'ldirmaydi; bot to'ldiradi. */}
                <label className="hp" aria-hidden="true">
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
                <div className="q">
                  <QHead badge="_manba" eyebrow={t("3-qadam")} title={t("Bizni qayerdan bildingiz?")} />
                  <div className="opts">
                    {cfg.manbalar.map((m) => (
                      <Opt
                        key={m}
                        on={manba === m}
                        icon={m}
                        title={t(m)}
                        onClick={() => {
                          setManba(m);
                          setErr("");
                        }}
                      />
                    ))}
                  </div>
                </div>
                <label className="fld" style={{ marginBottom: 16 }}>
                  <span>{t("Izoh (ixtiyoriy)")}</span>
                  <textarea rows={2} maxLength={500} value={izoh} onChange={(e) => setIzoh(e.target.value)} />
                </label>
                {err && <p className="err">{err}</p>}
                <div className="rowbtn">
                  <button type="button" className="cta back" onClick={() => go(2)} disabled={sending}>
                    {t("← Orqaga")}
                  </button>
                  <button type="button" className="cta" onClick={() => void submit()} disabled={sending}>
                    {sending && <Loader2 className="h-5 w-5 animate-spin" />}
                    {t("Yuborish")}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div key="q4" className="qstep done">
                <div className="tick">✓</div>
                <h2>{t("Qabul qilindi!")}</h2>
                <p>{t("24 soat ichida {tel} raqamiga qo'ng'iroq qilamiz.", { tel: telDigits ? maskSurveyPhone(telDigits) : tel })}</p>
                <div className="recap">
                  <dl>
                    <dt>{t("Kurs")}</dt>
                    <dd>{fan ? t(fan) : "—"}</dd>
                    {daraja ? (
                      <>
                        <dt>{t("Daraja")}</dt>
                        <dd>{info.test ? t("Daraja testi kerak") : info.aniq ? t(info.near) : t("{lo} — {hi} orasida", { lo: t(info.lo), hi: t(info.hi) })}</dd>
                      </>
                    ) : (
                      <>
                        <dt>{t("Sinf")}</dt>
                        <dd>{sinf ? t(sinf) : "—"}</dd>
                      </>
                    )}
                    <dt>{t("Filial")}</dt>
                    <dd>{branch?.nom ?? "—"}</dd>
                    <dt>{t("Vaqt")}</dt>
                    <dd>{vaqt ? t(vaqt) : "—"}</dd>
                  </dl>
                </div>
                {branch?.telefon && (
                  <p className="callus">
                    {t("Savol bo'lsa:")}
                    <a href={`tel:+998${phone9(branch.telefon)}`}>
                      <SurveyIcon name="_aloqa" />
                      {branch.telefon}
                    </a>
                  </p>
                )}
                <button type="button" className="cta ghost" onClick={reset}>
                  {t("Yana ariza qoldirish")}
                </button>
              </div>
            )}
          </div>
        )}

        {cities && <p className="sitefoot">{cities}</p>}
      </div>
    </div>
  );
}
