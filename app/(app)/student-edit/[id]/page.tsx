import StudentEditPage from "@/components/students/StudentEditPage";
import { createInitialOrders, type Order } from "@/lib/ordersData";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { getServerT } from "@/lib/serverT";

// O'quvchi profili ikki xil ro'yxatdan ochilishi mumkin:
//   • Buyurtmalar (lib/ordersData.ts demo generatori, id 2098-6013)
//   • O'quvchilar ro'yxati / Kassalar to'lov qatorlari — BAZADAGI o'quvchilar
//     (MongoDB `pupils`)
// Ikki id fazosi KESISHADI, shuning uchun havolaga `?src=list` qo'shiladi —
// shunda bir xil id ikkala ro'yxatda ham bo'lsa, mo'ljallangani ochiladi
// (aks holda noto'g'ri odam ochilib, buni hech kim sezmaydi).
async function orderFromPupil(id: number): Promise<Order | null> {
  if (!Number.isFinite(id)) return null;
  // FILIAL QAMROVI: boshqa filialning o'quvchisi bu sahifada ochilmaydi —
  // `/api/pupils/:id` bilan bir xil qoida, aks holda ro'yxatdan yashiringan
  // odam manzilni qo'lda yozib ochilaverardi.
  const scope = await getBranchScope();
  if (!scope) return null;
  const db = await ensureIndexes();
  const doc = await db.collection("pupils").findOne(withPupilBranch({ id }, scope));
  if (!doc) return null;
  const p = doc as unknown as Pupil;
  // StudentEditPage `Order` kutadi — mavjud maydonlarni ko'chiramiz,
  // qolganini bo'sh qoldiramiz (o'ylab topilgan qiymat yozmaymiz).
  return {
    id: p.id,
    name: pupilFullName(p),
    phone: p.phone ?? "",
    created: p.createdAt ?? "",
    moderator: p.moderator ?? "",
    source: p.source ?? "",
    group: "",
    firstLesson: "",
    teacher: "",
    course: "",
    level: "",
    note: "",
    status: "",
    subsource: "",
    fromBranch: "",
    toBranch: "",
    category: p.category ?? "",
    survey: "",
    subcourse: "",
    // O'quvchilar ro'yxatida bosqich tushunchasi yo'q — birinchisini
    // qo'yamiz (Order tipi majburiy qiladi, profil sahifasi ishlatmaydi).
    stage: "bir_oylay",
    dayPattern: "",
    taskStatus: "",
    referral: "",
    lessonDay: "",
    lessonStartTime: "",
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { src, tab } = await searchParams;
  const numId = Number(id);

  const fromOrders = () => createInitialOrders().find((o) => String(o.id) === id) ?? null;
  const order = src === "list"
    ? (await orderFromPupil(numId)) ?? fromOrders()
    : fromOrders() ?? (await orderFromPupil(numId));

  if (!order) {
    const { t } = await getServerT();
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          {t("O'quvchi topilmadi:")} <strong>{id}</strong>
        </p>
      </div>
    );
  }

  return <StudentEditPage order={order} initialTab={tab} />;
}
