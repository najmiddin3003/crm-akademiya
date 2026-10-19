"use client";

import { useEffect, useState } from "react";
import { preconnect, preinit } from "react-dom";
import { TaskInboxGate } from "@/components/shared/AppShell";
import { BranchProvider } from "@/components/shared/BranchContext";
import { NotificationsProvider } from "@/components/shared/NotificationsProvider";
import { PersonDirectoryProvider } from "@/components/shared/PersonDirectory";
import { NavbarSprite, SidebarSprite } from "@/components/shared/ShellSprites";
import { TaskInboxProvider } from "@/components/shared/TaskInboxProvider";
import ReceiptHost from "@/components/v2/finance/ReceiptHost";
import { DevNoticeBanner } from "./DevNotice";
import { CreateProvider } from "./CreateContext";
import { ShellProvider } from "./ShellContext";
import SidebarV2 from "./SidebarV2";
import TopbarV2, { type ShellUserV2 } from "./TopbarV2";

// YANGI VERSIYA QOBIG'I (v2, 17.10.2026) — eski components/shared/AppShell.tsx
// o'rniga, foydalanuvchi «Yangi versiya» ni tanlaganda (lib/uiVersion.ts).
//
// Tuzilish dizayndagidek: yon menyu chapda TO'LIQ balandlikda (sahifa fonida),
// yuqori panel faqat o'ng ustunda. Provayderlar eski qobiq bilan bir xil —
// filial, bildirishnoma va topshiriqlar ikki versiyada bir manbadan.
//
// SAHIFALARNING ICHI HOZIRCHA ESKI: `data-ui="v2"` (yangi tokenlar, Onest
// shrifti, `color-scheme`) faqat menyu va panelda — kontent hududiga
// qo'yilmagan, ya'ni eski sahifalar o'z shrifti va ranglarida aynan
// avvalgidek chiziladi. Sahifa yangi dizaynga o'tkazilganda uning o'z ildizi
// `data-ui="v2"` oladi.
//
// Balandlik zanjiri eski qobiq bilan bir xil (globals.css → «QOTIB
// TURADIGAN JADVAL»): main — `.flex.flex-1.overflow-hidden` ichida
// `flex-1 overflow-y-auto`, aks holda `.page-frame` jadval sarlavhasi qotmaydi.

/**
 * Onest — dizayn shrifti. Hozircha Google Fonts'dan va FAQAT yangi versiyada
 * (eski versiyadagilar yuklamaydi). `next/font/google` ATAYIN emas: u shriftni
 * build paytida yuklaydi va prod serverdagi build shu yo'l bilan bir necha
 * marta yiqilgan; to'liq o'tishda shrift loyiha ichiga joylanadi
 * (design/v2/SAVOLLAR.md, 4-savol).
 */
const ONEST_CSS = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap";

export default function AppShellV2({
  children,
  permissions = null,
  user = null,
  isAdmin = false,
  features = {},
  devNotice = true,
}: {
  children: React.ReactNode;
  /** Rol ruxsatlari — app/(app)/layout.tsx dan. `null` = cheklovsiz. */
  permissions?: string[] | null;
  user?: ShellUserV2 | null;
  /** `users.role === "admin"` — `adminOnly` bo'limlar va MohirAI ogohlantirishlari uchun. */
  isAdmin?: boolean;
  /** Yoqilgan modullar — menyudagi `feature` bo'limlar uchun. */
  features?: Record<string, boolean>;
  /** «Yangi versiya ishlab chiqilmoqda» qatori — bugun yopilmagan bo'lsa (./DevNotice.tsx). */
  devNotice?: boolean;
}) {
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  preinit(ONEST_CSS, { as: "style", precedence: "default" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Kompyuterda yon menyuni yig'ish. Saqlanmaydi: sahifa yangilansa menyu
  // yana ochiq (o'tishlarda qobiq qayta yaratilmaydi — holat saqlanadi).
  const [collapsed, setCollapsed] = useState(false);
  // Yopilsa shu sahifada darhol yo'qoladi; qayta yuklanganda server cookie'ni ko'radi.
  const [noticeOpen, setNoticeOpen] = useState(devNotice);

  // Chekma menyu Esc bilan yopiladi.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const sidebarProps = { permissions, isAdmin, features };

  return (
    <PersonDirectoryProvider>
      <BranchProvider>
        <NotificationsProvider>
          <TaskInboxProvider>
            {/* Eski sahifalar ikonkalarni shu sprite'lardan oladi (components/shared/ShellSprites.tsx). */}
            <SidebarSprite />
            <NavbarSprite />

            {/* Ruxsatlar (./ShellContext) va «+ Yangi» formalari (./CreateContext) — yuqori
                panel ham, sahifalar ham, qobiqdagi formalar ham ko'radi. */}
            <ShellProvider value={{ permissions, isAdmin }}>
              <CreateProvider>
                <div className="flex h-screen overflow-hidden">
                  {!collapsed && (
                    <aside
                      data-ui="v2"
                      className="hidden w-62 shrink-0 flex-col border-r border-v2-border bg-v2-bg font-v2 text-v2-text lg:flex"
                    >
                      <SidebarV2 {...sidebarProps} variant="desktop" onClose={() => setCollapsed(true)} />
                    </aside>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col">
                    <TopbarV2
                      user={user}
                      permissions={permissions}
                      isAdmin={isAdmin}
                      sidebarCollapsed={collapsed}
                      onExpandSidebar={() => setCollapsed(false)}
                      onOpenMenu={() => setDrawerOpen(true)}
                    />
                    {noticeOpen && <DevNoticeBanner onHide={() => setNoticeOpen(false)} />}
                    <div className="flex flex-1 overflow-hidden">
                      <main className="flex-1 overflow-y-auto">{children}</main>
                    </div>
                  </div>
                </div>

                {/* Telefon/planshet: yon menyu chekma oynada. */}
                {drawerOpen && (
                  <div data-ui="v2" className="fixed inset-0 z-50 font-v2 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
                    <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-v2-border bg-v2-bg text-v2-text shadow-v2-md">
                      <SidebarV2
                        {...sidebarProps}
                        variant="drawer"
                        onClose={() => setDrawerOpen(false)}
                        onNavigate={() => setDrawerOpen(false)}
                      />
                    </aside>
                  </div>
                )}
              </CreateProvider>
            </ShellProvider>

            <TaskInboxGate />
            {/* Formalar saqlangach toastdagi «Chekni ko'rish» — chek shu yerda ochiladi. */}
            <ReceiptHost />
          </TaskInboxProvider>
        </NotificationsProvider>
      </BranchProvider>
    </PersonDirectoryProvider>
  );
}
