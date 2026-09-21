import { redirect } from "next/navigation";

// Sarhisob endi Imtihon sahifasining birinchi tabi (/imtihon) — 21.09.2026
// gacha alohida sahifa edi; eski havolalar/xatcho'plar shu yerga tushadi.
export default function Page() {
  redirect("/imtihon");
}
