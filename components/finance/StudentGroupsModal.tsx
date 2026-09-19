"use client";

import { X } from "lucide-react";
import { useGroups } from "@/hooks/useGroups";
import PersonLink from "@/components/shared/PersonDirectory";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function fmtSom(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " so'm";
}

// Kassa → Chiqim oynasidagi "O'quvchi guruhlarini ko'rish" tugmasi ochadigan
// modal — tanlangan o'quvchi HAQIQATDA a'zo bo'lgan guruhlar (/api/groups,
// studentIds orqali — useGroups() boshqa joylarda ham shu manbadan o'qiydi).
//
// Guruh narxi va "qolgan darslar soni" tizimda yuritilmaydi (dars narxi ×
// dars soni hisobi yo'q — app/api/students/balances/route.ts dagi izohga
// qarang), shuning uchun bu yerda ham o'ylab topilmaydi: faqat haqiqiy
// balans va o'quvchi a'zo bo'lgan guruhlar ro'yxati ko'rsatiladi.
export default function StudentGroupsModal({
  pupilId,
  studentName,
  balance,
  onClose,
}: {
  pupilId: number;
  studentName: string;
  balance: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { groups, loading } = useGroups();
  const myGroups = groups.filter((g) => g.studentIds?.includes(pupilId));

  return (
    <Modal onClose={onClose} controller={modal} bare size="lg" zIndex={300}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-semibold">{t("Guruhlar")}</h3>
            <p className="text-[12px] text-muted-foreground truncate">{studentName}</p>
          </div>
          <button onClick={modal.close} className="h-8 w-8 shrink-0 rounded-md hover:bg-secondary inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="text-[13px]">
            {t("Balans:")}{" "}<strong className={balance < 0 ? "text-rose-600" : "text-emerald-600"}>{t(fmtSom(balance))}</strong>
          </div>

          {loading ? (
            <div className="text-center text-[13px] text-muted-foreground py-6">{t("Yuklanmoqda…")}</div>
          ) : myGroups.length === 0 ? (
            <div className="text-center text-[13px] text-muted-foreground py-6">
              {t("Bu o'quvchi hech qanday guruhga qo'shilmagan")}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">{t("Guruh nomi")}</th>
                    <th className="py-2 pr-3 font-medium">{t("O'qituvchi")}</th>
                    <th className="py-2 font-medium">{t("Sana")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myGroups.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{g.name || g.id}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap"><PersonLink name={g.teacher} kind="staff" /></td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                        {[g.day, g.time].filter(Boolean).join(" ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
  );
}
