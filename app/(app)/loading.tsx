import Spinner from "@/components/ui/Spinner";

// Route segmenti yuklanayotganda ko'rsatiladi. Bitta fayl (app) guruhidagi
// BARCHA sahifalarni qamrab oladi — Next.js uni avtomatik Suspense chegarasi
// sifatida ishlatadi. Sahifa ichidagi ma'lumot yuklanishi esa har komponentda
// alohida (SpinnerBlock bilan).
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner size={44} />
    </div>
  );
}
