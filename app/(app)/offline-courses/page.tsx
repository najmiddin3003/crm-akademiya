import OfflineCoursesList from "@/components/offline-courses/OfflineCoursesList";
import CoursesSettingsV2 from "@/components/v2/settings/CoursesSettingsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — «Sozlamalar → O'quv → Kurslar»
// (components/v2/settings/, 20.10.2026: ichki Sozlamalar menyusi, kategoriya va holat,
// qatorning o'zida tahrir). Eski versiyada — Oflayn kurslar ro'yxati o'zgarmadi. Ikkalasi
// bitta do'kondan (./layout.tsx → OfflineCoursesProvider). Versiya serverda tanlanadi.
export default async function Page() {
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2>
        <CoursesSettingsV2 />
      </SettingsFrameV2>
    );
  }
  return <OfflineCoursesList />;
}
