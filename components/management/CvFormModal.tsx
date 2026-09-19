"use client";

/* eslint-disable @next/next/no-img-element -- nomzod rasmi data: URL, next/image kerak emas. */

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { Paperclip, Upload, User, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { CV_LOADS, CV_TEACHING_ROLES } from "@/constants/managementCv";
import { formatUzPhone, type CvApplication } from "@/lib/managementCv";
import { fmtSize, formatSalary, useCvApplyForm, type ApplyBranch } from "./cvApplyForm";

// "ISHGA QABUL ANKETASI" MODALI — Boshqaruv → Ishga qabul (CV) →
// "CV to'ldirish (yangi ariza)". 19.09.2026 gacha bu yerda eski 21 savolli
// anketa turardi (native sana maydoni, tarjimasiz variantlar); endi ommaviy
// /ariza sahifasi bilan AYNI savollar va ayni mantiq (./cvApplyForm.ts —
// tekshiruv, rasm kichraytirish, fayl chegaralari, multipart yuborish,
// Google Sheets'ga yozish). Farqi: xodim nomzod nomidan to'ldiradi —
//   • rasm va rozilik majburiy emas (server xodim sessiyasini ko'rib
//     shuni qabul qiladi, kim kiritganini `enteredBy` ga yozadi);
//   • filial navbarda tanlangan filialdan boshlanadi;
//   • qoralama va tuzoq maydoni yo'q.
// Ko'rinish CRM uslubida (ui/Select, ui/DateField, Tailwind) — ommaviy
// sahifaning dizayn CSS'i bu yerga kirmaydi.

const ID = "cvf-";

interface Props {
  /** Google Sheets ulangan bo'lsa — ariza jadvalga ham yoziladi. */
  sheetsUrl: string;
  onClose: () => void;
  onSaved: (app: CvApplication | null, ref: string) => void | Promise<void>;
}

function Section({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="pt-1">
      <div className="text-[12px] font-bold uppercase tracking-wider text-primary">
        {n}. {title}
      </div>
      <p className="text-[12px] text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}

function Field({ label, optional, err, full, htmlFor, children }: { label: ReactNode; optional?: boolean; err?: string; full?: boolean; htmlFor?: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium mb-1">
        {label}
        {optional && <span className="text-muted-foreground font-normal"> {t("— ixtiyoriy")}</span>}
      </label>
      {children}
      {err && <p className="text-[12px] text-rose-500 mt-1">{err}</p>}
    </div>
  );
}

export default function CvFormModal({ sheetsUrl, onClose, onSaved }: Props) {
  const branch = useBranch();
  const branches: ApplyBranch[] = useMemo(
    () => branch.branches.map((b) => ({ id: b.id, name: b.name, location: "", address: "", phone: "" })),
    [branch.branches],
  );
  const form = useCvApplyForm({
    branches,
    photoRequired: false,
    consentRequired: false,
    sheetsUrl,
    initial: { branch: branch.branchId ? String(branch.branchId) : "" },
    idPrefix: ID,
  });
  const {
    t, v, set, photo, photoErr, cvFile, docs, certErr, bad, birthErr, sendErr, sending, teaching, pct,
    roleOptions, subjectOptions, branchOptions, eduOptions, expOptions, sourceOptions,
    photoInput, cvInput, docsInput, onPhotoPick, removePhoto, onCvPick, removeCv, addDocs, removeDoc, submit,
  } = form;
  const [dragOver, setDragOver] = useState(false);
  const modal = useModalClose(onClose);

  const inp = (k: string) =>
    `w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 ${bad.has(k) ? "border-rose-400 focus:ring-rose-300" : "border-border focus:ring-primary/40"}`;
  const err = (k: string, msg: string) => (bad.has(k) ? msg : undefined);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) addDocs(e.dataTransfer.files);
  }

  async function onSubmit() {
    const r = await submit();
    if (!r) return;
    await onSaved(r.app, r.ref);
    modal.close();
  }

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      size="3xl"
      zIndex={120}
      locked={sending}
      title={t("Ishga qabul anketasi")}
      subtitle={t("Ommaviy /ariza sahifasidagi savollar bilan bir xil — nomzod nomidan to'ldiring.")}
      bodyClassName="p-5"
      footer={
        <>
          {sendErr && (
            <p className="mr-auto text-[12px] text-rose-500" role="alert">
              {sendErr}
            </p>
          )}
          <button type="button" onClick={modal.close} disabled={sending} className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm disabled:opacity-60">
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={onSubmit} disabled={sending} className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {sending ? t("Yuborilmoqda…") : t("Anketani yuborish")}
          </button>
        </>
      }
    >
      {/* To'ldirilish o'lchagichi — ommaviy sahifadagi kabi. */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("Ariza to'ldirilishi")}>
          <i className={`block h-full rounded-full transition-[width] ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          <b className="text-foreground">{pct}</b>
          {t("% to'ldirildi")}
        </span>
      </div>

      <div className="space-y-5">
        {/* ---- 1. Shaxsiy ---- */}
        <Section n={1} title={t("Shaxsiy ma'lumotlar")} hint={t("Bog'lanish uchun telefon raqamingiz ishlab turganiga ishonch hosil qiling.")} />
        <div className={`flex items-center gap-4 rounded-xl border p-3 ${photoErr ? "border-rose-400" : "border-border bg-secondary/30"}`}>
          <button
            type="button"
            id={`${ID}photoBtn`}
            onClick={() => photoInput.current?.click()}
            aria-label={t("Rasm tanlash")}
            className="h-16 w-16 rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center text-muted-foreground shrink-0"
          >
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <User className="w-7 h-7" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">
              {t("Nomzod rasmi")} <span className="text-muted-foreground font-normal">{t("— ixtiyoriy")}</span>
            </div>
            <p className="text-[12px] text-muted-foreground">{t("3×4 yoki oddiy portret rasm bo'lsa ham bo'ladi. JPG yoki PNG, 10 MB gacha.")}</p>
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={() => photoInput.current?.click()} className="h-8 px-3 rounded-md border border-border bg-card hover:bg-secondary text-[12px]">
                {photo ? t("Boshqa rasm") : t("Rasm tanlash")}
              </button>
              {photo && (
                <button type="button" onClick={removePhoto} className="h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:bg-secondary">
                  {t("O'chirish")}
                </button>
              )}
            </div>
            {photoErr && <p className="text-[12px] text-rose-500 mt-1">{photoErr}</p>}
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoPick} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("Ism")} htmlFor={`${ID}firstName`} err={err("firstName", t("Ismingizni yozing."))}>
            <input id={`${ID}firstName`} value={v.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="off" placeholder="Abdulloh" className={inp("firstName")} />
          </Field>
          <Field label={t("Familiya")} htmlFor={`${ID}lastName`} err={err("lastName", t("Familiyangizni yozing."))}>
            <input id={`${ID}lastName`} value={v.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" placeholder="Raxmatullayev" className={inp("lastName")} />
          </Field>
          <Field label={t("Tug'ilgan sana")} err={bad.has("birth") ? birthErr || t("Tug'ilgan sanangizni tanlang.") : undefined}>
            <div id={`${ID}birth`} tabIndex={-1}>
              <DateField value={v.birth} onChange={(iso) => set("birth", iso)} variant="form" error={bad.has("birth")} placeholder="kk/oo/yyyy" />
            </div>
          </Field>
          <Field label={t("Telefon")} htmlFor={`${ID}phone`} err={err("phone", t("Raqamni to'liq kiriting: +998 va 9 ta raqam."))}>
            <input
              id={`${ID}phone`}
              value={v.phone}
              inputMode="tel"
              autoComplete="off"
              placeholder="+998 (__) ___-__-__"
              onFocus={() => {
                if (!v.phone) set("phone", "+998 ");
              }}
              onChange={(e) => set("phone", formatUzPhone(e.target.value))}
              className={inp("phone")}
            />
          </Field>
          <Field label="Telegram" optional htmlFor={`${ID}telegram`}>
            <input id={`${ID}telegram`} value={v.telegram} onChange={(e) => set("telegram", e.target.value)} autoComplete="off" placeholder="@username" className={inp("telegram")} />
          </Field>
          <Field label={t("Yashash manzili")} htmlFor={`${ID}city`} err={err("city", t("Tuman va viloyatni yozing."))}>
            <input id={`${ID}city`} value={v.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Chortoq tumani, Namangan")} className={inp("city")} />
          </Field>
        </div>

        {/* ---- 2. Vakansiya ---- */}
        <Section n={2} title={t("Qaysi ish uchun ariza berasiz")} hint={t("Bir nechta yo'nalish mos kelsa, asosiysini tanlang — qolganini suhbatda gaplashamiz.")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("Vakansiya turi")} full err={err("role", t("Vakansiya turini tanlang."))}>
            <Select
              id={`${ID}role`}
              size="md"
              value={v.role}
              error={bad.has("role")}
              placeholder={t("Vakansiyani tanlang")}
              options={roleOptions}
              onChange={(val) => {
                set("role", val);
                if (!CV_TEACHING_ROLES.includes(val)) set("subject", "");
              }}
            />
          </Field>
          {teaching && (
            <Field label={t("Qaysi fan yoki yo'nalish bo'yicha")} full err={err("subject", t("Fan yoki yo'nalishni tanlang."))}>
              <Select id={`${ID}subject`} size="md" value={v.subject} error={bad.has("subject")} placeholder={t("Fanni tanlang")} options={subjectOptions} onChange={(val) => set("subject", val)} />
            </Field>
          )}
          <Field label={t("Filial")} full err={err("branch", t("Filialni tanlang."))}>
            <Select id={`${ID}branch`} size="md" value={v.branch} error={bad.has("branch")} placeholder={t("Filialni tanlang")} options={branchOptions} onChange={(val) => set("branch", val)} />
          </Field>
          <Field label={t("Bandlik turi")} full err={err("load1", t("Bandlik turini tanlang."))}>
            <div id={`${ID}load1`} tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none">
              {CV_LOADS.map((l) => (
                <button
                  type="button"
                  key={l}
                  aria-pressed={v.load === l}
                  onClick={() => set("load", l)}
                  className={`h-9 px-3 rounded-lg border text-[13px] transition-colors ${
                    v.load === l ? "border-primary bg-primary/10 text-primary font-medium" : bad.has("load1") ? "border-rose-400 bg-card" : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {t(l)}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("Qachondan boshlay olasiz")} err={err("startDate", t("Sanani tanlang."))}>
            <div id={`${ID}startDate`} tabIndex={-1}>
              <DateField value={v.startDate} onChange={(iso) => set("startDate", iso)} variant="form" error={bad.has("startDate")} placeholder="kk/oo/yyyy" />
            </div>
          </Field>
          <Field
            label={
              <>
                {t("Kutayotgan oylik")} <span className="text-muted-foreground font-normal">{t("— so'mda")}</span>
              </>
            }
            htmlFor={`${ID}salary`}
            err={err("salary", t("Taxminiy summani yozing."))}
          >
            <input id={`${ID}salary`} inputMode="numeric" placeholder="4 000 000" value={v.salary} onChange={(e) => set("salary", formatSalary(e.target.value))} className={inp("salary")} />
          </Field>
        </div>

        {/* ---- 3. Ta'lim va tajriba ---- */}
        <Section n={3} title={t("Ta'lim va tajriba")} hint={t("Tajribangiz kam bo'lsa ham ariza qoldiring — o'qitib ishga olamiz.")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("Ta'lim darajasi")} err={err("edu", t("Ta'lim darajangizni tanlang."))}>
            <Select id={`${ID}edu`} size="md" value={v.edu} error={bad.has("edu")} placeholder={t("Tanlang")} options={eduOptions} onChange={(val) => set("edu", val)} />
          </Field>
          <Field label={t("Ish tajribasi")} err={err("exp", t("Tajribangizni tanlang."))}>
            <Select id={`${ID}exp`} size="md" value={v.exp} error={bad.has("exp")} placeholder={t("Tanlang")} options={expOptions} onChange={(val) => set("exp", val)} />
          </Field>
          <Field label={t("O'quv yurti va mutaxassislik")} full htmlFor={`${ID}school`} err={err("school", t("O'quv yurti va yo'nalishni yozing."))}>
            <input id={`${ID}school`} value={v.school} onChange={(e) => set("school", e.target.value)} placeholder={t("NamDU, ingliz tili va adabiyoti")} className={inp("school")} />
          </Field>
          <Field label={t("Oxirgi ish joyi va lavozimingiz")} optional full htmlFor={`${ID}lastJob`}>
            <input id={`${ID}lastJob`} value={v.lastJob} onChange={(e) => set("lastJob", e.target.value)} placeholder={t("Masalan: 12-maktab, ingliz tili o'qituvchisi (2023–2026)")} className={inp("lastJob")} />
          </Field>
          <Field label={t("Sertifikatlaringiz")} optional full htmlFor={`${ID}certText`}>
            <input id={`${ID}certText`} value={v.certText} onChange={(e) => set("certText", e.target.value)} placeholder="IELTS 7.0, Milliy sertifikat B2, TOPIK 4 ..." className={inp("certText")} />
          </Field>
          <Field
            label={
              <>
                {t("CV fayli")} <span className="text-muted-foreground font-normal">{t("— ixtiyoriy, PDF yoki rasm")}</span>
              </>
            }
            full
          >
            <div className="flex items-center gap-2">
              <label className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-dashed border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer flex items-center gap-2 text-[13px]">
                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{cvFile ? cvFile.name : t("Fayl tanlash")}</span>
                {cvFile && <span className="text-muted-foreground shrink-0">{fmtSize(cvFile.size)}</span>}
                <input ref={cvInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" hidden onChange={onCvPick} />
              </label>
              {cvFile && (
                <button type="button" onClick={removeCv} aria-label={t("{name} faylini olib tashlash", { name: cvFile.name })} className="h-10 w-10 rounded-lg border border-border bg-card hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </Field>
          <Field label={t("Sertifikat va diplom nusxalari")} optional full>
            <label
              className={`block rounded-lg border border-dashed px-3 py-3 cursor-pointer text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/60"}`}
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
              <div className="text-[13px] font-medium">
                {t("Fayllarni tanlang")} <span className="font-normal text-muted-foreground">{t("yoki shu yerga tashlang")}</span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {docs.length ? t("{n} ta fayl tanlandi — yana qo'shishingiz mumkin", { n: docs.length }) : t("PDF yoki rasm · bitta fayl 10 MB gacha · 10 tagacha")}
              </div>
              <input
                ref={docsInput}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                hidden
                onChange={(e) => {
                  if (e.target.files) addDocs(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {docs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {docs.map((f, i) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px]">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                    <button type="button" onClick={() => removeDoc(i)} aria-label={t("{name} faylini olib tashlash", { name: f.name })} className="ml-auto h-6 w-6 rounded hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {certErr && <p className="text-[12px] text-rose-500 mt-1">{certErr}</p>}
          </Field>
        </div>

        {/* ---- 4. Qo'shimcha ---- */}
        <Section n={4} title={t("Qo'shimcha")} hint={t("Bu qismni rahbar birinchi bo'lib o'qiydi.")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("Nega aynan Akademiyada ishlamoqchisiz va nimani yaxshi uddalaysiz")} full htmlFor={`${ID}about`} err={err("about", t("Bir-ikki jumla yozing."))}>
            <textarea
              id={`${ID}about`}
              value={v.about}
              onChange={(e) => set("about", e.target.value)}
              rows={3}
              placeholder={t("Qisqacha bo'lsa ham bo'ladi: nimalarda kuchlisiz, qanday natijalarga erishgansiz.")}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y ${bad.has("about") ? "border-rose-400 focus:ring-rose-300" : "border-border focus:ring-primary/40"}`}
            />
          </Field>
          <Field label={t("Vakansiyani qayerdan bildingiz")} optional full>
            <Select id={`${ID}source`} size="md" value={v.source} placeholder={t("Tanlang")} clearable options={sourceOptions} onChange={(val) => set("source", val)} />
          </Field>
        </div>
        <p className="text-[12px] text-muted-foreground">{t("Ariza nomzod nomidan to'ldirilmoqda — kim kiritgani arizada ko'rinadi.")}</p>
      </div>
    </Modal>
  );
}
