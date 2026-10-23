"use client";

import { useCallback, useEffect, useState } from "react";
import type { PupilProfilePayload } from "@/lib/pupilProfile";

// YANGI VERSIYA — O'QUVCHI SAHIFASINING MA'LUMOTI: bitta so'rov
// (GET /api/pupils/:id/profile). `reload()` — to'lov, guruh, holat yoki tahrirdan
// keyin; qayta yuklanayotganda eski ma'lumot ko'rinib turadi (sahifa skeletga
// qaytib «sakramasin»), yangisi kelgach almashadi.

export type ProfileState =
  | { kind: "loading" }
  | { kind: "ok"; data: PupilProfilePayload }
  | { kind: "notfound" }
  | { kind: "error" };

export function useStudentProfile(id: number) {
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let off = false;
    fetch(`/api/pupils/${id}/profile`, { cache: "no-store" })
      .then(async (r) => ({ status: r.status, d: (await r.json().catch(() => null)) as PupilProfilePayload | { ok: false } | null }))
      .then(({ status, d }) => {
        if (off) return;
        if (d && d.ok) setState({ kind: "ok", data: d });
        // Qayta yuklashda xato bo'lsa — eski ma'lumot qoladi (xabar chaqiruvchida).
        else setState((cur) => (cur.kind === "ok" ? cur : status === 404 ? { kind: "notfound" } : { kind: "error" }));
      })
      .catch(() => {
        if (!off) setState((cur) => (cur.kind === "ok" ? cur : { kind: "error" }));
      });
    return () => {
      off = true;
    };
  }, [id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
