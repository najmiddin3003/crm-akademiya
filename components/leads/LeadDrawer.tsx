"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight, Loader2, MessageSquare, Pencil, Printer, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { HOLAT_STEPS, UNDO_MINUTES, guruhOf, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { SURVEY_SOURCE, hasDaraja, type LeadSettings } from "@/lib/leadSettings";
import type { ManagementBranch } from "@/lib/managementBranches";
import { orderNo } from "@/lib/ordersData";
import { LeadBranchTag } from "@/components/leads/LeadNo";
import { timelineOf, type LeadFmt, type LeadRow } from "./leadsCommon";

// LID KARTASI — o'ngdan chiqadigan panel (prototipdagi drawer): holat
// tugmalari, so'rovnoma javoblari, daraja, tarix va izoh. ui/Modal `drawer`
// varianti — ochilish/yopilish animatsiyasi bilan.
//
// Chek, SMS va boshqa filialga o'tkazish — eski to'liq kartada
// (/orders-list/[id]): foydalanuvchi qarori, pastdagi «To'liq karta».

interface Props {
  row: LeadRow;
  settings: LeadSettings | null;
  branch: ManagementBranch | null;
  isAdmin: boolean;
  nowMs: number;
  fmt: LeadFmt;
  /** Holat tugmasi yoki bekor qilish ketyapti. */
  busy: boolean;
  commentsCount: number;
  /** Ustida ui/Modal bo'lmagan oyna ochiq (tahrirlash paneli, izohlar) —
   * Esc o'shani yopsin, kartani emas. */
  locked?: boolean;
  onClose: () => void;
  /** Holat tugmasi: bog — darhol, sinov/guruh/rad — oyna ochiladi. */
  onGo: (to: LeadHolat) => void;
  /** Sinov darsini belgilash yoki ko'chirish. */
  onReschedule: () => void;
  onUndo: () => void;
  onSaveNote: (note: string) => Promise<boolean>;
  onEdit: () => void;
  onReceipt: () => void;
  onComments: () => void;
}

export default function LeadDrawer(props: Props) {
  const { row, onClose, locked = false } = props;
  const modal = useModalClose(onClose, "drawer");
  return (
    <Modal controller={modal} onClose={onClose} variant="drawer" bare size="lg" panelStyle={{ maxWidth: 480 }} locked={locked}>
      <DrawerBody key={row.o.id} {...props} closeDrawer={modal.close} />
    </Modal>
  );
}

function DrawerBody({ row, settings, branch, isAdmin, nowMs, fmt, busy, commentsCount, onGo, onReschedule, onUndo, onSaveNote, onEdit, onReceipt, onComments, closeDrawer }: Props & { closeDrawer: () => void }) {
  const { t } = fmt;
  const o = row.o;
  const holat = row.holat;
  const cur = HOLAT_STEPS.indexOf(holat);
  const sinov = sinovOf(o);
  const guruh = guruhOf(o);
  const yon = settings?.yonalishlar.find((y) => y.id === row.yon) ?? null;
  const survey = o.source === SURVEY_SOURCE;
  const [note, setNote] = useState(o.note || "");
  const [savingNote, setSavingNote] = useState(false);

  // Bekor qilish — oxirgi o'zgarish; 10 daqiqadan keyin faqat direktor.
  const stack = Array.isArray(o.holatOldin) ? o.holatOldin : [];
  const last = stack[stack.length - 1];
  // Sahifa soati 30 soniyada bir yuradi — endigina qilingan o'zgarishda u
  // biroz orqada qoladi, shuning uchun o'tgan vaqt manfiy bo'lmasin.
  const left = last ? UNDO_MINUTES - Math.floor(Math.max(0, nowMs - Date.parse(last.at)) / 60_000) : 0;
  const canUndo = !!last && (left > 0 || isAdmin);

  const timeline = timelineOf(row, fmt);
  const lvl = o.daraja && hasDaraja(o.yonalish) && settings ? fmt.daraja(o.daraja, settings.bosqichlar) : null;
  const steps = settings?.bosqichlar ?? [];

  const saveNote = async () => {
    setSavingNote(true);
    await onSaveNote(note.trim());
    setSavingNote(false);
  };

  return (
    <>
      <div className="ld-dhead">
        <div className="ld-dhl">
          <h2>{o.name || "—"}</h2>
          <p>
            {t("ID {n}", { n: orderNo(o) })}
            <LeadBranchTag branchId={o.branchId} />
            {o.phone && (
              <>
                {" · "}
                <a href={`tel:${o.phone.replace(/[^\d+]/g, "").replace(/^(\d{9})$/, "+998$1")}`}>{o.phone}</a>
              </>
            )}
            {o.created ? ` · ${o.created}` : ""}
          </p>
        </div>
        <button type="button" className="ld-dx" onClick={closeDrawer} aria-label={t("Yopish")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="ld-dbody">
        <section className="ld-sect">
          <h4>{t("Holat")}</h4>
          <div className="ld-flow">
            {holat === "rad" ? (
              <button type="button" className="next" disabled={busy} onClick={() => onGo("bog")}>
                {t("Qayta bog'lanish")}
              </button>
            ) : (
              <>
                {HOLAT_STEPS.map((s, i) => {
                  if (i <= cur)
                    return (
                      <button key={s} type="button" className="done" disabled>
                        ✓ {fmt.holatNom(s)}
                      </button>
                    );
                  if (i === cur + 1)
                    return (
                      <button key={s} type="button" className="next" disabled={busy} onClick={() => onGo(s)}>
                        {fmt.holatNom(s)} →
                      </button>
                    );
                  return (
                    <button key={s} type="button" className="skip" disabled={busy} onClick={() => onGo(s)} title={t("Oraliq bosqichlar o'tkazib yuboriladi")}>
                      {fmt.holatNom(s)}
                    </button>
                  );
                })}
                {holat !== "guruh" && (
                  <button type="button" className="danger" disabled={busy} onClick={() => onGo("rad")}>
                    {fmt.holatNom("rad")}
                  </button>
                )}
              </>
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
          </div>
          {holat !== "rad" && holat !== "guruh" && cur < 2 && <p className="ld-hint">{t("Punktir tugmalar bilan oraliq bosqichni tashlab o'tish mumkin")}</p>}

          {holat === "rad" && (
            <p className="ld-note-s">
              {t("Sabab:")} <b>{o.radSabab ? t(o.radSabab) : "—"}</b>
            </p>
          )}
          {sinov ? (
            <div className="ld-info">
              <span>{t("Sinov darsi")}</span>
              <b>{[fmt.day(sinov.sana), sinov.vaqt].filter(Boolean).join(", ")}</b>
              <em>{sinov.oqituvchi || t("O'qituvchi belgilanmagan")}</em>
              {holat === "sinov" && (
                <div className="ld-info-act">
                  <button type="button" onClick={onReschedule} disabled={busy}>
                    {t("Ko'chirish")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            holat === "sinov" && (
              <div className="ld-info">
                <span>{t("Sinov darsi")}</span>
                <b>{t("Sana belgilanmagan")}</b>
                <em>{t("Telegram'da belgilangan — sana va o'qituvchini kiriting")}</em>
                <div className="ld-info-act">
                  <button type="button" onClick={onReschedule} disabled={busy}>
                    {t("Belgilash")}
                  </button>
                </div>
              </div>
            )
          )}
          {guruh && (
            <div className="ld-info g">
              <span>{t("Guruh")}</span>
              <b>{guruh.id > 0 ? <Link href={`/groups/${guruh.id}`}>{guruh.nom}</Link> : guruh.nom}</b>
              <em>
                {[guruh.kun, guruh.vaqt, guruh.boshlash ? t("1-dars {day}", { day: fmt.day(guruh.boshlash) }) : ""].filter(Boolean).join(" · ") || "—"}
              </em>
            </div>
          )}

          {last &&
            (canUndo ? (
              <>
                <button type="button" className="ld-undo" disabled={busy} onClick={onUndo}>
                  ↶ {left > 0 ? t("Bekor qilish") : t("Oldingi holatga qaytarish")}
                  <span>{left > 0 ? t("{n} daq qoldi", { n: left }) : t("direktor")}</span>
                </button>
                {holat === "guruh" && <p className="ld-warn">{t("Bekor qilinsa ham o'quvchi guruhda qoladi — kerak bo'lsa guruh sahifasidan chiqaring.")}</p>}
              </>
            ) : (
              <p className="ld-lock">{t("{n} daqiqa o'tdi — orqaga qaytarishni faqat direktor qila oladi", { n: UNDO_MINUTES })}</p>
            ))}
        </section>

        <section className="ld-sect">
          <h4>{survey ? t("So'rovnoma javoblari") : t("Ma'lumotlar")}</h4>
          <dl className="ld-kv">
            {yon && (
              <>
                <dt>{t("Yo'nalish")}</dt>
                <dd>{t(yon.nom)}</dd>
              </>
            )}
            <dt>{t("Kurs / fan")}</dt>
            <dd>{o.course ? t(o.course) : "—"}</dd>
            {o.sinf && (
              <>
                <dt>{t("Sinf")}</dt>
                <dd>{t(o.sinf)}</dd>
              </>
            )}
            {(o.lessonDay || o.lessonStartTime) && (
              <>
                <dt>{t("Dars kuni")}</dt>
                <dd>{[o.lessonDay, o.lessonStartTime].filter(Boolean).join(" · ")}</dd>
              </>
            )}
            <dt>{t("Filial")}</dt>
            <dd>
              {branch?.name || "—"}
              {(branch?.address || branch?.phone) && <small>{[branch.address, branch.phone].filter(Boolean).join(" · ")}</small>}
            </dd>
            {o.qulayVaqt && (
              <>
                <dt>{t("Qulay vaqt")}</dt>
                <dd>{t(o.qulayVaqt)}</dd>
              </>
            )}
            <dt>{t("Manba")}</dt>
            <dd>{o.source ? t(o.source) : "—"}</dd>
            {o.heardFrom && (
              <>
                <dt>{t("Qayerdan bildi")}</dt>
                <dd>{t(o.heardFrom)}</dd>
              </>
            )}
            <dt>{t("Moderator")}</dt>
            <dd>{o.moderator || "—"}</dd>
          </dl>
        </section>

        {lvl && (
          <section className="ld-sect">
            <h4>{t("Daraja (so'rovnomadagi javob)")}</h4>
            {lvl.test ? (
              <p className="ld-lvl-t">{t("Bilmaydi — bepul daraja testiga yozish kerak")}</p>
            ) : (
              <>
                <p className="ld-lvl-t">{lvl.text}</p>
                <div className="ld-msbar" aria-hidden="true">
                  {steps.map((s, i) => (
                    <u key={s} style={{ left: `${(i * 100) / Math.max(1, steps.length - 1)}%` }} />
                  ))}
                  <i style={{ left: `${Math.max(0, Math.min(100, o.daraja?.lvl ?? 0))}%` }} />
                </div>
                <div className="ld-mslab">
                  <span>{t(steps[0] ?? "")}</span>
                  <span>{t(steps[steps.length - 1] ?? "")}</span>
                </div>
              </>
            )}
          </section>
        )}

        <section className="ld-sect" style={{ marginBottom: 0 }}>
          <h4>{t("Tarix")}</h4>
          <div className="ld-tl">
            {timeline.map((x, i) => (
              <div key={`${x.at}-${i}`} style={x.tone === "info" ? undefined : ({ "--tl": `var(--ld-${x.tone})` } as CSSProperties)}>
                <b>{x.title}</b>
                <small>{[fmt.stamp(x.at, nowMs), x.sub].filter(Boolean).join(" · ")}</small>
              </div>
            ))}
          </div>
          <div className="ld-izoh">
            <input
              className="ld-input"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim() !== (o.note || "").trim()) void saveNote();
              }}
              placeholder={t("Izoh qo'shish...")}
            />
            <Button variant="outline" onClick={() => void saveNote()} disabled={savingNote || note.trim() === (o.note || "").trim()}>
              {savingNote && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Saqlash")}
            </Button>
          </div>
        </section>
      </div>

      <div className="ld-dfoot">
        <Link href={`/orders-list/${o.id}`} className="ld-dfoot-pri" title={t("Chek, SMS va boshqa filialga o'tkazish")}>
          <ArrowUpRight className="h-4 w-4" />
          {t("To'liq karta")}
        </Link>
        <button type="button" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {t("Tahrirlash")}
        </button>
        <button type="button" onClick={onReceipt}>
          <Printer className="h-4 w-4" />
          {t("Chek")}
        </button>
        <button type="button" onClick={onComments}>
          <MessageSquare className="h-4 w-4" />
          {commentsCount > 0 ? t("Izohlar ({n})", { n: commentsCount }) : t("Izohlar")}
        </button>
      </div>
    </>
  );
}
