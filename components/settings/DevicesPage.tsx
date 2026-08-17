"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Monitor, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";

// Profil menyusi → "Aktiv qurilmalar".
// Foydalanuvchining ochiq sessiyalari: qaysi qurilma/brauzer, qachon kirgan,
// oxirgi faollik. Sessiyani uzish — o'sha qurilma keyingi sahifa ochilishida
// tizimdan chiqarib yuboriladi (lib/auth.ts dagi tekshiruv).

interface SessionRow {
  sid: string;
  label: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export default function DevicesPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi");
        setRows(data.sessions as SessionRow[]);
      })
      .catch((e: unknown) => {
        if (!cancelled) showError(e instanceof Error ? e.message : "Qurilmalarni yuklab bo'lmadi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showError]);

  const terminate = async (sid: string, current: boolean) => {
    if (current) {
      if (!confirm("Bu joriy qurilma. Chiqarilsa tizimdan chiqib ketasiz. Davom etamizmi?")) return;
    } else if (!confirm("Shu qurilma tizimdan chiqarilsinmi?")) {
      return;
    }
    setBusy(sid);
    try {
      const res = await fetch(`/api/sessions?sid=${encodeURIComponent(sid)}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Chiqarib bo'lmadi");
      if (current) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
        return;
      }
      setRows((r) => r.filter((x) => x.sid !== sid));
      showSuccess("Qurilma chiqarildi");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Chiqarib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const terminateOthers = async () => {
    const others = rows.filter((r) => !r.current).length;
    if (others === 0) return;
    if (!confirm(`Boshqa ${others} ta qurilma tizimdan chiqarilsinmi?`)) return;
    setBusy("all");
    try {
      const res = await fetch("/api/sessions?all=1", { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Chiqarib bo'lmadi");
      setRows((r) => r.filter((x) => x.current));
      showSuccess(`${data.deleted} ta qurilma chiqarildi`);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Chiqarib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const others = rows.filter((r) => !r.current).length;

  return (
    <div className="page-frame container mx-auto max-w-[900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-[18px] font-bold tracking-tight">Aktiv qurilmalar</h1>
        <div className="flex-1" />
        <button
          onClick={() => void terminateOthers()}
          disabled={others === 0 || busy === "all"}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-40"
        >
          <LogOut className="w-4 h-4" />
          Boshqa qurilmalarni chiqarish
        </button>
      </div>

      <p className="text-[13px] text-muted-foreground">
        Hisobingizga kirilgan qurilmalar. Notanish qurilmani ko&apos;rsangiz — uni chiqaring va parolingizni almashtiring.
      </p>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qurilma</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">IP</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kirgan vaqti</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Oxirgi faollik</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.sid} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Monitor className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-[13px] font-medium">{r.label}</div>
                        {r.current && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <ShieldCheck className="w-3 h-3" />
                            Joriy qurilma
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground">{r.ip || "—"}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.createdAt}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.lastSeenAt}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => void terminate(r.sid, r.current)}
                      disabled={busy === r.sid}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[13px] font-medium hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Chiqarish
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Aktiv qurilma topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
