import GroupsListPage from "@/components/groups/GroupsListPage";
import GroupsListV2 from "@/components/v2/groups/GroupsListV2";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";
import { currentUiVersion } from "@/lib/uiVersionServer";

// SERVER KOMPONENT — guruhlar ro'yxati sahifa bilan BIRGA keladi.
//
// Ilgari bu 4 qatorlik bo'sh o'ram edi va ro'yxat gidratatsiyadan KEYIN,
// alohida HTTP to'lqinda so'ralardi. Prodda bitta brauzer<->API borib
// kelishi ~208 ms, ya'ni jadval shuncha kech chizilardi.
//
// Ma'lumot BIR MARTA, serverda olinadi va boshlang'ich qiymat sifatida
// uzatiladi. Filtr, qidiruv va boshqa hamma mantiq klientda qolgan —
// faqat birinchi yuklash tezlashdi.
//
// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// ro'yxat (components/v2/groups/GroupsListV2.tsx); ma'lumot ikkalasiga bir xil
// (components/groups/useGroupsList.ts). Versiya serverda tanlanadi —
// birinchi chizishdayoq to'g'ri ko'rinish, miltillashsiz.
export default async function Page() {
  const scope = await listScope();
  // Qamrov yo'q bo'lsa (sessiya tugagan) ro'yxat uzatilmaydi — klient
  // o'zi so'raydi va 401 ni odatdagidek qayta ishlaydi.
  // Uchala so'rov bir-biriga bog'liq emas — barobar ketadi.
  const [groups, frozenPupils, version] = await Promise.all([
    scope ? loadGroups() : undefined,
    scope ? loadPupils({ status: "Muzlatilgan" }) : undefined,
    currentUiVersion(),
  ]);

  return version === "v2" ? (
    <GroupsListV2 initialGroups={groups} initialFrozenPupils={frozenPupils} />
  ) : (
    <GroupsListPage initialGroups={groups} initialFrozenPupils={frozenPupils} />
  );
}
