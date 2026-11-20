import NazoratTurnstileIoPage from "@/components/nazorat/NazoratTurnstileIoPage";
import NazoratTurnstileIoV2 from "@/components/v2/nazorat/NazoratTurnstileIoV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Turniket kirish-chiqish analitikasi. Yangi versiyada (28-qism, 20.11.2026) — holat kataklari va
// jadval, o'sha /api/turnstile-io (components/v2/nazorat/NazoratTurnstileIoV2.tsx); eski versiya o'zgarmadi.
// Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <NazoratTurnstileIoV2 /> : <NazoratTurnstileIoPage />;
}
