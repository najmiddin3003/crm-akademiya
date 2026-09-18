"use client";

import { useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { useT } from "@/components/shared/Language";

// Profil sahifalarining CHAP YON KARTASI — xodim (Boshqaruv → Xodimlar) va
// o'quvchi (O'quvchilar → profil) uchun YAGONA komponent.
//
// NIMA NOTO'G'RI EDI: bu karta ikkala sahifada alohida-alohida yozilgan edi
// va vaqt o'tib bir-biridan uzoqlashib ketdi — bir xil ma'nodagi ikki ekran
// turlicha ko'rinardi:
//
//   ustun kengligi   320px            /  30% (~384px)
//   avatar           96px, harflar    /  112px, odam ikonkasi
//   tugmalar         4 ta kvadrat     /  3 ta doira
//   statistika       ALOHIDA karta    /  ALOHIDA karta (boshqa struktura)
//   ikonka           h-9 rounded-full /  h-10 rounded-lg
//
// Namunada (akademiya.edutizim.uz) esa ikkalasi ham BITTA kartada va deyarli
// aynan bir xil. Endi shu yerda.
//
// Farqlar props orqali qoplanadi — komponent "xodimmi yoki o'quvchimi"
// degan bayroq OLMAYDI: shart nima ko'rsatilishida, kim ekanida emas.

/** Kartadagi bitta statistika qatori. */
export interface ProfileStat {
  /** Ro'yxat kaliti ham shu — takrorlanmasin. */
  label: string;
  /**
   * TAYYOR satr. "—" (manba yo'q) va "…" (yuklanmoqda) ni CHAQIRUVCHI
   * beradi: bu komponent soxta "0" o'ylab topmasligi kerak.
   */
  value: string;
  /**
   * Tayyor element — `<Check className="w-4 h-4" />` yoki
   * `<svg className="icon icon-sm"><use href="#i-book" /></svg>`.
   * ComponentType emas: ikki sahifada ikonka manbasi har xil (lucide va
   * global sprite).
   */
  icon: ReactNode;
  /** Ikonka qutisining fon+matn klasslari, masalan "bg-sky-500/10 text-sky-600". */
  wrap: string;
  /** Qiymatga qo'shimcha klass (masalan manfiy avans — "text-rose-600"). */
  valueCls?: string;
  /**
   * Qiymat ostidagi kichik izoh (masalan "kartaga 1 584 000 · naqd
   * 2 900 000"). Berilmasa chizilmaydi.
   */
  hint?: string;
}

/** Ism/telefon ostidagi doira ikonka-tugma. */
export interface ProfileAction {
  key: string;
  /** Tooltip. */
  title: string;
  icon: ReactNode;
  /** Fon/hover/matn klasslari. */
  cls: string;
  /** `href` berilsa `<a>` chiziladi (masalan `tel:`), aks holda `<button>`. */
  onClick?: () => void;
  href?: string;
}

export interface ProfileSideCardProps {
  name: string;
  /** Ko'rinadigan telefon satri — formatlash chaqiruvchida. */
  phone: string;
  /** Berilmasa nusxa olish tugmasi umuman chizilmaydi. */
  onCopyPhone?: () => void;
  /** Cloudinary havolasi. Yo'q yoki buzilgan bo'lsa — bosh harflar. */
  photoUrl?: string;
  /** Ko'pi bilan 2 ta harf. Bo'sh bo'lsa — odam ikonkasi. */
  initials?: string;
  /** Avatar ostidagi rangli nishon (lavozim). `null` = chizilmaydi. */
  badge?: { label: string; cls: string } | null;
  /** Avatarning o'ng-past burchagidagi kamera tugmasi. Berilmasa chizilmaydi. */
  onPhotoUpload?: () => void;
  actions: ProfileAction[];
  stats: ProfileStat[];
  /** Tugmalardan KEYIN, statistikadan OLDIN chiziladigan qo'shimcha bloklar. */
  children?: ReactNode;
}

export default function ProfileSideCard({
  name,
  phone,
  onCopyPhone,
  photoUrl,
  initials = "",
  badge = null,
  onPhotoUpload,
  actions,
  stats,
  children,
}: ProfileSideCardProps) {
  const { t } = useT();
  // Cloudinary'dagi rasm o'chirilgan yoki havola buzilgan bo'lsa, singan
  // rasm belgisi o'rniga harflarga qaytamiz. Holat SHU YERDA — shunda
  // ikkala sahifa ham bir xil yiqiladi.
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  return (
    // Padding TASHQI kartada YO'Q: statistika qatorlari orasidagi chiziq
    // karta ramkasigacha yetib borishi kerak. `overflow-hidden` esa pastki
    // qatorning burchaklarini kartaga moslaydi.
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="p-5 flex flex-col items-center text-center">
        <div className="relative">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name}
              onError={() => setPhotoFailed(true)}
              // O'lcham INLINE. Tailwind preflight'idagi `img { height: auto }`
              // bilan `h-24` orasidagi to'qnashuv sababli rasm cho'zilib
              // ketishi mumkin — inline qiymat esa har qanday holatda aniq.
              style={{ width: 96, height: 96, objectFit: "cover" }}
              className="rounded-full shadow-lg"
            />
          ) : initials ? (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              <span>{initials}</span>
            </div>
          ) : (
            // Ism ham bo'lmagan chekka holat — namunadagidek odam ikonkasi.
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <svg viewBox="0 0 24 24" className="w-14 h-14" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}

          {badge && (
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow ${badge.cls}`}>
              {badge.label}
            </span>
          )}

          {onPhotoUpload && (
            // Avatar 112px dan 96px ga kichraygani uchun tugma chetga
            // `bottom-0 right-0` bilan qo'yiladi — aks holda doiradan
            // chiqib ketardi.
            <button
              type="button"
              onClick={onPhotoUpload}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white inline-flex items-center justify-center shadow-md hover:opacity-90"
              title={t("Rasm yuklash")}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          )}
        </div>

        <h2 className="mt-4 text-[17px] font-bold tracking-tight">{name}</h2>

        <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
          <span className="tabular-nums">{phone}</span>
          {onCopyPhone && (
            <button type="button" onClick={onCopyPhone} className="hover:text-primary" title={t("Nusxa olish")}>
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {actions.length > 0 && (
          // FLEX qator, grid emas: 3 ta ham, 4 ta ham tugma bilan bir xil
          // markazda turadi. Grid `grid-cols-4` da 3 ta tugma bo'sh katak
          // qoldirib, chapga surilib qolardi.
          <div className="mt-3 flex items-center justify-center gap-2">
            {actions.map((a) =>
              a.href ? (
                <a
                  key={a.key}
                  href={a.href}
                  title={a.title}
                  className={`h-9 w-9 rounded-full inline-flex items-center justify-center ${a.cls}`}
                >
                  {a.icon}
                </a>
              ) : (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.onClick}
                  title={a.title}
                  className={`h-9 w-9 rounded-full inline-flex items-center justify-center ${a.cls}`}
                >
                  {a.icon}
                </button>
              ),
            )}
          </div>
        )}

        {children}
      </div>

      {stats.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {stats.map((s) => (
            <li key={s.label} className="flex items-center gap-3 px-4 py-3">
              <span className={`h-10 w-10 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${s.wrap}`}>
                {s.icon}
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
                <div className={`text-[14px] font-semibold tabular-nums ${s.valueCls ?? ""}`}>{s.value}</div>
                {s.hint && <div className="text-[11px] text-muted-foreground tabular-nums">{s.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
