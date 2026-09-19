"use client";
import { useT } from "@/components/shared/Language";

export interface KoproqTabButtonProps {
  onClick?: () => void;
}

export default function KoproqTabButton({ onClick }: KoproqTabButtonProps) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 h-10 px-3 rounded-lg text-sm font-medium text-foreground/80 bg-secondary/40 hover:bg-secondary/70 inline-flex items-center gap-1"
    >
      {t("Ko'proq")}
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </svg>
    </button>
  );
}
