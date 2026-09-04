import GroupsListPage from "@/components/groups/GroupsListPage";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";

// SERVER KOMPONENT — guruhlar ro'yxati sahifa bilan BIRGA keladi.
//
// Ilgari bu 4 qatorlik bo'sh o'ram edi va ro'yxat gidratatsiyadan KEYIN,
// alohida HTTP to'lqinda so'ralardi. Prodda bitta brauzer<->API borib
// kelishi ~208 ms, ya'ni jadval shuncha kech chizilardi.
//
// Ma'lumot BIR MARTA, serverda olinadi va boshlang'ich qiymat sifatida
// uzatiladi. Filtr, qidiruv va boshqa hamma mantiq klientda qolgan —
// faqat birinchi yuklash tezlashdi.
export default async function Page() {
  const scope = await listScope();
  // Qamrov yo'q bo'lsa (sessiya tugagan) ro'yxat uzatilmaydi — klient
  // o'zi so'raydi va 401 ni odatdagidek qayta ishlaydi.
  // Ikkala so'rov bir-biriga bog'liq emas — barobar ketadi.
  const [groups, frozenPupils] = scope
    ? await Promise.all([loadGroups(), loadPupils({ status: "Muzlatilgan" })])
    : [undefined, undefined];

  return <GroupsListPage initialGroups={groups} initialFrozenPupils={frozenPupils} />;
}
