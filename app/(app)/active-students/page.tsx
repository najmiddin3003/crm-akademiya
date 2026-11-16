import ActiveStudentsPage from "@/components/students/ActiveStudentsPage";
import ActiveStudentsV2 from "@/components/v2/students/lists/ActiveStudentsV2";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";
import type { Pupil, PupilListItem } from "@/lib/pupilsData";
import { currentUiVersion } from "@/lib/uiVersionServer";

// SERVER KOMPONENT — o'quvchilar va guruhlar sahifa bilan BIRGA keladi.
// Sabab va yondashuv: lib/listQueries.ts izohiga qarang.
//
// Yangi versiyada — «Aktiv o'quvchilar» (30-qism, 16.11.2026): joriy oy to'lov holati, balans,
// oxirgi to'lov, taklif qilganlari; ma'lumot /api/students/lists dan. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <ActiveStudentsV2 />;

  const scope = await listScope();
  // Ikkala ro'yxat bir-biriga bog'liq emas — barobar olinadi.
  const [pupils, groups] = scope
    ? await Promise.all([
        loadPupils({ status: "Aktiv", extra: ["paymentDate"] }),
        loadGroups(),
      ])
    : [undefined, undefined];

  return (
    <ActiveStudentsPage
      initialPupils={pupils as (PupilListItem & Pick<Pupil, "paymentDate">)[] | undefined}
      initialGroups={groups}
    />
  );
}
