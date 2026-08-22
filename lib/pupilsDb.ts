// O'quvchilar bo'yicha SERVER tomonidagi yordamchilar (MongoDB `pupils`).
//
// lib/pupilsData.ts klientda ham import qilinadi, shuning uchun mongodb'ga
// bog'liq kod shu yerda alohida turadi.
//
// Moliya yozuvlari (bonus, jarima, tranzaksiya) o'quvchining id'sini emas,
// faqat ISMINI saqlaydi — shu bois qidiruv ism bo'yicha, katta-kichik harf va
// ortiqcha bo'shliqni hisobga olmagan holda ketadi (klientdagi
// hooks/useStudents.ts → byName bilan bir xil qoida).

import type { Db } from "mongodb";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";

export async function findPupilByName(db: Db, name: string): Promise<Pupil | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const rows = await db.collection("pupils").find({}).toArray();
  const hit = rows.find((r) => pupilFullName(r as unknown as Pupil).toLowerCase() === wanted);
  return hit ? ({ ...hit, _id: undefined } as unknown as Pupil) : null;
}

/** O'quvchi kartasidagi balans; o'quvchi topilmasa 0. */
export async function pupilBalanceByName(db: Db, name: string): Promise<number> {
  const pupil = await findPupilByName(db, name);
  return Number(pupil?.balance) || 0;
}
