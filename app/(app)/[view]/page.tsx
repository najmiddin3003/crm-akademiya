// Vaqtinchalik "hali qurilmagan" sahifa. Aniq nomlangan route (masalan
// app/birthdays/page.tsx) qo'shilganda, Next.js uni ushbu dinamik
// [view] route'dan avtomatik ustun qo'yadi — shuning uchun bu fayl
// portlanmagan sahifalar uchun vaqtinchalik joy egallovchi bo'lib qoladi.
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <p className="text-sm text-muted-foreground">
        Sahifa: <strong>{view}</strong>
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        (Bu sahifa hali portlanmagan — keyingi bosqichlarda qo&apos;shiladi.)
      </p>
    </div>
  );
}
