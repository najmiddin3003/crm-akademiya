// Global qidiruv (navbar). Hozircha backend yo'q, shu bois qidiruv loyihadagi
// demo ma'lumotlar ustidan ishlaydi: o'quvchilar (constants/STUDENTS) va
// buyurtmalar (ordersData). Har qanday matn — ism, familiya, telefon, ID,
// kurs, o'qituvchi, status va h.k. — bo'yicha qidiradi (registrga bog'liq emas,
// bir nechta so'z kiritilsa hammasi mos kelishi kerak). Backend ulanganda
// buni real qidiruv API'siga almashtiramiz.

import { STUDENTS } from "@/constants";
import { createInitialOrders } from "@/lib/ordersData";

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

let cache: SearchRecord[] | null = null;

function buildIndex(): SearchRecord[] {
  if (cache) return cache;
  const recs: SearchRecord[] = [];

  for (const s of STUDENTS) {
    recs.push({
      result: {
        id: `student-${s.id}`,
        title: s.name,
        subtitle: `Birinchi dars · ${s.course} · ${s.phone}`,
        category: "O'quvchi",
        href: "/first-lessons",
      },
      haystack: [s.name, s.phone, s.id, s.teacher, s.course, s.level, s.moderator, s.day, s.status]
        .join(" ")
        .toLowerCase(),
    });
  }

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

export function searchAll(query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const out: SearchResult[] = [];
  for (const rec of buildIndex()) {
    if (terms.every((t) => rec.haystack.includes(t))) {
      out.push(rec.result);
      if (out.length >= limit) break;
    }
  }
  return out;
}
