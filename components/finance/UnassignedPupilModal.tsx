"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { SpinnerBlock } from "@/components/ui/Spinner";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { useToast } from "@/components/ui/Toast";
import { useStudents } from "@/hooks/useStudents";
import { invalidateBalances, invalidateTransactions } from "@/lib/cacheKeys";
import { useT } from "@/components/shared/Language";
import type { UnassignedEntry } from "@/lib/pupilEntries";

// EGASI ANIQLANMAGAN TO'LOVLARNI QO'LDA BIRIKTIRISH.
//
// 23.09.2026 dan to'lov yozuvi o'quvchiga ID bo'yicha bog'lanadi
// (lib/pupilEntries.ts). Eski yozuvlarni migratsiya belgiladi, lekin ismi
// takrorlanganlarida mashina qaysi bola ekanini bila olmadi va ATAYLAB
// taxmin qilmadi — noto'g'ri ID yozuvga muhrlanib qolardi.
//
// Qolganini odam hal qiladi. Bu oyna o'sha qaror uchun hamma narsani
// bitta ekranga qo'yadi: to'lovning o'zi (sana, summa, ustoz, kassir,
// izoh) va nomzodlar — telefoni, holati, filiali, guruhlari va
// ALLAQACHON biriktirilgan to'lovlari bilan. Oxirgisi ko'pincha qarorni
// o'zi hal qiladi: "bu bolaga oldin ham shu ustozdan pul kelgan".
//
// BITTALAB KO'RSATILADI, ro'yxat emas: qaror har bir yozuvda alohida
// o'ylashni talab qiladi, 89 qatorlik jadval esa shoshilib bosishga
// undardi. Yuqorida "3 / 89" — ish qancha qolganini ko'rsatadi.
//
// BIR MARTALIK: yangi to'lovlar kassa oynasida o'quvchi ID'si bilan
// yoziladi, ya'ni bu ro'yxat o'smaydi. Shu bois alohida sahifa emas —
// Moliya → Tranzaksiyalar ichidagi oyna.

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU").replace(/,/g, " ");
}

function fmtDate(date: string, time: string): string {
  const [y, m, d] = (date || "").split("-");
  return y ? `${d}.${m}.${y}${time ? " | " + time : ""}` : date;
}

export default function UnassignedPupilModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  /** Biriktirish muvaffaqiyatli bo'lgach — qolgan qatorlar soni bilan. */
  onChanged?: (remaining: number) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [entries, setEntries] = useState<UnassignedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  // "Ro'yxatda yo'q" holati uchun — HAMMA o'quvchidan tanlash.
  const [otherKey, setOtherKey] = useState("");

  // Erkin tanlov ro'yxati. Yengil rejim: bu yerga faqat ism, telefon va
  // id kerak. Variantlar ID bo'yicha — ismdoshlar bitta qator bo'lib
  // ko'rinmasin (aynan shu muammoni hal qilyapmiz).
  const { students, loading: studentsLoading } = useStudents({ light: true });
  const studentById = useMemo(() => {
    const map = new Map<string, { id: number; name: string; phone: string }>();
    for (const s of students) map.set(String(s.id), s);
    return map;
  }, [students]);
  const studentOptions = useMemo(() => students.map((s) => String(s.id)), [students]);

  useEffect(() => {
    let alive = true;
    fetch("/api/transaction-entries/unassigned")
      .then((r) => r.json())
      .then((d) => { if (alive && d?.ok) setEntries(d.entries as UnassignedEntry[]); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const current = entries[index];

  async function assign(pupilId: number): Promise<void> {
    if (!current || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transaction-entries/${current.id}/pupil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId }),
      });
      const data = await res.json();
      if (!data?.ok) { showError(t(data?.error ?? "Biriktirib bo'lmadi")); return; }

      // Yozuvning egasi o'zgardi — balans va jurnal keshlari eskirdi.
      invalidateBalances();
      invalidateTransactions();

      const left = entries.filter((e) => e.id !== current.id);
      setEntries(left);
      // Indeks JOYIDA qoladi — o'chirilgan qatorning o'rniga keyingisi
      // suriladi, ya'ni moderator hech narsa bosmasdan davom etadi.
      // Oxirgisi biriktirilgan bo'lsa bir qadam orqaga.
      setIndex((i) => Math.min(i, Math.max(0, left.length - 1)));
      setOtherKey("");
      showSuccess(t("Biriktirildi: {name}", { name: data.pupilName }));
      onChanged?.(left.length);
    } catch {
      showError(t("Tarmoq xatosi — biriktirib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  const body = (() => {
    if (loading) return <SpinnerBlock size={26} />;
    if (entries.length === 0) {
      return (
        <div className="py-8 text-center space-y-2">
          <p className="text-sm font-medium text-emerald-600">{t("Hammasi biriktirilgan")}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {t("Egasi aniqlanmagan to'lov qolmadi.")}
          </p>
        </div>
      );
    }
    if (!current) return null;

    return (
      <div className="space-y-4">
        {/* TO'LOVNING O'ZI — qaror shu ma'lumotdan chiqadi. */}
        <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{current.studentName}</span>
            <span className={`tabular-nums font-semibold ${current.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmtUZS(current.amount)}
            </span>
          </div>
          <div className="text-[12px] text-muted-foreground space-y-0.5">
            <div>{fmtDate(current.date, current.time)} · {t(current.txName)} · {t(current.paymentType)}</div>
            <div>
              {t("Ustoz:")} <strong className="text-foreground">{current.teacherName || "—"}</strong>
              {current.moderator && <> · {t("Qabul qilgan:")} {current.moderator}</>}
            </div>
            {current.note && <div>{t("Izoh:")} {current.note}</div>}
          </div>
        </div>

        {current.samePerson && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700">
            {t("Nomzodlarning telefoni bir xil — bu bitta o'quvchi ikki marta kiritilganga o'xshaydi. Qaysinisini tanlasangiz ham pul haqiqiy odamga tushadi; kartalarni keyinroq birlashtirish kerak.")}
          </div>
        )}

        {/* NOMZODLAR */}
        {current.candidates.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            {t("Bu ismda o'quvchi topilmadi — pastdan qidirib tanlang.")}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Kim to'lagan?")}
            </p>
            {current.candidates.map((c) => {
              // Ustozi to'lovdagi ustoz bilan bir xil bo'lsa — kuchli
              // belgi, ajratib ko'rsatiladi.
              const teacherMatch = !!current.teacherName
                && c.groups.some((g) => g.toLowerCase().includes(current.teacherName.trim().toLowerCase()));
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={saving}
                  onClick={() => assign(c.id)}
                  className={`block w-full text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-60 ${
                    teacherMatch
                      ? "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {c.name}
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">#{c.id}</span>
                    </span>
                    {teacherMatch && (
                      <span className="shrink-0 text-[11px] font-medium text-emerald-600">{t("ustozi mos")}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground space-y-0.5">
                    <div>
                      {c.phone ? `+998 ${c.phone}` : t("telefon yo'q")}
                      {" · "}{t(c.status)}
                      {c.branchId != null && <> · {t("filial")} {c.branchId}</>}
                    </div>
                    <div>{c.groups.length > 0 ? c.groups.join(" · ") : t("guruhga biriktirilmagan")}</div>
                    <div>
                      {c.paidCount > 0
                        ? t("{n} ta to'lovi bor · {sum} so'm", { n: c.paidCount, sum: fmtUZS(c.paidTotal) })
                        : t("biriktirilgan to'lovi yo'q")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ERKIN TANLOV — nomzodlar orasida bo'lmasa. */}
        <div className="pt-1 border-t border-border space-y-2">
          <StudentSearchSelect
            label={t("Ro'yxatda yo'qmi? Hamma o'quvchidan qidiring")}
            variant="compact"
            value={otherKey}
            onChange={setOtherKey}
            options={studentOptions}
            labelOf={(k) => studentById.get(k)?.name ?? k}
            subtitleOf={(k) => {
              const s = studentById.get(k);
              return s?.phone ? `+998 ${s.phone}` : "";
            }}
            loading={studentsLoading}
            placeholder={t("Ism yoki telefon bo'yicha qidiring…")}
          />
          {otherKey && (
            <Button
              variant="primary"
              className="w-full"
              disabled={saving}
              onClick={() => assign(Number(otherKey))}
            >
              {t("Shu o'quvchiga biriktirish")}
            </Button>
          )}
        </div>
      </div>
    );
  })();

  return (
    <Modal
      controller={modal}
      onClose={onClose}
      size="lg"
      locked={saving}
      title={t("O'quvchisi aniqlanmagan to'lovlar")}
      subtitle={
        entries.length > 0
          ? t("{i} / {n} — ism takrorlangani uchun mashina ajrata olmadi", { i: index + 1, n: entries.length })
          : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={saving || index === 0}
              onClick={() => { setOtherKey(""); setIndex((i) => Math.max(0, i - 1)); }}
            >
              {t("Oldingisi")}
            </Button>
            <Button
              variant="outline"
              disabled={saving || index >= entries.length - 1}
              onClick={() => { setOtherKey(""); setIndex((i) => Math.min(entries.length - 1, i + 1)); }}
            >
              {t("Keyingisi")}
            </Button>
          </div>
          <Button variant="outline" onClick={modal.close}>{t("Yopish")}</Button>
        </div>
      }
    >
      {body}
    </Modal>
  );
}
