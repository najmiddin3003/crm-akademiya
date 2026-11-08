import FirstLessonsPage from "@/components/leads/FirstLessonsPage";
import { OrdersProvider } from "@/components/orders/OrdersContext";
import FirstLessonsV2 from "@/components/v2/first-lessons/FirstLessonsV2";
import { getCurrentUser } from "@/lib/auth";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Birinchi darsga yozilganlar (sidebar: Lidlar → Birinchi darsga yozilganlar).
//
// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// sahifa (components/v2/first-lessons/FirstLessonsV2.tsx, 22-qism): lidlar
// OrdersProvider'dan (Lidlar sahifasi bilan bir xil ombor va holat o'tishlari).
// Eski sahifa o'z ma'lumotini o'zi oladi. Versiya serverda tanlanadi —
// miltillashsiz. Direktor (admin) 10 daqiqadan keyin ham holatni qaytara oladi.
export default async function Page() {
  const [me, version] = await Promise.all([getCurrentUser(), currentUiVersion()]);
  if (version === "v2") {
    return (
      <OrdersProvider>
        <FirstLessonsV2 isAdmin={me?.role === "admin"} />
      </OrdersProvider>
    );
  }
  return <FirstLessonsPage />;
}
