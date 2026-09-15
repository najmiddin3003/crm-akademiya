// "Nega tez?" — sahifada ham (TapTestPage.tsx), modalda ham (SpeedFab.tsx)
// bir xil uch qator. Hook'siz — ikkalasidan ham import qilinadi.
export default function WhyFast({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-[15px] font-semibold mb-2">Nega tez?</h2>
      <ul className="space-y-1.5 text-[13.5px] text-muted-foreground list-disc pl-5">
        <li>Server endi <span className="text-foreground font-medium">Toshkentda</span> (TAS-IX) — so&apos;rov Singapurga borib kelmaydi.</li>
        <li>Ma&apos;lumotlar bazasi ham <span className="text-foreground font-medium">server yonida, Toshkentda</span>. (Ilgari ham baza server yonida edi — lekin ikkalasi Singapurda.)</li>
        <li>Natija internet tezligingizga ham bog&apos;liq — yana urinib ko&apos;ring.</li>
      </ul>
    </section>
  );
}
