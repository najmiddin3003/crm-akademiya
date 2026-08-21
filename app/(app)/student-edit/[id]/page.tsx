import StudentEditPage from "@/components/students/StudentEditPage";
import { createInitialOrders, type Order } from "@/lib/ordersData";
import { STUDENTS_LIST } from "@/constants/studentsList";

// O'quvchi profili ikki xil ro'yxatdan ochilishi mumkin:
//   • Buyurtmalar (lib/ordersData.ts, id 2098-6013)
//   • O'quvchilar ro'yxati / Kassalar to'lov qatorlari
//     (constants/studentsList.js, id 823-6731)
// Ikki id fazosi KESISHADI, shuning uchun havolaga `?src=list` qo'shiladi —
// shunda 4206 kabi id ikkala ro'yxatda ham bo'lsa, mo'ljallangani ochiladi
// (aks holda noto'g'ri odam ochilib, buni hech kim sezmaydi).
function orderFromStudentsList(id: number): Order | null {
  const s = STUDENTS_LIST.find((x) => x.id === id);
  if (!s) return null;
  // StudentEditPage `Order` kutadi — mavjud maydonlarni ko'chiramiz,
  // qolganini bo'sh qoldiramiz (o'ylab topilgan qiymat yozmaymiz).
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    created: s.createdAt,
    moderator: s.moderator,
    source: s.source,
    group: s.groups === "-" ? "" : s.groups,
    firstLesson: "",
    teacher: "",
    course: "",
    level: "",
    note: "",
    status: "",
    subsource: "",
    fromBranch: "",
    toBranch: "",
    category: "",
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
  searchParams: Promise<{ src?: string }>;
}) {
  const { id } = await params;
  const { src } = await searchParams;
  const numId = Number(id);

  const fromOrders = () => createInitialOrders().find((o) => String(o.id) === id) ?? null;
  const order = src === "list"
    ? orderFromStudentsList(numId) ?? fromOrders()
    : fromOrders() ?? orderFromStudentsList(numId);

  if (!order) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          O&apos;quvchi topilmadi: <strong>{id}</strong>
        </p>
      </div>
    );
  }

  return <StudentEditPage order={order} />;
}
