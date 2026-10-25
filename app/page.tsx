import LoginPage from "@/components/auth/LoginPage";
import LoginV2 from "@/components/v2/auth/LoginV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Kirish sahifasi. YANGI VERSIYA (25.10.2026, 14-qism — rasm «Kirish sahifasi»): versiya
// almashtirgichi cookie'si `v2` bo'lgan brauzerda (xodim yangi ko'rinishni tanlagan — chiqqandan
// keyin ham) yangi sahifa (components/v2/auth/LoginV2.tsx); `?classic=1` — eskisi.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <LoginV2 />;
  return <LoginPage />;
}
