"use client";

import Link from "@/components/ui/Link";
import { usePersonHref } from "@/components/shared/PersonDirectory";

/**
 * YANGI VERSIYA: XODIM ISMI — katalogda bo'lsa profiliga havola (o'qituvchi,
 * moderator). Har katak o'z hook'i bilan; bo'sh bo'lsa «—».
 */
export default function StaffName({ name }: { name: string }) {
  const href = usePersonHref(name, "staff");
  if (!name) return <span className="text-v2-text-3">—</span>;
  if (!href) return <>{name}</>;
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} className="hover:text-v2-brand-text hover:underline underline-offset-2">
      {name}
    </Link>
  );
}
