import EduCategoriesPage from "@/components/eduCategories/EduCategoriesPage";
import CategoriesV2 from "@/components/v2/settings/CategoriesV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Sozlamalar → O'quv → Kategoriyalar» (24-qism, 13.11.2026): KURS
// kategoriyalari va ularning oylik narxlari (`offline_courses.category` + darajalar narxi).
// O'quvchi kartasidagi «Kategoriya» (`edu_categories`) — boshqa ro'yxat: u `?tab=` bilan
// eski ko'rinishda ochiladi (yangi sahifa pastidagi havola). Eski versiyada — o'zgarmagan.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tab } = await searchParams;
  if ((await currentUiVersion()) === "v2" && !tab) {
    return (
      <SettingsFrameV2 current="/edu-category">
        <CategoriesV2 />
      </SettingsFrameV2>
    );
  }
  return <EduCategoriesPage />;
}
