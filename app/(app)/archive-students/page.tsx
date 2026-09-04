import ArchiveStudentsPage from "@/components/students/ArchiveStudentsPage";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";

// SERVER KOMPONENT — ro'yxatlar sahifa bilan BIRGA keladi.
// Sabab va yondashuv: lib/listQueries.ts izohiga qarang.
export default async function Page() {
  const scope = await listScope();
  const [pupils, groups] = scope
    ? await Promise.all([loadPupils({ status: "Arxiv" }), loadGroups()])
    : [undefined, undefined];

  return <ArchiveStudentsPage initialPupils={pupils} initialGroups={groups} />;
}
