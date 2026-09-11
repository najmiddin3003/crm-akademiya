"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { PUPIL_STATUSES, isPupilStatus, type Pupil, type PupilStatus } from "@/lib/pupilsData";
import { invalidateStudents } from "@/hooks/useStudents";
import Select from "@/components/ui/Select";

// O'quvchining holatini o'zgartirish oynasi.
//
// PATCH /api/pupils/:id/status allaqachon bor edi, lekin uni CHAQIRADIGAN
// hech nima yo'q edi: shu sababli bazadagi har bir o'quvchi abadiy "Aktiv"
// bo'lib qolar, "Muzlatilgan"/"Arxiv" sahifalari esa hech qachon qator
// ko'rsatmasdi. Shu oyna o'sha uzilgan zanjirning yetishmayotgan bo'g'ini.
//
// Nega alohida oyna (oddiy profil formasi emas)? Holat maydoni
// PATCH /api/pupils/:id dagi EDITABLE ro'yxatida ataylab yo'q — holat
// o'zgarishi sabab va sana bilan qayd etiladigan alohida amal.

interface Props {
  /**
   * Jadval qatoridan keladi; `status` — qatordagi HAQIQIY holat,
   * `statusReason` — allaqachon yozilgan sabab (bo'lsa).
   */
  student: { id: number; name: string; status: string; statusReason?: string };
  onClose: () => void;
  /** Serverdan qaytgan yangilangan o'quvchi hujjati. */
  onSaved: (pupil: Pupil) => void;
}

/** Har bir holat nima qilishini bir qatorda tushuntirish. */
const STATUS_HINTS: Record<PupilStatus, string> = {
  Aktiv: "O'quvchi odatdagidek o'qiydi. Muzlatish/arxivlash sababi tozalanadi.",
  Muzlatilgan: "O'quvchi vaqtincha dars olmaydi, lekin guruhlarida qoladi.",
  Arxiv: "O'quvchi o'qishni tugatdi yoki ketdi.",
};

const fieldCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function StudentStatusModal({ student, onClose, onSaved }: Props) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();

  // Boshlang'ich qiymat — qatordagi holat. Eski yozuvlarda holat umuman
  // bo'lmasligi mumkin, shuning uchun isPupilStatus bilan tekshiriladi.
  const [status, setStatus] = useState<PupilStatus>(
    isPupilStatus(student.status) ? student.status : "Aktiv",
  );
  // Mavjud sabab oldindan to'ldiriladi. Aks holda allaqachon
  // "Muzlatilgan"/"Arxiv" bo'lgan o'quvchida oyna ochilishi bilan "Saqlash"
  // o'chiq turardi (sabab majburiy, lekin maydon bo'sh) — go'yo oyna
  // buzilgandek ko'rinardi.
  const [reason, setReason] = useState(student.statusReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // API "Aktiv" dan boshqa holat uchun bo'sh sababni rad etadi
  // (route.ts: `if (status !== "Aktiv" && !reason)` → 400). Tugmani shu
  // yerdayoq o'chirib qo'yamiz — foydalanuvchi 400 xatoni ko'rmasin.
  const reasonRequired = status !== "Aktiv";
  const canSave = !saving && (!reasonRequired || reason.trim().length > 0);

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/pupils/${student.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() }),
      });
      const data = await res.json();
      invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
      if (!res.ok || !data.ok) {
        // Xato ikki joyda ko'rsatiladi: oynada (kontekst bilan) va toastda.
        setError(data.error || "Saqlanmadi");
        showError(data.error || "Holat o'zgartirilmadi");
        return;
      }
      onSaved(data.pupil as Pupil);
      showSuccess(`${student.name} — holati "${status}" ga o'zgartirildi`);
      onClose();
    } catch {
      setError("Serverga ulanib bo'lmadi");
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Saqlash ketayotganda fonni bosish oynani yopmasin — so'rov yarim
    // yo'lda qolib, natijasi ko'rinmay ketardi (loyihadagi tasdiq
    // oynalarining umumiy naqshi, qarang EmployeeArchiveModal).
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Holatni o&apos;zgartirish</h3>

        {/* Matn satr IFODASI sifatida yozilgan: ko'p qatorli JSX matnining
            bosh/oxirgi probeli qirqilib, "Ismning" bo'lib qolardi. */}
        <p className="text-[13px] text-muted-foreground">
          <span className="text-foreground font-medium">{student.name}</span>
          {` — hozirgi holati: ${isPupilStatus(student.status) ? student.status : "Aktiv"}.`}
        </p>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Yangi holat</label>
          <Select value={status} onChange={(v) => {
                const next = v;
                if (isPupilStatus(next)) setStatus(next);
              }} options={PUPIL_STATUSES.map((s) => ({ value: s, label: s }))} size="sm" disabled={saving} />
          <p className="mt-1.5 text-[12px] text-muted-foreground">{STATUS_HINTS[status]}</p>
        </div>

        {/* "Arxiv" ni alohida ogohlantiramiz, chunki u qaytarib bo'lmaydigan
            yon ta'sirga ega: route.ts arxivlashda `groups` dagi barcha
            studentIds'dan o'quvchini $pull qiladi. Holatni keyin "Aktiv" ga
            qaytarsa ham guruh a'zoligi O'ZI tiklanmaydi. */}
        {status === "Arxiv" && (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-700">
            <AlertTriangle className="icon icon-sm flex-shrink-0 mt-0.5" />
            <span>
              Diqqat: arxivga o&apos;tkazilgan o&apos;quvchi barcha guruhlaridan ham chiqariladi.
              Holatni keyinroq &laquo;Aktiv&raquo; ga qaytarsangiz, guruhlarga uni qo&apos;lda qayta
              qo&apos;shishingiz kerak bo&apos;ladi.
            </span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">
            Sabab{reasonRequired && <span className="text-rose-600"> *</span>}
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={saving}
            placeholder={reasonRequired ? "Masalan: oilaviy sabablarga ko'ra" : "Ixtiyoriy"}
            className={`${fieldCls} disabled:opacity-60`}
          />
          {reasonRequired && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              &laquo;Muzlatilgan&raquo; va &laquo;Arxiv&raquo; uchun sabab majburiy — u o&apos;quvchi
              kartasida saqlanadi.
            </p>
          )}
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          {/* components/ui/Button.tsx da disabled uslubi bor, lekin loyihadagi
              boshqa modallar kabi ochiqroq bo'lishi uchun opacity qo'shilgan. */}
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="disabled:opacity-40">
            Bekor qilish
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={!canSave} className="disabled:opacity-40">
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </div>
  );
}
