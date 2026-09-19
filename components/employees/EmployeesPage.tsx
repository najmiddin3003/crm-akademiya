"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import PhoneField, { formatPhoneDigits } from "@/components/auth/PhoneField";
import { SpinnerBlock } from "@/components/ui/Spinner";
import EmployeeEditModal from "@/components/employees/EmployeeEditModal";
import { useT } from "@/components/shared/Language";

interface EmployeeRow {
  id: string;
  fullName: string;
  phone: string;
  position: string | null;
  status: "invited" | "active" | "frozen" | "blocked";
  createdAt: string;
}

const STATUS_META: Record<EmployeeRow["status"], { label: string; cls: string }> = {
  invited: { label: "Taklif yuborildi", cls: "bg-amber-50 text-amber-700" },
  active: { label: "Faol", cls: "bg-emerald-50 text-emerald-700" },
  frozen: { label: "Muzlatilgan", cls: "emp-badge-frozen" },
  blocked: { label: "Bloklangan", cls: "emp-badge-blocked" },
};

// Holatga mos qator foni — muzlatilgan/bloklangan xodimlar ro'yxatda darrov
// ko'zga tashlanadi. (globals.css statik bo'lgani uchun qo'lda yozilgan
// .emp-row-* klasslar ishlatiladi, Tailwind arbitrary opacity emas.)
const ROW_TINT: Record<EmployeeRow["status"], string> = {
  invited: "",
  active: "",
  frozen: "emp-row-frozen",
  blocked: "emp-row-blocked",
};

// 998901234567 -> +998 (90) 123-45-67
function displayPhone(stored: string) {
  const local = stored.startsWith("998") ? stored.slice(3) : stored;
  return `+998 ${formatPhoneDigits(local)}`;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// Boshqaruv > Xodimlar: admin yangi xodim qo'shadi -> POST /api/employees
// (users status='invited' + SMS taklif). Ro'yxatda holat ko'rinadi, taklif
// yetib bormasa qayta jo'natish, tahrirlash va o'chirish ikonkalar orqali.
export default function EmployeesPage() {
  const { t } = useT();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<EmployeeRow | null>(null);

  // Ro'yxatni yuklaydi. setState har doim await'dan keyin ishlaydi.
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.ok) {
        setRows(data.employees);
        setLoadError("");
      } else {
        setLoadError(data.error || "Ro'yxatni yuklab bo'lmadi");
      }
    } catch {
      setLoadError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  // Ilk yuklash — inline async IIFE (effekt tanasida sinxron setState bo'lmasligi
  // uchun; refetch esa hodisa ishlovchilaridan load() bilan chaqiriladi).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/employees");
        const data = await res.json();
        if (!active) return;
        if (data.ok) setRows(data.employees);
        else setLoadError(data.error || "Ro'yxatni yuklab bo'lmadi");
      } catch {
        if (active) setLoadError("Serverga ulanib bo'lmadi");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setNotice("");
    if (!fullName.trim()) {
      setFormError("F.I.Sh. kiriting");
      return;
    }
    if (phone.length < 9) {
      setFormError("To'liq telefon raqamni kiriting");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, position }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Xodim qo'shilmadi");
        return;
      }
      setNotice(
        data.smsSimulated
          ? "Xodim qo'shildi. SMS simulyatsiya qilindi (Eskiz credential yo'q — server logiga qarang)."
          : data.smsSent
            ? t("Xodim qo'shildi va SMS taklif yuborildi ✅")
            : t("Xodim qo'shildi, lekin SMS yuborilmadi (server logini tekshiring).")
      );
      setFullName("");
      setPhone("");
      setPosition("");
      load();
    } catch {
      setFormError("Serverga ulanib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async (id: string) => {
    setResendingId(id);
    setNotice("");
    try {
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: id }),
      });
      const data = await res.json();
      setNotice(
        res.ok
          ? data.smsSimulated
            ? t("Taklif qayta yuborildi (SMS simulyatsiya — server logi).")
            : t("Taklif qayta yuborildi ✅")
          : data.error || "Qayta yuborilmadi"
      );
    } catch {
      setNotice("Serverga ulanib bo'lmadi");
    } finally {
      setResendingId(null);
    }
  };

  const remove = async (row: EmployeeRow) => {
    if (!confirm(t("{fullName} butunlay o'chirilsinmi? Bu amalni orqaga qaytarib bo'lmaydi.", { fullName: row.fullName }))) return;
    setDeletingId(row.id);
    setNotice("");
    try {
      const res = await fetch(`/api/employees/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      setNotice(res.ok && data.ok ? "Xodim o'chirildi" : data.error || "O'chirilmadi");
      if (res.ok && data.ok) load();
    } catch {
      setNotice("Serverga ulanib bo'lmadi");
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls =
    "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";
  const iconBtnCls = "!h-10 !w-10 border-border text-muted-foreground emp-icon-btn";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight">{t("Xodimlar")}</h1>
        <p className="text-sm text-muted-foreground">{t("Yangi xodim qo'shing — telefoniga SMS taklif yuboriladi")}</p>
      </div>

      {/* Ishga qabul formasi */}
      <form onSubmit={submit} className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("Ishga qabul — yangi xodim")}</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{t("F.I.Sh.")}</label>
            <input
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("Ism Familiya")}
            />
          </div>
          <PhoneField value={phone} onChange={setPhone} />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{t("Lavozim")}</label>
            <input
              className={inputCls}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder={t("O'qituvchi, admin...")}
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-[13px] text-red-500">{formError}</p>}
        {notice && <p className="mt-3 text-[13px] text-emerald-600">{notice}</p>}
        <div className="mt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("Yuborilmoqda...") : t("Taklif yuborish")}
          </Button>
        </div>
      </form>

      {/* Ro'yxat */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Xodimlar ro&apos;yxati {rows.length > 0 && <span className="text-muted-foreground">({rows.length})</span>}
        </div>
        {loading ? (
          <div className="px-4 py-8"><SpinnerBlock /></div>
        ) : loadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-500">{loadError}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("Hozircha xodim yo'q")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("F.I.Sh.")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("Telefon")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("Lavozim")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("Holat")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("Amal")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.invited;
                  return (
                    <tr key={r.id} className={`border-b border-border last:border-0 ${ROW_TINT[r.status]}`}>
                      <td className="px-4 py-2.5 font-medium">{r.fullName}</td>
                      <td className="px-4 py-2.5 tabular-nums">{displayPhone(r.phone)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.position || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.cls}`}>
                          {t(meta.label)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="icon"
                            type="button"
                            className={`${iconBtnCls} emp-icon-btn-danger`}
                            title={t("Xodimni o'chirish")}
                            disabled={deletingId === r.id}
                            onClick={() => remove(r)}
                          >
                            <TrashIcon />
                          </Button>
                          <Button
                            variant="icon"
                            type="button"
                            className={iconBtnCls}
                            title={t("Tahrirlash")}
                            onClick={() => setEditingRow(r)}
                          >
                            <EditIcon />
                          </Button>
                          {r.status === "invited" && (
                            <Button
                              variant="icon"
                              type="button"
                              className={iconBtnCls}
                              title={t("Qayta yuborish")}
                              disabled={resendingId === r.id}
                              onClick={() => resend(r.id)}
                            >
                              <RetryIcon />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRow && (
        <EmployeeEditModal
          employee={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            setNotice("Xodim ma'lumotlari saqlandi ✅");
            load();
          }}
        />
      )}
    </div>
  );
}
