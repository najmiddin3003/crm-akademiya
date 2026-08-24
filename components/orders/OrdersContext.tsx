"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { applyOrderValues, type NewOrderValues, type Order } from "@/lib/ordersData";
import { useToast } from "@/components/ui/Toast";
import type { OrderMessage } from "@/components/orders/OrderMessagePanel";

// Shared orders store for the orders-list route segment (mounted by
// app/(app)/orders-list/layout.tsx), backed by MongoDB via /api/orders. Both
// the list page and the order-detail page (/orders-list/[id]) read/write
// through this same context so a create/edit made on one is immediately
// visible on the other, and survives client-side navigation between them.

/**
 * Buyurtma hujjatida izohlar ham bor, ammo lib/ordersData.ts dagi `Order`
 * tipida bu maydon e'lon qilinmagan (u fayl bu agentga tegishli emas).
 * GET /api/orders butun hujjatni qaytargani uchun `comments` amalda keladi —
 * shu bois shu yerda mahalliy kengaytma tipi bilan o'qiymiz.
 */
type OrderWithComments = Order & { comments?: OrderMessage[] };

interface OrdersContextValue {
  orders: Order[];
  loading: boolean;
  createOrder: (values: NewOrderValues) => Promise<Order | null>;
  updateOrder: (id: number, values: NewOrderValues) => Promise<Order | null>;
  patchOrder: (id: number, patch: Partial<Order>) => Promise<Order | null>;
  /** Buyurtma izohlari (ro'yxatdagi xabar ikonkasi va detal sahifasidagi
   * "Izoh" paneli) — ikkala sahifa bir xil ipni ko'rsatishi uchun shu yerda.
   * MongoDB'dagi `orders.comments` massividan o'qiladi va
   * POST /api/orders/:id/comments orqali saqlanadi. */
  messagesByOrder: Record<number, OrderMessage[]>;
  /** Izohni serverga yozadi. `true` — saqlandi (chaqiruvchi shunda muvaffaqiyat
   * toastini ko'rsatadi); xato bo'lsa xabarni shu yerning o'zi ko'rsatadi. */
  addMessage: (orderId: number, text: string) => Promise<boolean>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesByOrder, setMessagesByOrder] = useState<Record<number, OrderMessage[]>>({});
  const { showError } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        const list = data.orders as OrderWithComments[];
        setOrders(list);
        // Izohlar buyurtma hujjatining ichida keladi — alohida so'rov shart
        // emas, va ro'yxat ham, detal sahifasi ham darhol to'liq ipni ko'radi.
        const byOrder: Record<number, OrderMessage[]> = {};
        for (const o of list) {
          if (Array.isArray(o.comments) && o.comments.length > 0) {
            byOrder[o.id] = o.comments.map((c) => ({ text: c.text, time: c.time }));
          }
        }
        setMessagesByOrder(byOrder);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createOrder = useCallback(async (values: NewOrderValues) => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.ok) return null;
      setOrders((prev) => [data.order as Order, ...prev]);
      return data.order as Order;
    } catch {
      // Tarmoq xatoligi (server o'chiq, internet uzilgan va h.k.) — fetch/json
      // o'zi reject qiladi, shu bois try/catch bilan null'ga tushiramiz, aks
      // holda chaqiruvchi tomondagi await/toast hech qachon ishlamas edi.
      return null;
    }
  }, []);

  const patchOrder = useCallback(async (id: number, patch: Partial<Order>) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) return null;
      setOrders((prev) => prev.map((o) => (o.id === id ? (data.order as Order) : o)));
      return data.order as Order;
    } catch {
      return null;
    }
  }, []);

  const updateOrder = useCallback(
    async (id: number, values: NewOrderValues) => {
      const current = orders.find((o) => o.id === id);
      if (!current) return null;
      return patchOrder(id, applyOrderValues(current, values));
    },
    [orders, patchOrder],
  );

  // Izohni SERVERGA yozadi. Ilgari bu funksiya faqat React holatini
  // o'zgartirardi — "Izoh qo'shildi" toasti chiqardi, lekin izoh hech qayerga
  // yozilmasdi va sahifa yangilanishi bilan yo'q bo'lardi.
  const addMessage = useCallback(
    async (orderId: number, text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      try {
        const res = await fetch(`/api/orders/${orderId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = await res.json();
        if (!data.ok) {
          showError((data.error as string) || "Izohni saqlab bo'lmadi");
          return false;
        }
        const saved = data.comment as OrderMessage;
        // Server qaytargan vaqt bilan qo'shamiz — mahalliy soatga tayanmaymiz,
        // shunda qayta yuklashdan keyin ham aynan shu vaqt ko'rinadi.
        setMessagesByOrder((prev) => ({
          ...prev,
          [orderId]: [...(prev[orderId] ?? []), { text: saved.text, time: saved.time }],
        }));
        return true;
      } catch {
        showError("Izohni saqlab bo'lmadi");
        return false;
      }
    },
    [showError],
  );

  return (
    <OrdersContext.Provider value={{ orders, loading, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
