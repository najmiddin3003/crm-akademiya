import type { TabButtonProps } from "@/components/shared/TahrirlashTabButton";

export default function QongiroqlarTabButton({ active = false, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-white shadow-sm" : "bg-secondary/40 text-foreground/80 hover:bg-secondary/70"
      }`}
    >
      Qo&apos;ng&apos;iroqlar tarixi
    </button>
  );
}
