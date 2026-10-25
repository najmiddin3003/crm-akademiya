"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useGroups } from "@/hooks/useGroups";
import type { UbCells, UbResult, UbTest, UbTestRow } from "@/lib/uzbmb";
import UbEntry from "./UbEntry";
import UbResults from "./UbResults";
import UbExportButton from "./ubExport";
import { UbTestDialog } from "./ubDialogs";
import { groupLabelOf, sheetRows, useGroupMembers, useUbConfig, useUbTestData, useUbTests } from "./ubCore";

// YANGI VERSIYA — IMTIHON → UZBMB (12-qism, rasmlar «UzBMB · Natija kiritish», «Natijalar va taqqoslash»,
// «Excel eksport», 25.10.2026). Manzil (Sarhisob parametrlari bilan to'qnashmaydi):
//   /imtihon?tab=uzbmb                      — natijalar: oxirgi test, natijasi ko'p guruh;
//   …&test=<id>&guruh=<id>                  — tanlangan test va guruh;
//   …&rejim=kiritish                        — «Natija kiritish» (orqaga — natijalar);
//   …&eski=1                                — testga bog'lanmagan eski natijalar (eski ko'rinish, ImtihonV2).
// Ma'lumot bir joyda yuklanadi (sozlama, testlar, test natijalari, guruh o'quvchilari) — ikkala ko'rinish
// shundan; kiritish qoralamasi UbEntry ichida (test/guruh almashganda `key` bilan tozalanadi).

export default function UzbmbV2() {
  const { t } = useT();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { config } = useUbConfig();
  const testsApi = useUbTests();
  const { groups, loading: groupsLoading } = useGroups();
  const tests = testsApi.tests;

  const urlTest = Number(sp.get("test"));
  const urlGroup = Number(sp.get("guruh"));
  const entry = sp.get("rejim") === "kiritish";

  const testRow: UbTestRow | null = tests ? (tests.find((x) => x.id === urlTest) ?? tests[0] ?? null) : null;
  const testId = testRow?.id ?? null;
  const td = useUbTestData(testId);
  const test: UbTest | null = td.data && td.data.test.id === testId ? td.data.test : testRow;

  // Guruh tanlanmagan bo'lsa — natijalar ko'rinishida shu testda natijasi eng ko'p guruh.
  const defaultGroup = useMemo(() => {
    if (!td.data) return null;
    const count = new Map<number, number>();
    for (const r of td.data.results) count.set(r.groupId, (count.get(r.groupId) ?? 0) + 1);
    const best = [...count.entries()].filter(([id]) => groups.some((g) => g.id === id)).sort((a, b) => b[1] - a[1])[0];
    return best?.[0] ?? null;
  }, [td.data, groups]);
  const groupId = Number.isInteger(urlGroup) && urlGroup > 0 ? urlGroup : entry ? null : defaultGroup;
  const membersApi = useGroupMembers(groupId);

  const [testDialog, setTestDialog] = useState<null | { test: UbTestRow | null }>(null);
  const [seed, setSeed] = useState<{ key: string; cells: Record<number, UbCells> } | null>(null);

  function setParams(patch: Record<string, string | null>, push = false) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    q.set("tab", "uzbmb");
    const url = `${pathname}?${q.toString()}`;
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }

  const entryKey = `${testId ?? "-"}|${groupId ?? "-"}`;
  const group = groups.find((g) => g.id === groupId) ?? null;
  const groupLabel = group ? groupLabelOf(group) : groupId !== null ? (td.data?.groupLabels[groupId] ?? `#${groupId}`) : "";
  const exportRows = useMemo(
    () => (membersApi.members && td.data && groupId !== null ? sheetRows({ members: membersApi.members, results: td.data.results, groupId }) : []),
    [membersApi.members, td.data, groupId],
  );
  const nextNo = (tests ?? []).reduce((m, x) => Math.max(m, x.no), 0) + 1;

  const exportNode = <UbExportButton data={td.data} groupId={groupId} groupLabel={groupLabel} rows={exportRows} />;
  const common = {
    config,
    tests,
    test,
    data: td.data,
    dataLoading: td.loading,
    dataError: td.error ?? testsApi.error,
    onRetryData: () => {
      if (testsApi.error) testsApi.reload();
      td.reload();
    },
    groups,
    groupsLoading,
    groupId,
    members: membersApi.members,
    exportNode,
    onNewTest: () => setTestDialog({ test: null }),
    onEditTest: (x: UbTestRow) => setTestDialog({ test: x }),
  };

  function onSaved(results: UbResult[], info: { saved: number; removed: number; partial: number }) {
    td.setResults(results);
    if (test) testsApi.upsert(test, { resultCount: results.length, groupCount: new Set(results.map((r) => r.groupId)).size });
    setSeed(null);
    const detail = [
      info.saved ? t("{n} ta o'quvchi natijasi", { n: info.saved }) : null,
      info.removed ? t("{n} ta natija o'chirildi", { n: info.removed }) : null,
      info.partial ? t("{n} tasi to'liq emas — reytingga kirmaydi", { n: info.partial }) : null,
    ].filter((x): x is string => Boolean(x));
    showToast({ tone: "success", title: t("Natijalar saqlandi"), detail: [groupLabel, ...detail].filter(Boolean) });
    setParams({ rejim: null, test: testId === null ? null : String(testId), guruh: groupId === null ? null : String(groupId) });
  }

  return (
    <>
      {entry ? (
        <UbEntry
          key={entryKey}
          {...common}
          membersError={membersApi.error}
          seed={seed && seed.key === entryKey ? seed.cells : null}
          onChangeTest={(id) => setParams({ test: String(id) })}
          onChangeGroup={(id) => setParams({ guruh: String(id) })}
          onSaved={onSaved}
          onLeave={() => {
            setSeed(null);
            setParams({ rejim: null });
          }}
          onMemberAdded={membersApi.add}
        />
      ) : (
        <UbResults
          {...common}
          legacyCount={testsApi.legacyCount}
          onChangeTest={(id) => setParams({ test: String(id) })}
          onChangeGroup={(id) => setParams({ guruh: String(id) })}
          onEnter={() => setParams({ rejim: "kiritish", test: testId === null ? null : String(testId), guruh: groupId === null ? null : String(groupId) }, true)}
          onImported={(cells) => {
            setSeed({ key: entryKey, cells });
            setParams({ rejim: "kiritish", test: testId === null ? null : String(testId), guruh: groupId === null ? null : String(groupId) }, true);
          }}
        />
      )}

      {testDialog && (
        <UbTestDialog
          test={testDialog.test}
          nextNo={nextNo}
          onClose={() => setTestDialog(null)}
          onSaved={(x) => {
            testsApi.upsert(x);
            if (testDialog.test) td.patchTest(x);
            else setParams({ test: String(x.id) });
          }}
          onDeleted={(id) => {
            testsApi.remove(id);
            if (id === testId) setParams({ test: null });
          }}
        />
      )}
    </>
  );
}
