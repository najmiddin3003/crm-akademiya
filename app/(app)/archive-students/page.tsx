import ArchiveStudentsPage from "@/components/students/ArchiveStudentsPage";
import ArchiveStudentsV2 from "@/components/v2/students/lists/ArchiveStudentsV2";
import { listScope, loadGroups, loadPupils } from "@/lib/listQueries";
import { currentUiVersion } from "@/lib/uiVersionServer";

// SERVER KOMPONENT — ro'yxatlar sahifa bilan BIRGA keladi.
// Sabab va yondashuv: lib/listQueries.ts izohiga qarang.
//
// Yangi versiyada — «Arxiv o'quvchilar» (30-qism, 16.11.2026): ketish sabablari, oxirgi guruh,
// o'qigan muddati, qarz; ma'lumot /api/students/lists dan. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <ArchiveStudentsV2 />;

  const scope = await listScope();
  const [pupils, groups] = scope
    ? await Promise.all([loadPupils({ status: "Arxiv" }), loadGroups()])
    : [undefined, undefined];

  return <ArchiveStudentsPage initialPupils={pupils} initialGroups={groups} />;
}
