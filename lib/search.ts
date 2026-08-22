// Global qidiruv (navbar). Har qanday matn — ism, familiya, telefon, ID,
// kurs, o'qituvchi, status va h.k. — bo'yicha qidiradi (registrga bog'liq
// emas, bir nechta so'z kiritilsa hammasi mos kelishi kerak).
//
// O'quvchilar HAQIQIY bazadan keladi: chaqiruvchi (Navbar → hooks/useStudents)
// ro'yxatni uzatadi, chunki bu funksiya klientda sinxron ishlaydi. Ilgari
// bu yerda constants/STUDENTS statik demo massivi o'qilardi.
// Buyurtmalar qismi hozircha eski demo generatordan (createInitialOrders) —
// u alohida ish, buyurtmalar sahifasining o'zi bazadan o'qiydi.

import { createInitialOrders } from "@/lib/ordersData";
import type { StudentRow } from "@/lib/studentsData";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  href: string;
}

interface SearchRecord {
  result: SearchResult;
  haystack: string;
}

function studentRecords(students: StudentRow[]): SearchRecord[] {
  return students.map((s) => ({
    result: {
      id: `student-${s.id}`,
      title: s.name,
      subtitle: `O'quvchi · ${s.phone || "telefon yo'q"}`,
      category: "O'quvchi",
      href: `/student-edit/${s.id}?src=list`,
    },
    haystack: [s.name, s.phone, s.id, s.moderator, s.source, s.category].join(" ").toLowerCase(),
  }));
}

let cache: SearchRecord[] | null = null;

/** Buyurtmalar indeksi — o'zgarmaydi, shu bois bir marta quriladi. */
function buildIndex(): SearchRecord[] {
  if (cache) return cache;
  const recs: SearchRecord[] = [];

  for (const o of createInitialOrders()) {
    recs.push({
      result: {
        id: `order-${o.id}`,
        title: o.name,
        subtitle: `Buyurtma · ${o.course} · ${o.phone}`,
        category: "Buyurtma",
        href: "/orders-list",
      },
      haystack: [o.name, o.phone, o.id, o.teacher, o.course, o.level, o.moderator, o.group, o.status, o.source, o.category]
        .join(" ")
        .toLowerCase(),
    });
  }

  cache = recs;
  return recs;
}

export function searchAll(query: string, students: StudentRow[] = [], limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const out: SearchResult[] = [];
  for (const rec of [...studentRecords(students), ...buildIndex()]) {
    if (terms.every((t) => rec.haystack.includes(t))) {
      out.push(rec.result);
      if (out.length >= limit) break;
    }
  }
  return out;
}
