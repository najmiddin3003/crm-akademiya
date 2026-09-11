import type { Db } from "mongodb";
import { ARCHIVED_GROUPS_COLLECTION } from "@/lib/groups";

/**
 * Keyingi guruh `id`si — `groups` VA arxiv bo'yicha eng kattasi + 1.
 *
 * Ilgari faqat `groups` dagi maksimum olinardi. 11.09.2026 da barcha
 * guruhlar arxivga ko'chirilgach kolleksiya bo'shadi va o'sha mantiq
 * yangi guruhga id=1 berar edi — arxivdagi 1-guruh bilan bir xil raqam.
 * `orders.group` kabi joylar guruhni nomi bilan eslaydi, lekin id ham
 * hisobotlar va manzillarda (/groups/1) yuradi — ikki xil guruh bitta
 * raqam ostida bo'lmasligi kerak. Raqamlash arxivdan davom etadi (111…).
 *
 * Ikkala so'rov ham `{ id: 1 }` indeksidan foydalanadi — bitta hujjat
 * o'qiladi, kolleksiya to'liq aylanmaydi.
 */
export async function nextGroupId(db: Db): Promise<number> {
  const maxIdOf = async (collection: string) => {
    const [last] = await db
      .collection(collection)
      .find({}, { projection: { _id: 0, id: 1 } })
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    return Number(last?.id) || 0;
  };
  const [live, archived] = await Promise.all([maxIdOf("groups"), maxIdOf(ARCHIVED_GROUPS_COLLECTION)]);
  return Math.max(live, archived) + 1;
}
