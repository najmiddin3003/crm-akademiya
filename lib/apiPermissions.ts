import {
  API_PERMISSIONS,
  PUBLIC_API,
  PUBLIC_API_METHODS,
  SHARED_API,
} from "./apiPermissions.generated";

// `/api/*` so'rovi uchun qanday tekshiruv kerakligini aytadi. Jadvalning
// o'zi generatsiya qilinadi (scripts/gen-api-permissions.mjs), bu yerda
// faqat moslashtirish mantig'i turadi.
//
// Ruxsat kaliti — sahifa pathname'i, ya'ni lib/permissions.ts dagi bilan
// bir xil alifbo. Route bir nechta sahifada ishlatilsa, xodimda ULARDAN
// BITTASI bo'lishi yetarli — aks holda, masalan, Guruhlarni ko'ra oladigan
// lekin Moliyani ko'rmaydigan xodim uchun umumiy `/api/groups` yopilib
// qolardi.

export type ApiAccess =
  | { kind: "public" }
  | { kind: "session" }
  | { kind: "permission"; anyOf: readonly string[] };

interface Entry {
  segments: string[];
  access: ApiAccess;
}

function toEntry(route: string, access: ApiAccess): Entry {
  return { segments: route.split("/").filter(Boolean), access };
}

const ENTRIES: Entry[] = [
  ...PUBLIC_API.map((r) => toEntry(r, { kind: "public" as const })),
  ...SHARED_API.map((r) => toEntry(r, { kind: "session" as const })),
  ...Object.entries(API_PERMISSIONS).map(([r, anyOf]) => toEntry(r, { kind: "permission" as const, anyOf })),
];

// Metod bo'yicha istisnolar segment ko'rinishida (bir marta tayyorlanadi).
const METHOD_ENTRIES = Object.entries(PUBLIC_API_METHODS).map(([r, methods]) => ({
  segments: r.split("/").filter(Boolean),
  methods: methods.map((m) => m.toUpperCase()),
}));

/**
 * Naqsh so'rov yo'liga mos keladimi. Segment soni TENG bo'lishi shart:
 * aks holda `/api/roles` naqshi `/api/roles/3` ni ham yutib yuborardi va
 * aniqroq `/api/roles/[id]` yozuvi hech qachon ishlamasdi.
 *
 * Qaytadi: mos kelmasa -1, mos kelsa — nechta LITERAL segment tutgani
 * (aniqlik darajasi; kattarog'i g'olib).
 */
function score(pattern: string[], parts: string[]): number {
  if (pattern.length !== parts.length) return -1;
  let literal = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith("[")) continue; // dinamik segment
    if (pattern[i] !== parts[i]) return -1;
    literal++;
  }
  return literal;
}

export function apiAccessFor(pathname: string, method: string): ApiAccess {
  const parts = pathname.split("/").filter(Boolean);

  const upper = method.toUpperCase();
  for (const m of METHOD_ENTRIES) {
    if (score(m.segments, parts) >= 0 && m.methods.includes(upper)) {
      return { kind: "public" };
    }
  }

  let best: ApiAccess | null = null;
  let bestScore = -1;
  for (const e of ENTRIES) {
    const s = score(e.segments, parts);
    if (s > bestScore) {
      bestScore = s;
      best = e.access;
    }
  }

  // Jadvalda yo'q route — YANGI qo'shilgan bo'lishi mumkin. Bunda sessiya
  // talab qilinadi, lekin ruxsat tekshirilmaydi.
  //
  // Ataylab "ochiq" tomonga xatolashamiz: teskarisi har bir yangi route'ni
  // jadvalga qo'shilgunicha 403 qilardi va bu tekshiruvni birinchi bo'lib
  // o'chirib tashlashga sabab bo'lardi. Drift'ni ko'rish uchun
  // `node scripts/gen-api-permissions.mjs` ni qayta ishga tushiring va
  // `git diff lib/apiPermissions.generated.ts` ga qarang.
  return best ?? { kind: "session" };
}
