"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import Navbar, { type ShellUser } from "@/components/shared/Navbar";
import { PersonDirectoryProvider } from "@/components/shared/PersonDirectory";
import { BranchProvider } from "@/components/shared/BranchContext";
import { NotificationsProvider } from "@/components/shared/NotificationsProvider";
import { TaskInboxProvider, useTaskInbox } from "@/components/shared/TaskInboxProvider";
import TaskInboxModal from "@/components/shared/TaskInboxModal";

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
  isAdmin = false,
}: {
  children: React.ReactNode;
  /** Rol ruxsatlari — app/(app)/layout.tsx dan keladi. `null` = cheklovsiz. */
  permissions?: string[] | null;
  /** Joriy foydalanuvchi — o'sha layout'dan. `null` faqat testlarda. */
  user?: ShellUser | null;
  /** `users.role === "admin"` — sidebar'dagi `adminOnly` bo'limlar uchun. */
  isAdmin?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // PersonDirectoryProvider shu yerda — ism→profil xaritasi sessiyaga bir
  // marta yuklanib, barcha sahifalardagi <PersonLink> larga xizmat qiladi
  // (har sahifa o'zi so'rov yubormaydi).
  return (
    <PersonDirectoryProvider>
      {/* Filial tanlovi — navbar uni boshqaradi, sahifalar `useBranch()`
          orqali o'qiydi va tanlov o'zgarganda ma'lumotni qayta so'raydi. */}
      <BranchProvider>
      {/* Qo'ng'iroq paneli — Navbar ham, mobil chekma menyu ham BITTA
          manbadan o'qisin. Ilgari ikkalasi o'qilmaganlar sonini alohida
          hisoblardi va telefonda ikkita raqam bir-biriga zid bo'lardi.
          BranchProvider ICHIDA: filial almashtirilganda sahifa qayta
          yuklanadi, ya'ni bu ham qaytadan mount bo'ladi. */}
      <NotificationsProvider>
      {/* Xodimning shaxsiy topshiriq oynasi — navbardagi topshiriq ikonkasi,
          mobil menyu qatori va login'dan keyin o'zi ochiladigan modal shu
          provider'dan o'qiydi (components/shared/TaskInboxProvider.tsx). */}
      <TaskInboxProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Navbar onOpenMobileMenu={() => setMobileOpen(true)} user={user} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} permissions={permissions} isAdmin={isAdmin} />
          <main className="flex-1 overflow-y-auto bg-secondary/30">{children}</main>
        </div>
      </div>
      <TaskInboxGate />
      </TaskInboxProvider>
      </NotificationsProvider>
      </BranchProvider>
    </PersonDirectoryProvider>
  );
}

/**
 * Modal FAQAT ochiq paytda mount bo'ladi (loyihadagi boshqa modallar kabi —
 * `{open && <XModal/>}`): yopiqda uning hisoblagich taymeri ham, holati
 * ham yashamaydi.
 */
function TaskInboxGate() {
  const { open } = useTaskInbox();
  return open ? <TaskInboxModal /> : null;
}
