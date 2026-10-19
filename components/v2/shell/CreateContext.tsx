"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import CashOperationModalV2 from "@/components/v2/finance/CashOperationModalV2";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import NewStudentDrawerV2 from "@/components/v2/students/NewStudentDrawerV2";
import { emitMoneyChanged, emitPupilCreated } from "./v2Events";

// YANGI VERSIYA: «+ YANGI» — FORMANI SHU JOYDA OCHISH (rasm «+ Yangi» menyusi,
// 19.10.2026): «O'quvchi» — o'ngdan panel, «To'lov qabul qilish» va «Kassa
// amali» — markazda; sahifadan ketilmaydi. Formalar qobiqda turadi, saqlangach
// sahifalar ./v2Events.ts orqali yangilanadi. Lid, Topshiriq va rahbar bandlari —
// o'z sahifasida (TopbarV2 → havola).

export type CreateKind = "student" | "payment" | "cash";

const CreateCtx = createContext<{ open: (kind: CreateKind) => void }>({ open: () => {} });

export function useCreate() {
  return useContext(CreateCtx);
}

export function CreateProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<CreateKind | null>(null);
  const value = useMemo(() => ({ open: (k: CreateKind) => setKind(k) }), []);
  const close = () => setKind(null);
  return (
    <CreateCtx.Provider value={value}>
      {children}
      {kind === "student" && <NewStudentDrawerV2 onClose={close} onSaved={(pupil, groupId) => emitPupilCreated(pupil, groupId)} />}
      {kind === "payment" && <StudentPaymentModalV2 onClose={close} onSaved={() => emitMoneyChanged()} />}
      {kind === "cash" && <CashOperationModalV2 onClose={close} onSaved={() => emitMoneyChanged()} />}
    </CreateCtx.Provider>
  );
}
