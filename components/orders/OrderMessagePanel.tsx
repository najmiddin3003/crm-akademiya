"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { Order } from "@/lib/ordersData";

// "Izoh" (megaphone) tugmasi bosilganda o'ng-pastki burchakda ochiladigan kichik
// izoh/chat oynasi (akademiya.edutizim.uz referens skrinshotiga mos): sarlavhada
// tanlangan o'quvchi ismi, tanasida yuborilgan izohlar ro'yxati, pastda yozish
// maydoni + yumaloq yuborish tugmasi. Fixed o'lcham/joylashuv inline style bilan
// berilgan — globals.css'dagi pre-compiled Tailwind blobida w-80/h-96/bottom-5/
// right-5 kabi utilitylar mavjud emas (bracket bo'lmagan standart o'lchamlar ham
// original HTML'da ishlatilmagani uchun chiqarilmagan).

export interface OrderMessage {
  text: string;
  time: string;
}

export interface OrderMessagePanelProps {
  order: Order;
  messages: OrderMessage[];
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function OrderMessagePanel({ order, messages, onClose, onSend }: OrderMessagePanelProps) {
  const [text, setText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  useEscapeClose(onClose);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
      style={{ position: "fixed", bottom: 20, right: 20, width: 320, maxWidth: "calc(100vw - 40px)", height: 384, zIndex: 150 }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-send" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </symbol>
        </defs>
      </svg>

      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="font-semibold text-sm truncate">{order.name}</span>
        <button type="button" onClick={onClose} className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">
          <svg className="icon icon-sm">
            <use href="#i-x-circle" />
          </svg>
        </button>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className="ml-auto rounded-lg bg-primary/10 px-3 py-2 text-sm" style={{ maxWidth: "85%" }}>
            <div>{m.text}</div>
            <div className="text-right mt-1" style={{ fontSize: 11 }}>
              <span className="text-muted-foreground">{m.time}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-border shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Izoh qoldirish"
          className="flex-1 h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={handleSend}
          className="h-10 w-10 shrink-0 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90"
          title="Yuborish"
        >
          <svg className="icon icon-sm">
            <use href="#i-send" />
          </svg>
        </button>
      </div>
    </div>
  );
}
