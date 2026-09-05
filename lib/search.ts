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
import { searchPhoneDigits } from "@/lib/phoneSearch";
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
  /**
   * Telefon raqami — FAQAT raqamlar, ajratkichlarsiz.
   *
   * NIMA NOTO'G'RI EDI: bazada raqam "94 111 88 55" ko'rinishida saqlanadi
   * va bu yerdagi filtr oddiy `includes` bilan ishlardi. Ya'ni "1118855"
   * deb qidirilganda server o'quvchini TO'G'RI topardi (u ajratkichga
   * chidamli naqsh ishlatadi), klient esa uni shu qatorda tashlab
   * yuborardi — ekranda "Natija topilmadi" chiqardi. O'lchandi: server 1
   * ta yozuv qaytargan, ekranga 0 ta chiqqan.
   *
   * Ism va ID ni bu yerga QO'SHIB BO'LMAYDI: raqamlar ajratkichsiz
   * yopishib qolardi va "13947" + "941118855" birlashib, chegaradan
   * o'tuvchi soxta mosliklar berardi.
   */
  phoneDigits: string;
}

const digitsOf = (v: unknown) => String(v ?? "").replace(/\D/g, "");

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
    phoneDigits: digitsOf(s.phone),
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
      phoneDigits: digitsOf(o.phone),
    });
  }

  cache = recs;
  return recs;
}

export function searchAll(query: string, students: StudentRow[] = [], limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  // RAQAMLI so'rov BUTUNLIGICHA solishtiriladi, so'zlarga bo'linmasdan:
  // "94 111 88 55" to'rtta bo'lakka bo'linsa, "94" hamma 94-raqamli
  // o'quvchiga mos kelib ketardi. Server ham aynan shunday qiladi
  // (app/api/search/students/route.ts → `digitsOnly`).
  const digitsOnly = /^[\d\s()+-]+$/.test(q);
  const wholePhone = digitsOnly ? searchPhoneDigits(q) : null;

  const out: SearchResult[] = [];
  for (const rec of [...studentRecords(students), ...buildIndex()]) {
    const hit = wholePhone
      ? rec.phoneDigits.includes(wholePhone)
      : terms.every((t) => {
          if (rec.haystack.includes(t)) return true;
          // Aralash so'rovda ("ali 9415") raqamli bo'lak telefonga ham
          // urinib ko'rsin — serverdagi bilan bir xil qoida.
          const d = searchPhoneDigits(t);
          return d !== null && rec.phoneDigits.includes(d);
        });
    if (hit) {
      out.push(rec.result);
      if (out.length >= limit) break;
    }
  }
  return out;
}
