"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import PhoneField, { phoneDigits } from "@/components/auth/PhoneField";
import { useBranches } from "@/hooks/useBranches";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import EmployeeToggle from "./EmployeeToggle";
import CustomFieldDrawer, { type CustomFieldDraft } from "./CustomFieldDrawer";
import {
  EMPLOYEE_CUSTOM_FIELDS_KEY,
  readCustomFieldDefs,
  type EmployeeCustomFieldDef,
  type HrEmployeeFull,
} from "./employeeExtras";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Xodim qo'shish modali (crm-akademiya #emp-add-modal, skrinshot 2 tartibida).
// Saqlash → POST /api/hr-employees.
//
// NIMA NOTO'G'RI EDI: shaklda yig'ilgan bir nechta qiymat hech qayerga
// yuborilmasdi — tug'ilgan sanasi (boshqarilmaydigan input edi), Izoh,
// "Ish haqi chiqarish" va "Ikki bosqichli tasdiqlash" toggle'lari, hamda
// "Maxsus maydon qo'shish" drawer'i (u faqat toast chiqarardi).
// "Hammasiga bir xil" galochkasi ham hech narsaga ta'sir qilmasdi.
// Hozir hammasi saqlanadi; maxsus maydon TA'RIFLARI esa `settings`
// kolleksiyasida (management.employee-custom-fields) turadi, ya'ni bir marta
// yaratilgan maydon keyingi xodimlarda ham chiqadi.
//
// DIQQAT: saqlanish — ishlash degani EMAS. "Ikki bosqichli tasdiqlash"
// bazaga yoziladi, lekin login oqimi (app/api/auth/login/route.ts) uni
// o'qimaydi; shuning uchun toggle ostida buni ochiq aytadigan izoh turadi.
const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";


// Bitta filial qatorining holati. Galochka qo'yilmaguncha qolgan uchtasi
// o'chiq turadi (referensdagidek).
interface BranchRow {
  checked: boolean;
  roleId: string;
  scheduleId: string;
  salary: string;
}
const EMPTY_ROW: BranchRow = { checked: false, roleId: "", scheduleId: "", salary: "" };

// Grading tizimidagi bitta lavozim. `halfRate` faqat MENEJER jadvalida bor
// (o'qituvchilarnikida "Yarim stavka" ustuni yo'q), shu bois ixtiyoriy.
interface DegreeOpt {
  name: string;
  halfRate?: string;
  fullRate?: string;
}
// "Bandlik darajasi" ro'yxati — menejer grading jadvalidagi ikki ustun.
// Yozuvlardan emas, USTUNLARDAN kelib chiqadi, shuning uchun qat'iy.
const BANDLIK_OPTS = [
  { label: "Yarim stavka", key: "halfRate" as const },
  { label: "Bir stavka", key: "fullRate" as const },
];

/**
 * "Darajasi" tanlagichi — o'qituvchida ham, moderatorda ham bir xil
 * ko'rinadi, farq faqat KELADIGAN RO'YXATda. Shu sabab bitta komponent.
 */
function DegreeSelect({
  loading,
  opts,
  value,
  onChange,
  empty = "Daraja qo'shilmagan",
}: {
  loading: boolean;
  opts: DegreeOpt[];
  value: string;
  onChange: (v: string) => void;
  empty?: string;
}) {
  const { t } = useT();
  return (
    <Select value={value} onChange={(v) => onChange(v)} options={[...(value && !opts.some((d) => d.name === value) ? [{ value: value, label: t("{value} — ro'yxatda yo'q (eski qiymat)", { value }) }] : []), ...opts.map((d) => ({ value: d.name, label: d.name }))]} placeholder={selectPlaceholder(loading, opts.length, empty, "Darajani tanlang")} clearable disabled={loading} />
  );
}

const TURI_MAP: Record<string, string> = { "O'qituvchi": "teacher", Moderator: "moderator", Administrator: "admin" };
const GENDER_MAP: Record<string, string> = { Erkak: "male", Ayol: "female" };

// TESKARI xaritalar — tahrirlash uchun. Modal LAVOZIM YORLIG'ini saqlaydi
// ("O'qituvchi"), bazada esa kod turadi ("teacher"). Bularsiz mavjud xodim
// ochilganda tanlov bo'sh qolardi — va bu jimgina zanjir buzardi: `vazifa`
// bo'sh bo'lsa `isTeacher` false bo'lib, "Oladigan foizi" ro'yxati umuman
// yuklanmasdi.
const TURI_LABEL: Record<string, string> = { teacher: "O'qituvchi", moderator: "Moderator", admin: "Administrator" };
const GENDER_LABEL: Record<string, string> = { male: "Erkak", female: "Ayol" };

// lib/invite.ts dagi isValidPhone/normalizePhone bilan bir xil qoida —
// u yerdagi funksiyalarni to'g'ridan-to'g'ri import qilmaymiz (crypto/bcryptjs
// ishlatadi, klient tomonga mos emas), shuning uchun shu yerda takrorlangan.
function isValidPhoneClient(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.length === 9 ? "998" + digits : digits;
  return /^998\d{9}$/.test(normalized);
}

/**
 * Maxsus maydon turiga mos kiritish elementi. Qiymat HAR DOIM satr bo'lib
 * saqlanadi — belgi (checkbox) uchun "Ha" / bo'sh, chunki hujjatdagi
 * `customFields` — Record<string, string>.
 */
function renderCustomInput(
  def: EmployeeCustomFieldDef,
  value: string,
  onChange: (v: string) => void,
) {
  if (def.type === "Belgi (checkbox)") {
    return (
      <label className="flex items-center gap-2 h-10 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "Ha"}
          onChange={(e) => onChange(e.target.checked ? "Ha" : "")}
          className="w-4 h-4 rounded border-border accent-primary"
        />
        <span className="text-sm text-muted-foreground">Ha</span>
      </label>
    );
  }
  if (def.type === "Tanlov (select)") {
    return (
      <Select value={value} onChange={(v) => onChange(v)} options={def.options.map((o) => ({ value: o, label: o }))} placeholder="Tanlang" clearable />
    );
  }
  const type = def.type === "Raqam" ? "number" : def.type === "Sana" ? "date" : "text";
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

/**
 * Modal IKKI ish uchun: xodim QO'SHISH va TAHRIRLASH.
 *
 * Rejim `mode` bayrog'i bilan emas, `employee` propining bor-yo'qligi bilan
 * aniqlanadi — bayroq bo'lganda `mode="edit"` + `employee` yo'q degan
 * mumkin bo'lmagan holat yaratish mumkin edi. Birlashma tipi buni
 * kompilyatsiya paytida taqiqlaydi.
 *
 * NIMA UCHUN QAYTA ISHLATILADI: ilgari tahrirlash uchun alohida, KICHIK
 * oyna bor edi (EmployeeProfileEditModal) va u to'liq formadan ortda
 * qolgandi — masalan "Oladigan foizi" u yerda erkin matn edi, bu yerda esa
 * Sozlamalardagi ro'yxatdan tanlanadi.
 */
type EmployeeFormProps =
  | { employee?: undefined; onClose: () => void; onCreated?: (emp: HrEmployeeFull) => void; onSaved?: never }
  | { employee: HrEmployeeFull; onClose: () => void; onSaved?: (emp: HrEmployeeFull) => void; onCreated?: never };

export default function AddEmployeeModal({ employee, onClose, onCreated, onSaved }: EmployeeFormProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const editing = Boolean(employee);
  const { showSuccess, showError } = useToast();
  // Filial qatorlari Boshqaruv → Filiallar bilan bir xil manbadan.
  const { branches, loading: branchesLoading } = useBranches();
  // Tahrirlashda ism BITTA maydon. Bazada ham yagona `name` bor va
  // "ism familiya" tartibi hech qayerda majburlanmagan (import ham) — har
  // qanday bo'lish qoidasi familiyasi oldinda yozilgan yozuvlarni ag'darib
  // yuborardi. Shuning uchun mavjud xodimda satr BO'LINMAYDI.
  const [ism, setIsm] = useState(employee?.name ?? "");
  const [familiya, setFamiliya] = useState("");
  // FAQAT 9 RAQAM saqlanadi ("941558855") — "+998" maydonda qotib turadi
  // (PhoneField, kirish oynasidagi bilan bir xil). Bazada ikki xil shakl
  // bor ("94 155 88 55" va "998336263006"), `phoneDigits` ikkalasini ham
  // tanidi. Ilgari bu yerda ko'rinadigan satr turardi va unga istalgan
  // narsa yozib bo'lardi.
  const [phone, setPhone] = useState(employee ? phoneDigits(employee.phone) : "");
  const [vazifa, setVazifa] = useState(employee ? TURI_LABEL[employee.turi] ?? "" : "");
  const [jinsi, setJinsi] = useState(employee ? GENDER_LABEL[employee.gender] ?? "" : "");
  /**
   * Jinsi QO'LDA tanlanganmi.
   *
   * Avtomatik taxmin (pastdagi effekt) faqat shu bayroq `false` bo'lganda
   * yozadi. Bo'sh maydonni tekshirish YETMAYDI: odam ataylab "Erkak" deb
   * qo'yib, keyin familiyani tuzatsa, taxmin uning tanlovini jimgina
   * bosib tashlardi. Tahrirlashda darhol `true` — mavjud xodimning
   * saqlangan jinsi taxminga almashmasin.
   */
  const [genderTouched, setGenderTouched] = useState(editing);
  const [guessingGender, setGuessingGender] = useState(false);
  const [email, setEmail] = useState(employee?.email ?? "");
  const [birthDate, setBirthDate] = useState(employee?.birthDate ?? "");
  const [comment, setComment] = useState(employee?.comment ?? "");
  const [payroll, setPayroll] = useState(employee?.payroll ?? false);
  const [twoFactor, setTwoFactor] = useState(employee?.twoFactor ?? false);
  // Tahrirlashda FALSE: yoqiq bo'lsa bitta filial ish haqini o'zgartirish
  // qolgan hammasini jimgina bosib tashlardi.
  const [sameForAll, setSameForAll] = useState(!editing);
  const [showCustomField, setShowCustomField] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Maxsus maydonlar ────────────────────────────────────────────────────
  // Ta'riflar sozlamalarda (barcha xodimlar uchun umumiy), qiymatlar esa
  // shu xodim hujjatida (`customFields`) saqlanadi.
  const [customDefs, setCustomDefs] = useState<EmployeeCustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>(employee?.customFields ?? {});
  const [savingField, setSavingField] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(EMPLOYEE_CUSTOM_FIELDS_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return;
        setCustomDefs(readCustomFieldDefs(d.values));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /** Ta'riflar ro'yxatini sozlamalarga yozadi (butun ro'yxat qayta yoziladi). */
  async function persistDefs(next: EmployeeCustomFieldDef[]): Promise<boolean> {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: EMPLOYEE_CUSTOM_FIELDS_KEY, values: { fields: next } }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Maxsus maydon saqlanmadi"));
        return false;
      }
      setCustomDefs(next);
      return true;
    } catch {
      showError(t("Serverga ulanib bo'lmadi — maxsus maydon saqlanmadi"));
      return false;
    }
  }

  async function addCustomField(draft: CustomFieldDraft) {
    if (customDefs.some((f) => f.name.toLowerCase() === draft.name.toLowerCase())) {
      showError(t("\"{name}\" nomli maydon allaqachon bor", { name: draft.name }));
      return;
    }
    setSavingField(true);
    const nextId = customDefs.reduce((max, f) => Math.max(max, f.id), 0) + 1;
    const ok = await persistDefs([...customDefs, { id: nextId, ...draft }]);
    setSavingField(false);
    if (!ok) return;
    setShowCustomField(false);
    showSuccess(t("Maxsus maydon qo'shildi — {name}", { name: draft.name }));
  }

  async function removeCustomField(def: EmployeeCustomFieldDef) {
    const ok = await persistDefs(customDefs.filter((f) => f.id !== def.id));
    if (!ok) return;
    // Kiritilgan qiymat ham qoldirilmaydi — maydonning o'zi endi yo'q.
    setCustomValues((prev) => {
      const next = { ...prev };
      delete next[def.name];
      return next;
    });
    showSuccess(t("Maxsus maydon o'chirildi — {name}", { name: def.name }));
  }

  // Vazifa tanlanganda pastda qo'shimcha maydonlar ochiladi. Ularning
  // ro'yxati ham, TARKIBI ham vazifaga bog'liq (referensdagidek):
  //
  //   O'qituvchi → Oladigan foizi — Sozlamalar → Moliya → Oylik foizlari
  //                Darajasi       — Sozlamalar → Boshqaruv → O'QITUVCHILAR
  //                                 grading tizimi (degrees-teacher)
  //                Kurslar        — O'quv bo'limi → Kurslar
  //   Moderator  → Darajasi         — Sozlamalar → Boshqaruv → MENEJER
  //                                   grading tizimi (degrees-manager)
  //                Bandlik darajasi — o'sha jadvaldagi yarim/bir stavka
  //
  // Ikkala "Darajasi" bir xil ko'rinadi, lekin MANBASI boshqa: o'qituvchi
  // darajalarini moderatorga taklif qilish — jimgina noto'g'ri ma'lumot.
  const isTeacher = vazifa === "O'qituvchi";
  const isModerator = vazifa === "Moderator";
  const [percent, setPercent] = useState(employee?.percent ?? "");
  const [daraja, setDaraja] = useState(employee?.degree ?? "");
  const [bandlik, setBandlik] = useState(employee?.employmentRate ?? "");
  const [kurs, setKurs] = useState(employee?.kurs ?? "");
  const [percentOpts, setPercentOpts] = useState<{ name: string; percent: string }[]>([]);
  // Stavkalar ham olinadi: "Bandlik darajasi" variantlari yonida tanlangan
  // lavozimning summasi ko'rinsin — aks holda "Yarim stavka" degan tanlov
  // qancha pul ekanini modal ichida bilib bo'lmasdi.
  const [darajaOpts, setDarajaOpts] = useState<DegreeOpt[]>([]);
  const [kursOpts, setKursOpts] = useState<string[]>([]);
  // Ro'yxatlar KELAYOTGANDA "Foizni tanlang" turishi yolg'on edi: hali hech
  // narsa o'qilmagan, foydalanuvchi esa ro'yxat bo'sh deb o'ylardi.
  // Bayroq "yuklanmoqda" emas, "QAYSI VAZIFA uchun yuklandi" — chunki
  // so'rovlar vazifa tanlangandan KEYIN ketadi va vazifa almashsa qaytadan
  // ketishi kerak. Oddiy `loading` bayrog'i effekt ishga tushguncha bir kadr
  // `false` turib, bo'sh (yoki eski) ro'yxatni ko'rsatib ulgurardi.
  const [listsFor, setListsFor] = useState("");
  const roleListsLoading = (isTeacher || isModerator) && listsFor !== vazifa;
  // Yuklab bo'lingunicha ESKI ro'yxat ko'rsatilmaydi: o'qituvchi darajalari
  // moderatorga umuman tegishli emas. Holatni effekt ichida tozalash o'rniga
  // hosila qiymat — cascading render bo'lmaydi.
  const degreeOpts = roleListsLoading ? [] : darajaOpts;

  // Ro'yxatlar faqat kerak bo'lganda yuklanadi — administrator tanlansa
  // bu so'rovlar umuman ketmaydi.
  useEffect(() => {
    if (!isTeacher && !isModerator) return;
    let cancelled = false;
    const get = (url: string) => fetch(url).then((r) => r.json()).catch(() => null);
    Promise.all([
      isTeacher ? get("/api/settings-lists?kind=monthly-percents") : null,
      get(`/api/settings-lists?kind=${isTeacher ? "degrees-teacher" : "degrees-manager"}`),
      isTeacher ? get("/api/offline-courses") : null,
    ]).then(([p, d, c]) => {
      if (cancelled) return;
      if (p?.ok) setPercentOpts((p.items as { name: string; percent: string }[]).map((i) => ({ name: i.name, percent: i.percent })));
      if (d?.ok) {
        setDarajaOpts((d.items as DegreeOpt[]).map((i) => ({ name: i.name, halfRate: i.halfRate, fullRate: i.fullRate })));
      }
      if (c?.ok) setKursOpts((c.courses as { name: string }[]).map((i) => i.name));
    }).finally(() => { if (!cancelled) setListsFor(vazifa); });
    return () => { cancelled = true; };
  }, [isTeacher, isModerator, vazifa]);

  // ── Jinsni ism-familiyadan taxmin qilish ────────────────────────────
  //
  // Sun'iy intellekt modeli orqali (/api/gender-guess — kalit serverda,
  // brauzerga chiqmaydi). Bu TAKLIF, majburiy qiymat emas:
  //   • qo'lda tanlangan jins hech qachon bosilmaydi (`genderTouched`);
  //   • so'rov yiqilsa yoki kalit sozlanmagan bo'lsa maydon bo'sh qoladi
  //     va shakl avvalgidek qo'lda to'ldiriladi — xodim qo'shish hech
  //     qachon shu so'rovga bog'lanib qolmasin;
  //   • TAHRIRLASHDA umuman ishlamaydi: saqlangan jins taxminga
  //     almashmasin (`editing` da `genderTouched` boshidan `true`).
  const nameForGuess = editing ? "" : `${ism.trim()} ${familiya.trim()}`.trim();
  useEffect(() => {
    if (genderTouched || nameForGuess.length < 3) return;
    let cancelled = false;
    // Har bosilgan harfda so'rov ketmasin — odam yozib bo'lguncha kutamiz.
    const timer = setTimeout(() => {
      setGuessingGender(true);
      fetch("/api/gender-guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameForGuess }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d?.ok) return;
          const label = GENDER_LABEL[d.gender as keyof typeof GENDER_LABEL];
          if (label) setJinsi(label);
          // Sabab konsolda qoladi (kalit yo'q, model nomi noto'g'ri…) —
          // foydalanuvchiga toast chiqarmaymiz: u shunchaki qo'lda tanlaydi.
          else if (d.reason) console.debug("[jins taxmini]", d.reason);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setGuessingGender(false); });
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nameForGuess, genderTouched]);

  // ── Filial qatorlari ────────────────────────────────────────────────────
  // Referensda har filial qatori mustaqil: galochka QO'YILGAN filialdagina
  // Rol / Ish jadvali / Ish haqi tanlanadi, qolganlari o'chiq turadi.
  // Rollar — Boshqaruv → Rollar (/api/roles), ish jadvallari —
  // Boshqaruv → Ish jadvali (/api/work-schedules, faqat faollari).
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [schedules, setSchedules] = useState<{ id: number; name: string }[]>([]);
  // Ikkalasi bitta Promise.all bilan keladi — shu sabab bitta bayroq.
  // O'qituvchi ro'yxatlariniki ALOHIDA: u effekt kechroq (vazifa tanlangach)
  // ishga tushadi, umumiy bayroq bo'lsa birinchi tugagan so'rov ikkinchisi
  // hali yo'ldaligida ro'yxatni "tayyor" deb ko'rsatib qo'yardi.
  const [branchListsLoading, setBranchListsLoading] = useState(true);
  // Tahrirlashda mavjud biriktiruvlar bilan to'ldiriladi — aks holda modal
  // ochilib "Saqlash" bosilsa, sozlangan ish haqi bo'sh massiv bilan
  // almashib, butunlay yo'qolardi.
  const [branchRows, setBranchRows] = useState<Record<number, BranchRow>>(() => {
    const seed: Record<number, BranchRow> = {};
    for (const a of employee?.branchAssignments ?? []) {
      seed[a.branchId] = {
        checked: true,
        roleId: a.roleId == null ? "" : String(a.roleId),
        scheduleId: a.scheduleId == null ? "" : String(a.scheduleId),
        salary: a.salary ? String(a.salary) : "",
      };
    }
    return seed;
  });

  useEffect(() => {
    let cancelled = false;
    const get = (u: string) => fetch(u).then((r) => r.json()).catch(() => null);
    Promise.all([get("/api/roles"), get("/api/work-schedules")]).then(([r, s]) => {
      if (cancelled) return;
      if (r?.ok) setRoles(r.roles as { id: number; name: string }[]);
      if (s?.ok) {
        setSchedules((s.schedules as { id: number; name: string; active: boolean }[]).filter((x) => x.active));
      }
    }).finally(() => { if (!cancelled) setBranchListsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function rowOf(id: number): BranchRow {
    return branchRows[id] ?? EMPTY_ROW;
  }
  function updateRow(id: number, patch: Partial<BranchRow>) {
    setBranchRows((p) => {
      const next: Record<number, BranchRow> = { ...p, [id]: { ...(p[id] ?? EMPTY_ROW), ...patch } };
      // "Hammasiga bir xil" — galochka aynan shuni va'da qiladi: bitta
      // qatorga yozilgan ish haqi qolgan filiallarga ham ko'chiriladi.
      // Ilgari bu holat hech qayerda o'qilmasdi, ya'ni galochka o'lik edi.
      if (sameForAll && patch.salary !== undefined) {
        for (const b of branches) {
          if (b.id === id) continue;
          next[b.id] = { ...(next[b.id] ?? EMPTY_ROW), salary: patch.salary };
        }
      }
      // Galochka YOQIQ turganda yangi filial yoqilsa, u ham umumiy ish haqi
      // bilan ochilsin — aks holda o'sha bitta qator bo'sh qolib ketardi.
      if (sameForAll && patch.checked && !next[id].salary) {
        const src = branches.find((b) => p[b.id]?.salary);
        if (src) next[id] = { ...next[id], salary: p[src.id]!.salary };
      }
      return next;
    });
  }
  /**
   * Galochka bosilganda ikkala YO'NALISH ham ishlaydi:
   *  YOQILSA  — YONIB TURGAN (galochkali) filialning ish haqi pastdagi
   *             filiallarga ham tushadi;
   *  O'CHIRILSA — galochkasiz filiallarda qolib ketgan NUSXA tozalanadi,
   *             ya'ni har filial o'z ish haqini o'zi hisoblaydi.
   */
  function toggleSameForAll(on: boolean) {
    setSameForAll(on);
    setBranchRows((p) => {
      const next: Record<number, BranchRow> = { ...p };
      if (on) {
        // Manba — avvalo GALOCHKALI qator. Ilgari shunchaki birinchi
        // to'ldirilgan qator olinardi: yuqorida o'chiq turgan filialda eski
        // raqam qolgan bo'lsa, u yonib turgan filialnikini bosib tashlardi.
        const src =
          branches.find((b) => p[b.id]?.checked && p[b.id]?.salary) ??
          branches.find((b) => p[b.id]?.salary);
        const shared = src ? p[src.id]!.salary : "";
        if (!shared) return p;
        for (const b of branches) next[b.id] = { ...(next[b.id] ?? EMPTY_ROW), salary: shared };
      } else {
        // Galochkasiz qatordagi raqam — faqat "hammasiga bir xil" qoldirgan
        // nusxa (input o'chiq, unga qo'lda yozib bo'lmaydi). Tozalanmasa,
        // keyin o'sha filial yoqilganda tayyor raqam bilan ochilib qolardi
        // va saqlashda jimgina o'sha ish haqi ketardi.
        for (const b of branches) {
          const r = next[b.id];
          if (r && !r.checked && r.salary) next[b.id] = { ...r, salary: "" };
        }
      }
      return next;
    });
  }

  // ── Profil rasmi ────────────────────────────────────────────────────────
  const photoRef = useRef<HTMLInputElement>(null);
  // `file` saqlanadi — saqlash bosilganda Cloudinary'ga yuboriladi.
  // `url` faqat ko'rinish uchun (blob:), serverga bormaydi.
  const [photo, setPhoto] = useState<{ name: string; url: string; file: File } | null>(null);
  // Mavjud rasm — Cloudinary havolasi. `photo` faqat YANGI tanlangan faylni
  // ushlaydi, shu sabab eskisi alohida saqlanadi. Bo'sh satr — "rasmni
  // o'chirish", `undefined` emas: PATCH da yuborilmagan maydon tegilmaydi.
  const [photoUrl, setPhotoUrl] = useState(employee?.photoUrl ?? "");

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      showError(t("Faqat PNG yoki JPG rasm tanlang"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError(t("Rasm hajmi 5 MB dan oshmasin"));
      return;
    }
    // Oldingi ko'rinish uchun yaratilgan URL bo'shatiladi (xotira oqmasin).
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ name: file.name, url: URL.createObjectURL(file), file });
  }
  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    // Tahrirlashda "X" — ATAYLAB o'chirish, ya'ni serverga bo'sh satr ketadi.
    setPhotoUrl("");
    if (photoRef.current) photoRef.current.value = "";
  }

  async function save() {
    // Tahrirlashda ism BITTA maydonda (`ism`), yaratishda ikkitasi.
    const name = editing ? ism.trim() : `${ism.trim()} ${familiya.trim()}`.trim();
    if (!name) {
      showError(editing ? t("F.I.SH. ni kiriting") : t("Ism va familiyani kiriting"));
      return;
    }
    // Maydon faqat raqam qabul qiladi, lekin 9 tasi TO'LIQ terilganini
    // baribir tekshiramiz — yarim raqam bilan saqlab bo'lmasin.
    if (!isValidPhoneClient(phone)) {
      showError(t("Telefon raqamini to'liq kiriting — 9 ta raqam (masalan 90 123 45 67)"));
      return;
    }
    // Filiallar ro'yxati hali kelmagan bo'lsa saqlashga yo'l qo'ymaymiz:
    // `branchAssignments` shu ro'yxatdan yig'iladi va bo'sh massiv
    // yuborilsa xodimning sozlangan ish haqi butunlay o'chib ketardi.
    if (editing && branches.length === 0) {
      showError(t("Filiallar ro'yxati hali yuklanmadi — bir lahza kuting"));
      return;
    }
    // Referensda bu ikkisi yulduzcha bilan — faqat o'qituvchi uchun majburiy.
    if (isTeacher && !percent) {
      showError(t("Oladigan foizini tanlang"));
      return;
    }
    if (isTeacher && !kurs) {
      showError(t("Kursni tanlang"));
      return;
    }
    // Drawer'da "Majburiy maydon" yoqilgan bo'lsa — u haqiqatan majburiy
    // bo'lsin, aks holda toggle yana bir bo'sh va'da bo'lib qolardi.
    const missing = customDefs.find((f) => f.required && !(customValues[f.name] || "").trim());
    if (missing) {
      showError(t("\"{name}\" maydonini to'ldiring", { name: missing.name }));
      return;
    }
    setSaving(true);
    try {
      // Rasm avval Cloudinary'ga yuklanadi. Yuklanmasa saqlashni TO'XTATAMIZ —
      // xodim rasmsiz yaratilib, foydalanuvchi buni sezmay qolmasin.
      // Yangi fayl tanlanmagan bo'lsa MAVJUD havola saqlanadi.
      let finalPhotoUrl = photoUrl;
      if (photo) {
        const fd = new FormData();
        fd.append("file", photo.file);
        fd.append("folder", "xodimlar");
        const up = await fetch("/api/upload/image", { method: "POST", body: fd });
        const upData = await up.json();
        if (!up.ok || !upData.ok) {
          showError(t(upData.error || "Rasm yuklanmadi"));
          setSaving(false);
          return;
        }
        finalPhotoUrl = upData.url as string;
      }

      // Faqat galochka qo'yilgan filiallar yuboriladi.
      const branchAssignments = branches
        .filter((b) => rowOf(b.id).checked)
        .map((b) => {
          const r = rowOf(b.id);
          return {
            branchId: b.id,
            roleId: r.roleId ? Number(r.roleId) : null,
            scheduleId: r.scheduleId ? Number(r.scheduleId) : null,
            salary: Number(r.salary) || 0,
          };
        });
      // O'CHIRILGAN filialdagi biriktiruv ham saqlanadi: yuqoridagi halqa
      // faqat JORIY filiallar bo'yicha yuradi, ya'ni ro'yxatdan olib
      // tashlangan filialning ish haqi jimgina yo'qolib ketardi.
      for (const a of employee?.branchAssignments ?? []) {
        if (!branches.some((b) => b.id === a.branchId)) branchAssignments.push(a);
      }
      // Galochka qo'yilgan filiallar — xodim SHU FILIALLARDA ishlaydi.
      // Navbardagi filial ro'yxati aynan shundan chiqadi
      // (lib/branchScope.ts → getBranchScope). Bo'sh bo'lsa yuborilmaydi
      // va server mavjud qiymatga tegmaydi.
      const branchIds = branchAssignments.map((a) => a.branchId);

      const res = await fetch(editing ? `/api/hr-employees/${employee!.id}` : "/api/hr-employees", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          // 9 ta raqam ketadi ("941558855") — server `normalizePhone()`
          // bilan "998941558855" ga keltiradi (lib/eskiz.ts). Kirish
          // oynasi ham aynan shunday yuboradi.
          phone,
          turi: TURI_MAP[vazifa] || "",
          gender: GENDER_MAP[jinsi] || "",
          email: email.trim(),
          birthDate,
          comment: comment.trim(),
          payroll,
          twoFactor,
          // Faqat to'ldirilgan maxsus maydonlar yuboriladi.
          customFields: Object.fromEntries(
            customDefs
              .map((f) => [f.name, (customValues[f.name] || "").trim()] as const)
              .filter(([, v]) => v !== ""),
          ),
          // Vazifaga qarab to'ldiriladi; tegishli bo'lmaganda bo'sh ketadi
          // (vazifa almashganda holat allaqachon tozalangan).
          kurs,
          percent,
          degree: daraja,
          employmentRate: bandlik,
          photoUrl: finalPhotoUrl,
          branchAssignments,
          branchIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || (editing ? t("Saqlanmadi") : t("Xodim qo'shilmadi")));
        setSaving(false);
        return;
      }
      if (editing) {
        // Tahrirlashda SMS yuborilmaydi — faollashtirish taklifi faqat
        // yangi xodim yaratilganda ketadi.
        onSaved?.(data.employee as HrEmployeeFull);
        showSuccess(t("Xodim ma'lumotlari saqlandi"));
      } else {
        onCreated?.(data.employee as HrEmployeeFull);
        if (data.smsSent) {
          showSuccess(t("Xodim qo'shildi — {name}. Faollashtirish SMS'i yuborildi.", { name }));
        } else {
          showError(t("Xodim qo'shildi — {name}, lekin faollashtirish SMS'i yuborilmadi. Birozdan so'ng qayta urinib ko'ring.", { name }));
        }
      }
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <><Modal onClose={onClose} controller={modal} bare size="3xl" panelClassName="overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-[16px] font-semibold">{editing ? t("Xodimni tahrirlash") : t("Xodim qo'shish")}</h3>
          <p className="text-[11px] text-muted-foreground"><span className="text-rose-500">*</span>{" "}{t("Zarurligini bildiradi")}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Row 1: Ism / Familiya / Telefon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tahrirlashda BITTA maydon — bazada ham yagona `name` bor va
                uni ism/familiyaga bo'lish tartibi hech qayerda kafolatlanmagan
                (familiyasi oldinda yozilgan yozuvlar ag'darilib ketardi). */}
            {editing ? (
              <div className="md:col-span-2">
                <label className={labelCls}>{t("F.I.SH.")}<span className="text-rose-500">*</span></label>
                <input type="text" value={ism} onChange={(e) => setIsm(e.target.value)} className={inputCls} />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>{t("Ism")}<span className="text-rose-500">*</span></label>
                  <input type="text" value={ism} onChange={(e) => setIsm(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("Familiya")}<span className="text-rose-500">*</span></label>
                  <input type="text" value={familiya} onChange={(e) => setFamiliya(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>{t("Telefon raqam")}<span className="text-rose-500">*</span></label>
              {/* KIRISH oynasidagi maydonning AYNAN O'ZI (PhoneField):
                  "+998" qotib turadi, faqat 9 raqam kiritiladi va u
                  "(90) 123-45-67" bo'lib formatlanadi. Ilgari bu yerda
                  oddiy matn maydoni edi va unga istalgan narsa yozib
                  bo'lardi — ikki ekranda ikki xil qoida ishlardi.
                  Yorliq shu yerda chiziladi (yulduzchasi bilan). */}
              <PhoneField label={null} value={phone} onChange={setPhone} />
              {/* Telefon — tizimga kirish logini. Shu sababli PATCH endi
                  `users` hujjatini ham yangilaydi: aks holda profil yangi
                  raqamni ko'rsatgani bilan xodim eskisi bilan kirishda davom
                  etardi. Raqam band bo'lsa server 409 qaytaradi. */}
              {editing && (
                <p className="mt-1 text-[11px] text-muted-foreground">{t("Bu raqam bilan xodim tizimga kiradi — o'zgartirilsa yangisi amal qiladi.")}</p>
              )}
            </div>
          </div>

          {/* Row 2: Vazifa / Jinsi / Tug'ilgan sanasi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t("O'quv markazidagi vazifasi")}<span className="text-rose-500">*</span></label>
              <Select value={vazifa} onChange={(v) => {
                    // Vazifaga tegishli bo'lmay qolgan maydonlar tozalanadi.
                    if (v !== "O'qituvchi") {
                      setPercent("");
                      setKurs("");
                    }
                    if (v !== "Moderator") setBandlik("");
                    // Daraja HAR SAFAR tozalanadi: o'qituvchi va moderator
                    // darajalari boshqa-boshqa ro'yxatdan keladi, ya'ni eski
                    // tanlov yangi ro'yxatda umuman yo'q qiymat bo'lardi va
                    // <select> uni jimgina tashlab yuborardi.
                    setDaraja("");
                    setVazifa(v);
                  }} options={[{ value: "O'qituvchi", label: t("O'qituvchi") }, { value: "Moderator", label: t("Moderator") }, { value: "Administrator", label: t("Administrator") }]} placeholder={t("Tanlang")} clearable />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                {t("Ko'rinadigan bo'limlar ham shu vazifadan olinadi (Boshqaruv → Rollar).")}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                Jinsi
                {/* Taxmin ketayotgani ko'rinib tursin — aks holda maydon
                    o'zidan o'zi to'lgandek tuyulardi. */}
                {guessingGender && (
                  <span className="ml-2 font-normal text-[11.5px] text-muted-foreground">
                    {t("ismdan aniqlanmoqda…")}
                  </span>
                )}
              </label>
              <Select value={jinsi} onChange={(v) => {
                    // Qo'lda tanlandi — endi avtomatik taxmin bu maydonga
                    // umuman tegmaydi (yuqoridagi effektga qarang).
                    setGenderTouched(true);
                    setJinsi(v);
                  }} options={[{ value: "Erkak", label: t("Erkak") }, { value: "Ayol", label: t("Ayol") }]} placeholder={t("Jinsini tanlang")} clearable />
            </div>
            <div>
              <label className={labelCls}>{t("Tug'ilgan sanasi")}</label>
              <DateField value={birthDate} onChange={(v) => setBirthDate(v)} variant="form" />
            </div>
          </div>

          {/* Row 3 — FAQAT o'qituvchi uchun (referensdagidek). */}
          {isTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>{t("Oladigan foizi")}<span className="text-rose-500">*</span></label>
                <Select value={percent} onChange={(v) => setPercent(v)} options={[...(percent && !percentOpts.some((p) => p.name === percent) ? [{ value: percent, label: t("{percent} — ro'yxatda yo'q (eski qiymat)", { percent }) }] : []), ...percentOpts.map((p) => ({ value: p.name, label: `${p.name} (${p.percent}%)` }))]} placeholder={selectPlaceholder(roleListsLoading, percentOpts.length, "Foiz qo'shilmagan", "Foizni tanlang")} clearable disabled={roleListsLoading} />
              </div>
              <div>
                <label className={labelCls}>{t("Darajasi")}</label>
                <DegreeSelect
                  loading={roleListsLoading}
                  opts={degreeOpts}
                  value={daraja}
                  onChange={setDaraja}
                />
              </div>
              <div>
                <label className={labelCls}>{t("Kurslar")}<span className="text-rose-500">*</span></label>
                <Select value={kurs} onChange={(v) => setKurs(v)} options={kursOpts.map((k) => ({ value: k, label: k }))} placeholder={selectPlaceholder(roleListsLoading, kursOpts.length, "Kurs qo'shilmagan")} clearable disabled={roleListsLoading} />
              </div>
            </div>
          )}

          {/* Row 3 — MODERATOR uchun (referensdagidek ikkita maydon).
              Darajasi menejer grading tizimidan, bandlik darajasi esa o'sha
              jadvaldagi yarim/bir stavka ustunlaridan. */}
          {isModerator && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("Darajasi")}</label>
                <DegreeSelect
                  loading={roleListsLoading}
                  opts={degreeOpts}
                  value={daraja}
                  onChange={setDaraja}
                  empty="Menejer qo'shilmagan"
                />
              </div>
              <div>
                <label className={labelCls}>{t("Bandlik darajasi")}</label>
                <Select value={bandlik} onChange={(v) => setBandlik(v)} options={BANDLIK_OPTS.map(({ label, key }) => { const rate = degreeOpts.find((d) => d.name === daraja)?.[key]; return { value: label, label: rate ? t("{label} ({rate} UZS)", { label, rate }) : label }; })} placeholder={t("Tanlang")} clearable />
              </div>
            </div>
          )}

          {/* Ish haqi chiqarish toggle */}
          <EmployeeToggle checked={payroll} onChange={setPayroll} label={t("Ish haqi chiqarish")} />

          {/* Filiallar / Rollar / Ish jadvali / Ish haqi */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-[13px] font-semibold">
              <div>{t("Filiallar")}</div>
              <div>{t("Rollar")}</div>
              <div>{t("Ish jadvali")}</div>
              <div className="flex items-center justify-between">
                <span>{t("Ish haqi")}</span>
                <label className="flex items-center gap-1 font-normal text-[12px] cursor-pointer">
                  <input type="checkbox" checked={sameForAll} onChange={(e) => toggleSameForAll(e.target.checked)} className="w-4 h-4 rounded accent-primary" />{" "}{t("Hammasiga bir xil")}
                </label>
              </div>
            </div>
            {/* Filiallar KELAYOTGANDA bu yer butunlay bo'sh turardi — sarlavha
                qatori bor, ostida esa hech narsa yo'q: "xodimni biriktiradigan
                filial yo'q ekan" degan taassurot. Checkbox ro'yxatiga nativ
                select placeholder'i to'g'ri kelmaydi, shuning uchun spinner. */}
            {branchesLoading ? <SpinnerBlock size={22} /> : branches.map((branch) => {
              const row = rowOf(branch.id);
              // `disabled:opacity-40` — loyihada MAVJUD bo'lgan yagona
              // disabled-opacity klassi (brauzerda tekshirildi; opacity-50 va
              // disabled:opacity-60 umuman generatsiya bo'lmagan). Yuklanish
              // uchun `disabled:opacity-70` QO'SHILMAYDI: ikkala klass ham
              // bir xil xossani yozadi va qaysi biri g'olib bo'lishi CSS
              // tartibiga qolardi — bu yerda o'chiq ko'rinish allaqachon bor.
              const off = !row.checked;
              return (
                <div key={branch.id} className="grid grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => updateRow(branch.id, { checked: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">{branch.name}</span>
                  </label>
                  <Select value={row.roleId} onChange={(v) => updateRow(branch.id, { roleId: v })} options={roles.map((r) => ({ value: String(r.id), label: r.name }))} placeholder={selectPlaceholder(branchListsLoading, roles.length, "Rol qo'shilmagan", "Rolni tanlang")} clearable disabled={off || branchListsLoading} />
                  <Select value={row.scheduleId} onChange={(v) => updateRow(branch.id, { scheduleId: v })} options={schedules.map((s) => ({ value: String(s.id), label: s.name }))} placeholder={selectPlaceholder(branchListsLoading, schedules.length, "Faol ish jadvali yo'q", "Ish jadvali")} clearable disabled={off || branchListsLoading} />
                  <MoneyInput
                    value={row.salary}
                    onChange={(v) => updateRow(branch.id, { salary: v })}
                    disabled={off}
                    placeholder={t("Ish haqini kiriting")}
                    className={`${inputCls} tabular-nums disabled:opacity-40`}
                  />
                </div>
              );
            })}
          </div>

          {/* Izoh */}
          <div>
            <label className={labelCls}>{t("Izoh")}</label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Elektron pochta / Profil rasmi / Ikki bosqichli tasdiqlash */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t("Elektron pochta")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("example@gmail.com")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("Profil rasmi")}</label>
              {/* Yashirin fayl maydoni + ko'rinadigan tugma — loyihadagi
                  naqsh (components/finance/PenaltyDrawer.tsx dagidek). */}
              <input
                ref={photoRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => pickPhoto(e.target.files?.[0])}
              />
              {/* Yangi tanlangan fayl BO'LMASA ham, tahrirlashda mavjud
                  rasm ko'rinib turishi kerak — aks holda admin rasm yo'q deb
                  o'ylab, uni bilmasdan qayta yuklardi. */}
              {photo || photoUrl ? (
                <div className="w-full h-10 rounded-lg border border-border bg-card px-2 text-sm flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo ? photo.url : photoUrl} alt="" style={{ width: 28, height: 28, objectFit: "cover" }} className="rounded-full shrink-0" />
                  <span className="flex-1 truncate text-[13px]">{photo ? photo.name : "Mavjud rasm"}</span>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    title={t("Rasmni olib tashlash")}
                    className="h-7 w-7 shrink-0 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-left flex items-center justify-between hover:bg-secondary/30"
                >
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Upload className="icon icon-sm" />{" "}{t("Profil rasmi")}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">{t("PNG, JPG")}</span>
                </button>
              )}
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <EmployeeToggle checked={twoFactor} onChange={setTwoFactor} label={t("Ikki bosqichli tasdiqlash")} />
              {/* Toggle qiymati bazaga rost yoziladi (hr_employees.twoFactor),
                  ammo uni O'QIYDIGAN kod yo'q: app/api/auth/login/route.ts
                  faqat telefon + parolni tekshiradi va hech qanday ikkinchi
                  bosqich so'ramaydi. Uni "ishlaydigan xavfsizlik sozlamasi"
                  qilib ko'rsatish yolg'on va'da bo'lardi, o'chirib tashlash
                  esa saqlangan haqiqiy qiymatni yo'qotardi — shu bois
                  Sozlamalar bo'limidagi kabi qisqa, xira rost izoh
                  (components/settings/SettingsNote.tsx qoidasi). */}
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t("Belgi xodim kartasiga saqlanadi, lekin hozircha amal qilmaydi — tizimga kirishda faqat telefon raqam va parol tekshiriladi.")}
              </p>
            </div>
          </div>

          {/* Maxsus maydonlar — sozlamalarda saqlangan ta'riflar bo'yicha. */}
          {customDefs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {customDefs.map((f) => (
                <div key={f.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium">
                      {f.name}
                      {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCustomField(f)}
                      title={t("Maydonni o'chirish")}
                      className="h-6 w-6 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderCustomInput(f, customValues[f.name] ?? "", (v) =>
                    setCustomValues((prev) => ({ ...prev, [f.name]: v })))}
                </div>
              ))}
            </div>
          )}

          {/* Maxsus maydon qo'shish */}
          <button
            type="button"
            onClick={() => setShowCustomField(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <Plus className="icon icon-sm" />
            <span>{t("Maxsus maydon qo'shish")}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border sticky bottom-0 bg-card">
          <button onClick={modal.close} className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">{t("Orqaga")}</button>
          <button onClick={save} disabled={saving} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? t("Saqlanmoqda…") : t("Saqlash")}</button>
        </div>
      </Modal>{showCustomField && (
        <CustomFieldDrawer
          onClose={() => setShowCustomField(false)}
          onSave={addCustomField}
          saving={savingField}
        />
      )}</>
  );
}
