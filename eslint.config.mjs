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
]);

export default eslintConfig;
