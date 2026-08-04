"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { applyOrderValues, type NewOrderValues, type Order } from "@/lib/ordersData";
import type { OrderMessage } from "@/components/orders/OrderMessagePanel";

// Shared orders store for the orders-list route segment (mounted by
// app/(app)/orders-list/layout.tsx), backed by MongoDB via /api/orders. Both
// the list page and the order-detail page (/orders-list/[id]) read/write
// through this same context so a create/edit made on one is immediately
// visible on the other, and survives client-side navigation between them.

interface OrdersContextValue {
  orders: Order[];
  loading: boolean;
  createOrder: (values: NewOrderValues) => Promise<Order | null>;
  updateOrder: (id: number, values: NewOrderValues) => Promise<Order | null>;
  patchOrder: (id: number, patch: Partial<Order>) => Promise<Order | null>;
  /** Per-order comment thread (megaphone icon on the list, "+ Izoh" on the
   * detail page) — kept here so both surfaces show the same thread. Local
   * only for now, not persisted to the backend. */
  messagesByOrder: Record<number, OrderMessage[]>;
  addMessage: (orderId: number, text: string) => void;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setOrders(data.orders);
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

  const [messagesByOrder, setMessagesByOrder] = useState<Record<number, OrderMessage[]>>({});
  const addMessage = useCallback((orderId: number, text: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setMessagesByOrder((prev) => ({ ...prev, [orderId]: [...(prev[orderId] ?? []), { text, time }] }));
  }, []);

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
