import ProfilePage from "@/components/settings/ProfilePage";
import MyAccountV2 from "@/components/v2/account/MyAccountV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Mening hisobim. YANGI VERSIYA (37-qism): Profil / Xavfsizlik / Qurilmalar bitta sahifa, tab manzildan
// (components/v2/account/MyAccountV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <MyAccountV2 tab="profile" />;
  return <ProfilePage />;
}
