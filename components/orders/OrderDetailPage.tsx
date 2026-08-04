"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AddOrderModal from "@/components/orders/AddOrderModal";
import OrderMessagePanel from "@/components/orders/OrderMessagePanel";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import RejectReasonModal from "@/components/orders/RejectReasonModal";
import BranchPickerModal from "@/components/orders/BranchPickerModal";
import { useOrders } from "@/components/orders/OrdersContext";
import { useToast } from "@/components/ui/Toast";

// Per-order detail page reached by clicking a row in the orders-list table
// (akademiya.edutizim.uz/orders/order-list/edit/... reference): student
// header strip + a single course/group row with accept/reject actions.
// Ported here (rather than left as a stub) now that the shared MongoDB-backed
// OrdersContext exists — both AddOrderModal invocations below write through
// the same createOrder/updateOrder as the list page's drawer.

// No real birthDate field exists anywhere (AddStudentModal captures one but
// it's never persisted onto Order) — this is a deterministic placeholder,
// same convention as genPhone/genDate elsewhere in this project for fields
// with no backend source yet.
function birthInfoFor(orderId: number): { date: string; age: number } {
  const today = new Date(2026, 6, 17);
  const age = 10 + (orderId % 40);
  const birthYear = today.getFullYear() - age;
  const month = orderId % 12;
  const day = 1 + (orderId % 28);
  const birth = new Date(birthYear, month, day);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${pad(birth.getDate())}.${pad(birth.getMonth() + 1)}.${birth.getFullYear()} | 00:00`, age };
}

export default function OrderDetailPage({ orderId }: { orderId: number }) {
  const { orders, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage } = useOrders();
  const { showSuccess, showError } = useToast();
  const order = orders.find((o) => o.id === orderId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

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

  const { date: birthDate, age } = birthInfoFor(order.id);
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
            {age} yosh ({birthDate})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-muted-foreground">Telefon raqam:</span> <span className="font-medium">{phone}</span>
          </div>
          <Button variant="primary">SMS yuborish</Button>
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
              <tr className="border-b border-border/50">
                <td className="px-3 py-3 whitespace-nowrap">{order.course || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{order.status || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{order.lessonDay || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{order.lessonStartTime || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setMessageOpen(true)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    + Izoh
                  </button>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{order.group || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{order.firstLesson || "—"}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGroupPickerOpen(true)}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium hover:bg-secondary"
                    >
                      ✓ Guruhga qo&apos;shish
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectOpen(true)}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-rose-300 text-rose-600 bg-card text-xs font-medium hover:bg-rose-50"
                    >
                      ✗ Rad etish
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
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

      {editOpen && (
        <AddOrderModal
          initialOrder={order}
          onClose={() => setEditOpen(false)}
          onSave={async (values) => {
            const updated = await updateOrder(order.id, values);
            if (updated) {
              showSuccess("Buyurtma muvaffaqiyatli yangilandi");
              setEditOpen(false);
            } else {
              showError("Buyurtmani yangilashda xatolik yuz berdi");
            }
          }}
        />
      )}

      {messageOpen && (
        <OrderMessagePanel
          order={order}
          messages={messagesByOrder[order.id] ?? []}
          onClose={() => setMessageOpen(false)}
          onSend={(text) => {
            addMessage(order.id, text);
            showSuccess("Izoh qo'shildi");
          }}
        />
      )}

      {groupPickerOpen && (
        <GroupPickerModal
          onClose={() => setGroupPickerOpen(false)}
          onSelect={async (group) => {
            const updated = await patchOrder(order.id, { status: "Qabul qilindi", group: String(group.id) });
            if (updated) {
              showSuccess("O'quvchi guruhga qo'shildi");
              setGroupPickerOpen(false);
            } else {
              showError("Guruhga qo'shishda xatolik yuz berdi");
            }
          }}
        />
      )}

      {rejectOpen && (
        <RejectReasonModal
          onClose={() => setRejectOpen(false)}
          onConfirm={async (reason) => {
            const note = [order.note, `Rad etish sababi: ${reason}`].filter(Boolean).join(" · ");
            const updated = await patchOrder(order.id, { status: "Bekor qilindi", note });
            if (updated) {
              showSuccess("Buyurtma rad etildi");
              setRejectOpen(false);
            } else {
              showError("Rad etishda xatolik yuz berdi");
            }
          }}
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
