"use client";

import { useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { Check, Monitor, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useEduCategories } from "@/hooks/useEduCategories";
import { COURSE_LANGUAGES, COURSE_LEVELS, type CourseSection, type OnlineCourse } from "@/lib/onlineCourses";
import { useOnlineCourses } from "./OnlineCoursesProvider";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Kurs qo'shish/tahrirlash — crm-akademiya #view-online-course-add (4 bosqichli
// "wizard"). Manba klonida bu sahifaning yarmi bezak edi: ikkala "Yuklash"
// tugmasi, to'rtala select va 2-bosqichning uchala matni hech qayerga
// bormasdi. Endi hammasi haqiqiy:
//
//   * Kurs rasmi / Reklama video — tanlangan fayl darhol Cloudinary'ga
//     yuklanadi (/api/upload/image, /api/upload/video), qaytgan URL kursga
//     yoziladi va o'sha yerda ko'rinadi. Rasm kurs kartasining muqovasiga
//     tushadi (CourseCover.tsx).
//   * Kurs tili / Kurs bosqichi — referensdagi ro'yxatlar (lib/onlineCourses.ts).
//   * Kategoriya — /api/edu-categories dan (O'quv bo'limi → Kategoriya).
//   * 2-bosqichning uchala matni — kursga saqlanadi va tahrirlashda qaytadi.
//
// OLIB TASHLANGANI: "Sub kategoriya" (tizimda subkategoriya tushunchasi yo'q —
// EduCategory faqat {id, name}, uni to'ldirishning iloji yo'q edi) va matn
// maydonlari ustidagi B/I/U tugmalari (oddiy textarea'da formatlash ishlamaydi,
// tavsif esa hech qayerda HTML sifatida ko'rsatilmaydi).

const STEPS = [
  { n: 1, label: "Kurs yaratish" },
  { n: 2, label: "Kurs talablari" },
  { n: 3, label: "Narxlash" },
  { n: 4, label: "Kurs materiallari" },
];

// 2-bosqich savollari. `key` — OnlineCourse maydoni.
const REQUIREMENT_FIELDS = [
  {
    key: "learn" as const,
    q: "Kursingizda o'quvchilar nimani o'rganadilar?",
    hint: "Kursni tugatgandan so'ng o'quvchilar erishishi mumkin bo'lgan o'quv maqsadlari yoki natijalarini kiritishingiz kerak.",
  },
  {
    key: "requirements" as const,
    q: "Kursga kirish uchun qanday talablar yoki old shartlar mavjud?",
    hint: "Kursni o'tashdan oldin o'quvchilar ega bo'lishi kerak bo'lgan kerakli ko'nikma, tajriba, yoki jihozlarni sanab o'tish.",
  },
  {
    key: "audience" as const,
    q: "Bu kurs kim uchun?",
    hint: "Kursingiz mazmunini qimmatli deb topadigan kursingiz uchun mo'ljallangan o'quvchilarning aniq tavsifini yozing.",
  },
];

const textareaCls = "w-full min-h-[120px] mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y";

/** Yuklangan fayl URL'idan ko'rsatish uchun nom ajratadi. */
function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

export default function CourseWizard({ courseId }: { courseId?: number }) {
  const { t } = useT();
  const { getCourse, loading } = useOnlineCourses();
  const editing = courseId != null ? getCourse(courseId) : undefined;

  // Kurslar API'dan kelguncha "topilmadi" deb xulosa qilmaymiz.
  if (courseId != null && loading) {
    return (
      <div className="container mx-auto max-w-[1100px] p-4 md:p-5">
        <SpinnerBlock />
      </div>
    );
  }

  if (courseId != null && !editing) {
    return (
      <div className="container mx-auto max-w-[1100px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Kurs topilmadi.")}</p>
        <Link href="/online-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
      </div>
    );
  }

  return <CourseWizardBody key={editing?.id ?? "new"} editing={editing} />;
}

function CourseWizardBody({ editing }: { editing?: OnlineCourse }) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { addCourse, updateCourse } = useOnlineCourses();
  const { categories, loading: categoriesLoading } = useEduCategories();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [what, setWhat] = useState(editing?.what ?? "");
  const [language, setLanguage] = useState(editing?.language ?? "");
  const [level, setLevel] = useState(editing?.level ?? "");
  // Select'ning DOM qiymati har doim satr — raqamga faqat saqlashda o'giramiz.
  const [categoryId, setCategoryId] = useState(editing?.categoryId != null ? String(editing.categoryId) : "");
  const [texts, setTexts] = useState<Record<string, string>>({
    learn: editing?.learn ?? "",
    requirements: editing?.requirements ?? "",
    audience: editing?.audience ?? "",
  });
  const [price, setPrice] = useState(String(editing?.price ?? 0));
  const [free, setFree] = useState(editing?.free ?? false);
  const [sections, setSections] = useState<CourseSection[]>(editing?.sections ?? []);
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionOutcome, setSectionOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  // Muqova: 'cosmic' kabi seed kalitlari ham bo'lishi mumkin — yuklangan
  // rasmni faqat http(s) bo'lganda ko'rsatamiz.
  const [cover, setCover] = useState(editing?.cover ?? "");
  const [video, setVideo] = useState(editing?.video ?? "");
  const [uploading, setUploading] = useState<"cover" | "video" | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const coverUrl = cover.startsWith("http") ? cover : "";

  function onFreeToggle(checked: boolean) {
    setFree(checked);
    if (checked) setPrice("0");
  }

  function saveSection() {
    if (!sectionName.trim() || !sectionOutcome.trim()) {
      showError(t("Bo'lim nomi va natijani to'ldiring"));
      return;
    }
    setSections((prev) => [...prev, { name: sectionName.trim(), outcome: sectionOutcome.trim() }]);
    setSectionName("");
    setSectionOutcome("");
    setSectionEditorOpen(false);
  }
  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  /** Tanlangan faylni darhol yuklaydi — tugma "Yuklash" deb atalgan. */
  async function upload(kind: "cover" | "video", file: File | undefined) {
    if (!file) return;

    // Server ham tekshiradi, lekin oldindan to'sib qo'yamiz — aks holda
    // 60 MB lik rolik bekorga to'liq yuborilib, keyin rad javobi kelardi
    // (AddEmployeeModal.tsx dagi bilan bir xil ehtiyot).
    const rules = kind === "cover"
      ? { types: ["image/png", "image/jpeg"], max: 5 * 1024 * 1024, wrong: "Faqat JPG yoki PNG", big: "Rasm hajmi 5 MB dan oshmasin" }
      : { types: ["video/mp4", "video/webm", "video/quicktime"], max: 50 * 1024 * 1024, wrong: "Faqat MP4, WEBM yoki MOV", big: "Video hajmi 50 MB dan oshmasin" };
    if (!rules.types.includes(file.type)) {
      showError(rules.wrong);
      return;
    }
    if (file.size > rules.max) {
      showError(rules.big);
      return;
    }

    setUploading(kind);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "kurslar");
    const endpoint = kind === "cover" ? "/api/upload/image" : "/api/upload/video";
    const data = await fetch(endpoint, { method: "POST", body: fd })
      .then((r) => r.json())
      .catch(() => null);
    setUploading(null);

    if (!data?.ok) {
      showError(data?.error || (kind === "cover" ? t("Rasm yuklanmadi") : t("Video yuklanmadi")));
      return;
    }
    if (kind === "cover") setCover(data.url as string);
    else setVideo(data.url as string);
    showSuccess(kind === "cover" ? t("Kurs rasmi yuklandi") : t("Reklama video yuklandi"));
  }

  function gotoStep(n: number) {
    if (n > 1 && !name.trim()) {
      showError(t("Kurs nomini kiriting"));
      return;
    }
    setStep(n);
  }

  async function saveAndNext() {
    if (step === 1 && !name.trim()) {
      showError(t("Kurs nomini kiriting"));
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }

    const values = {
      name: name.trim(),
      description,
      what,
      language,
      level,
      categoryId: categoryId ? Number(categoryId) : null,
      learn: texts.learn,
      requirements: texts.requirements,
      audience: texts.audience,
      price: parseInt(price, 10) || 0,
      free,
      sections,
      cover,
      video,
    };

    setSaving(true);
    const error = editing ? await updateCourse(editing.id, values) : await addCourse(values);
    setSaving(false);
    if (error) {
      showError(error);
      return;
    }
    showSuccess(editing ? t("Kurs yangilandi — {name}", { name: values.name }) : "Kurs aktivlandi");
    router.push("/online-courses");
  }

  return (
    <div className="container mx-auto max-w-[1100px] p-4 md:p-5 pb-32 space-y-6">
      {step === 1 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">{t("Kurs yaratish")}</h1>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {t("Kursning ochilish sahifasi Edu tizimdagi muvaffaqiyatingiz uchun juda muhimdir. Ushbu bo'limni to'ldirganingizdan so'ng, kimdir sizning kursingizga yozilish istagini ko'rsatadigan qiziqarli kurs sahifasini yaratish haqida o'ylab ko'ring.")}
          </p>

          <div>
            <label className="text-[13px] font-medium text-foreground">{t("Kurs nomi")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-11 mt-2 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">{t("Sizning sarlavhangiz diqqatni jalb qiluvchi, ma'lumot beruvchi va qidiruv uchun optimallashtirilgan bo'lishi kerak")}</p>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">{t("Kurs tavsifi")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaCls} />
          </div>

          <div>
            <h3 className="text-base font-semibold">{t("Asosiy ma'lumot")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-[12px] font-medium text-foreground/80">{t("Kurs tili")}</label>
                <Select value={language} onChange={(v) => setLanguage(v)} options={COURSE_LANGUAGES.map((l) => ({ value: l, label: l }))} placeholder={t("Kurs tili")} clearable className="mt-1" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80">{t("Kurs bosqichi")}</label>
                <Select value={level} onChange={(v) => setLevel(v)} options={COURSE_LEVELS.map((l) => ({ value: l, label: l }))} placeholder={t("Kurs bosqichi")} clearable className="mt-1" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80">{t("Kategoriya")}</label>
                <Select value={categoryId} onChange={(v) => setCategoryId(v)} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={t("Kategoriya")} clearable className="mt-1" disabled={!categoriesLoading && categories.length === 0} />
                {!categoriesLoading && categories.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Kategoriya yo&apos;q —{" "}
                    <Link href="/edu-category" className="text-primary hover:underline">{t("O'quv bo'limi → Kategoriya")}</Link>
                    {" "}da qo&apos;shing
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">{t("Kursingizda asosan nima o'rgatiladi?")}</label>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              type="text"
              className="w-full h-11 mt-2 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Kurs rasmi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[13px] font-medium text-foreground">{t("Kurs rasmi")}</label>
              <div className="mt-2 rounded-lg border-2 border-dashed border-border bg-secondary/20 aspect-[750/422] flex items-center justify-center text-muted-foreground overflow-hidden">
                {coverUrl ? (
                  // Balandlik INLINE: preflight `img { height: auto }` qo'yadi,
                  // shuning uchun `h-full` klassi bu yerda ishlamaydi.
                  <img src={coverUrl} alt={t("Kurs rasmi")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Monitor style={{ width: 64, height: 64, opacity: 0.3 }} />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[13px] font-semibold mt-2">{t("O'lcham: 750x422 piksel")}</p>
              <p className="text-[12px] text-muted-foreground">(jpg, jpeg, png)</p>
              <div className="relative">
                <input
                  type="text"
                  value={coverUrl ? fileNameFromUrl(coverUrl) : ""}
                  placeholder={t("File yuklanmagan")}
                  readOnly
                  className="w-full h-10 rounded-lg border border-border bg-card pl-3 pr-9 text-sm"
                />
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCover("")}
                    title={t("Olib tashlash")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <input
                ref={coverRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; upload("cover", f); }}
              />
              <button
                type="button"
                disabled={uploading !== null}
                onClick={() => coverRef.current?.click()}
                className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {uploading === "cover" ? t("Yuklanmoqda...") : t("Yuklash")}
              </button>
            </div>
          </div>

          {/* Reklama video */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[13px] font-medium text-foreground">{t("Reklama video")}</label>
              <div className="mt-2 rounded-lg border-2 border-dashed border-border bg-secondary/20 aspect-[750/422] flex items-center justify-center text-muted-foreground overflow-hidden">
                {video ? (
                  <video src={video} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Monitor style={{ width: 64, height: 64, opacity: 0.3 }} />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[13px] mt-2">{t("Sizning reklama videoingiz o'quvchilar uchun kursingizda nimani o'rganishini oldindan ko'rishning tez va jozibali usulidir.")}</p>
              <p className="text-[12px] text-muted-foreground">(mp4, webm, mov — 50 MB gacha)</p>
              <div className="relative">
                <input
                  type="text"
                  value={video ? fileNameFromUrl(video) : ""}
                  placeholder={t("File yuklanmagan")}
                  readOnly
                  className="w-full h-10 rounded-lg border border-border bg-card pl-3 pr-9 text-sm"
                />
                {video && (
                  <button
                    type="button"
                    onClick={() => setVideo("")}
                    title={t("Olib tashlash")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; upload("video", f); }}
              />
              <button
                type="button"
                disabled={uploading !== null}
                onClick={() => videoRef.current?.click()}
                className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {uploading === "video" ? t("Yuklanmoqda...") : t("Yuklash")}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">{t("Kurs talablari")}</h1>
          {REQUIREMENT_FIELDS.map((f) => (
            <div key={f.key}>
              <h3 className="text-base font-semibold">{f.q}</h3>
              <p className="text-[13px] mt-1.5">{t(f.hint)}</p>
              <textarea
                value={texts[f.key]}
                onChange={(e) => setTexts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className={`${textareaCls} min-h-[100px]`}
              />
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">{t("Narxlash")}</h1>
          <div>
            <label className="text-[13px] font-medium text-foreground">{t("Kurs narxi")}</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              type="text"
              inputMode="numeric"
              disabled={free}
              placeholder="0"
              className="w-full h-11 mt-2 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${free ? "bg-primary" : "bg-secondary"}`}>
              <input type="checkbox" checked={free} onChange={(e) => onFreeToggle(e.target.checked)} className="sr-only" />
              {/* Siljish INLINE: `translate-x-5` bu loyihada ishlamaydi —
                  qatlamsiz v3 blobi `--tw-translate-x` ni 0 ga tushiradi
                  (README: "qatlamsiz v3 blobi..."). Tugmacha qimirlamasdi. */}
              <span
                className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                style={{ transform: `translateX(${free ? 20 : 0}px)`, transition: "transform .2s cubic-bezier(.4,0,.2,1)" }}
              />
            </span>
            <span className="text-[14px] font-medium">{t("Tekin")}</span>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">{t("Kurs materiallari")}</h1>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setSectionEditorOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <Plus className="icon icon-sm" />
              <span>{t("Kurs materiali qo'shish")}</span>
            </button>
          </div>

          {sectionEditorOpen && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <p className="text-[12px] mb-4"><span className="text-rose-500">*</span>{" "}{t("belgisi majburiyligini bildiradi")}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-foreground/80">{t("Bo'lim nomi")}{" "}<span className="text-rose-500">*</span></label>
                  <input
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    type="text"
                    className="w-full h-10 mt-1 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-foreground/80">{t("Ushbu bo'lim oxirida o'quvchilar nima qila oladilar?")}{" "}<span className="text-rose-500">*</span></label>
                  <input
                    value={sectionOutcome}
                    onChange={(e) => setSectionOutcome(e.target.value)}
                    type="text"
                    className="w-full h-10 mt-1 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-4 mt-4 text-[13px]">
                <button type="button" onClick={() => { setSectionEditorOpen(false); setSectionName(""); setSectionOutcome(""); }} className="text-rose-600 hover:underline">{t("O'chirish")}</button>
                <button type="button" onClick={saveSection} className="text-primary font-medium hover:underline">{t("Saqlash")}</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">{t(s.outcome)}</p>
                </div>
                <button type="button" onClick={() => removeSection(i)} className="h-7 w-7 rounded-md hover:bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0" title={t("O'chirish")}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="container mx-auto max-w-[1600px] px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-2xl">
            <div className="flex items-center gap-1 flex-1">
              {STEPS.map((s, i) => (
                <div key={s.n} className="flex items-center gap-1 flex-1 last:flex-initial">
                  <button type="button" onClick={() => gotoStep(s.n)} className="flex flex-col items-center gap-1 cursor-pointer">
                    <div className={`h-8 w-8 rounded-full text-[13px] font-semibold flex items-center justify-center ${s.n <= step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                      {s.n < step ? <Check className="h-4 w-4" /> : s.n}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t(s.label)}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={saveAndNext}
            disabled={saving || uploading !== null}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm shrink-0 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda..." : step < 4 ? t("Saqlash") : t("Aktivlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
