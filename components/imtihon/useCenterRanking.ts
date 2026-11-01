"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/shared/Language";
import {
  facetCounts,
  matchesFacets,
  matchesQuery,
  podiumOf,
  rankPool,
  rankRows,
  rankStats,
  type FacetCount,
  type RankFacetKey,
  type RankFacets,
} from "@/lib/examRanking";
import type { GroupExam } from "@/lib/imtihon";
import { examGroupTitle } from "./sarhisobCore";

// MARKAZ REYTINGI — eski (SarhisobView) va yangi (v2/imtihon/SarhisobListV2) Sarhisob uchun
// umumiy holat; qoidalar lib/examRanking.ts da. Oy va fan — sahifaning o'zida (sarhisoblar
// ro'yxati bilan umumiy, ko'rinish almashganda saqlanadi); bosqich, ustoz, guruh, qidiruv va
// sahifalash — shu yerda. Filtr yoki qidiruv o'zgarsa sahifa 1-ga qaytadi.

export interface RankOption {
  value: string;
  label: string;
  /** Shu tanlovdagi natijalar soni (boshqa filtrlar qo'llangan holda). */
  hint: string;
}

export function useCenterRanking(live: GroupExam[], month: string, course: string, enabled: boolean) {
  const { t } = useT();
  const [level, setLevel] = useState("");
  const [teacher, setTeacher] = useState("");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);

  // Ro'yxat ko'rinishida hisoblanmaydi — 1 000+ natija har o'zgarishda qayta yig'ilmasin.
  const pool = useMemo(() => (enabled ? rankPool(live, month) : []), [enabled, live, month]);
  const facets = useMemo<RankFacets>(() => ({ course, level, teacher, group }), [course, level, teacher, group]);
  const ranked = useMemo(() => rankRows(pool.filter((r) => matchesFacets(r, facets))), [pool, facets]);
  const visible = useMemo(() => (query.trim() ? ranked.filter((r) => matchesQuery(r, query)) : ranked), [ranked, query]);
  const podium = useMemo(() => podiumOf(ranked), [ranked]);
  const stats = useMemo(() => rankStats(ranked), [ranked]);

  // Guruh nomi barcha sarhisoblardan — tanlangan guruh shu oyda bo'lmasa ham nomi bilan ko'rinsin.
  const groupNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of live) if (!m.has(String(e.groupId))) m.set(String(e.groupId), `${e.course} · ${examGroupTitle(e, t)}`);
    return m;
  }, [live, t]);

  const options = useMemo(() => {
    const counts = facetCounts(pool, facets);
    const label: Record<RankFacetKey, (v: string) => string> = {
      course: (v) => v,
      level: (v) => t(v),
      teacher: (v) => v,
      group: (v) => groupNames.get(v) ?? v,
    };
    const build = (key: RankFacetKey, list: FacetCount[]): RankOption[] =>
      list
        .map((o) => ({ value: o.value, label: label[key](o.value), hint: String(o.count) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    return {
      course: build("course", counts.course),
      level: build("level", counts.level),
      teacher: build("teacher", counts.teacher),
      group: build("group", counts.group),
    };
  }, [pool, facets, t, groupNames]);

  // Sahifa: filtr/qidiruv/oy o'zgarsa — 1-sahifa (effect'siz: kalit mos kelmasa 1).
  const resetKey = [month, course, level, teacher, group, query.trim(), pageSize].join("\u0001");
  const [pg, setPg] = useState({ key: resetKey, page: 1 });
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const page = pg.key === resetKey ? Math.min(pg.page, totalPages) : 1;
  const pageRows = useMemo(() => visible.slice((page - 1) * pageSize, page * pageSize), [visible, page, pageSize]);

  /** Bosqich, ustoz yoki guruh tanlangan (fan — sahifaning o'zida). */
  const facetsActive = Boolean(level || teacher || group);

  return {
    pool,
    ranked,
    visible,
    podium,
    stats,
    options,
    pageRows,
    level,
    setLevel,
    teacher,
    setTeacher,
    group,
    setGroup,
    query,
    setQuery,
    page,
    setPage: (p: number) => setPg({ key: resetKey, page: p }),
    pageSize,
    setPageSize,
    facetsActive,
    /** Bosqich, ustoz, guruh va qidiruvni tozalaydi. */
    clear: () => {
      setLevel("");
      setTeacher("");
      setGroup("");
      setQuery("");
    },
  };
}

export type CenterRanking = ReturnType<typeof useCenterRanking>;
