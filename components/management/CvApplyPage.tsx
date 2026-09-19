"use client";

/* eslint-disable no-restricted-syntax, @next/next/no-img-element --
   Ommaviy nomzod sahifasi: dizayn (akademiya-ishga-ariza.html) o'z
   ko'rinishidagi native <select> va sana maydonlarini ishlatadi, ilova
   qobig'ining ui/Select va DateField'lari bu yerda mos kelmaydi (ular
   CRM uslubida). Rasmlar — data: URL va Cloudinary, next/image kerak emas. */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import {
  CV_ANY_BRANCH,
  CV_EDU_LEVELS,
  CV_EXP_LEVELS,
  CV_FILE_LIMITS,
  CV_INSTAGRAM,
  CV_LOADS,
  CV_MAIN_PHONE,
  CV_MIN_AGE,
  CV_ROLE_GROUPS,
  CV_SOURCES,
  CV_SUBJECT_GROUPS,
  CV_TEACHING_ROLES,
} from "@/constants/managementCv";
import { ageOf, formatUzPhone, type CvApplication } from "@/lib/managementCv";
import { useT } from "@/components/shared/Language";

// OMMAVIY ISH ARIZASI (/ariza) — dizayn foydalanuvchining
// "akademiya-ishga-ariza.html" faylidan (19.09.2026): chap panelda jonli
// ariza kartasi + 3 qadam, o'ngda 4 bo'limli forma (shaxsiy, vakansiya,
// ta'lim/tajriba, qo'shimcha), tepada to'ldirilish o'lchagichi, mobilda
// pastki panel. Uslublar app/ariza/ariza.css da.
//
// NIMA QILADI:
//   • rasm (majburiy) — brauzerda 900px JPEG'ga kichraytiriladi, so'ng
//     server orqali Cloudinary'ga; CV fayli va sertifikat nusxalari (10
//     tagacha) ham Cloudinary'ga — app/api/management-cv (multipart);
//   • qoralama localStorage'da (matn + rasm) — sahifa yopilib qolsa
//     yozganlari qaytadi; fayllar qoralamaga tushmaydi (File saqlanmaydi);
//   • tekshiruv mijozda (tezkor) va serverda (haqiqiy) bir xil;
//   • Google Sheets ulangan bo'lsa (`#s=BASE64(url)`) ariza jadvalga ham
//     yoziladi — CRM dagi "Ariza havolasini ulashish" shunday havola beradi.
//
// Filiallar bazadan (app/ariza/page.tsx server komponenti beradi) —
// tanlangan filial `branchId` bo'lib saqlanadi va CRM'da o'sha filial
// ro'yxatida ko'rinadi; "qaysi filial bo'lsa ham" — hammasida.

export interface ApplyBranch {
  id: number;
  name: string;
  location: string;
  address: string;
  phone: string;
}

type TextKey =
  | "firstName" | "lastName" | "birth" | "phone" | "telegram" | "city" | "role" | "subject" | "branch"
  | "load" | "startDate" | "salary" | "edu" | "exp" | "school" | "lastJob" | "certText" | "about" | "source";

type Values = Record<TextKey, string>;

const EMPTY: Values = {
  firstName: "", lastName: "", birth: "", phone: "", telegram: "", city: "", role: "", subject: "", branch: "",
  load: "", startDate: "", salary: "", edu: "", exp: "", school: "", lastJob: "", certText: "", about: "", source: "",
};

/** Majburiy matn/tanlov maydonlari — o'lchagich va tekshiruv shu ro'yxatdan (dizayndagi `required`). */
const REQUIRED: TextKey[] = ["firstName", "lastName", "birth", "phone", "city", "role", "branch", "startDate", "salary", "edu", "exp", "school", "about"];

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

function fmtSize(b: number): string {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
}

/** Rasmni brauzerda kichraytiradi (uzun tomoni `max`) — yuklash yengil bo'lsin. */
function shrinkImage(src: string, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      try {
        resolve(c.toDataURL("image/jpeg", quality));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

const PersonIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6" />
  </svg>
);

export default function CvApplyPage({ branches }: { branches: ApplyBranch[] }) {
  const { t } = useT();
  const [v, setV] = useState<Values>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // tuzoq maydoni — odam ko'rmaydi
  const [photo, setPhoto] = useState(""); // dataURL (kichraytirilgan JPEG)
  const [photoErr, setPhotoErr] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<File[]>([]);
  const [certErr, setCertErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [bad, setBad] = useState<Set<string>>(() => new Set());
  const [birthErr, setBirthErr] = useState("");
  const [consentBad, setConsentBad] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [sending, setSending] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [done, setDone] = useState<{ ref: string; tel: string; files: string } | null>(null);
  const [sheetsUrl] = useState(readSheetsUrlFromHash);

  const formRef = useRef<HTMLFormElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cvInput = useRef<HTMLInputElement>(null);
  const docsInput = useRef<HTMLInputElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  const set = useCallback((k: TextKey, val: string) => setV((s) => ({ ...s, [k]: val })), []);
  const teaching = CV_TEACHING_ROLES.includes(v.role);

  const selectedBranch = v.branch && v.branch !== "any" ? branches.find((b) => String(b.id) === v.branch) ?? null : null;
  const branchLabel = v.branch === "any" ? t(CV_ANY_BRANCH) : selectedBranch ? selectedBranch.name : "";
  const branchTel = (selectedBranch?.phone || CV_MAIN_PHONE).trim();

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
        const next: Values = { ...EMPTY };
        let any = false;
        for (const k of Object.keys(EMPTY) as TextKey[]) {
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
  }, []);

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
    setV(EMPTY);
    setConsent(false);
    setPhoto("");
    setPhotoErr("");
    setCvFile(null);
    setDocs([]);
    setCertErr("");
    setBad(new Set());
    setDraftRestored(false);
    if (cvInput.current) cvInput.current.value = "";
  }

  /* ---- o'lchagich ---- */
  const fieldOk = useCallback(
    (k: TextKey) => {
      const val = v[k].trim();
      if (!val) return false;
      if (k === "phone") return val.replace(/\D/g, "").length === 12;
      if (k === "birth") {
        const a = ageOf(val);
        return a >= CV_MIN_AGE && a < 80;
      }
      return true;
    },
    [v],
  );
  const pct = useMemo(() => {
    let n = REQUIRED.filter(fieldOk).length;
    if (v.load) n++;
    if (consent) n++;
    if (photo) n++;
    return Math.round((n / (REQUIRED.length + 3)) * 100);
  }, [fieldOk, v.load, consent, photo]);

  /* ---- rasm ---- */
  async function onPhotoPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return setPhotoErr(t("Faqat rasm yuklang — JPG yoki PNG."));
    if (f.size > CV_FILE_LIMITS.photoBytes) return setPhotoErr(t("Rasm hajmi 10 MB dan oshmasin."));
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setPhoto(await shrinkImage(String(reader.result), 900, 0.82));
        setPhotoErr("");
      } catch {
        setPhotoErr(t("Bu formatdagi rasm ochilmadi — JPG yoki PNG yuklang."));
      }
    };
    reader.onerror = () => setPhotoErr(t("Rasmni o'qib bo'lmadi, boshqasini tanlang."));
    reader.readAsDataURL(f);
  }

  /* ---- sertifikat va diplomlar ---- */
  function addDocs(list: FileList | File[]) {
    let msg = "";
    // FileList JONLI — chaqiruvchi input'ni darhol tozalaydi (`value = ""`),
    // React esa yangilovchini keyinroq ishga tushiradi. Shu bois nusxa hozir.
    const picked = Array.from(list);
    // Xato matni ham SHU YERDA hisoblanadi (yangilovchi ichida emas — u
    // keyinroq, render paytida ishlaydi va `msg` bo'sh qolardi).
    const next = [...docs];
    {
      for (const f of picked) {
        if (next.length >= CV_FILE_LIMITS.docsCount) {
          msg = t("Ko'pi bilan {n} ta fayl yuklash mumkin.", { n: CV_FILE_LIMITS.docsCount });
          break;
        }
        if (f.size > CV_FILE_LIMITS.fileBytes) {
          msg = t("{name} — 10 MB dan katta, siqib qayta yuklang.", { name: f.name });
          continue;
        }
        if (next.reduce((a, x) => a + x.size, 0) + f.size > CV_FILE_LIMITS.docsTotalBytes) {
          msg = t("Fayllarning umumiy hajmi 25 MB dan oshmasin.");
          continue;
        }
        if (!/^image\//.test(f.type) && f.type !== "application/pdf" && !/\.(pdf|jpe?g|png|webp)$/i.test(f.name)) {
          msg = t("{name} — faqat PDF yoki rasm yuklanadi.", { name: f.name });
          continue;
        }
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        next.push(f);
      }
    }
    setDocs(next);
    setCertErr(msg);
  }
  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) addDocs(e.dataTransfer.files);
  }

  /* ---- tekshirish ---- */
  function validate(): boolean {
    const nextBad = new Set<string>();
    let first: string | null = null;
    const mark = (id: string) => {
      nextBad.add(id);
      if (!first) first = id;
    };
    if (!photo) {
      setPhotoErr(t("Rasmingizni yuklang."));
      first = "photoBtn";
    } else setPhotoErr("");
    for (const k of REQUIRED) {
      if (k === "birth") {
        const a = v.birth ? ageOf(v.birth) : -1;
        setBirthErr(
          v.birth && !(a >= CV_MIN_AGE && a < 80)
            ? t("Ishga qabul {age} yoshdan boshlanadi — sanani tekshiring.", { age: CV_MIN_AGE })
            : t("Tug'ilgan sanangizni tanlang."),
        );
      }
      if (!fieldOk(k)) mark(k);
    }
    if (teaching && !v.subject) mark("subject");
    if (!v.load) mark("load1");
    setConsentBad(!consent);
    if (!consent) mark("consent");
    setBad(nextBad);
    if (first) {
      const el = document.getElementById(`ar-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
    return !first;
  }

  /* ---- yuborish ---- */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendErr("");
    const sid = `pa${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    try {
      const fd = new FormData();
      for (const k of Object.keys(v) as TextKey[]) fd.append(k, v[k]);
      fd.append("consent", consent ? "on" : "");
      fd.append("website", website);
      fd.append("sid", sid);
      fd.append("photo", dataUrlToFile(photo, "rasm.jpg"));
      if (cvFile) fd.append("cv", cvFile);
      for (const d of docs) fd.append("docs", d);

      const res = await fetch("/api/management-cv", { method: "POST", body: fd });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; ref?: string; application?: CvApplication | null };
      if (!res.ok || !out.ok) throw new Error(out.error || `server ${res.status}`);
      const ref = out.ref || "";
      const app = out.application;

      // Google Sheets ulangan bo'lsa — markaziy jadvalga ham (javob kutilmaydi).
      if (sheetsUrl && app) {
        const rec = {
          sid,
          ref,
          name: app.name,
          phone: app.phone,
          telegram: app.telegram || "",
          address: app.address,
          birth: app.birth,
          university: app.university,
          position: app.position,
          subject: app.subject,
          branchName: app.branchName || "",
          load: app.load || "",
          edu: app.edu || "",
          achievements: app.achievements,
          experience: app.experience,
          startDate: app.startDate,
          whyUs: app.whyUs,
          currentJob: app.currentJob,
          expectedSalary: app.expectedSalary,
          source: app.source || "",
          photoUrl: app.photoUrl || "",
          cvFileUrl: app.cvFile?.url || "",
          docsUrls: (app.docs || []).map((d) => d.url),
          priorities: [],
          strengths: [],
        };
        fetch(sheetsUrl, { method: "POST", body: JSON.stringify(rec) }).catch(() => {});
      }

      const files = [t("rasm")];
      if (docs.length) files.push(t("{n} ta sertifikat/diplom", { n: docs.length }));
      if (cvFile) files.push(t("CV fayli"));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* — */
      }
      setDone({ ref, tel: branchTel, files: files.join(", ") });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg = err instanceof Error && err.message && !/^server \d+/.test(err.message) ? t(err.message) : "";
      setSendErr(msg || t("Yuborib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring — yozganlaringiz saqlanib turibdi."));
      setTimeout(() => document.getElementById("ar-sendErr")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const birthMax = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - CV_MIN_AGE);
    return d.toISOString().slice(0, 10);
  })();
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
      <main className="shell">
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
                <i className="dot" />
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
                            <button
                              className="mini ghost"
                              type="button"
                              onClick={() => {
                                setPhoto("");
                                setPhotoErr("");
                              }}
                            >
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
                      <input id="ar-birth" type="date" min="1950-01-01" max={birthMax} value={v.birth} onChange={(e) => set("birth", e.target.value)} />
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
                      <select
                        id="ar-role"
                        value={v.role}
                        onChange={(e) => {
                          set("role", e.target.value);
                          if (!CV_TEACHING_ROLES.includes(e.target.value)) set("subject", "");
                        }}
                      >
                        <option value="">{t("Vakansiyani tanlang")}</option>
                        {CV_ROLE_GROUPS.map((g) => (
                          <optgroup key={g.label} label={t(g.label)}>
                            {g.roles.map((r) => (
                              <option key={r} value={r}>
                                {t(r)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="err">{t("Vakansiya turini tanlang.")}</p>
                    </div>

                    {teaching && (
                      <div className={fieldCls("subject", "full")}>
                        <label htmlFor="ar-subject">{t("Qaysi fan yoki yo'nalish bo'yicha")}</label>
                        <select id="ar-subject" value={v.subject} onChange={(e) => set("subject", e.target.value)}>
                          <option value="">{t("Fanni tanlang")}</option>
                          {CV_SUBJECT_GROUPS.map((g) => (
                            <optgroup key={g.label} label={t(g.label)}>
                              {g.subjects.map((s) => (
                                <option key={s} value={s}>
                                  {t(s)}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="err">{t("Fan yoki yo'nalishni tanlang.")}</p>
                      </div>
                    )}

                    <div className={fieldCls("branch", "full")}>
                      <label htmlFor="ar-branch">{t("Filial")}</label>
                      <select id="ar-branch" value={v.branch} onChange={(e) => set("branch", e.target.value)}>
                        <option value="">{t("Filialni tanlang")}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.name}
                            {b.address || b.location ? ` — ${b.address || b.location}` : ""}
                          </option>
                        ))}
                        <option value="any">{t(CV_ANY_BRANCH)}</option>
                      </select>
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
                      <input id="ar-startDate" type="date" min={today} value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
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
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 12);
                          set("salary", d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");
                        }}
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
                      <select id="ar-edu" value={v.edu} onChange={(e) => set("edu", e.target.value)}>
                        <option value="">{t("Tanlang")}</option>
                        {CV_EDU_LEVELS.map((o) => (
                          <option key={o} value={o}>
                            {t(o)}
                          </option>
                        ))}
                      </select>
                      <p className="err">{t("Ta'lim darajangizni tanlang.")}</p>
                    </div>
                    <div className={fieldCls("exp")}>
                      <label htmlFor="ar-exp">{t("Ish tajribasi")}</label>
                      <select id="ar-exp" value={v.exp} onChange={(e) => set("exp", e.target.value)}>
                        <option value="">{t("Tanlang")}</option>
                        {CV_EXP_LEVELS.map((o) => (
                          <option key={o} value={o}>
                            {t(o)}
                          </option>
                        ))}
                      </select>
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
                        <input
                          ref={cvInput}
                          id="ar-cv"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f && f.size > CV_FILE_LIMITS.fileBytes) {
                              setCertErr(t("CV fayli 10 MB dan oshmasin."));
                              e.target.value = "";
                              return;
                            }
                            setCvFile(f);
                          }}
                        />
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
                                onClick={() => {
                                  setDocs((d) => d.filter((_, j) => j !== i));
                                  setCertErr("");
                                }}
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
                      <select id="ar-source" value={v.source} onChange={(e) => set("source", e.target.value)}>
                        <option value="">{t("Tanlang")}</option>
                        {CV_SOURCES.map((o) => (
                          <option key={o} value={o}>
                            {t(o)}
                          </option>
                        ))}
                      </select>
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
      </main>

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
