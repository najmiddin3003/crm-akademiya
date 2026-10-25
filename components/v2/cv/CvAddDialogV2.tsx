"use client";

import { useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { EMPTY_VALUES, useCvApplyForm, type ApplyBranch, type TextKey } from "@/components/management/cvApplyForm";
import { branchPool, collapseBranchPools } from "@/lib/branchPools";
import type { CvApplication } from "@/lib/managementCv";
import CvApplySection, { APPLY_STEPS, showProblems, stepProblems, useBirthInput } from "./CvApplyFields";
import type { CvPlace } from "./cvBits";

// YANGI VERSIYA — «NOMZOD QO'SHISH» (Ishga qabul (CV) sahifasi, 13-qism, 25.10.2026). Rasmda alohida
// berilmagan: ommaviy anketaning (rasm «Ochiq anketa (#ariza)») o'sha 4 bo'limi o'ngdan chiqadigan
// uzun oynada, bitta varaqda — xodim qog'oz CV yoki telefon suhbatidan to'ldiradi. Rasm, rozilik,
// mutaxassislik, bitirgan yil va sertifikat bu yerda ixtiyoriy; kim kiritgani serverda `enteredBy`.
// Yuborish — eski «Ishga qabul anketasi» modali bilan bitta hook (POST /api/management-cv).

const ID = "cva-";

export default function CvAddDialogV2({
  places,
  sheetsUrl,
  onClose,
  onSaved,
}: {
  places: CvPlace[];
  sheetsUrl: string;
  onClose: () => void;
  onSaved: (app: CvApplication | null) => void;
}) {
  const { t } = useT();
  const branch = useBranch();
  const modal = useModalClose(onClose, "drawer");

  // Filiallar — xodimga ochiq ro'yxat (navbar), manzili CV javobidagi `places` dan.
  const branches: ApplyBranch[] = useMemo(
    () =>
      branch.branches.map((b) => ({
        id: b.id,
        name: b.name,
        location: "",
        address: places.find((p) => p.id === b.id)?.address ?? "",
        phone: "",
      })),
    [branch.branches, places],
  );
  // Sukut — navbar filiali (1+2 hovuzida ro'yxatdagi birlashgan qator).
  const initialBranch = useMemo(() => {
    const cur = branch.branchId;
    if (cur === null) return "";
    const hit = collapseBranchPools(branches).find((b) => branchPool(b.id).includes(cur));
    return hit ? String(hit.id) : "";
  }, [branch.branchId, branches]);

  const form = useCvApplyForm({
    branches,
    photoRequired: false,
    consentRequired: false,
    sheetsUrl,
    initial: { branch: initialBranch },
    idPrefix: ID,
    multiSubject: true,
  });
  const birth = useBirthInput(form);

  const dirty =
    (Object.keys(EMPTY_VALUES) as TextKey[]).some((k) => k !== "branch" && form.v[k].trim() !== "") ||
    Boolean(form.photo || form.cvFile || form.docs.length || form.subjects.length || form.ageGroups.length);

  async function save() {
    if (form.sending) return;
    const problems = [1, 2, 3, 4].flatMap((s) => stepProblems(form, s, "staff"));
    if (!showProblems(form, problems, ID)) return;
    const r = await form.submit();
    if (!r) return; // xato matni — `form.sendErr` (pastda)
    onSaved(r.app);
    modal.close();
  }

  return (
    <V2Dialog
      variant="right"
      title={t("Nomzod qo'shish")}
      subtitle={t("Anketa nomzod nomidan to'ldiriladi — kim kiritgani saqlanadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={form.sending}
      width={600}
      onSubmit={() => void save()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={form.sending} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={form.sending} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {form.sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {form.sending ? t("Saqlanmoqda...") : t("Nomzodni qo'shish")}
          </button>
        </>
      )}
    >
      <div className="divide-y divide-v2-border">
        {APPLY_STEPS.map((label, i) => (
          <section key={label} className="py-5 first:pt-0 last:pb-0" aria-label={t(label)}>
            <h3 className="mb-3.5 text-v2-body font-semibold text-v2-text">
              {i + 1}. {t(label)}
            </h3>
            <CvApplySection form={form} step={i + 1} mode="staff" birth={birth} idPrefix={ID} />
          </section>
        ))}
      </div>
      {form.sendErr && (
        <p role="alert" className="mt-4 rounded-v2-md bg-v2-danger-bg px-3.5 py-3 text-v2-small text-v2-danger">
          {form.sendErr}
        </p>
      )}
    </V2Dialog>
  );
}
