import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // `next/link` to'g'ridan-to'g'ri ISHLATILMAYDI — faqat components/ui/Link.tsx
  // orqali. O'ram prefetch'ni standart holda o'chiradi: ro'yxat sahifalarida
  // har qatorda 2-5 ta havola bor va ularning oldindan yuklanishi serverni
  // 503 gacha olib borgan (izoh o'sha faylda). Qoida — yangi sahifada buni
  // unutib qo'ymaslik uchun.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Buning o'rniga @/components/ui/Link ishlating (prefetch standart holda o'chiq).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/ui/Link.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  // Native <select> va <input type="date|time|month"> ISHLATILMAYDI —
  // ular brauzer/OS oynasi: stillanmaydi, tungi rejimda oq, qidiruvi yo'q.
  // O'rniga components/ui/{Select,DateField,TimeField,MonthYearPicker}.
  // 11.09.2026 da butun loyiha shularga ko'chirildi; qoida — yangi sahifada
  // eski odat qaytmasligi uchun. Faqat components/ui/ ichida ruxsat.
  {
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Native <select> o'rniga @/components/ui/Select ishlating.",
        },
        {
          selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'] > Literal[value=/^(date|time|month)$/]",
          message: "Native sana/vaqt inputi o'rniga @/components/ui/DateField, TimeField yoki MonthYearPicker ishlating.",
        },
      ],
    },
  },
]);

export default eslintConfig;
