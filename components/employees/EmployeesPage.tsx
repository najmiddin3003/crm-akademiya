"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import PhoneField, { formatPhoneDigits } from "@/components/auth/PhoneField";

interface EmployeeRow {
  id: string;
  fullName: string;
  phone: string;
  position: string | null;
  status: "invited" | "active" | "blocked";
  createdAt: string;
}

const STATUS_META: Record<EmployeeRow["status"], { label: string; cls: string }> = {
  invited: { label: "Taklif yuborildi", cls: "bg-amber-50 text-amber-700" },
  active: { label: "Faol", cls: "bg-emerald-50 text-emerald-700" },
  blocked: { label: "Bloklangan", cls: "bg-secondary text-red-600" },
};

// 998901234567 -> +998 (90) 123-45-67
function displayPhone(stored: string) {
  const local = stored.startsWith("998") ? stored.slice(3) : stored;
  return `+998 ${formatPhoneDigits(local)}`;
}

// Boshqaruv > Xodimlar: admin yangi xodim qo'shadi -> POST /api/employees
// (users status='invited' + SMS taklif). Ro'yxatda holat ko'rinadi, taklif
// yetib bormasa "Qayta yuborish" bilan qayta SMS jo'natiladi.
export default function EmployeesPage() {
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
            ? "Xodim qo'shildi va SMS taklif yuborildi ✅"
            : "Xodim qo'shildi, lekin SMS yuborilmadi (server logini tekshiring)."
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
            ? "Taklif qayta yuborildi (SMS simulyatsiya — server logi)."
            : "Taklif qayta yuborildi ✅"
          : data.error || "Qayta yuborilmadi"
      );
    } catch {
      setNotice("Serverga ulanib bo'lmadi");
    } finally {
      setResendingId(null);
    }
  };

  const inputCls =
    "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight">Xodimlar</h1>
        <p className="text-sm text-muted-foreground">Yangi xodim qo&apos;shing — telefoniga SMS taklif yuboriladi</p>
      </div>

      {/* Ishga qabul formasi */}
      <form onSubmit={submit} className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Ishga qabul — yangi xodim</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">F.I.Sh.</label>
            <input
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ism Familiya"
            />
          </div>
          <PhoneField value={phone} onChange={setPhone} />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Lavozim</label>
            <input
              className={inputCls}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="O'qituvchi, admin..."
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-[13px] text-red-500">{formError}</p>}
        {notice && <p className="mt-3 text-[13px] text-emerald-600">{notice}</p>}
        <div className="mt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Yuborilmoqda..." : "Taklif yuborish"}
          </Button>
        </div>
      </form>

      {/* Ro'yxat */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Xodimlar ro&apos;yxati {rows.length > 0 && <span className="text-muted-foreground">({rows.length})</span>}
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>
        ) : loadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-500">{loadError}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Hozircha xodim yo&apos;q</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">F.I.Sh.</th>
                  <th className="px-4 py-2.5 font-medium">Telefon</th>
                  <th className="px-4 py-2.5 font-medium">Lavozim</th>
                  <th className="px-4 py-2.5 font-medium">Holat</th>
                  <th className="px-4 py-2.5 font-medium">Amal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.invited;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.fullName}</td>
                      <td className="px-4 py-2.5 tabular-nums">{displayPhone(r.phone)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.position || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.status === "invited" ? (
                          <Button
                            variant="outline"
                            type="button"
                            className="h-8 px-3 text-[13px]"
                            disabled={resendingId === r.id}
                            onClick={() => resend(r.id)}
                          >
                            {resendingId === r.id ? "..." : "Qayta yuborish"}
                          </Button>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
