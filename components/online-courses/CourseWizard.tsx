"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Monitor, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useOnlineCourses, type CourseSection, type OnlineCourse } from "./OnlineCoursesProvider";

// Kurs qo'shish/tahrirlash — crm-akademiya #view-online-course-add (4 bosqichli
// "wizard"). Manbada ~15 maydondan atigi 6 tasi haqiqatan saqlanadi: nomi/
// tavsifi/"nima o'rgatiladi" (1-bosqich), narx+tekin belgisi (3-bosqich),
// bo'limlar ro'yxati (4-bosqich). Til/bosqich/kategoriya/subkategoriya
// select'lari, rasm/video yuklash va 2-bosqichning 3 ta matni — manbada ham
// hech qayerga saqlanmaydi (id yo'q, o'qilmaydi) — shu holicha faqat vizual
// qoldirildi, soxta funksional qo'shilmadi. "Saqlash" oxirgi bosqichda kursni
// har doim published:true qiladi ("Aktivlash") — CourseForm.tsx'dagi bilan
// bir xil optional-id + key-remount patterni.

export default function CourseWizard({ courseId }: { courseId?: number }) {
  const { getCourse } = useOnlineCourses();
  const editing = courseId != null ? getCourse(courseId) : undefined;

  if (courseId != null && !editing) {
    return (
      <div className="container mx-auto max-w-[1100px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Kurs topilmadi.</p>
        <Link href="/online-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
      </div>
    );
  }

  return <CourseWizardBody key={editing?.id ?? "new"} editing={editing} />;
}

const STEPS = [
  { n: 1, label: "Kurs yaratish" },
  { n: 2, label: "Kurs talablari" },
  { n: 3, label: "Narxlash" },
  { n: 4, label: "Kurs materiallari" },
];

function CourseWizardBody({ editing }: { editing?: OnlineCourse }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { addCourse, updateCourse } = useOnlineCourses();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [what, setWhat] = useState(editing?.what ?? "");
  const [price, setPrice] = useState(String(editing?.price ?? 0));
  const [free, setFree] = useState(editing?.free ?? false);
  const [sections, setSections] = useState<CourseSection[]>(editing?.sections ?? []);
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionOutcome, setSectionOutcome] = useState("");

  function onFreeToggle(checked: boolean) {
    setFree(checked);
    if (checked) setPrice("0");
  }

  function saveSection() {
    if (!sectionName.trim() || !sectionOutcome.trim()) return;
    setSections((prev) => [...prev, { name: sectionName.trim(), outcome: sectionOutcome.trim() }]);
    setSectionName("");
    setSectionOutcome("");
    setSectionEditorOpen(false);
  }
  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  function saveAndNext() {
    if (step === 1 && !name.trim()) {
      showError("Kurs nomini kiriting");
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    const values = { name: name.trim(), description, what, price: parseInt(price, 10) || 0, free, sections };
    if (editing) updateCourse(editing.id, values);
    else addCourse(values);
    showSuccess(editing ? `Kurs yangilandi — ${values.name}` : "Kurs aktivlandi");
    router.push("/online-courses");
  }

  return (
    <div className="container mx-auto max-w-[1100px] p-4 md:p-5 pb-32 space-y-6">
      {step === 1 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">Kurs yaratish</h1>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Kursning ochilish sahifasi Edu tizimdagi muvaffaqiyatingiz uchun juda muhimdir. Ushbu bo&apos;limni to&apos;ldirganingizdan so&apos;ng, kimdir sizning kursingizga yozilish istagini ko&apos;rsatadigan qiziqarli kurs sahifasini yaratish haqida o&apos;ylab ko&apos;ring.
          </p>

          <div>
            <label className="text-[13px] font-medium text-foreground">Kurs nomi</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-11 mt-2 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">Sizning sarlavhangiz diqqatni jalb qiluvchi, ma&apos;lumot beruvchi va qidiruv uchun optimallashtirilgan bo&apos;lishi kerak</p>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">Kurs tavsifi</label>
            <div className="mt-2 rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-secondary/30 text-muted-foreground text-[12px]">
                {["B", "I", "U"].map((l) => <button key={l} type="button" className="h-7 w-7 rounded hover:bg-secondary inline-flex items-center justify-center font-bold">{l}</button>)}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[120px] border-0 bg-transparent px-3 py-2 text-sm focus:outline-none resize-y"
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold">Asosiy ma&apos;lumot</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-[12px] font-medium text-foreground/80">Kurs tili</label>
                <select defaultValue="" className="filter-select w-full h-10 mt-1 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Kurs tili</option>
                  <option>O&apos;zbek</option>
                  <option>Ingliz</option>
                  <option>Rus</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80">Kurs bosqichi</label>
                <select defaultValue="" className="filter-select w-full h-10 mt-1 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Kurs bosqichi</option>
                  <option>Boshlang&apos;ich</option>
                  <option>O&apos;rta</option>
                  <option>Yuqori</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80">Kategoriya</label>
                <select defaultValue="" className="filter-select w-full h-10 mt-1 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Kategoriya</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground/80">Sub kategoriya</label>
                <select defaultValue="" className="filter-select w-full h-10 mt-1 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Tanlang</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">Kursingizda asosan nima o&apos;rgatiladi?</label>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              type="text"
              className="w-full h-11 mt-2 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {[
            { label: "Kurs rasmi", hint: "O'lcham: 750x422 piksel", sub: "(jpg, jpeg, png)" },
            { label: "Reklama video", hint: "Sizning reklama videoingiz o'quvchilar uchun kursingizda nimani o'rganishini oldindan ko'rishning tez va jozibali usulidir.", sub: null },
          ].map((f) => (
            <div key={f.label} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[13px] font-medium text-foreground">{f.label}</label>
                <div className="mt-2 rounded-lg border-2 border-dashed border-border bg-secondary/20 aspect-[750/422] flex items-center justify-center text-muted-foreground">
                  <Monitor style={{ width: 64, height: 64, opacity: 0.3 }} />
                </div>
              </div>
              <div className="space-y-3">
                <p className={f.sub ? "text-[13px] font-semibold mt-2" : "text-[13px] mt-2"}>{f.hint}</p>
                {f.sub && <p className="text-[12px] text-muted-foreground">{f.sub}</p>}
                <input type="text" placeholder="File yuklanmagan" readOnly className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm" />
                <button type="button" className="w-full h-10 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Yuklash</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">Kurs talablari</h1>
          {[
            { q: "Kursingizda o'quvchilar nimani o'rganadilar?", hint: "Kursni tugatgandan so'ng o'quvchilar erishishi mumkin bo'lgan o'quv maqsadlari yoki natijalarini kiritishingiz kerak." },
            { q: "Kursga kirish uchun qanday talablar yoki old shartlar mavjud?", hint: "Kursni o'tashdan oldin o'quvchilar ega bo'lishi kerak bo'lgan kerakli ko'nikma, tajriba, yoki jihozlarni sanab o'tish." },
            { q: "Bu kurs kim uchun?", hint: "Kursingiz mazmunini qimmatli deb topadigan kursingiz uchun mo'ljallangan o'quvchilarning aniq tavsifini yozing." },
          ].map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-semibold">{f.q}</h3>
              <p className="text-[13px] mt-1.5">{f.hint}</p>
              <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-secondary/30 text-muted-foreground text-[12px]">
                  {["B", "I", "U"].map((l) => <button key={l} type="button" className="h-7 w-7 rounded hover:bg-secondary inline-flex items-center justify-center font-bold">{l}</button>)}
                </div>
                <textarea className="w-full min-h-[100px] border-0 bg-transparent px-3 py-2 text-sm focus:outline-none resize-y" />
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">Narxlash</h1>
          <div>
            <label className="text-[13px] font-medium text-foreground">Kurs narxi</label>
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
            <span className="text-[14px] font-medium">Tekin</span>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold tracking-tight">Kurs materiallari</h1>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setSectionEditorOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <Plus className="icon icon-sm" />
              <span>Kurs materiali qo&apos;shish</span>
            </button>
          </div>

          {sectionEditorOpen && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <p className="text-[12px] mb-4"><span className="text-rose-500">*</span> belgisi majburiyligini bildiradi</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-foreground/80">Bo&apos;lim nomi <span className="text-rose-500">*</span></label>
                  <input
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    type="text"
                    className="w-full h-10 mt-1 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-foreground/80">Ushbu bo&apos;lim oxirida o&apos;quvchilar nima qila oladilar? <span className="text-rose-500">*</span></label>
                  <input
                    value={sectionOutcome}
                    onChange={(e) => setSectionOutcome(e.target.value)}
                    type="text"
                    className="w-full h-10 mt-1 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-4 mt-4 text-[13px]">
                <button type="button" onClick={() => { setSectionEditorOpen(false); setSectionName(""); setSectionOutcome(""); }} className="text-rose-600 hover:underline">O&apos;chirish</button>
                <button type="button" onClick={saveSection} className="text-primary font-medium hover:underline">Saqlash</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">{s.outcome}</p>
                </div>
                <button type="button" onClick={() => removeSection(i)} className="h-7 w-7 rounded-md hover:bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0" title="O'chirish">
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
                  <button type="button" onClick={() => setStep(s.n)} className="flex flex-col items-center gap-1 cursor-pointer">
                    <div className={`h-8 w-8 rounded-full text-[13px] font-semibold flex items-center justify-center ${s.n <= step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                      {s.n < step ? <Check className="h-4 w-4" /> : s.n}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={saveAndNext} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm shrink-0">
            {step < 4 ? "Saqlash" : "Aktivlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
