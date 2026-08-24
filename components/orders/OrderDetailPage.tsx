"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AddOrderModal from "@/components/orders/AddOrderModal";
import OrderMessagePanel from "@/components/orders/OrderMessagePanel";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import RejectReasonModal from "@/components/orders/RejectReasonModal";
import BranchPickerModal from "@/components/orders/BranchPickerModal";
import SmsModal from "@/components/orders/SmsModal";
import { useOrders } from "@/components/orders/OrdersContext";
import { usePupils } from "@/components/orders/PupilsContext";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useToast } from "@/components/ui/Toast";
import type { Order } from "@/lib/ordersData";
import type { Group } from "@/lib/groups";
import { enrollOrderInGroup, findPupilForOrder } from "@/lib/enrollStudent";

// Per-order detail page reached by clicking a row in the orders-list table
// (akademiya.edutizim.uz/orders/order-list/edit/... reference): student
// header strip + o'quvchining BARCHA buyurtmalari. Referensda bir o'quvchi
// bir nechta fanga yozilgan bo'lsa, hammasi alohida qator bo'lib chiqadi —
// ilgari bizda faqat ochilgan bittasi ko'rinardi.
//
// Ported here (rather than left as a stub) now that the shared MongoDB-backed
// OrdersContext exists — both AddOrderModal invocations below write through
// the same createOrder/updateOrder as the list page's drawer.

// Tug'ilgan sana o'quvchi kartasidan (`pupils.birthDate`, "YYYY-MM-DD" —
// AddStudentModal kiritadi). Buyurtma o'quvchiga telefon/ism orqali
// bog'lanadi (findPupilForOrder). Ilgari bu yerda sana buyurtma id'sidan
// o'ylab topilardi (`10 + orderId % 40` yosh), ya'ni ekranda hech kimga
// tegishli bo'lmagan tug'ilgan kun turardi.
function birthInfoOf(birthDate: string | undefined): { date: string; age: number | null } | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${pad(birth.getDate())}.${pad(birth.getMonth() + 1)}.${birth.getFullYear()}`;
  // Kelajakdagi sana kiritilgan bo'lsa yosh ma'nosiz ("-1 yosh") — sanani
  // ko'rsatamiz, yoshni esa yashiramiz.
  return { date, age: age < 0 ? null : age };
}

const digitsOf = (s: string) => (s || "").replace(/\D/g, "");

/**
 * Buyurtma o'quvchiga id bilan bog'lanmagan (Order'da studentId maydoni yo'q),
 * shu bois telefon raqami bo'yicha, u yo'q bo'lsa ism bo'yicha guruhlanadi.
 * Ikkalasida ham telefon bo'lmasa, bir xil ismli ikki o'quvchi bitta
 * sanalishi mumkin.
 */
function sameStudent(a: Order, b: Order): boolean {
  const pa = digitsOf(a.phone);
  const pb = digitsOf(b.phone);
  if (pa && pb) return pa === pb;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

export default function OrderDetailPage({ orderId }: { orderId: number }) {
  const { orders, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage } = useOrders();
  const { pupils } = usePupils();
  // Fan nomini O'quv bo'limi > Oflayn kurslardagi kurs kartasiga bog'lash uchun.
  const { courses } = useOfflineCourseList();
  const { showSuccess, showError } = useToast();
  const order = orders.find((o) => o.id === orderId);
  const [createOpen, setCreateOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  // Quyidagilar QATOR bo'yicha ochiladi — qaysi buyurtma ustida ish
  // ketayotganini id saqlaydi.
  const [editId, setEditId] = useState<number | null>(null);
  const [messageId, setMessageId] = useState<number | null>(null);
  const [groupPickerId, setGroupPickerId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  if (!order) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          Buyurtma topilmadi: <strong>{orderId}</strong>
        </p>
        <Link href="/orders-list" className="text-primary hover:underline">
          Buyurtmalar ro&apos;yxatiga qaytish
        </Link>
      </div>
    );
  }

  // Shu o'quvchining buyurtmalari. Guruhga ALLAQACHON qo'shilganlari
  // (groupId yozilgan) bu yerda ko'rsatilmaydi — ular endi lid emas.
  const studentOrders = orders
    .filter((o) => sameStudent(o, order) && !o.groupId)
    .sort((a, b) => a.id - b.id);

  const rowOf = (id: number | null) => (id === null ? undefined : orders.find((o) => o.id === id));
  const editOrder = rowOf(editId);
  const messageOrder = rowOf(messageId);

  /**
   * Fan nomi bosilganda ochiladigan manzil. Kurs Oflayn kurslar ro'yxatida
   * bo'lsa — o'sha kursning tahrirlash sahifasi; hali bo'lmasa — nomi
   * oldindan to'ldirilgan "kurs qo'shish" sahifasi (Saqlash bazaga yozadi).
   */
  const courseHref = (courseName: string): string => {
    const found = courses.find((c) => c.name.trim().toLowerCase() === courseName.trim().toLowerCase());
    return found ? `/offline-courses/${found.id}/edit` : `/offline-courses/add?name=${encodeURIComponent(courseName)}`;
  };

  /**
   * "Guruhga qo'shish": lidni haqiqiy o'quvchiga aylantirib tanlangan
   * guruhga yozadi (lib/enrollStudent.ts), so'ng buyurtmaga groupId
   * qo'yadi — shundan keyin qator bu sahifada ko'rinmaydi.
   */
  const handleAddToGroup = async (group: Group) => {
    const rowId = groupPickerId;
    const row = rowOf(rowId);
    if (rowId === null || !row) return;
    const groupLabel = group.name || String(group.id);

    const res = await enrollOrderInGroup(row, group.id, pupils);
    if (!res.ok) {
      showError(res.error || "Guruhga qo'shishda xatolik yuz berdi");
      return;
    }

    const updated = await patchOrder(rowId, {
      status: "Qabul qilindi",
      group: groupLabel,
      groupId: group.id,
    });
    if (!updated) {
      showError("Buyurtma holatini saqlashda xatolik yuz berdi");
      return;
    }

    showSuccess(`O'quvchi "${groupLabel}" guruhiga qo'shildi`);
    setGroupPickerId(null);
  };

  const birthInfo = birthInfoOf(findPupilForOrder(order, pupils)?.birthDate);
  const phone = order.phone ? `+998${order.phone.replace(/\s/g, "")}` : "—";

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Buyurtma yaratish
        </Button>
        <Button variant="outline" onClick={() => setBranchPickerOpen(true)}>
          Transfer
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">O&apos;quvchini ismi:</span>{" "}
          <Link href={`/student-edit/${order.id}`} className="font-medium hover:text-primary hover:underline">
            {order.name}
          </Link>
        </div>
        <div>
          <span className="text-muted-foreground">Tug&apos;ilgan sanasi:</span>{" "}
          <span className="font-medium">
            {!birthInfo ? "—" : birthInfo.age === null ? birthInfo.date : `${birthInfo.age} yosh (${birthInfo.date})`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-muted-foreground">Telefon raqam:</span> <span className="font-medium">{phone}</span>
          </div>
          <Button variant="primary" onClick={() => setSmsOpen(true)}>
            SMS yuborish
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap">Ism</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh holati</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kun</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs vaqti</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh nomi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Birinchi darsga kelish sanasi</th>
                <th className="text-right px-3 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {studentOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    Bu o&apos;quvchining barcha buyurtmalari guruhga qo&apos;shilgan.
                  </td>
                </tr>
              )}
              {studentOrders.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.course ? (
                      <Link href={courseHref(row.course)} className="hover:text-primary hover:underline">
                        {row.course}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.status || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.lessonDay || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.lessonStartTime || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setMessageId(row.id)}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      + Izoh
                    </button>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.group || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.firstLesson || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGroupPickerId(row.id)}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium hover:bg-secondary"
                      >
                        ✓ Guruhga qo&apos;shish
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectId(row.id)}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-rose-300 text-rose-600 bg-card text-xs font-medium hover:bg-rose-50"
                      >
                        ✗ Rad etish
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(row.id)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Tahrirlash"
                      >
                        <svg className="icon icon-xs">
                          <use href="#i-edit" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <AddOrderModal
          initialStudentName={order.name}
          initialStudentPhone={order.phone}
          onClose={() => setCreateOpen(false)}
          onSave={async (values) => {
            const created = await createOrder(values);
            if (created) {
              showSuccess("Buyurtma muvaffaqiyatli yaratildi");
              setCreateOpen(false);
            } else {
              showError("Buyurtma yaratishda xatolik yuz berdi");
            }
          }}
        />
      )}

      {editOrder && (
        <AddOrderModal
          initialOrder={editOrder}
          onClose={() => setEditId(null)}
          onSave={async (values) => {
            const updated = await updateOrder(editOrder.id, values);
            if (updated) {
              showSuccess("Buyurtma muvaffaqiyatli yangilandi");
              setEditId(null);
            } else {
              showError("Buyurtmani yangilashda xatolik yuz berdi");
            }
          }}
        />
      )}

      {messageOrder && (
        <OrderMessagePanel
          order={messageOrder}
          messages={messagesByOrder[messageOrder.id] ?? []}
          onClose={() => setMessageId(null)}
          onSend={async (text) => {
            // addMessage HAQIQIY so'rov (POST /api/orders/:id/comments) va u
            // muvaffaqiyatsiz tugashi mumkin (404, 400, tarmoq uzilishi).
            // Ilgari u await QILINMASDI va "Izoh qo'shildi" toasti SHARTSIZ
            // chiqardi: yozuv tushmagan holatda foydalanuvchi bir vaqtda ham
            // kontekstning xato toastini, ham muvaffaqiyat toastini ko'rardi.
            // Endi natija kutiladi va muvaffaqiyat faqat izoh haqiqatan
            // saqlangandagina aytiladi (xato xabarini OrdersContext o'zi
            // ko'rsatadi, shu bois bu yerda takrorlanmaydi).
            const saved = await addMessage(messageOrder.id, text);
            if (saved) showSuccess("Izoh qo'shildi");
          }}
        />
      )}

      {groupPickerId !== null && (
        <GroupPickerModal onClose={() => setGroupPickerId(null)} onSelect={handleAddToGroup} />
      )}

      {rejectId !== null && (
        <RejectReasonModal
          onClose={() => setRejectId(null)}
          onConfirm={async (reason) => {
            const target = rowOf(rejectId);
            const note = [target?.note, `Rad etish sababi: ${reason}`].filter(Boolean).join(" · ");
            const updated = await patchOrder(rejectId, { status: "Bekor qilindi", note });
            if (updated) {
              showSuccess("Buyurtma rad etildi");
              setRejectId(null);
            } else {
              showError("Rad etishda xatolik yuz berdi");
            }
          }}
        />
      )}

      {smsOpen && (
        <SmsModal
          studentName={order.name}
          phone={order.phone}
          onClose={() => setSmsOpen(false)}
          onSent={({ simulated }) => {
            // simulated = Eskiz sozlanmagan, SMS real jo'natilmadi (faqat
            // server konsoliga chiqdi va jurnalga yozildi) — buni yashirmaymiz.
            if (simulated) showError("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else showSuccess("SMS yuborildi");
            setSmsOpen(false);
          }}
          onError={showError}
        />
      )}

      {branchPickerOpen && (
        <BranchPickerModal
          onClose={() => setBranchPickerOpen(false)}
          onSelect={async (branch) => {
            const updated = await patchOrder(order.id, { toBranch: branch });
            if (updated) {
              showSuccess("Filialga muvaffaqiyatli o'tkazildi");
              setBranchPickerOpen(false);
            } else {
              showError("Filialga o'tkazishda xatolik yuz berdi");
            }
          }}
        />
      )}
    </div>
  );
}
