import NazoratBranchesPage from "@/components/nazorat/NazoratBranchesPage";
import MovedNotice from "@/components/v2/owner/MovedNotice";
import { requireAdmin } from "@/lib/adminOnly";
import { currentUiVersion } from "@/lib/uiVersionServer";

// 49-qism: «Filiallar holati» Rahbar paneli → Umumiy ko'rinish → Filiallar taqqoslashga ko'chdi. Yangi versiyada
// admin tepada yangi joyini ko'radi; sahifa o'zi (va boshqa rollar uchun) o'zgarmagan.
export default async function Page() {
  const note = (await currentUiVersion()) === "v2" && (await requireAdmin());
  return (
    <>
      {note ? <MovedNotice href="/owner" text="Filiallar holati endi Rahbar paneli → Umumiy ko'rinish → Filiallar taqqoslashda" link="Rahbar paneli" /> : null}
      <NazoratBranchesPage />
    </>
  );
}
