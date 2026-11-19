"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";

/** 49-qism: ko'chgan bo'lim sahifasi tepasidagi izoh — yangi joyiga havola (faqat admin, yangi versiya). */
export default function MovedNotice({ href, text, link }: { href: string; text: string; link: string }) {
  const { t } = useT();
  return (
    <div data-ui="v2" className="px-4 pt-4 font-v2 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
        <Info className="size-4 shrink-0 text-v2-info" aria-hidden />
        <span className="min-w-0 flex-1">{t(text)}</span>
        <Link href={href} className="inline-flex items-center gap-1 font-medium text-v2-brand-text hover:underline">
          {t(link)}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
