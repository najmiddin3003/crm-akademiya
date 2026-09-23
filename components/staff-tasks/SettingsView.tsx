"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import MoneyInput from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { PRIORITIES, type StaffTaskSettings } from "@/lib/staffTasks";
import { api } from "./api";
import type { StaffFmt } from "./format";

// «Sozlamalar» tabi (faqat direktor): muhimlik bo'yicha jarima, qayta
// muddat (soat) va oylik jarima limiti. «Oylik holati» QO'LDA
// belgilanmaydi — Moliya → Oylik chiqarishdan keladi.

interface MonthState {
  month: string;
  closed: boolean;
  runs: number;
}

interface Props {
  fmt: StaffFmt;
  onSaved: (s: StaffTaskSettings) => void;
}

export default function SettingsView({ fmt, onSaved }: Props) {
  const { t, money, monthLabel } = fmt;
  const { showSuccess, showError } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [fines, setFines] = useState<Record<string, string>>({});
  const [grace, setGrace] = useState("24");
  const [limit, setLimit] = useState("30");
  const [months, setMonths] = useState<MonthState[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    api<{ settings: StaffTaskSettings; months: MonthState[] }>("/api/staff-tasks/settings").then((r) => {
      if (off) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const f: Record<string, string> = {};
      for (const p of PRIORITIES) f[String(p)] = String(r.settings.fines[String(p)] ?? 0);
      setFines(f);
      setGrace(String(r.settings.graceHours));
      setLimit(String(r.settings.limitPercent));
      setMonths(r.months);
      setLoaded(true);
    });
    return () => {
      off = true;
    };
  }, []);

  const pct = Math.min(100, Math.max(0, Number(limit) || 0));

  const save = async () => {
    setSaving(true);
    const body = {
      fines: Object.fromEntries(PRIORITIES.map((p) => [String(p), Number(fines[String(p)] || 0)])),
      graceHours: Number(grace) || 24,
      limitPercent: pct,
    };
    const r = await api<{ settings: StaffTaskSettings }>("/api/staff-tasks/settings", { method: "PUT", body });
    setSaving(false);
    if (!r.ok) return showError(r.error);
    onSaved(r.settings);
    setGrace(String(r.settings.graceHours));
    setLimit(String(r.settings.limitPercent));
    showSuccess(t("Sozlamalar saqlandi"));
  };

  if (!loaded) {
    return <div className="stk-card stk-pad text-sm text-muted-foreground">{error ? t(error) : t("Yuklanmoqda…")}</div>;
  }

  return (
    <div>
      <div className="stk-card">
        <h3>{t("Sozlamalar → Topshiriqlar")}</h3>
        <div className="stk-pad">
          <div className="stk-field">
            <span className="stk-label">{t("Muhimlik darajasi bo'yicha jarima summasi")}</span>
            <div className="stk-ladder">
              {PRIORITIES.map((p) => (
                <div key={p}>
                  <label className="stk-label" htmlFor={`stk-fine-${p}`} style={{ fontWeight: 500 }}>
                    {t("Muhimlik {n}", { n: p })}
                  </label>
                  <div className="stk-suffix" data-suffix={t("so'm")}>
                    <MoneyInput
                      id={`stk-fine-${p}`}
                      className="stk-input"
                      value={fines[String(p)] ?? ""}
                      onChange={(v) => setFines((f) => ({ ...f, [String(p)]: v }))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="stk-note">
              {t("Summa topshiriq yaratilgan paytda unga yozib olinadi — keyin o'zgartirilsa mavjud topshiriqlarga ta'sir qilmaydi.")}
            </div>
          </div>
          <div className="stk-two">
            <div className="stk-field">
              <label className="stk-label" htmlFor="stk-grace">
                {t("Qayta muddat, soat")} <small>{t("(deadline o'tgach beriladigan bir martalik muddat)")}</small>
              </label>
              <input id="stk-grace" className="stk-input" type="number" min={1} max={336} value={grace} onChange={(e) => setGrace(e.target.value)} />
            </div>
            <div className="stk-field">
              <label className="stk-label" htmlFor="stk-limit">
                {t("Oylik jarima limiti, oklad foizi")} <small>{t("(MK 312-modda: 30%, ichki tartib bilan 50% gacha)")}</small>
              </label>
              <input id="stk-limit" className="stk-input" type="number" min={0} max={100} value={limit} onChange={(e) => setLimit(e.target.value)} />
              <div className="stk-note">
                {t("Masalan, oklad 3 000 000 so'm bo'lsa, bir oyda ko'pi bilan {sum} ushlanadi.", { sum: money((3_000_000 * pct) / 100) })}
              </div>
            </div>
          </div>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Sozlamalarni saqlash")}
          </Button>
        </div>
      </div>

      <div className="stk-card">
        <h3>{t("Oylik holati (Oylik moduli bilan bog'lanadi)")}</h3>
        <div className="stk-pad">
          <div className="stk-months">
            {months.map((m) => (
              <div key={m.month}>
                <span>{monthLabel(m.month)}</span>
                {m.closed ? (
                  <span className="stk-chip stk-tone-ok">{t("Oylik chiqarilgan")}</span>
                ) : (
                  <span className="stk-chip stk-tone-gray">{t("Ochiq")}</span>
                )}
              </div>
            ))}
          </div>
          <div className="stk-note">
            {t("Holat Moliya → Oylik chiqarishdan olinadi. Oylik chiqarilgan oydagi jarimani bekor qilib bo'lmaydi — tuzatish keyingi oyga alohida qator bilan yoziladi.")}
          </div>
        </div>
      </div>
    </div>
  );
}
