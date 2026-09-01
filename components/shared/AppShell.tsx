"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import Navbar, { type ShellUser } from "@/components/shared/Navbar";
import { PersonDirectoryProvider } from "@/components/shared/PersonDirectory";

// Umumiy qobiq (Navbar + Sidebar), app/layout.tsx orqali barcha sahifalarga
// o'raladi. Har bir sahifa endi o'zining nomlangan route papkasida (masalan
// app/tasks/page.tsx) yashaydi va Sidebar/Navbar ular bilan <Link> orqali
// bog'lanadi — bu yerda faqat mobil menyu ochiq/yopiqligi boshqariladi.
//
// Struktura referens saytdagidek (akademiya.edutizim.uz): header BUTUN
// kenglikda tepada turadi va logo ham uning ichida bo'ladi, sidebar esa
// header ostidan boshlanadi. Ilgari teskari edi — sidebar to'liq balandlikda
// chapda turib, logo o'zida saqlanardi va header faqat o'ngdagi joyni
// egallardi.
export default function AppShell({
  children,
  permissions = null,
  user = null,
}: {
  children: React.ReactNode;
  /** Rol ruxsatlari — app/(app)/layout.tsx dan keladi. `null` = cheklovsiz. */
  permissions?: string[] | null;
  /** Joriy foydalanuvchi — o'sha layout'dan. `null` faqat testlarda. */
  user?: ShellUser | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // PersonDirectoryProvider shu yerda — ism→profil xaritasi sessiyaga bir
  // marta yuklanib, barcha sahifalardagi <PersonLink> larga xizmat qiladi
  // (har sahifa o'zi so'rov yubormaydi).
  return (
    <PersonDirectoryProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Navbar onOpenMobileMenu={() => setMobileOpen(true)} user={user} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} permissions={permissions} />
          <main className="flex-1 overflow-y-auto bg-secondary/30">{children}</main>
        </div>
      </div>
    </PersonDirectoryProvider>
  );
}
