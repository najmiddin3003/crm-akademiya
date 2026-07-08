import AppShell from "@/components/shared/AppShell";

// Sidebar+Navbar faqat shu guruhdagi (haqiqiy CRM) sahifalarga o'raladi.
// (auth) sahifalari — login/register — bu qobiqsiz, to'liq ekranli.
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
