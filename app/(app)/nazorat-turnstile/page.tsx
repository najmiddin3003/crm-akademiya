import NazoratTurnstilePage from "@/components/nazorat/NazoratTurnstilePage";
import NazoratTurnstileV2 from "@/components/v2/nazorat/NazoratTurnstileV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Turniket analitikasi. Turniket qurilmasi ulanmagan (SAVOLLAR 447) — yangi versiyada (28-qism,
// 20.11.2026) bo'sh holat va mavjud manbalarga havola (components/v2/nazorat/NazoratTurnstileV2.tsx); eski
// versiya o'zgarmadi. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <NazoratTurnstileV2 /> : <NazoratTurnstilePage />;
}
