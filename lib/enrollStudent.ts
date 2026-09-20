import type { Order } from "@/lib/ordersData";
import { pupilFullName, type Pupil, type PupilListItem } from "@/lib/pupilsData";
import { invalidateStudents, loadPupilsCached } from "@/hooks/useStudents";
import { SOURCE_FROM_ORDER } from "@/constants";

// Lidni (buyurtmani) haqiqiy o'quvchiga aylantirib guruhga yozish.
//
// Ikki joydan chaqiriladi — buyurtma detali sahifasidagi "Guruhga qo'shish"
// tugmasi va Birinchi darsga yozilganlar sahifasidagi "⋮" menyusi — shu bois
// mantiq shu yerda, klientdan mustaqil (kontekstga bog'liq emas) yozilgan.

const digitsOf = (s: string) => (s || "").replace(/\D/g, "");

/** Buyurtmadagi o'quvchini `pupils` ichidan topadi (telefon, bo'lmasa ism). */
// Generik: chaqiruvchi boyroq tur bersa (masalan `birthDate` bilan), javob
// ham o`sha turda qaytadi — `PupilListItem` ga qisilib qolmaydi.
export function findPupilForOrder<T extends PupilListItem>(order: Order, pupils: T[]): T | undefined {
  const phone = digitsOf(order.phone);
  if (phone) {
    const byPhone = pupils.find((p) => digitsOf(p.phone) === phone);
    if (byPhone) return byPhone;
  }
  const name = order.name.trim().toLowerCase();
  return pupils.find((p) => pupilFullName(p).toLowerCase() === name);
}

export interface EnrollResult {
  ok: boolean;
  error?: string;
  pupil?: PupilListItem;
  /** O'quvchi shu chaqiruvda yangi yaratilgan bo'lsa true. */
  created?: boolean;
}

/**
 * O'quvchini guruhga qo'shadi:
 *   1) `pupils` ichidan topadi; topilmasa lid ma'lumotidan yangisini yaratadi;
 *   2) POST /api/groups/:id/students orqali guruhga yozadi.
 *
 * Buyurtmaning o'zini yangilash (status/group/groupId) CHAQIRUVCHI zimmasida —
 * har bir sahifa buni o'z holatiga mos ravishda qiladi.
 *
 * @param knownPupils allaqachon yuklangan o'quvchilar (berilmasa API'dan olinadi)
 */
export async function enrollOrderInGroup(
  order: Order,
  groupId: number,
  knownPupils?: PupilListItem[],
): Promise<EnrollResult> {
  let pupils = knownPupils;
  if (!pupils) {
    try {
      pupils = await loadPupilsCached(true);
    } catch {
      return { ok: false, error: "O'quvchilar ro'yxatini olib bo'lmadi" };
    }
  }

  let pupil = findPupilForOrder(order, pupils);
  let created = false;
  if (!pupil) {
    const [firstName, ...rest] = order.name.trim().split(/\s+/);
    const res = await fetch("/api/pupils", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName || order.name.trim(),
        lastName: rest.join(" "),
        phone: order.phone || "",
        extraPhone: "",
        category: order.category || "",
        birthDate: "",
        // Manba POST /api/pupils da MAJBURIY. Bu yerda o'quvchi lid
        // (buyurtma) dan avtomatik yaratilyapti, ya'ni so'raydigan forma
        // yo'q — qat'iy qiymat yoziladi.
        //
        // `order.source` KO'CHIRILMAYDI: uning lug'ati butunlay boshqa
        // (lib/ordersData.ts → ORDER_SOURCES = bot/interface/kommo/
        // survey/tilda) va u lid CRM'ga qaysi KANAL orqali tushganini
        // bildiradi, o'quvchi markazni qayerdan eshitganini emas.
        // Ko'chirilsa "Manba" filtrida `bot`, `tilda` kabi begona
        // variantlar paydo bo'lardi.
        source: SOURCE_FROM_ORDER,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) return { ok: false, error: res?.error || "O'quvchini yaratishda xatolik yuz berdi" };
    pupil = res.pupil as Pupil;
    created = true;
    invalidateStudents(); // yangi o'quvchi qo'shildi -> umumiy kesh bekor
  }

  // Darslar qaysi kundan sanaladi (Qarzdorlar hisoboti, lib/groupMembership.ts):
  // lidning "Birinchi dars" sanasi bo'lsa — o'sha ("29.08.2026 | 10:00" →
  // "2026-08-29"), bo'lmasa server bugunni yozadi.
  const m = (order.firstLesson || "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  const joinedAt = m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
  const res = await fetch(`/api/groups/${groupId}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pupilId: pupil.id, joinedAt }),
  })
    .then((r) => r.json())
    .catch(() => null);
  if (!res?.ok) return { ok: false, error: res?.error || "Guruhga qo'shishda xatolik yuz berdi" };

  return { ok: true, pupil, created };
}
