// Hisobotlar → Sotuv voronkasi (sidebar: Hisobotlar > Sotuv va marketing >
// Sotuv voronkasi, href /reports-funnel).
//
// Yangi kolleksiya YO'Q — hammasi mavjud buyurtmalardan hisoblanadi
// (lib/ordersData.ts createInitialOrders(), loyihadagi O'quvchilar/Guruh
// sahifalari bilan bir xil manba). Shu sababli hisobot doim buyurtmalar
// ro'yxati bilan izchil bo'ladi.
import { ORDER_STAGES, type Order, type OrderStageKey } from "@/lib/ordersData";

export interface FunnelReportRow {
  label: string;
  count: number;
  courses: number; // shu qatorga tushgan noyob kurslar soni
}

export interface FunnelStep {
  label: string;
  count: number;
  percent: number; // birinchi bosqichga nisbatan
}

export interface StageSummary {
  key: OrderStageKey;
  label: string;
  emoji: string;
  count: number;
  percent: number;
}

// Referensdagi 11 qatorli "Hisobot turlari" jadvali. Har bir qator buyurtma
// statusi/bosqichi bo'yicha predikat — shu tarzda qo'shish/o'zgartirish oson.
const REPORT_ROWS: { label: string; match: (o: Order) => boolean }[] = [
  { label: "Barcha buyurtmalar soni", match: () => true },
  { label: "Buyurtmadan ketganlar", match: (o) => o.status === "Bekor qilindi" },
  { label: "Sinov darsiga yozilganlar", match: (o) => o.status === "Kelmoqda" || o.status === "Kutilmoqda" },
  { label: "Sinov darsiga kelmay ketganlar", match: (o) => o.status === "Kutilmoqda" && o.stage === "ketdim" },
  { label: "Sinov darsiga kelganlar", match: (o) => o.status === "Qabul qilindi" },
  { label: "Sinov darsiga kelib ketganlar", match: (o) => o.status === "Qabul qilindi" && o.stage === "ketdim" },
  { label: "Birinchi to'lovni qilganlar", match: (o) => o.stage === "rahmaaaat" },
  { label: "Birinchi to'lovni qilib ketganlar", match: (o) => o.stage === "rahmaaaat" && o.status === "O'tkazildi" },
  { label: "Tugatganlar", match: (o) => o.status === "Yakunlandi" },
  // DIQQAT: har bir buyurtmada fromBranch/toBranch to'ldirilgan bo'ladi,
  // shuning uchun "filial bor" degan shart ko'chirishni ANIQLAMAYDI — u
  // barcha buyurtmani sanab ketardi. Ko'chirish faqat statusi "O'tkazildi"
  // bo'lgan va manba/maqsad filiali HAR XIL bo'lgan buyurtma.
  {
    label: "Boshqa filialdan ko'chirilgan",
    match: (o) => o.status === "O'tkazildi" && !!o.fromBranch && o.fromBranch !== o.toBranch,
  },
  {
    label: "Boshqa filialga ko'chirilgan",
    match: (o) => o.status === "O'tkazildi" && !!o.toBranch && o.fromBranch !== o.toBranch,
  },
];

export function buildFunnelReport(orders: Order[]): FunnelReportRow[] {
  return REPORT_ROWS.map((r) => {
    const hits = orders.filter(r.match);
    return {
      label: r.label,
      count: hits.length,
      courses: new Set(hits.map((o) => o.course).filter(Boolean)).size,
    };
  });
}

// Voronka bosqichlari — referensdagi 4 ta ko'rsatkich. Foiz birinchi
// bosqichga nisbatan hisoblanadi (0 ga bo'linishdan himoyalangan).
export function buildFunnelSteps(rows: FunnelReportRow[]): FunnelStep[] {
  const byLabel = new Map(rows.map((r) => [r.label, r.count]));
  const total = byLabel.get("Barcha buyurtmalar soni") ?? 0;
  const pick = (label: string) => byLabel.get(label) ?? 0;
  const steps = [
    { label: "Barcha buyurtmalar soni", count: total },
    { label: "Sinov darsiga yozilganlar", count: pick("Sinov darsiga yozilganlar") },
    { label: "Sinov darsiga kelganlar", count: pick("Sinov darsiga kelganlar") },
    { label: "Birinchi to'lovni qilganlar", count: pick("Birinchi to'lovni qilganlar") },
  ];
  return steps.map((s) => ({ ...s, percent: total > 0 ? (s.count / total) * 100 : 0 }));
}

// Lid bosqichlari (Kanban ustunlari bilan bir xil) — har bosqichdagi lidlar
// soni va eng ko'p to'lganiga nisbatan foizi.
export function buildStageSummary(orders: Order[]): StageSummary[] {
  const counts = ORDER_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    emoji: s.emoji,
    count: orders.filter((o) => o.stage === s.key).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return counts.map((c) => ({ ...c, percent: (c.count / max) * 100 }));
}
