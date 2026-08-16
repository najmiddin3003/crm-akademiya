"use client";

import { useState } from "react";
import { ORDER_STAGES, type Order, type OrderStageKey } from "@/lib/ordersData";

// Ported from crm-akademiya/src/app.js renderOrdersKanban()/renderOrderKanbanCard()
// and the onOrderCardDragStart/onStageDrop family (~lines 24065-24598).

export interface OrdersKanbanProps {
  orders: Order[];
  onDropStage: (orderId: number, stage: OrderStageKey) => void;
}

export default function OrdersKanban({ orders, onDropStage }: OrdersKanbanProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStageKey | null>(null);

  const byStage: Record<OrderStageKey, Order[]> = { bir_oylay: [], jaylang_e: [], rahmaaaat: [], ketdim: [] };
  for (const o of orders) (byStage[o.stage] || byStage.bir_oylay).push(o);

  return (
    <div className="orders-kanban-grid">
      {ORDER_STAGES.map((st) => (
        <div key={st.key} className={`ok-column ok-stage-${st.key}`}>
          <div className="ok-column-header">
            <span className="ok-column-emoji">{st.emoji}</span>
            <div className="flex flex-col items-center">
              <span className="ok-column-title">{st.uppercase}</span>
              <span className="ok-column-count">{byStage[st.key].length} Lidlar</span>
            </div>
          </div>
          <div
            className={`ok-cards ${dropTarget === st.key ? "ok-drop-target" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDropTarget(st.key); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setDropTarget(null);
              const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
              if (id) onDropStage(id, st.key);
            }}
          >
            {byStage[st.key].length === 0 ? (
              <div className="ok-empty">Bo&apos;sh</div>
            ) : (
              byStage[st.key].map((o) => (
                <div
                  key={o.id}
                  className={`ok-card ${draggingId === o.id ? "ok-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(o.id)); e.dataTransfer.effectAllowed = "move"; setDraggingId(o.id); }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <div className="ok-card-row1">
                    <div className="ok-card-title">
                      {o.name}<span className="course">, {o.course}</span>
                    </div>
                    <div className="ok-card-day-badge">{o.dayPattern}</div>
                  </div>
                  <div className="ok-card-teacher">{o.teacher || "—"}</div>
                  <div className="ok-card-row3">
                    {/* Referens kartasida sana va vaqt oddiy probel bilan
                        ajratiladi ("03.10.2025 15:04"), jadvaldagi kabi "|"
                        bilan emas — manba ma'lumoti o'zgarmaydi. */}
                    <span>{o.created.replace(" | ", " ")}</span>
                    <span className="ok-card-task-status">{o.taskStatus}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
