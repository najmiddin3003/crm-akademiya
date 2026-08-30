"use client";

import dynamic from "next/dynamic";
import type { DonutSlice } from "./DonutChartImpl";

// Donut diagramma — recharts KEYIN yuklanadi.
//
// NEGA: recharts butun loyihada faqat shu bitta komponentda ishlatiladi,
// lekin statik import bo'lgani uchun uning 318 KB lik chunk'i TO'RTTA
// sahifaning boshlang'ich JS to'plamiga kirardi (Moliya analitikasi,
// Cash Flow, Hisobotlar, Turniket). Diagramma esa hech qaysi sahifada
// birinchi bo'yoqda ko'rinmaydi — u /api dan ma'lumot kelgandan keyin
// chiziladi, /finance-analytics da esa umuman boshqa tab ostida.
//
// Tashqi interfeys o'zgarmadi: chaqiruvchi joylar tegilmagan.
// `ssr: false` — recharts brauzer DOM'iga tayanadi; hujjatlarga ko'ra bu
// tanlov faqat Client Component ichida ishlaydi, shuning uchun bu fayl
// "use client".
const DonutChartImpl = dynamic(() => import("./DonutChartImpl"), {
  ssr: false,
  // Joy-egallovchi kerak emas: o'lcham pastdagi o'rovchi div'da, ya'ni
  // diagramma kelguncha ham maydon band turadi va sahifa sakramaydi.
  loading: () => null,
});

export type { DonutSlice };

export default function DonutChart(props: {
  slices: DonutSlice[];
  centerLabel: string;
  size?: number;
  showLabels?: boolean;
  valueFormatter?: (value: number) => string;
}) {
  const size = props.size ?? 220;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <DonutChartImpl {...props} />
    </div>
  );
}
