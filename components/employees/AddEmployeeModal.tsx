"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
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
const selectCls =
  "w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

function Chevron() {
  return (
    <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      <use href="#i-chevron-down" />
    </svg>
  );
}

// Bitta filial qatorining holati. Galochka qo'yilmaguncha qolgan uchtasi
// o'chiq turadi (referensdagidek).
interface BranchRow {
  checked: boolean;
  roleId: string;
  scheduleId: string;
  salary: string;
}
const EMPTY_ROW: BranchRow = { checked: false, roleId: "", scheduleId: "", salary: "" };

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
      <div className="relative">
        <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Tanlang</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Chevron />
      </div>
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
  const editing = Boolean(employee);
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  // Filial qatorlari Boshqaruv → Filiallar bilan bir xil manbadan.
  const { branches, loading: branchesLoading } = useBranches();
  // Tahrirlashda ism BITTA maydon. Bazada ham yagona `name` bor va
  // "ism familiya" tartibi hech qayerda majburlanmagan (import ham) — har
  // qanday bo'lish qoidasi familiyasi oldinda yozilgan yozuvlarni ag'darib
  // yuborardi. Shuning uchun mavjud xodimda satr BO'LINMAYDI.
  const [ism, setIsm] = useState(employee?.name ?? "");
  const [familiya, setFamiliya] = useState("");
  // Bazada ikki xil shakl bor: "94 155 88 55" va "998336263006". Formatter
  // ikkalasini ham qabul qiladi — ilgari bu yerda qo'lda "+998" qo'shilardi
  // va 12 xonali raqamga u IKKINCHI marta yopishib ketardi.
  const [phone, setPhone] = useState(employee ? formatPhoneDisplay(employee.phone) : "+998");
  const [vazifa, setVazifa] = useState(employee ? TURI_LABEL[employee.turi] ?? "" : "");
  const [jinsi, setJinsi] = useState(employee ? GENDER_LABEL[employee.gender] ?? "" : "");
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
        showError(data.error || "Maxsus maydon saqlanmadi");
        return false;
      }
      setCustomDefs(next);
      return true;
    } catch {
      showError("Serverga ulanib bo'lmadi — maxsus maydon saqlanmadi");
      return false;
    }
  }

  async function addCustomField(draft: CustomFieldDraft) {
    if (customDefs.some((f) => f.name.toLowerCase() === draft.name.toLowerCase())) {
      showError(`"${draft.name}" nomli maydon allaqachon bor`);
      return;
    }
    setSavingField(true);
    const nextId = customDefs.reduce((max, f) => Math.max(max, f.id), 0) + 1;
    const ok = await persistDefs([...customDefs, { id: nextId, ...draft }]);
    setSavingField(false);
    if (!ok) return;
    setShowCustomField(false);
    showSuccess(`Maxsus maydon qo'shildi — ${draft.name}`);
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
    showSuccess(`Maxsus maydon o'chirildi — ${def.name}`);
  }

  // Referensda vazifa "O'qituvchi" tanlanganda pastda yana uchta maydon
  // ochiladi. Uchalasining ro'yxati ham BACKENDDAN keladi:
  //   Oladigan foizi — Sozlamalar → Moliya → Oylik foizlari (monthly-percents)
  //   Darajasi       — Sozlamalar → Boshqaruv → O'qituvchi darajalari
  //   Kurslar        — O'quv bo'limi → Kurslar (/api/offline-courses)
  const isTeacher = vazifa === "O'qituvchi";
  const [percent, setPercent] = useState(employee?.percent ?? "");
  const [daraja, setDaraja] = useState(employee?.degree ?? "");
  const [kurs, setKurs] = useState(employee?.kurs ?? "");
  const [percentOpts, setPercentOpts] = useState<{ name: string; percent: string }[]>([]);
  const [darajaOpts, setDarajaOpts] = useState<string[]>([]);
  const [kursOpts, setKursOpts] = useState<string[]>([]);
  // Ro'yxatlar KELAYOTGANDA "Foizni tanlang" turishi yolg'on edi: hali hech
  // narsa o'qilmagan, foydalanuvchi esa ro'yxat bo'sh deb o'ylardi.
  // Bayroq "yuklanmoqda" emas, "YUKLANDI" — chunki bu uch so'rov vazifa
  // "O'qituvchi"ga o'zgargandan KEYIN ketadi. Oddiy `loading` bayrog'i
  // effekt ishga tushguncha bir kadr `false` turib, aynan o'sha bo'sh
  // ro'yxatni ko'rsatib ulgurardi; hosila qiymatda bunday oyna yo'q.
  const [teacherListsLoaded, setTeacherListsLoaded] = useState(false);
  const teacherListsLoading = isTeacher && !teacherListsLoaded;

  // Ro'yxatlar faqat kerak bo'lganda yuklanadi — moderator/administrator
  // tanlansa bu so'rovlar umuman ketmaydi.
  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;
    const get = (url: string) => fetch(url).then((r) => r.json()).catch(() => null);
    Promise.all([
      get("/api/settings-lists?kind=monthly-percents"),
      get("/api/settings-lists?kind=degrees-teacher"),
      get("/api/offline-courses"),
    ]).then(([p, d, c]) => {
      if (cancelled) return;
      if (p?.ok) setPercentOpts((p.items as { name: string; percent: string }[]).map((i) => ({ name: i.name, percent: i.percent })));
      if (d?.ok) setDarajaOpts((d.items as { name: string }[]).map((i) => i.name));
      if (c?.ok) setKursOpts((c.courses as { name: string }[]).map((i) => i.name));
    }).finally(() => { if (!cancelled) setTeacherListsLoaded(true); });
    return () => { cancelled = true; };
  }, [isTeacher]);

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
      return next;
    });
  }
  /** Galochka YOQILGANDA mavjud ish haqilarni darhol tenglashtiramiz. */
  function toggleSameForAll(on: boolean) {
    setSameForAll(on);
    if (!on) return;
    setBranchRows((p) => {
      const first = branches.map((b) => p[b.id]?.salary).find((s) => s);
      if (!first) return p;
      const next: Record<number, BranchRow> = { ...p };
      for (const b of branches) next[b.id] = { ...(next[b.id] ?? EMPTY_ROW), salary: first };
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
      showError("Faqat PNG yoki JPG rasm tanlang");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Rasm hajmi 5 MB dan oshmasin");
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
      showError(editing ? "F.I.SH. ni kiriting" : "Ism va familiyani kiriting");
      return;
    }
    const trimmedPhone = phone.trim();
    if (!isValidPhoneClient(trimmedPhone)) {
      showError("Telefon raqamini to'g'ri kiriting (masalan +998 90 123 45 67)");
      return;
    }
    // Filiallar ro'yxati hali kelmagan bo'lsa saqlashga yo'l qo'ymaymiz:
    // `branchAssignments` shu ro'yxatdan yig'iladi va bo'sh massiv
    // yuborilsa xodimning sozlangan ish haqi butunlay o'chib ketardi.
    if (editing && branches.length === 0) {
      showError("Filiallar ro'yxati hali yuklanmadi — bir lahza kuting");
      return;
    }
    // Referensda bu ikkisi yulduzcha bilan — faqat o'qituvchi uchun majburiy.
    if (isTeacher && !percent) {
      showError("Oladigan foizini tanlang");
      return;
    }
    if (isTeacher && !kurs) {
      showError("Kursni tanlang");
      return;
    }
    // Drawer'da "Majburiy maydon" yoqilgan bo'lsa — u haqiqatan majburiy
    // bo'lsin, aks holda toggle yana bir bo'sh va'da bo'lib qolardi.
    const missing = customDefs.find((f) => f.required && !(customValues[f.name] || "").trim());
    if (missing) {
      showError(`"${missing.name}" maydonini to'ldiring`);
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
          showError(upData.error || "Rasm yuklanmadi");
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
          // Telefon formatlangan ko'rinishda ketadi ("+998 94 155 88 55") —
          // server uni normalizePhone() bilan bir xil shaklga soladi, ya'ni
          // probel va qavslar bazaga tushmaydi.
          phone: trimmedPhone,
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
          // Faqat o'qituvchida to'ldiriladi; boshqasida bo'sh ketadi.
          kurs,
          percent,
          degree: daraja,
          photoUrl: finalPhotoUrl,
          branchAssignments,
          branchIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || (editing ? "Saqlanmadi" : "Xodim qo'shilmadi"));
        setSaving(false);
        return;
      }
      if (editing) {
        // Tahrirlashda SMS yuborilmaydi — faollashtirish taklifi faqat
        // yangi xodim yaratilganda ketadi.
        onSaved?.(data.employee as HrEmployeeFull);
        showSuccess("Xodim ma'lumotlari saqlandi");
      } else {
        onCreated?.(data.employee as HrEmployeeFull);
        if (data.smsSent) {
          showSuccess(`Xodim qo'shildi — ${name}. Faollashtirish SMS'i yuborildi.`);
        } else {
          showError(`Xodim qo'shildi — ${name}, lekin faollashtirish SMS'i yuborilmadi. Birozdan so'ng qayta urinib ko'ring.`);
        }
      }
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-[16px] font-semibold">{editing ? "Xodimni tahrirlash" : "Xodim qo'shish"}</h3>
          <p className="text-[11px] text-muted-foreground"><span className="text-rose-500">*</span> Zarurligini bildiradi</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Row 1: Ism / Familiya / Telefon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tahrirlashda BITTA maydon — bazada ham yagona `name` bor va
                uni ism/familiyaga bo'lish tartibi hech qayerda kafolatlanmagan
                (familiyasi oldinda yozilgan yozuvlar ag'darilib ketardi). */}
            {editing ? (
              <div className="md:col-span-2">
                <label className={labelCls}>F.I.SH.<span className="text-rose-500">*</span></label>
                <input type="text" value={ism} onChange={(e) => setIsm(e.target.value)} className={inputCls} />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Ism<span className="text-rose-500">*</span></label>
                  <input type="text" value={ism} onChange={(e) => setIsm(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Familiya<span className="text-rose-500">*</span></label>
                  <input type="text" value={familiya} onChange={(e) => setFamiliya(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>Telefon raqam<span className="text-rose-500">*</span></label>
              <div className="flex items-center gap-2 h-10 rounded-lg border border-border pl-2 pr-3 bg-card">
                <span className="inline-block text-[16px]">🇺🇿</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
              {/* Telefon — tizimga kirish logini. Shu sababli PATCH endi
                  `users` hujjatini ham yangilaydi: aks holda profil yangi
                  raqamni ko'rsatgani bilan xodim eskisi bilan kirishda davom
                  etardi. Raqam band bo'lsa server 409 qaytaradi. */}
              {editing && (
                <p className="mt-1 text-[11px] text-muted-foreground">Bu raqam bilan xodim tizimga kiradi — o&apos;zgartirilsa yangisi amal qiladi.</p>
              )}
            </div>
          </div>

          {/* Row 2: Vazifa / Jinsi / Tug'ilgan sanasi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>O&apos;quv markazidagi vazifasi<span className="text-rose-500">*</span></label>
              <div className="relative">
                <select
                  className={selectCls}
                  value={vazifa}
                  onChange={(e) => {
                    // O'qituvchidan boshqasiga o'tilsa, faqat o'qituvchiga
                    // tegishli maydonlar tozalanadi.
                    if (e.target.value !== "O'qituvchi") {
                      setPercent("");
                      setDaraja("");
                      setKurs("");
                    }
                    setVazifa(e.target.value);
                  }}
                >
                  <option value="">Tanlang</option>
                  <option>O&apos;qituvchi</option>
                  <option>Moderator</option>
                  <option>Administrator</option>
                </select>
                <Chevron />
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Ko&apos;rinadigan bo&apos;limlar ham shu vazifadan olinadi (Boshqaruv → Rollar).
              </p>
            </div>
            <div>
              <label className={labelCls}>Jinsi</label>
              <div className="relative">
                <select className={selectCls} value={jinsi} onChange={(e) => setJinsi(e.target.value)}>
                  <option value="">Jinsini tanlang</option>
                  <option>Erkak</option>
                  <option>Ayol</option>
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tug&apos;ilgan sanasi</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Row 3 — FAQAT o'qituvchi uchun (referensdagidek). */}
          {isTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Oladigan foizi<span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    className={`${selectCls} disabled:opacity-70`}
                    disabled={teacherListsLoading}
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  >
                    <option value="">{selectPlaceholder(teacherListsLoading, percentOpts.length, "Foiz qo'shilmagan", "Foizni tanlang")}</option>
                    {/* ESKI XOM QIYMAT ("60" kabi). Ilgari bu maydon erkin
                        matn edi, ya'ni bazada ro'yxatga mos kelmaydigan
                        qiymatlar bor. Ular uchun variant qo'shilmasa
                        <select> ularni JIMGINA tashlab yuborardi va birinchi
                        saqlashda foiz yo'qolardi. */}
                    {percent && !percentOpts.some((p) => p.name === percent) && (
                      <option value={percent}>{`${percent} — ro'yxatda yo'q (eski qiymat)`}</option>
                    )}
                    {percentOpts.map((p) => (
                      <option key={p.name} value={p.name}>{`${p.name} (${p.percent}%)`}</option>
                    ))}
                  </select>
                  <Chevron />
                </div>
              </div>
              <div>
                <label className={labelCls}>Darajasi</label>
                <div className="relative">
                  <select
                    className={`${selectCls} disabled:opacity-70`}
                    disabled={teacherListsLoading}
                    value={daraja}
                    onChange={(e) => setDaraja(e.target.value)}
                  >
                    <option value="">{selectPlaceholder(teacherListsLoading, darajaOpts.length, "Daraja qo'shilmagan", "Darajani tanlang")}</option>
                    {darajaOpts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Chevron />
                </div>
              </div>
              <div>
                <label className={labelCls}>Kurslar<span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    className={`${selectCls} disabled:opacity-70`}
                    disabled={teacherListsLoading}
                    value={kurs}
                    onChange={(e) => setKurs(e.target.value)}
                  >
                    <option value="">{selectPlaceholder(teacherListsLoading, kursOpts.length, "Kurs qo'shilmagan")}</option>
                    {kursOpts.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <Chevron />
                </div>
              </div>
            </div>
          )}

          {/* Ish haqi chiqarish toggle */}
          <EmployeeToggle checked={payroll} onChange={setPayroll} label="Ish haqi chiqarish" />

          {/* Filiallar / Rollar / Ish jadvali / Ish haqi */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-[13px] font-semibold">
              <div>Filiallar</div>
              <div>Rollar</div>
              <div>Ish jadvali</div>
              <div className="flex items-center justify-between">
                <span>Ish haqi</span>
                <label className="flex items-center gap-1 font-normal text-[12px] cursor-pointer">
                  <input type="checkbox" checked={sameForAll} onChange={(e) => toggleSameForAll(e.target.checked)} className="w-4 h-4 rounded accent-primary" /> Hammasiga bir xil
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
                  <div className="relative">
                    <select
                      className={`${selectCls} disabled:opacity-40`}
                      disabled={off || branchListsLoading}
                      value={row.roleId}
                      onChange={(e) => updateRow(branch.id, { roleId: e.target.value })}
                    >
                      <option value="">{selectPlaceholder(branchListsLoading, roles.length, "Rol qo'shilmagan", "Rolni tanlang")}</option>
                      {roles.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                    </select>
                    <Chevron />
                  </div>
                  <div className="relative">
                    <select
                      className={`${selectCls} disabled:opacity-40`}
                      disabled={off || branchListsLoading}
                      value={row.scheduleId}
                      onChange={(e) => updateRow(branch.id, { scheduleId: e.target.value })}
                    >
                      {/* Ro'yxat FAOL jadvallar bilan filtrlangan — "jadval
                          qo'shilmagan" emas, "faol jadval yo'q" to'g'ri. */}
                      <option value="">{selectPlaceholder(branchListsLoading, schedules.length, "Faol ish jadvali yo'q", "Ish jadvali")}</option>
                      {schedules.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <Chevron />
                  </div>
                  <MoneyInput
                    value={row.salary}
                    onChange={(v) => updateRow(branch.id, { salary: v })}
                    disabled={off}
                    placeholder="Ish haqini kiriting"
                    className={`${inputCls} tabular-nums disabled:opacity-40`}
                  />
                </div>
              );
            })}
          </div>

          {/* Izoh */}
          <div>
            <label className={labelCls}>Izoh</label>
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
              <label className={labelCls}>Elektron pochta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Profil rasmi</label>
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
                    title="Rasmni olib tashlash"
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
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Upload className="icon icon-sm" /> Profil rasmi</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">PNG, JPG</span>
                </button>
              )}
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <EmployeeToggle checked={twoFactor} onChange={setTwoFactor} label="Ikki bosqichli tasdiqlash" />
              {/* Toggle qiymati bazaga rost yoziladi (hr_employees.twoFactor),
                  ammo uni O'QIYDIGAN kod yo'q: app/api/auth/login/route.ts
                  faqat telefon + parolni tekshiradi va hech qanday ikkinchi
                  bosqich so'ramaydi. Uni "ishlaydigan xavfsizlik sozlamasi"
                  qilib ko'rsatish yolg'on va'da bo'lardi, o'chirib tashlash
                  esa saqlangan haqiqiy qiymatni yo'qotardi — shu bois
                  Sozlamalar bo'limidagi kabi qisqa, xira rost izoh
                  (components/settings/SettingsNote.tsx qoidasi). */}
              <p className="text-[11px] leading-snug text-muted-foreground">
                Belgi xodim kartasiga saqlanadi, lekin hozircha amal qilmaydi &mdash; tizimga
                kirishda faqat telefon raqam va parol tekshiriladi.
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
                      title="Maydonni o'chirish"
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
            <span>Maxsus maydon qo&apos;shish</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">Orqaga</button>
          <button onClick={save} disabled={saving} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>

      {showCustomField && (
        <CustomFieldDrawer
          onClose={() => setShowCustomField(false)}
          onSave={addCustomField}
          saving={savingField}
        />
      )}
    </div>
  );
}
