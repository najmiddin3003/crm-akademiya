"use client";

import { useMemo, useState } from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { postHolat } from "@/components/leads/LeadHolatModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2TimeField, { isTime } from "@/components/v2/form/V2TimeField";
import { Field } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { Group } from "@/lib/groups";
import { sinovOf } from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import { DAY_MS, uzDateOf } from "@/lib/staffTasks";
import type { Teacher } from "@/lib/teachersData";
import { GroupRadioList, LeadFromBox } from "./leadBits";
import { dateOfIso, isoOfDate, liveGroupsFor, nextLessonIso, phoneParts, splitByCourse, startTimeOf, trialGroupOf } from "./leadUtils";

// YANGI VERSIYA — «BIRINCHI DARSGA YOZISH» / «BIRINCHI DARSNI KO'CHIRISH» (lid
// panelidagi «Birinchi darsga yozish →» va «O'zgartirish»; rasmda alohida oyna
// berilmagan — «Guruhga qo'shish» oynasi qolipida, SAVOLLAR 92). Maydonlar eski
// oyna bilan bir xil — sana, vaqt, o'qituvchi; ustiga ixtiyoriy «Guruh darsiga»:
// guruh tanlansa o'qituvchi, vaqt va keyingi dars sanasi o'zi qo'yiladi (lid shu
// guruhning darsiga keladi — panel va ro'yxatda xona ham shundan ko'rinadi).
//
// So'rov — eski oyna bilan BITTA: POST /api/orders/:id/holat { to: "sinov", sinov }.

const norm = (s: string | undefined) => String(s ?? "").trim().toLowerCase();

export default function LeadSinovModalV2({
  order,
  branchName,
  nowMs,
  groups,
  teachers,
  onClose,
  onDone,
  onConflict,
}: {
  order: Order;
  branchName: string;
  nowMs: number;
  groups: Group[] | null;
  teachers: Teacher[];
  onClose: () => void;
  onDone: (order: Order, message: string) => void;
  onConflict: () => void;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const current = sinovOf(order);
  const today = uzDateOf(nowMs);
  const all = groups ?? [];
  const live = liveGroupsFor(order, all);
  const { match, other } = splitByCourse(order, live);
  const [showAll, setShowAll] = useState(false);
  const list = showAll || match.length === 0 ? [...match, ...other] : match;

  // O'qituvchilar: shu kursni o'qitadiganlar tepada (eski oyna qoidasi).
  const curTeacher = current?.oqituvchi ?? "";
  const teacherOptions = useMemo<PickerOption[]>(() => {
    const c = norm(order.course);
    const sorted = [...teachers].sort((a, b) => {
      const ma = c && norm(a.kurs).includes(c) ? 0 : 1;
      const mb = c && norm(b.kurs).includes(c) ? 0 : 1;
      return ma - mb || a.name.localeCompare(b.name);
    });
    const opts: PickerOption[] = sorted.map((x) => ({ value: x.name, label: x.name, sublabel: x.kurs || undefined, keywords: x.phone }));
    if (curTeacher && !opts.some((o) => o.value === curTeacher)) opts.unshift({ value: curTeacher, label: curTeacher });
    return opts;
  }, [teachers, order.course, curTeacher]);

  // Oyna ochilgandagi qiymat — keyin o'zgarmaydi («Saqlanmagan o'zgarishlar» shunga qarab).
  const [initial] = useState(() => ({
    sana: current && current.sana >= today ? current.sana : uzDateOf(nowMs + DAY_MS),
    vaqt: current?.vaqt || "16:00",
    oqituvchi: curTeacher,
  }));
  const [sana, setSana] = useState(initial.sana);
  const [vaqt, setVaqt] = useState(initial.vaqt);
  // O'qituvchi tanlanmagan bo'lsa — kurs o'qituvchilaridan birinchisi (eski oyna sukuti).
  const [oqituvchiRaw, setOqituvchi] = useState<string | null>(initial.oqituvchi || null);
  const oqituvchi = oqituvchiRaw ?? teacherOptions[0]?.value ?? "";
  // Ko'chirishda — sinov darsi bo'lgan guruh (topilsa) tanlangan holda.
  const [pickedRaw, setPicked] = useState<number | null | undefined>(undefined);
  const trial = current ? trialGroupOf(order, all) : null;
  const pick = pickedRaw === undefined ? (trial?.id ?? null) : pickedRaw;

  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);

  const errSana = !sana ? t("Sanani tanlang") : sana < today ? t("Sana bugundan oldin bo'lmasin.") : "";
  const errVaqt = !isTime(vaqt) ? t("Vaqtni «16:00» ko'rinishida kiriting") : "";
  const dirty = sana !== initial.sana || vaqt !== initial.vaqt || (oqituvchiRaw ?? "") !== initial.oqituvchi || pickedRaw !== undefined;

  function chooseGroup(id: number | null) {
    setPicked(id);
    const g = live.find((x) => x.id === id);
    if (!g) return;
    if (g.teacher) setOqituvchi(g.teacher);
    const start = startTimeOf(g.time);
    if (start) setVaqt(start);
    const next = nextLessonIso(g, nowMs);
    if (next) setSana(next);
  }

  async function submit() {
    if (busy) return;
    setSubmitted(true);
    if (errSana || errVaqt) return;
    setBusy(true);
    const r = await postHolat(order.id, { to: "sinov", sinov: { sana, vaqt, oqituvchi } });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, current ? t("Birinchi dars ko'chirildi") : t("Birinchi darsga yozildi"));
    modal.close();
  }

  const phone = phoneParts(order.phone)?.show ?? order.phone;
  return (
    <V2Dialog
      title={current ? t("Birinchi darsni ko'chirish") : t("Birinchi darsga yozish")}
      subtitle={[order.name, phone].filter(Boolean).join(" · ")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={busy}
      width={540}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : current ? t("Saqlash") : t("Birinchi darsga yozish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <LeadFromBox course={order.course || ""} branch={branchName} />

        {list.length > 0 && (
          <div>
            <div className="mb-2 text-v2-small font-medium text-v2-text">
              {t("Guruh darsiga")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
            </div>
            <GroupRadioList groups={list} value={pick} onChange={chooseGroup} trialId={trial?.id ?? null} allowNone label={t("Guruh darsiga")} autoFocus />
            {match.length > 0 && other.length > 0 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
                {showAll ? t("Faqat shu kurs guruhlari") : t("Boshqa kurslar guruhlari ({n})", { n: other.length })}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Sana")} error={submitted ? errSana : ""}>
            <V2DateField value={sana ? dateOfIso(sana) : null} onChange={(d) => setSana(isoOfDate(d))} state={submitted && errSana ? "error" : "default"} />
          </Field>
          <Field label={t("Vaqt")} error={(submitted || timeTouched) && errVaqt ? errVaqt : ""}>
            <V2TimeField value={vaqt} onChange={setVaqt} onBlur={() => setTimeTouched(true)} state={(submitted || timeTouched) && errVaqt ? "error" : "default"} />
          </Field>
        </div>

        <Field label={t("O'qituvchi")} optional>
          <V2Picker
            value={oqituvchi}
            onChange={(v) => setOqituvchi(v)}
            options={teacherOptions}
            label={t("O'qituvchi")}
            placeholder={t("O'qituvchini tanlang")}
            searchPlaceholder={t("O'qituvchini qidirish")}
            clearable
          />
        </Field>

        <div className="flex items-start gap-2.5 rounded-v2-lg bg-v2-info-bg px-3.5 py-3 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <p>{t("Dars kuni ro'yxatda «Bugun birinchi dars» belgisi chiqadi. Natijasi «Birinchi darsga yozilganlar» sahifasida belgilanadi.")}</p>
        </div>
      </div>
    </V2Dialog>
  );
}
