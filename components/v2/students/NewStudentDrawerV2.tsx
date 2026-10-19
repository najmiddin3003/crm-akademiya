"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useStudentSources } from "@/components/orders/useStudentSources";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import BirthDateField, { parseBirth } from "@/components/v2/form/BirthDateField";
import { Chip, Field, FieldError, FieldLabel, PhoneField, SectionTitle, TextInput, formatLocalPhone } from "@/components/v2/form/fields";
import { SOURCE_OTHER } from "@/constants";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import { invalidateStudents } from "@/hooks/useStudents";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import type { StudentRow } from "@/lib/studentsData";

// YANGI VERSIYA — «YANGI O'QUVCHI» (rasm «Yangi o'quvchi · O'ngdan panel»,
// yorug'/qorong'i, 19.10.2026): sarlavha + «… filiali»;
//   Shaxsiy ma'lumotlar: Ism | Familiya, Telefon (+998) | Tug'ilgan sana
//     (ixtiyoriy), «Qo'shimcha ma'lumotlar · ikkinchi telefon raqami»;
//   O'qish: Kategoriya (chiplar), Filial | Manba, Guruh (ixtiyoriy — qidiruv,
//     «Chet tillari · 3 ta guruh», «6 o'quvchi», «Kategoriya bo'yicha saralangan ·
//     Hammasini ko'rsatish»);
//   pastda «Saqlab, yana qo'shish», «Bekor qilish», «O'quvchini saqlash».
//
// Yozish — eski oynadagi bilan BITTA so'rov (POST /api/pupils; manba ro'yxati —
// components/orders/useStudentSources.ts), guruh tanlangan bo'lsa ketidan
// POST /api/groups/:id/students (O'quvchilar → «Guruhga qo'shish» bilan bir xil).
//
// Taxminlar (design/v2/SAVOLLAR.md 81–84):
//   • majburiy — rasmdagidek: Ism, Familiya, Telefon, Kategoriya, Manba («ixtiyoriy»
//     yozilmaganlari); eski oynada faqat Ism va Manba edi;
//   • FILIAL — navbardagi filial (server o'quvchini o'shanga yozadi); maydon faqat
//     ko'rsatadi, boshqa filial uchun navbarda almashtiriladi;
//   • guruh kategoriyasi bazada yo'q — a'zolarining ko'pchiligi kategoriyasi
//     (`groupCategory`, O'quvchilar sahifasi beradi); berilmasa saralanmaydi;
//   • takroriy telefon — ogohlantirish, saqlashni to'xtatmaydi.

export interface NewStudentDrawerProps {
  onClose: () => void;
  /** Har saqlangandan keyin («Saqlab, yana qo'shish» da bir necha marta). */
  onSaved?: (pupil: Pupil, groupId: number | null) => void;
  /** Guruhlar (sahifada bo'lsa); berilmasa — so'raladi. */
  groups?: Group[];
  /** guruh id → kategoriya (a'zolarining ko'pchiligi) — «Kategoriya bo'yicha saralangan». */
  groupCategory?: Map<number, string>;
}

type FieldKey = "firstName" | "lastName" | "phone" | "birth" | "extraPhone" | "category" | "branch" | "source";

export default function NewStudentDrawerV2({ onClose, onSaved, groups: givenGroups, groupCategory }: NewStudentDrawerProps) {
  const { t } = useT();
  const router = useRouter();
  const branch = useBranch();
  const { showToast, showError } = useToast();
  const modal = useModalClose(onClose, "drawer");
  const { names: categoryNames, loading: categoriesLoading } = useEduCategoryNames();
  const { sourceOptions } = useStudentSources("");

  const [fetchedGroups, setFetchedGroups] = useState<Group[] | null>(null);
  useEffect(() => {
    if (givenGroups) return;
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setFetchedGroups(d?.ok ? (d.groups as Group[]) : []);
      })
      .catch(() => {
        if (!cancelled) setFetchedGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [givenGroups]);
  const groups = givenGroups ?? fetchedGroups;

  /* ---- Maydonlar ---- */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [extraPhone, setExtraPhone] = useState("");
  const [category, setCategory] = useState("");
  // «Boshqa» — qiymat emas, darvoza (eski oynadagi qoida): tanlansa ostida matn maydoni.
  const [sourcePick, setSourcePick] = useState("");
  const [otherText, setOtherText] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [again, setAgain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  // «Saqlab, yana qo'shish» dan keyin saqlanib qoladigan tanlovlar — o'zgarmagan bo'lsa forma «toza».
  const [base, setBase] = useState({ category: "", sourcePick: "", otherText: "", groupId: null as number | null });
  const touch = (k: FieldKey) => setTouched((cur) => (cur[k] ? cur : { ...cur, [k]: true }));
  // Maydon o'ramlari `data-field` bilan — saqlashda birinchi xatoli maydonga fokus.
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldEl = (k: FieldKey) => rootRef.current?.querySelector<HTMLElement>(`[data-field="${k}"]`) ?? null;

  const source = sourcePick === SOURCE_OTHER ? otherText.trim() : sourcePick;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const birthParsed = parseBirth(birth);

  /* ---- Tekshiruv: maydondan chiqqanda (yozib turganda emas) va saqlashda ---- */
  const errors: Record<FieldKey, string> = {
    firstName: !firstName.trim() ? t("Ismni kiriting") : "",
    lastName: !lastName.trim() ? t("Familiyani kiriting") : "",
    phone: phone.length === 0 ? t("Telefon raqamini kiriting") : phone.length < 9 ? t("Raqam to'liq emas — 9 ta raqam kerak") : "",
    birth: birthParsed.state === "partial" || birthParsed.state === "invalid" ? t("Sana noto'g'ri — kk.oo.yyyy") : "",
    extraPhone: showExtra && extraPhone.length > 0 && extraPhone.length < 9 ? t("Raqam to'liq emas — 9 ta raqam kerak") : "",
    category: !category && categoryNames.length > 0 ? t("Kategoriyani tanlang") : "",
    branch: branch.branchId === null ? t("Navbardan filialni tanlang — o'quvchi o'sha filialga qo'shiladi") : "",
    source: !sourcePick ? t("Manbani tanlang") : sourcePick === SOURCE_OTHER && !otherText.trim() ? t("Manbani yozing") : "",
  };
  const shown = (k: FieldKey) => ((submitted || touched[k]) && errors[k] ? errors[k] : "");
  const ORDER: FieldKey[] = ["firstName", "lastName", "phone", "birth", "extraPhone", "category", "branch", "source"];

  /* ---- Takroriy telefon — ogohlantirish (saqlashni to'xtatmaydi) ---- */
  const [dupes, setDupes] = useState<{ phone: string; list: StudentRow[] } | null>(null);
  useEffect(() => {
    if (phone.length !== 9) return;
    let alive = true;
    const id = window.setTimeout(() => {
      fetch(`/api/search/students?q=${phone}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const list = (d?.ok ? (d.students as StudentRow[]) : []).filter((s) => {
            const digits = (s.phone || "").replace(/\D/g, "");
            return digits === phone || digits === `998${phone}`;
          });
          setDupes({ phone, list });
        })
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [phone]);
  const dupList = dupes && dupes.phone === phone ? dupes.list : [];

  /* ---- Guruhlar: arxivdagisiz; kategoriya ma'lum bo'lsa — o'sha kategoriyaniki ---- */
  const usableGroups = useMemo(() => (groups ?? []).filter((g) => g.status !== "archive"), [groups]);
  const catOf = (g: Group) => groupCategory?.get(g.id) ?? "";
  const byCategory = !!groupCategory && !!category && !showAllGroups;
  const listedGroups = useMemo(() => {
    const list = byCategory ? usableGroups.filter((g) => (groupCategory?.get(g.id) ?? "") === category) : [...usableGroups];
    if (!groupCategory) return list.sort((a, b) => (a.course || "").localeCompare(b.course || ""));
    // Bo'limlar: tanlangan kategoriya birinchi, keyin qolganlari alifbo bo'yicha, kategoriyasizlar oxirida.
    const rank = (g: Group) => {
      const c = groupCategory.get(g.id) ?? "";
      return c === category ? `0${c}` : c ? `1${c}` : "2";
    };
    return list.sort((a, b) => rank(a).localeCompare(rank(b)) || (a.course || "").localeCompare(b.course || ""));
  }, [usableGroups, byCategory, groupCategory, category]);
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of listedGroups) {
      const c = groupCategory?.get(g.id) ?? "";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [listedGroups, groupCategory]);
  const groupOptions: PickerOption[] = listedGroups.map((g) => {
    const c = catOf(g);
    return {
      value: String(g.id),
      label: g.course || g.name || `#${g.id}`,
      sublabel: [g.teacher, [g.day, timeLabel(g.time)].filter(Boolean).join(" "), roomLabel(g.room)].filter(Boolean).join(" · "),
      hint: t("{n} o'quvchi", { n: g.studentIds?.length ?? g.students ?? 0 }),
      lead: <span className={`mt-1 size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />,
      group: groupCategory ? `${c || t("Kategoriyasiz")} · ${t("{n} ta guruh", { n: countByCat.get(c) ?? 0 })}` : undefined,
      keywords: `${g.name} ${g.teacher} ${g.course}`,
    };
  });
  // Tanlangan guruh ro'yxatdan chiqib qolsa ham (kategoriya almashdi) — tugmada ko'rinsin.
  const chosenGroup = groupId === null ? undefined : usableGroups.find((g) => g.id === groupId);
  if (chosenGroup && !groupOptions.some((o) => o.value === String(chosenGroup.id))) {
    groupOptions.unshift({
      value: String(chosenGroup.id),
      label: chosenGroup.course || chosenGroup.name,
      sublabel: [chosenGroup.teacher, [chosenGroup.day, timeLabel(chosenGroup.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
      lead: <span className={`mt-1 size-2 rounded-full ${FAN_DOT[fanOf(chosenGroup.course)]}`} aria-hidden />,
    });
  }

  const dirty =
    !!(firstName || lastName || phone || birth || extraPhone) ||
    category !== base.category ||
    sourcePick !== base.sourcePick ||
    otherText !== base.otherText ||
    groupId !== base.groupId;

  async function save() {
    if (saving) return;
    const first = ORDER.find((k) => errors[k]);
    if (first) {
      setSubmitted(true);
      fieldEl(first)?.querySelector<HTMLElement>("input:not([type=checkbox]), button")?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pupils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: formatLocalPhone(phone),
          extraPhone: showExtra ? formatLocalPhone(extraPhone) : "",
          category,
          birthDate: birthParsed.iso,
          source,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        showError(t(data?.error || "O'quvchi qo'shishda xatolik yuz berdi"));
        setSaving(false);
        return;
      }
      const pupil = data.pupil as Pupil;
      invalidateStudents();
      // Guruhga — O'quvchilar → «Guruhga qo'shish» bilan bir xil so'rov.
      let addedGroup: Group | null = null;
      if (groupId !== null) {
        const gr = await fetch(`/api/groups/${groupId}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pupilId: pupil.id }),
        })
          .then((r) => r.json())
          .catch(() => null);
        if (gr?.ok) addedGroup = usableGroups.find((g) => g.id === groupId) ?? null;
        else showError(t("O'quvchi qo'shildi, lekin guruhga qo'shilmadi: {error}", { error: t(gr?.error || "Serverga ulanib bo'lmadi") }));
      }
      const fullName = `${pupil.firstName ?? firstName.trim()} ${pupil.lastName ?? lastName.trim()}`.trim();
      showToast({
        tone: "success",
        title: t("O'quvchi qo'shildi"),
        detail: [fullName, addedGroup ? t("{group} guruhiga qo'shildi", { group: addedGroup.course || addedGroup.name }) : ""].filter(Boolean),
        action: { label: t("Profilni ochish"), onClick: () => router.push(`/student-edit/${pupil.id}`) },
      });
      onSaved?.(pupil, addedGroup ? addedGroup.id : null);
      if (again) {
        // Keyingisi uchun: shaxsiy maydonlar tozalanadi, kategoriya/manba/guruh qoladi.
        setFirstName("");
        setLastName("");
        setPhone("");
        setBirth("");
        setExtraPhone("");
        setShowExtra(false);
        setTouched({});
        setSubmitted(false);
        setBase({ category, sourcePick, otherText, groupId });
        setSaving(false);
        requestAnimationFrame(() => fieldEl("firstName")?.querySelector<HTMLInputElement>("input")?.focus());
      } else {
        modal.close();
      }
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const sourcePickerOptions: PickerOption[] = sourceOptions.map((s) => ({ value: s, label: s === SOURCE_OTHER ? t("Boshqa (o'zim yozaman)") : t(s) }));
  const branchOptions: PickerOption[] = branch.branches.map((b) => ({ value: String(b.id), label: b.name }));

  return (
    <V2Dialog
      variant="right"
      controller={modal}
      title={t("Yangi o'quvchi")}
      subtitle={branchName ? t("{name} filiali", { name: branchName }) : undefined}
      onClose={onClose}
      dirty={dirty}
      saving={saving}
      onSubmit={save}
      footerStart={
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-v2-small text-v2-text-2">
          <V2Checkbox checked={again} onChange={setAgain} label={t("Saqlab, yana qo'shish")} />
          {t("Saqlab, yana qo'shish")}
        </label>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={`${secondaryBtn} justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={save} disabled={saving} className={`${primaryBtn} justify-center disabled:cursor-not-allowed disabled:opacity-70`}>
            {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("O'quvchini saqlash")}
          </button>
        </>
      )}
    >
      <div ref={rootRef} className="space-y-6">
        {/* Shaxsiy ma'lumotlar */}
        <section>
          <SectionTitle>{t("Shaxsiy ma'lumotlar")}</SectionTitle>
          <div className="grid gap-4 min-[30rem]:grid-cols-2">
            <div data-field="firstName">
              <Field label={t("Ism")} error={shown("firstName")}>
                <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => touch("firstName")} maxLength={60} autoComplete="off" state={shown("firstName") ? "error" : "default"} />
              </Field>
            </div>
            <div data-field="lastName">
              <Field label={t("Familiya")} error={shown("lastName")}>
                <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => touch("lastName")} maxLength={60} autoComplete="off" state={shown("lastName") ? "error" : "default"} />
              </Field>
            </div>
            <div data-field="phone">
              <Field
                label={t("Telefon")}
                error={shown("phone")}
                warning={
                  dupList.length > 0 ? (
                    <>
                      {t("Bu raqam O'quvchilarda bor:")}{" "}
                      {dupList.slice(0, 2).map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <b className="font-semibold">{s.name}</b>{" "}
                          <Link href={`/student-edit/${s.id}`} target="_blank" className="font-semibold text-v2-brand-text hover:underline">
                            {t("Ochish")}
                          </Link>
                        </span>
                      ))}
                    </>
                  ) : undefined
                }
              >
                <PhoneField value={phone} onChange={setPhone} onBlur={() => touch("phone")} state={shown("phone") ? "error" : dupList.length > 0 ? "warning" : "default"} />
              </Field>
            </div>
            <div data-field="birth">
              <Field label={t("Tug'ilgan sana")} optional error={shown("birth")}>
                <BirthDateField value={birth} onChange={setBirth} onBlur={() => touch("birth")} state={shown("birth") ? "error" : "default"} />
              </Field>
            </div>
          </div>
          <label className="mt-3 inline-flex cursor-pointer select-none items-center gap-2 text-v2-small text-v2-text">
            <V2Checkbox checked={showExtra} onChange={setShowExtra} label={t("Qo'shimcha ma'lumotlar")} />
            <span className="font-medium">{t("Qo'shimcha ma'lumotlar")}</span>
            <span className="text-v2-text-3">· {t("ikkinchi telefon raqami")}</span>
          </label>
          {showExtra && (
            <div data-field="extraPhone" className="mt-3 min-[30rem]:w-1/2 min-[30rem]:pr-2">
              <Field label={t("Qo'shimcha telefon")} optional error={shown("extraPhone")}>
                <PhoneField value={extraPhone} onChange={setExtraPhone} onBlur={() => touch("extraPhone")} state={shown("extraPhone") ? "error" : "default"} />
              </Field>
            </div>
          )}
        </section>

        <div className="border-t border-v2-border" aria-hidden />

        {/* O'qish */}
        <section className="space-y-4">
          <SectionTitle>{t("O'qish")}</SectionTitle>
          <div data-field="category" className="-mt-1">
            <FieldLabel>{t("Kategoriya")}</FieldLabel>
            {categoriesLoading ? (
              <div className="flex gap-2" aria-hidden>
                <span className="h-8 w-20 rounded-v2-full bg-v2-skeleton" />
                <span className="h-8 w-16 rounded-v2-full bg-v2-skeleton" />
                <span className="h-8 w-24 rounded-v2-full bg-v2-skeleton" />
              </div>
            ) : categoryNames.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Kategoriya qo'shilmagan — O'quv bo'limi → Kategoriya")}</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("Kategoriya")}>
                {categoryNames.map((name) => (
                  <Chip
                    key={name}
                    on={category === name}
                    onClick={() => {
                      setCategory(category === name ? "" : name);
                      touch("category");
                      setShowAllGroups(false);
                    }}
                  >
                    {t(name)}
                  </Chip>
                ))}
              </div>
            )}
            {shown("category") && <FieldError>{shown("category")}</FieldError>}
          </div>

          <div className="grid gap-4 min-[30rem]:grid-cols-2">
            <div data-field="branch">
              <Field label={t("Filial")} error={shown("branch")} hint={!shown("branch") ? t("Navbardagi filial") : undefined}>
                <V2Picker
                  value={branch.branchId === null ? "" : String(branch.branchId)}
                  onChange={() => {}}
                  options={branchOptions}
                  label={t("Filial")}
                  placeholder={t("Tanlanmagan")}
                  disabled
                  state={shown("branch") ? "error" : "default"}
                />
              </Field>
            </div>
            <div data-field="source">
              <Field label={t("Manba")} error={sourcePick === SOURCE_OTHER ? "" : shown("source")}>
                <V2Picker
                  value={sourcePick}
                  onChange={(v) => {
                    setSourcePick(v);
                    touch("source");
                  }}
                  options={sourcePickerOptions}
                  label={t("Manba")}
                  placeholder={t("Tanlang")}
                  state={shown("source") && sourcePick !== SOURCE_OTHER ? "error" : "default"}
                />
              </Field>
            </div>
          </div>
          {sourcePick === SOURCE_OTHER && (
            <Field label={t("Manbani yozing")} error={shown("source")} hint={t("O'quvchi markazni qayerdan eshitgan?")}>
              <TextInput
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onBlur={() => touch("source")}
                maxLength={60}
                placeholder={t("Masalan: Maktabdan eshitgan")}
                autoFocus
                state={shown("source") ? "error" : "default"}
              />
            </Field>
          )}

          <Field label={t("Guruh")} optional>
            <V2Picker
              value={groupId === null ? "" : String(groupId)}
              onChange={(v) => setGroupId(v ? Number(v) : null)}
              options={groupOptions}
              label={t("Guruh")}
              placeholder={t("Tanlanmagan")}
              searchable
              searchPlaceholder={t("Guruh yoki o'qituvchi")}
              emptyText={byCategory ? t("Bu kategoriyada guruh yo'q") : t("Guruh topilmadi")}
              loading={!groups}
              clearable
              footer={
                groupCategory && category
                  ? () => (
                      <>
                        <span className="text-v2-text-3">{showAllGroups ? t("Hamma guruhlar") : t("Kategoriya bo'yicha saralangan")}</span>
                        <button type="button" onClick={() => setShowAllGroups((v) => !v)} className="font-semibold text-v2-brand-text hover:underline">
                          {showAllGroups ? t("Faqat shu kategoriya") : t("Hammasini ko'rsatish")}
                        </button>
                      </>
                    )
                  : undefined
              }
            />
          </Field>
        </section>
      </div>
    </V2Dialog>
  );
}
