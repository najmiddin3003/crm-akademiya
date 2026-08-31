"use client";

// Ma'lumot yuklanmaganda RAQAM O'RNIGA ko'rsatiladigan banner.
//
// NEGA Toast EMAS: Toast (components/ui/Toast.tsx) bir necha soniyada
// yo'qoladi. Bu yerdagi holat esa turg'un — sahifada noto'g'ri raqamlar
// turibdi va foydalanuvchi buni BILISHI kerak. Shu bois banner sahifada
// qoladi va yonida qayta urinish tugmasi turadi.
//
// QOIDA: xato bo'lganda nol bilan to'ldirilgan jadval CHIZILMASIN.
// Moliya tizimida "0 UZS" — bu da'vo, "ma'lumot kelmadi" esa boshqa gap.

export default function ErrorBanner({
  message = "Ma'lumot yuklanmadi — raqamlar to'liq emas.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-600"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-rose-500/30 px-3 py-1.5 text-[12px] font-medium hover:bg-rose-500/10"
        >
          Qayta urinish
        </button>
      )}
    </div>
  );
}

/** Butun blok o'rnini egallaydigan variant (SpinnerBlock bilan bir xil shakl). */
export function ErrorBlock({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="py-10">
      <ErrorBanner message={message} onRetry={onRetry} />
    </div>
  );
}
