"use client";

/* eslint-disable @next/next/no-img-element -- rasmlar data: URL va Cloudinary, next/image kerak emas. */

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Moon, Sun } from "lucide-react";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import { useTheme } from "@/components/shared/Theme";
import { LANGS as LANG_LABELS } from "@/lib/navbar";
import { LANGS, type Lang } from "@/lib/i18n";
import { CV_INSTAGRAM, CV_LOADS, CV_MAIN_PHONE, CV_TEACHING_ROLES } from "@/constants/managementCv";
import { formatUzPhone } from "@/lib/managementCv";
import { useLang } from "@/components/shared/Language";
import { EMPTY_VALUES, fmtSize, formatSalary, useCvApplyForm, type ApplyBranch, type TextKey, type Values } from "./cvApplyForm";

// OMMAVIY ISH ARIZASI (/ariza) — dizayn foydalanuvchining
// "akademiya-ishga-ariza.html" faylidan (19.09.2026): chap panelda jonli
// ariza kartasi + 3 qadam, o'ngda 4 bo'limli forma (shaxsiy, vakansiya,
// ta'lim/tajriba, qo'shimcha), tepada to'ldirilish o'lchagichi, mobilda
// pastki panel. Uslublar app/ariza/ariza.css da.
//
// MANTIQ (savollar, tekshiruv, rasm kichraytirish, fayllar, yuborish) —
// ./cvApplyForm.ts dagi useCvApplyForm: CRM'dagi "Ishga qabul anketasi"
// modali (CvFormModal.tsx) ham AYNI hook'ni ishlatadi, shuning uchun ikki
// anketa hech qachon bir-biridan farq qilmaydi. Bu faylda faqat ommaviy
// sahifaga xos narsalar qoldi:
//   • qoralama localStorage'da (matn + rasm) — sahifa yopilib qolsa
//     yozganlari qaytadi; fayllar qoralamaga tushmaydi (File saqlanmaydi);
//   • tuzoq maydoni (botlar uchun), yuborilgach "Ariza yuborildi" ekrani;
//   • Google Sheets ulangan bo'lsa (`#s=BASE64(url)`) ariza jadvalga ham
//     yoziladi — CRM dagi "Ariza havolasini ulashish" shunday havola beradi.
//
// Filiallar bazadan (app/ariza/page.tsx server komponenti beradi) —
// tanlangan filial `branchId` bo'lib saqlanadi va CRM'da o'sha filial
// ro'yxatida ko'rinadi; "qaysi filial bo'lsa ham" — hammasida.
//
// Tanlovlar va sanalar — CRM'ning o'z ui/Select va ui/DateField'lari
// (loyiha qoidasi: native <select>/<input type="date"> ishlatilmaydi);
// til va tungi rejim tugmalari sahifa tepasida (navbar yo'q).

export type { ApplyBranch } from "./cvApplyForm";

const DRAFT_KEY = "akademiya_ariza_draft";

/** Havola ichidagi Google Sheets manzili: /ariza#s=BASE64(url). */
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

const PersonIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6" />
  </svg>
);

export default function CvApplyPage({ branches }: { branches: ApplyBranch[] }) {
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();
  const [website, setWebsite] = useState(""); // tuzoq maydoni — odam ko'rmaydi
  const [sheetsUrl] = useState(readSheetsUrlFromHash);
  const [dragOver, setDragOver] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [done, setDone] = useState<{ ref: string; tel: string; files: string } | null>(null);

  const form = useCvApplyForm({ branches, photoRequired: true, consentRequired: true, sheetsUrl, honeypot: website });
  const {
    t, v, setV, set, consent, setConsent, consentBad, setConsentBad, photo, setPhoto, photoErr, cvFile, docs, certErr,
    bad, birthErr, sendErr, sending, teaching, selectedBranch, branchLabel, branchTel, pct,
    roleOptions, subjectOptions, branchOptions, eduOptions, expOptions, sourceOptions,
    photoInput, cvInput, docsInput, onPhotoPick, removePhoto, onCvPick, addDocs, removeDoc, submit, reset,
  } = form;

  const formRef = useRef<HTMLFormElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- qoralama: tiklash va saqlash ---- */
  // Tiklash gidratatsiyadan KEYIN (localStorage serverda yo'q) va bir tik
  // kechikib — effekt ichida to'g'ridan-to'g'ri setState chaqirilmasin
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw) as Partial<Values> & { _rasm?: string; consent?: boolean };
        const next: Values = { ...EMPTY_VALUES };
        let any = false;
        for (const k of Object.keys(EMPTY_VALUES) as TextKey[]) {
          if (typeof d[k] === "string" && d[k]) {
            next[k] = d[k] as string;
            any = true;
          }
        }
        if (d._rasm) {
          setPhoto(d._rasm);
          any = true;
        }
        if (!any) return;
        setV(next);
        if (d.consent) setConsent(true);
        setDraftRestored(true);
      } catch {
        // buzilgan qoralama — e'tibor bermaymiz
      }
    }, 0);
    return () => clearTimeout(id);
  }, [setV, setPhoto, setConsent]);

  useEffect(() => {
    if (done) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...v, consent, _rasm: photo }));
      } catch {
        // joy yetmasa (rasm katta) — rasmsiz saqlaymiz
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...v, consent }));
        } catch {
          /* localStorage o'chirilgan */
        }
      }
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [v, consent, photo, done]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* — */
    }
    reset();
    setDraftRestored(false);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) addDocs(e.dataTransfer.files);
  }

  /* ---- yuborish ---- */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await submit();
    if (!r) {
      setTimeout(() => document.getElementById("ar-sendErr")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    // Yuborilgach — kutib turgan qoralama taymeri ham o'chsin, aks holda
    // tozalangan qoralama qayta yozilib qolardi.
    if (draftTimer.current) clearTimeout(draftTimer.current);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* — */
    }
    setDone({ ref: r.ref, tel: branchTel, files: r.files.join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fullName = `${v.firstName} ${v.lastName}`.trim();
  const fieldCls = (k: string, extra = "") => `field${extra ? " " + extra : ""}${bad.has(k) ? " bad" : ""}`;

  const meter = (id: string, withTitle: boolean) => (
    <div className={`meter${pct === 100 ? " full" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("Ariza to'ldirilishi")}>
      <i className="bar" style={{ width: `${pct}%` }} />
      <div className="lbl">
        {withTitle && <strong>{t("Ishga ariza")}</strong>}
        <span>
          <b id={id}>{pct}</b>{t("% to'ldirildi")}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <div className="seg" role="group" aria-label={t("Til")}>
          {LANGS.map((code: Lang) => (
            <button type="button" key={code} className={lang === code ? "on" : ""} onClick={() => setLang(code)} aria-pressed={lang === code}>
              {LANG_LABELS[code].short}
            </button>
          ))}
        </div>
        <button type="button" className="theme" onClick={toggleTheme} aria-label={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")} title={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}>
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <div className="shell" role="main">
        {/* ============ CHAP PANEL ============ */}
        <aside className="aside">
          <div className="aside-in">
            <div className="brand" role="img" aria-label={t("Akademiya o'quv markazi")} />
            <h1>
              {t("Jamoaga")} <em>{t("qo'shiling")}</em>
            </h1>
            <p className="lede">{t("Bo'sh ish o'rinlari uchun ariza. To'ldirish 3 daqiqa vaqt oladi, mos kelsangiz 7 ish kuni ichida qo'ng'iroq qilamiz.")}</p>

            <div className="card" aria-hidden="true">
              <div className="card-top">
                <span className="ct-left">
                  <i className="card-mark" aria-hidden="true" />
                  {t("ARIZA")}
                </span>
                <span>{new Date().getFullYear()}</span>
              </div>
              <div className="card-head">
                <div className="card-photo">{photo ? <img src={photo} alt="" /> : <PersonIcon size={24} />}</div>
                <div className={`card-name${fullName ? "" : " empty"}`}>{fullName || t("Ism Familiya")}</div>
              </div>
              <div className="card-row">
                {t("Vakansiya:")} <b>{v.role || t("tanlanmagan")}</b>
              </div>
              <div className="card-row">
                {t("Filial:")} <b>{branchLabel || t("tanlanmagan")}</b>
              </div>
              <div className="card-foot">
                <i className={`dot${done ? " ok" : ""}`} />
                <span>{done ? `${t("Yuborildi")} · ${done.ref}` : t("To'ldirilmoqda")}</span>
              </div>
            </div>

            <ol className="steps">
              <li>
                <b>{t("Ariza ko'rib chiqiladi")}</b>
                {t("Ta'lim bo'limi 7 ish kuni ichida javob beradi.")}
              </li>
              <li>
                <b>{t("Suhbat")}</b>
                {t("Filial rahbari bilan qisqa suhbat va savol-javob.")}
              </li>
              <li>
                <b>{t("Sinov darsi")}</b>
                {t("O'qituvchilar uchun ochiq dars, boshqa lavozimlarda sinov muddati.")}
              </li>
            </ol>

            <p className="aside-foot">
              {t("Savollar bo'lsa:")} <a href={`tel:${CV_MAIN_PHONE.replace(/\s/g, "")}`}>{CV_MAIN_PHONE}</a>
              <br />
              Instagram:{" "}
              <a href="https://instagram.com/akademiya.rasmiy" target="_blank" rel="noopener">
                {CV_INSTAGRAM}
              </a>
            </p>
          </div>
        </aside>

        {/* ============ FORMA ============ */}
        <section className="main">
          {done ? (
            <div className="done">
              <div className="badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A1240" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5.5 5.5L20 7" />
                </svg>
              </div>
              <h2>{t("Ariza yuborildi")}</h2>
              <div className="ref">{done.ref}</div>
              <p>{t("Qabul qilingan fayllar: {files}.", { files: done.files })}</p>
              <p>{t("Rahmat! Arizangiz ta'lim bo'limiga tushdi. 7 ish kuni ichida telefon orqali bog'lanamiz.")}</p>
              <p>
                {t("Shoshilinch savol bo'lsa filialga o'zingiz qo'ng'iroq qilishingiz mumkin:")}{" "}
                <a href={`tel:${done.tel.replace(/\s/g, "")}`}>{done.tel}</a>
              </p>
              <button className="again" type="button" onClick={() => window.location.reload()}>
                {t("Yangi ariza to'ldirish")}
              </button>
            </div>
          ) : (
            <>
              <div className="progress">{meter("pctTop", true)}</div>

              {draftRestored && (
                <div className="draft">
                  <span>{t("Oldingi qoralama tiklandi.")}</span>
                  <button type="button" onClick={clearDraft}>
                    {t("Tozalash")}
                  </button>
                </div>
              )}

              <form ref={formRef} className="form-body" onSubmit={onSubmit} noValidate>
                {/* ---- 1. Shaxsiy ---- */}
                <fieldset>
                  <legend>{t("Shaxsiy ma'lumotlar")}</legend>
                  <p className="hint">{t("Bog'lanish uchun telefon raqamingiz ishlab turganiga ishonch hosil qiling.")}</p>
                  <div className="grid">
                    <div className="field full">
                      <label>{t("Nomzod rasmi")}</label>
                      <div className={`photo-row${photoErr ? " bad" : ""}`}>
                        <button type="button" className="avatar" id="ar-photoBtn" aria-label={t("Rasm tanlash")} onClick={() => photoInput.current?.click()}>
                          {photo ? <img src={photo} alt={t("Yuklangan rasm")} /> : <PersonIcon size={32} />}
                        </button>
                        <div className="photo-meta">
                          <b>{t("Rasmingizni yuklang")}</b>
                          <p>{t("3×4 yoki oddiy portret rasm bo'lsa ham bo'ladi. JPG yoki PNG, 10 MB gacha.")}</p>
                          <button className="mini" type="button" onClick={() => photoInput.current?.click()}>
                            {photo ? t("Boshqa rasm") : t("Rasm tanlash")}
                          </button>
                          {photo && (
                            <button className="mini ghost" type="button" onClick={removePhoto}>
                              {t("O'chirish")}
                            </button>
                          )}
                          <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoPick} />
                        </div>
                      </div>
                      {photoErr && <p className="err on">{photoErr}</p>}
                    </div>
                    <div className={fieldCls("firstName")}>
                      <label htmlFor="ar-firstName">{t("Ism")}</label>
                      <input id="ar-firstName" value={v.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" placeholder="Abdulloh" />
                      <p className="err">{t("Ismingizni yozing.")}</p>
                    </div>
                    <div className={fieldCls("lastName")}>
                      <label htmlFor="ar-lastName">{t("Familiya")}</label>
                      <input id="ar-lastName" value={v.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" placeholder="Raxmatullayev" />
                      <p className="err">{t("Familiyangizni yozing.")}</p>
                    </div>
                    <div className={fieldCls("birth")}>
                      <label htmlFor="ar-birth">{t("Tug'ilgan sana")}</label>
                      <div id="ar-birth" tabIndex={-1}>
                        <DateField value={v.birth} onChange={(iso) => set("birth", iso)} variant="panel" error={bad.has("birth")} placeholder="kk/oo/yyyy" />
                      </div>
                      <p className="err">{birthErr || t("Tug'ilgan sanangizni tanlang.")}</p>
                    </div>
                    <div className={fieldCls("phone")}>
                      <label htmlFor="ar-phone">{t("Telefon")}</label>
                      <input
                        id="ar-phone"
                        value={v.phone}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+998 (__) ___-__-__"
                        onFocus={() => {
                          if (!v.phone) set("phone", "+998 ");
                        }}
                        onChange={(e) => set("phone", formatUzPhone(e.target.value))}
                      />
                      <p className="err">{t("Raqamni to'liq kiriting: +998 va 9 ta raqam.")}</p>
                    </div>
                    <div className="field">
                      <label htmlFor="ar-telegram">
                        Telegram <i>{t("— ixtiyoriy")}</i>
                      </label>
                      <input id="ar-telegram" value={v.telegram} onChange={(e) => set("telegram", e.target.value)} autoComplete="off" placeholder="@username" />
                    </div>
                    <div className={fieldCls("city")}>
                      <label htmlFor="ar-city">{t("Yashash manzili")}</label>
                      <input id="ar-city" value={v.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Chortoq tumani, Namangan")} />
                      <p className="err">{t("Tuman va viloyatni yozing.")}</p>
                    </div>
                  </div>
                </fieldset>

                {/* ---- 2. Vakansiya ---- */}
                <fieldset>
                  <legend>{t("Qaysi ish uchun ariza berasiz")}</legend>
                  <p className="hint">{t("Bir nechta yo'nalish mos kelsa, asosiysini tanlang — qolganini suhbatda gaplashamiz.")}</p>
                  <div className="grid">
                    <div className={fieldCls("role", "full")}>
                      <label htmlFor="ar-role">{t("Vakansiya turi")}</label>
                      <Select
                        id="ar-role"
                        size="lg"
                        value={v.role}
                        error={bad.has("role")}
                        placeholder={t("Vakansiyani tanlang")}
                        options={roleOptions}
                        onChange={(val) => {
                          set("role", val);
                          if (!CV_TEACHING_ROLES.includes(val)) set("subject", "");
                        }}
                      />
                      <p className="err">{t("Vakansiya turini tanlang.")}</p>
                    </div>

                    {teaching && (
                      <div className={fieldCls("subject", "full")}>
                        <label htmlFor="ar-subject">{t("Qaysi fan yoki yo'nalish bo'yicha")}</label>
                        <Select id="ar-subject" size="lg" value={v.subject} error={bad.has("subject")} placeholder={t("Fanni tanlang")} options={subjectOptions} onChange={(val) => set("subject", val)} />
                        <p className="err">{t("Fan yoki yo'nalishni tanlang.")}</p>
                      </div>
                    )}

                    <div className={fieldCls("branch", "full")}>
                      <label htmlFor="ar-branch">{t("Filial")}</label>
                      <Select id="ar-branch" size="lg" value={v.branch} error={bad.has("branch")} placeholder={t("Filialni tanlang")} options={branchOptions} onChange={(val) => set("branch", val)} />
                      <p className="err">{t("Filialni tanlang.")}</p>
                      {v.branch && (
                        <div className="branch-info">
                          <b>{v.branch === "any" ? t("Barcha filiallar ko'rib chiqiladi") : selectedBranch?.address || selectedBranch?.location || selectedBranch?.name}</b>
                          <br />
                          {t("Telefon:")} {branchTel}
                        </div>
                      )}
                    </div>

                    <div className={fieldCls("load1", "full")}>
                      <label>{t("Bandlik turi")}</label>
                      <div className="pills">
                        {CV_LOADS.map((l, i) => (
                          <span key={l} style={{ display: "contents" }}>
                            <input type="radio" id={`ar-load${i + 1}`} name="load" value={l} checked={v.load === l} onChange={() => set("load", l)} />
                            <label htmlFor={`ar-load${i + 1}`}>{t(l)}</label>
                          </span>
                        ))}
                      </div>
                      <p className="err">{t("Bandlik turini tanlang.")}</p>
                    </div>

                    <div className={fieldCls("startDate")}>
                      <label htmlFor="ar-startDate">{t("Qachondan boshlay olasiz")}</label>
                      <div id="ar-startDate" tabIndex={-1}>
                        <DateField value={v.startDate} onChange={(iso) => set("startDate", iso)} variant="panel" error={bad.has("startDate")} placeholder="kk/oo/yyyy" />
                      </div>
                      <p className="err">{t("Sanani tanlang.")}</p>
                    </div>
                    <div className={fieldCls("salary")}>
                      <label htmlFor="ar-salary">
                        {t("Kutayotgan oylik")} <i>{t("— so'mda")}</i>
                      </label>
                      <input
                        id="ar-salary"
                        inputMode="numeric"
                        placeholder="4 000 000"
                        value={v.salary}
                        onChange={(e) => set("salary", formatSalary(e.target.value))}
                      />
                      <p className="err">{t("Taxminiy summani yozing.")}</p>
                    </div>
                  </div>
                </fieldset>

                {/* ---- 3. Ta'lim va tajriba ---- */}
                <fieldset>
                  <legend>{t("Ta'lim va tajriba")}</legend>
                  <p className="hint">{t("Tajribangiz kam bo'lsa ham ariza qoldiring — o'qitib ishga olamiz.")}</p>
                  <div className="grid">
                    <div className={fieldCls("edu")}>
                      <label htmlFor="ar-edu">{t("Ta'lim darajasi")}</label>
                      <Select id="ar-edu" size="lg" value={v.edu} error={bad.has("edu")} placeholder={t("Tanlang")} options={eduOptions} onChange={(val) => set("edu", val)} />
                      <p className="err">{t("Ta'lim darajangizni tanlang.")}</p>
                    </div>
                    <div className={fieldCls("exp")}>
                      <label htmlFor="ar-exp">{t("Ish tajribasi")}</label>
                      <Select id="ar-exp" size="lg" value={v.exp} error={bad.has("exp")} placeholder={t("Tanlang")} options={expOptions} onChange={(val) => set("exp", val)} />
                      <p className="err">{t("Tajribangizni tanlang.")}</p>
                    </div>
                    <div className={fieldCls("school", "full")}>
                      <label htmlFor="ar-school">{t("O'quv yurti va mutaxassislik")}</label>
                      <input id="ar-school" value={v.school} onChange={(e) => set("school", e.target.value)} placeholder={t("NamDU, ingliz tili va adabiyoti")} />
                      <p className="err">{t("O'quv yurti va yo'nalishni yozing.")}</p>
                    </div>
                    <div className="field full">
                      <label htmlFor="ar-lastJob">
                        {t("Oxirgi ish joyi va lavozimingiz")} <i>{t("— ixtiyoriy")}</i>
                      </label>
                      <input id="ar-lastJob" value={v.lastJob} onChange={(e) => set("lastJob", e.target.value)} placeholder={t("Masalan: 12-maktab, ingliz tili o'qituvchisi (2023–2026)")} />
                    </div>
                    <div className="field full">
                      <label htmlFor="ar-certText">
                        {t("Sertifikatlaringiz")} <i>{t("— ixtiyoriy")}</i>
                      </label>
                      <input id="ar-certText" value={v.certText} onChange={(e) => set("certText", e.target.value)} placeholder="IELTS 7.0, Milliy sertifikat B2, TOPIK 4 ..." />
                    </div>
                    <div className="field full">
                      <label htmlFor="ar-cv">
                        {t("CV fayli")} <i>{t("— ixtiyoriy, PDF yoki rasm")}</i>
                      </label>
                      <label className="file" htmlFor="ar-cv">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
                        </svg>
                        <span>{cvFile ? cvFile.name : t("Fayl tanlash")}</span>
                        <input ref={cvInput} id="ar-cv" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={onCvPick} />
                      </label>
                    </div>
                    <div className="field full">
                      <label htmlFor="ar-certFiles">
                        {t("Sertifikat va diplom nusxalari")} <i>{t("— ixtiyoriy")}</i>
                      </label>
                      <label
                        className={`drop${dragOver ? " over" : ""}`}
                        htmlFor="ar-certFiles"
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDragOver(false);
                        }}
                        onDrop={onDrop}
                      >
                        <b>
                          {t("Fayllarni tanlang")}
                          <span className="dragword"> {t("yoki shu yerga tashlang")}</span>
                        </b>
                        <span>
                          {docs.length
                            ? t("{n} ta fayl tanlandi — yana qo'shishingiz mumkin", { n: docs.length })
                            : t("PDF yoki rasm · bitta fayl 10 MB gacha · 10 tagacha")}
                        </span>
                        <input
                          ref={docsInput}
                          id="ar-certFiles"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => {
                            if (e.target.files) addDocs(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {docs.length > 0 && (
                        <ul className="files">
                          {docs.map((f, i) => (
                            <li key={`${f.name}-${f.size}`}>
                              <span>{f.name}</span>
                              <i>{fmtSize(f.size)}</i>
                              <button
                                type="button"
                                aria-label={t("{name} faylini olib tashlash", { name: f.name })}
                                onClick={() => removeDoc(i)}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {certErr && <p className="err on">{certErr}</p>}
                    </div>
                  </div>
                </fieldset>

                {/* ---- 4. Qo'shimcha ---- */}
                <fieldset>
                  <legend>{t("Qo'shimcha")}</legend>
                  <p className="hint">{t("Bu qismni rahbar birinchi bo'lib o'qiydi.")}</p>
                  <div className="grid">
                    <div className={fieldCls("about", "full")}>
                      <label htmlFor="ar-about">{t("Nega aynan Akademiyada ishlamoqchisiz va nimani yaxshi uddalaysiz")}</label>
                      <textarea id="ar-about" value={v.about} onChange={(e) => set("about", e.target.value)} placeholder={t("Qisqacha bo'lsa ham bo'ladi: nimalarda kuchlisiz, qanday natijalarga erishgansiz.")} />
                      <p className="err">{t("Bir-ikki jumla yozing.")}</p>
                    </div>
                    <div className="field full">
                      <label htmlFor="ar-source">
                        {t("Vakansiyani qayerdan bildingiz")} <i>{t("— ixtiyoriy")}</i>
                      </label>
                      <Select id="ar-source" size="lg" value={v.source} placeholder={t("Tanlang")} clearable options={sourceOptions} onChange={(val) => set("source", val)} />
                    </div>
                    <div className="hp" aria-hidden="true">
                      <label htmlFor="ar-website">Website</label>
                      <input id="ar-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                    <div className="full">
                      <label className={`consent${consentBad ? " bad" : ""}`}>
                        <input
                          id="ar-consent"
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => {
                            setConsent(e.target.checked);
                            if (e.target.checked) setConsentBad(false);
                          }}
                        />
                        <span>{t("Ma'lumotlarim ishga qabul jarayonida ko'rib chiqilishiga roziman va ular to'g'riligini tasdiqlayman.")}</span>
                      </label>
                      {consentBad && (
                        <p className="err on" style={{ marginLeft: 30 }}>
                          {t("Rozilikni belgilang.")}
                        </p>
                      )}
                    </div>
                  </div>

                  {sendErr && (
                    <p className="send-err" id="ar-sendErr" role="alert">
                      {sendErr}
                    </p>
                  )}
                  <div className="actions">
                    <button className="btn" type="submit" disabled={sending}>
                      {sending ? t("Yuborilmoqda...") : t("Arizani yuborish")}
                    </button>
                    <p>{t("Yuborganingizdan so'ng ariza raqamingiz chiqadi — uni saqlab qo'ying.")}</p>
                  </div>
                </fieldset>
              </form>
            </>
          )}
        </section>
      </div>

      {!done && (
        <div className="mobile-bar">
          {meter("pctBottom", false)}
          <button className="btn" type="button" disabled={sending} onClick={() => formRef.current?.requestSubmit()}>
            {sending ? t("Yuborilmoqda...") : t("Yuborish")}
          </button>
        </div>
      )}
    </>
  );
}
