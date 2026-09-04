import ActiveStudentsPage from "@/components/students/ActiveStudentsPage";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";
import type { Pupil, PupilListItem } from "@/lib/pupilsData";

// SERVER KOMPONENT — o'quvchilar va guruhlar sahifa bilan BIRGA keladi.
// Sabab va yondashuv: lib/listQueries.ts izohiga qarang.
export default async function Page() {
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
