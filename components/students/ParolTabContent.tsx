"use client";

import { useState } from "react";

// Ported from crm-akademiya/src/app.js renderStudentEditParol() (~line 34519).
// Content is identical regardless of the selected sub-tab in the source too —
// only the pill styling changes.

export default function ParolTabContent({ login }: { login: string }) {
  const [sub, setSub] = useState<"oquvchi" | "otaona">("oquvchi");

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setSub("oquvchi")}
          className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
            sub === "oquvchi" ? "bg-primary text-white" : "bg-secondary/40 hover:bg-secondary/70 text-foreground/80"
          }`}
        >
          O&apos;quvchi
        </button>
        <button
          type="button"
          onClick={() => setSub("otaona")}
          className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
            sub === "otaona" ? "bg-primary text-white" : "bg-secondary/40 hover:bg-secondary/70 text-foreground/80"
          }`}
        >
          Ota-ona
        </button>
      </div>

      <div className="space-y-4 max-w-3xl">
        <div>
          <label className="block text-[13px] font-medium mb-1.5">Login</label>
          <input type="text" defaultValue={login} className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div>
          <label className="block text-[13px] font-medium mb-1.5">Parol</label>
          <input type="password" defaultValue="password123" className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Saqlash</button>
        </div>
      </div>
    </div>
  );
}
