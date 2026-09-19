"use client";

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CV_ANY_BRANCH,
  CV_EDU_LEVELS,
  CV_EXP_LEVELS,
  CV_FILE_LIMITS,
  CV_MAIN_PHONE,
  CV_MIN_AGE,
  CV_ROLE_GROUPS,
  CV_SOURCES,
  CV_SUBJECT_GROUPS,
  CV_TEACHING_ROLES,
} from "@/constants/managementCv";
import { ageOf, type CvApplication } from "@/lib/managementCv";
import { useT } from "@/components/shared/Language";

// ISHGA ARIZA ANKETASI — UMUMIY MANTIQ (19.09.2026).
//
// Ikki joyda BIR XIL anketa to'ldiriladi:
//   • ommaviy /ariza sahifasi (components/management/CvApplyPage.tsx) —
//     nomzod o'zi, dizayn CSS'i bilan;
//   • CRM'dagi "Ishga qabul anketasi" modali (components/management/
//     CvFormModal.tsx) — xodim nomzod nomidan, CRM uslubida.
// Savollar, tekshiruv, rasm kichraytirish, fayl chegaralari va yuborish
// (multipart → app/api/management-cv) shu yerda bitta nusxada — ikkovi
// hech qachon bir-biridan ajralib ketmasin (foydalanuvchi talabi: "modal
// yangi /ariza bilan bir xil bo'lsin"). Ko'rinish (JSX) har birida o'ziniki.
//
// Farqlar faqat `CvApplyFormOptions` orqali: CRM'da rasm va rozilik
// majburiy emas (xodimda nomzod rasmi bo'lmasligi mumkin), filial navbar
// filialidan boshlanadi, qoralama va tuzoq maydoni yo'q.

export interface ApplyBranch {
  id: number;
  name: string;
  location: string;
  address: string;
  phone: string;
}

export type TextKey =
  | "firstName" | "lastName" | "birth" | "phone" | "telegram" | "city" | "role" | "subject" | "branch"
  | "load" | "startDate" | "salary" | "edu" | "exp" | "school" | "lastJob" | "certText" | "about" | "source";

export type Values = Record<TextKey, string>;

export const EMPTY_VALUES: Values = {
  firstName: "", lastName: "", birth: "", phone: "", telegram: "", city: "", role: "", subject: "", branch: "",
  load: "", startDate: "", salary: "", edu: "", exp: "", school: "", lastJob: "", certText: "", about: "", source: "",
};

/** Majburiy matn/tanlov maydonlari — o'lchagich va tekshiruv shu ro'yxatdan (dizayndagi `required`). */
export const REQUIRED_KEYS: TextKey[] = ["firstName", "lastName", "birth", "phone", "city", "role", "branch", "startDate", "salary", "edu", "exp", "school", "about"];

export function fmtSize(b: number): string {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
}

/** "4000000" → "4 000 000" — kutayotgan oylik maydoni. */
export function formatSalary(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}

/** Rasmni brauzerda kichraytiradi (uzun tomoni `max`) — yuklash yengil bo'lsin. */
export function shrinkImage(src: string, max: number, quality: number): Promise<string> {
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

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Google Sheets'ga yoziladigan qator — Apps Script HEADERS bilan bir xil kalitlar. */
export function cvSheetsRecord(app: CvApplication, sid: string, ref: string) {
  return {
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
}

export interface CvApplyFormOptions {
  branches: ApplyBranch[];
  /** Rasm majburiymi — ommaviy anketada ha, CRM'da (xodim to'ldiradi) yo'q. */
  photoRequired: boolean;
  /** Rozilik katakchasi bormi — ommaviy anketada ha, CRM'da yo'q. */
  consentRequired: boolean;
  /** Yuborilgach yozuv Google Sheets'ga ham ketadi (bo'sh — yo'q, javob kutilmaydi). */
  sheetsUrl: string;
  /** Boshlang'ich qiymatlar (CRM: navbar filiali). */
  initial?: Partial<Values>;
  /** Tuzoq maydoni qiymati (ommaviy anketa) — server to'ldirilganini ko'rsa jimgina "qabul qildim" deydi. */
  honeypot?: string;
  /** Xato maydoniga o'tish uchun DOM id prefiksi: `${idPrefix}${kalit}`. */
  idPrefix?: string;
}

export interface CvApplySuccess {
  ref: string;
  app: CvApplication | null;
  /** Qabul qilingan fayllar tavsifi — "rasm, 2 ta sertifikat/diplom, CV fayli". */
  files: string[];
}

export function useCvApplyForm(opts: CvApplyFormOptions) {
  const { branches, photoRequired, consentRequired, sheetsUrl, honeypot = "", idPrefix = "ar-" } = opts;
  const { t } = useT();
  const [v, setV] = useState<Values>(() => ({ ...EMPTY_VALUES, ...(opts.initial || {}) }));
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState(""); // dataURL (kichraytirilgan JPEG)
  const [photoErr, setPhotoErr] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<File[]>([]);
  const [certErr, setCertErr] = useState("");
  const [bad, setBad] = useState<Set<string>>(() => new Set());
  const [birthErr, setBirthErr] = useState("");
  const [consentBad, setConsentBad] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [sending, setSending] = useState(false);

  const photoInput = useRef<HTMLInputElement>(null);
  const cvInput = useRef<HTMLInputElement>(null);
  const docsInput = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  // Maydon o'zgarganda uning qizil belgisi darhol o'chadi (tekshiruv
  // qaytadan faqat "Yuborish"da) — tuzatilgan maydon qizil turib qolmasin.
  const set = useCallback((k: TextKey, val: string) => {
    setV((s) => ({ ...s, [k]: val }));
    const badKey = k === "load" ? "load1" : k;
    setBad((b) => {
      if (!b.has(badKey)) return b;
      const next = new Set(b);
      next.delete(badKey);
      return next;
    });
  }, []);
  const teaching = CV_TEACHING_ROLES.includes(v.role);

  const selectedBranch = v.branch && v.branch !== "any" ? branches.find((b) => String(b.id) === v.branch) ?? null : null;
  const branchLabel = v.branch === "any" ? t(CV_ANY_BRANCH) : selectedBranch ? selectedBranch.name : "";
  const branchTel = (selectedBranch?.phone || CV_MAIN_PHONE).trim();
  const today = new Date().toISOString().slice(0, 10);

  /* ---- tanlov ro'yxatlari ---- */
  const roleOptions = useMemo(
    () => CV_ROLE_GROUPS.flatMap((g) => g.roles.map((r) => ({ value: r, label: t(r), group: t(g.label) }))),
    [t],
  );
  const subjectOptions = useMemo(
    () => CV_SUBJECT_GROUPS.flatMap((g) => g.subjects.map((sub) => ({ value: sub, label: t(sub), group: t(g.label) }))),
    [t],
  );
  const branchOptions = useMemo(
    () => [
      ...branches.map((b) => ({ value: String(b.id), label: b.name, sub: b.address || b.location || undefined })),
      { value: "any", label: t(CV_ANY_BRANCH) },
    ],
    [branches, t],
  );
  const eduOptions = useMemo(() => CV_EDU_LEVELS.map((o) => ({ value: o, label: t(o) })), [t]);
  const expOptions = useMemo(() => CV_EXP_LEVELS.map((o) => ({ value: o, label: t(o) })), [t]);
  const sourceOptions = useMemo(() => CV_SOURCES.map((o) => ({ value: o, label: t(o) })), [t]);

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
    let n = REQUIRED_KEYS.filter(fieldOk).length;
    let total = REQUIRED_KEYS.length + 1;
    if (v.load) n++;
    if (consentRequired) {
      total++;
      if (consent) n++;
    }
    if (photoRequired) {
      total++;
      if (photo) n++;
    }
    return Math.round((n / total) * 100);
  }, [fieldOk, v.load, consent, photo, consentRequired, photoRequired]);

  /* ---- rasm ---- */
  function onPhotoPick(e: ChangeEvent<HTMLInputElement>) {
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
  function removePhoto() {
    setPhoto("");
    setPhotoErr("");
  }

  /* ---- CV fayli ---- */
  function onCvPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > CV_FILE_LIMITS.fileBytes) {
      setCertErr(t("CV fayli 10 MB dan oshmasin."));
      e.target.value = "";
      return;
    }
    setCvFile(f);
  }
  function removeCv() {
    setCvFile(null);
    if (cvInput.current) cvInput.current.value = "";
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
    setDocs(next);
    setCertErr(msg);
  }
  function removeDoc(i: number) {
    setDocs((d) => d.filter((_, j) => j !== i));
    setCertErr("");
  }

  /* ---- tekshirish ---- */
  function validate(): boolean {
    const nextBad = new Set<string>();
    let first: string | null = null;
    const mark = (id: string) => {
      nextBad.add(id);
      if (!first) first = id;
    };
    if (photoRequired && !photo) {
      setPhotoErr(t("Rasmingizni yuklang."));
      first = "photoBtn";
    } else setPhotoErr("");
    for (const k of REQUIRED_KEYS) {
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
    if (v.startDate && v.startDate < today) mark("startDate");
    if (teaching && !v.subject) mark("subject");
    if (!v.load) mark("load1");
    if (consentRequired) {
      setConsentBad(!consent);
      if (!consent) mark("consent");
    }
    setBad(nextBad);
    if (first) {
      const el = document.getElementById(`${idPrefix}${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
    return !first;
  }

  /* ---- yuborish ---- */
  /** Tekshiradi va yuboradi; muvaffaqiyatda natija, xatoda `null` (`sendErr` to'ldiriladi). */
  async function submit(): Promise<CvApplySuccess | null> {
    if (!validate() || sendingRef.current) return null;
    sendingRef.current = true;
    setSending(true);
    setSendErr("");
    const sid = `pa${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    try {
      const fd = new FormData();
      for (const k of Object.keys(v) as TextKey[]) fd.append(k, v[k]);
      fd.append("consent", consent ? "on" : "");
      fd.append("website", honeypot);
      fd.append("sid", sid);
      if (photo) fd.append("photo", dataUrlToFile(photo, "rasm.jpg"));
      if (cvFile) fd.append("cv", cvFile);
      for (const d of docs) fd.append("docs", d);

      const res = await fetch("/api/management-cv", { method: "POST", body: fd });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; ref?: string; application?: CvApplication | null };
      if (!res.ok || !out.ok) throw new Error(out.error || `server ${res.status}`);
      const ref = out.ref || "";
      const app = out.application ?? null;

      // Google Sheets ulangan bo'lsa — markaziy jadvalga ham (javob kutilmaydi).
      if (sheetsUrl && app) fetch(sheetsUrl, { method: "POST", body: JSON.stringify(cvSheetsRecord(app, sid, ref)) }).catch(() => {});

      const files: string[] = [];
      if (photo) files.push(t("rasm"));
      if (docs.length) files.push(t("{n} ta sertifikat/diplom", { n: docs.length }));
      if (cvFile) files.push(t("CV fayli"));
      return { ref, app, files };
    } catch (err) {
      const msg = err instanceof Error && err.message && !/^server \d+/.test(err.message) ? t(err.message) : "";
      setSendErr(msg || t("Yuborib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring — yozganlaringiz saqlanib turibdi."));
      return null;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  /** Hammasini boshlang'ich holatga qaytaradi (qoralama tozalash, modal qayta ochish). */
  function reset() {
    setV({ ...EMPTY_VALUES, ...(opts.initial || {}) });
    setConsent(false);
    setConsentBad(false);
    setPhoto("");
    setPhotoErr("");
    setCvFile(null);
    setDocs([]);
    setCertErr("");
    setBad(new Set());
    setBirthErr("");
    setSendErr("");
    if (cvInput.current) cvInput.current.value = "";
    if (docsInput.current) docsInput.current.value = "";
  }

  return {
    t,
    v, setV, set,
    consent, setConsent, consentBad, setConsentBad,
    photo, setPhoto, photoErr, setPhotoErr,
    cvFile, docs, certErr,
    bad, birthErr, sendErr, setSendErr, sending,
    teaching, selectedBranch, branchLabel, branchTel, today, pct, fieldOk,
    roleOptions, subjectOptions, branchOptions, eduOptions, expOptions, sourceOptions,
    photoInput, cvInput, docsInput,
    onPhotoPick, removePhoto, onCvPick, removeCv, addDocs, removeDoc,
    validate, submit, reset,
  };
}

export type CvApplyForm = ReturnType<typeof useCvApplyForm>;
