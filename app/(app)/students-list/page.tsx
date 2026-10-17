import StudentsListPage from "@/components/students/StudentsListPage";
import StudentsListV2 from "@/components/v2/students/StudentsListV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// ro'yxat; ma'lumot, filtrlar va eksport ikkalasida bir manbadan
// (components/students/useStudentsList.ts). Versiya serverda tanlanadi —
// sahifa birinchi chizishdayoq to'g'ri ko'rinishda, miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <StudentsListV2 /> : <StudentsListPage />;
}
