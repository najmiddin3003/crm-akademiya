import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LangProvider } from "@/components/shared/Language";
import NavigationHistoryProvider from "@/components/shared/NavigationHistory";
import { ToastProvider } from "@/components/ui/Toast";
import { htmlLang, normalizeLang } from "@/lib/i18n";

// Referens sayt (akademiya.edutizim.uz) Nunito ishlatadi. globals.css dagi
// `body { font-family: var(--font-nunito), ... }` shu o'zgaruvchini o'qiydi.
const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tizimli",
};

/**
 * Ilovaning brend palitrasi.
 *
 *   "teal"     — joriy rang (moviy-yashil)
 *   "edutizim" — dastlabki ko'k (akademiya.edutizim.uz dan ko'chirilgan)
 *
 * QAYTARISH: shu qatorni "edutizim" ga o'zgartirish KIFOYA. Barcha
 * qiymatlar app/globals.css dagi "BREND PALITRASI" blokida turadi va
 * asosiy rang, shell (navbar/sidebar) hamda body fonining gradienti —
 * hammasi o'sha bloknni o'qiydi.
 */
const BRAND = "teal";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // INTERFEYS TILI — cookie'dan (components/shared/Language.tsx yozadi).
  // Birinchi chizish ham tanlangan tilda bo'lsin: aks holda inglizcha
  // tanlagan odam har yangilashda bir lahza o'zbekcha ko'rardi. Narxi:
  // cookie o'qilgani uchun har sahifa dinamik chiziladi — ilova baribir
  // sessiyali (proxy.ts), statik sahifa deyarli yo'q edi.
  const lang = normalizeLang((await cookies()).get("tizimli_lang")?.value);
  return (
    // `suppressHydrationWarning` — pastdagi skript `dark` klassini gidratatsiyadan
    // OLDIN qo'shadi, server HTML'ida esa u yo'q. React buni nomuvofiqlik deb
    // hisoblaydi; bu atribut aynan shu holat uchun (faqat shu elementga tegishli).
    <html lang={htmlLang(lang)} data-brand={BRAND} className={nunito.variable} suppressHydrationWarning>
      <head>
        {/* Mavzu `useTheme` da effekt orqali qo'llanadi — ya'ni gidratatsiyadan
            KEYIN. Shu sabab tungi rejimda har sahifa yuklanganda bir lahza
            yorug' rejim ko'rinib ketardi. Bu skript bloklovchi: birinchi
            bo'yashdan oldin klassni qo'yadi. Kalit `components/shared/Theme.tsx`
            dagi bilan bir xil bo'lishi shart. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('tizimli:theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body>
        <LangProvider initial={lang}>
          <ToastProvider>
            <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
          </ToastProvider>
        </LangProvider>
      </body>
    </html>
  );
}
