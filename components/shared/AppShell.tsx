"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import Navbar from "@/components/shared/Navbar";

// Umumiy qobiq (Sidebar + Navbar), app/layout.tsx orqali barcha sahifalarga
// o'raladi. Har bir sahifa endi o'zining nomlangan route papkasida (masalan
// app/tasks/page.tsx) yashaydi va Sidebar/Navbar ular bilan <Link> orqali
// bog'lanadi — bu yerda faqat mobil menyu ochiq/yopiqligi boshqariladi.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-secondary/30">{children}</main>
      </div>
    </div>
  );
}
