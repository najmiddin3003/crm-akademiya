"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { gamApi } from "../api";
import { btnDanger, btnGhost, btnSm, fmtDate } from "../ui";

// Profil → «O'quvchi havolasi va Telegram» (TZ 5.4; prototipda yo'q).
// Admin va direktor: havolani nusxalash, qayta yaratish (eski havola va
// barcha Telegram bog'lanishlari darhol bekor — tasdiq so'raladi),
// bog'langan akkauntlar ro'yxati va har birida «Uzish».

type Toast = (text: string, opts?: { error?: boolean }) => void;

interface Access {
  token: string | null;
  path: string | null;
  telegramUrl: string | null;
  links: { id: number; name: string; username: string; linkedAt: string }[];
}

function RegenerateModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<boolean> }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={130}>
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">{t("Havolani qayta yaratish")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {t("Eski havola va shu o'quvchiga bog'langan barcha Telegram akkauntlar darhol ishlamay qoladi — ularni yangi havola bilan qayta bog'lash kerak. Davom etasizmi?")}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm();
              setBusy(false);
              if (ok) modal.close();
            }}
          >
            {busy ? t("Saqlanmoqda…") : t("Qayta yaratish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function AccessSection({ pupilId, toast }: { pupilId: number; toast: Toast }) {
  const { t } = useT();
  const [data, setData] = useState<Access | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const url = `/api/gamification/students/${pupilId}/access-token`;

  const load = useCallback(
    () =>
      gamApi<Access>(url).then((res) => {
        if (res.ok) setData(res);
        else setErr(res.error);
      }),
    [url],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const fullLink = (path: string) => `${typeof window === "undefined" ? "" : window.location.origin}${path}`;

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(fullLink(path));
      toast(t("Havola nusxalandi"));
    } catch {
      // Brauzer ruxsat bermadi — havola maydoni belgilanadi, qo'lda nusxalash oson bo'lsin.
      linkRef.current?.focus();
      linkRef.current?.select();
      toast(t("Nusxalab bo'lmadi — havolani qo'lda belgilab oling"), { error: true });
    }
  }

  async function create(): Promise<boolean> {
    setBusy(true);
    const res = await gamApi<Access & { created: boolean; revokedLinks: number }>(url, { method: "POST", body: {} });
    setBusy(false);
    if (!res.ok) {
      toast(t(res.error), { error: true });
      return false;
    }
    setData(res);
    if (res.created) {
      toast(t("Havola yaratildi"));
      if (res.path) void copy(res.path);
    } else {
      toast(t("Yangi havola yaratildi · eski havola va {n} ta Telegram bog'lanish bekor qilindi", { n: res.revokedLinks }));
    }
    return true;
  }

  async function unlink(id: number) {
    setBusy(true);
    const res = await gamApi<{ links: Access["links"] }>(`${url.replace("/access-token", "")}/telegram-links/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast(t(res.error), { error: true });
      return;
    }
    setData((d) => (d ? { ...d, links: res.links } : d));
    toast(t("Telegram akkaunt uzildi"));
  }

  return (
    <section>
      <h3 className="mb-2 text-[14px] font-semibold">🔗 {t("O'quvchi havolasi va Telegram")}</h3>
      <div className="rounded-2xl border border-border p-3.5">
        {err && !data ? (
          <p className="text-[13px] text-muted-foreground">{t(err)}</p>
        ) : !data ? (
          <p className="text-[13px] text-muted-foreground">{t("Yuklanmoqda…")}</p>
        ) : (
          <>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {t("O'quvchi (yoki ota-onasi) shu havola orqali o'z sahifasini ochadi — tangalar, daraja, istaklar. Havoladagi «Telegramda ochish» sahifani o'quvchilar botiga bog'laydi (ko'pi bilan 3 ta akkaunt).")}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {data.path ? (
                <>
                  <button type="button" className={btnSm} disabled={busy} onClick={() => void copy(data.path!)}>
                    📋 {t("Havolani nusxalash")}
                  </button>
                  <button type="button" className={btnSm} disabled={busy} onClick={() => setConfirm(true)}>
                    ♻️ {t("Qayta yaratish")}
                  </button>
                  <input
                    ref={linkRef}
                    readOnly
                    value={fullLink(data.path)}
                    aria-label={t("Havola")}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-8 min-w-0 flex-1 basis-56 rounded-lg border border-border bg-secondary/60 px-2 text-[12px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </>
              ) : (
                <button type="button" className={btnSm} disabled={busy} onClick={() => void create()}>
                  🔗 {t("Havola yaratish")}
                </button>
              )}
            </div>
            <div className="mt-3">
              <div className="mb-1 text-[12px] font-semibold text-muted-foreground">
                {t("Bog'langan Telegram akkauntlar")} ({data.links.length}/3)
              </div>
              {data.links.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">{t("Hali bog'lanmagan.")}</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {data.links.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">
                        <b>{l.name || t("Nomsiz")}</b>
                        {l.username && <span className="text-muted-foreground"> · @{l.username}</span>}
                        <span className="text-muted-foreground"> · {fmtDate(l.linkedAt)}</span>
                      </span>
                      <button type="button" className={btnSm} disabled={busy} onClick={() => void unlink(l.id)}>
                        {t("Uzish")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {confirm && <RegenerateModal onClose={() => setConfirm(false)} onConfirm={create} />}
    </section>
  );
}
