"use client";

import { Fragment, useMemo } from "react";
import { Download } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { parseAiMarkdown, parseInline, tableCsv, type Inline } from "./aiMarkdown";

// AI javobini chizish — `aiMarkdown.ts` daraxtidan, HTML'siz.
// Havola bosilganda panel yopiladi (`onNavigate`): sahifa ochiladi,
// suhbat esa saqlanib qoladi — robotni qayta bossangiz davom etadi.
//
// JADVAL (5-bosqich): ro'yxatlar (to'lovlar, o'quvchilar, davomat) jadval
// bo'lib chiqadi; tepasidagi «CSV» tugmasi uni Excel'da ochiladigan faylga
// yuklab beradi (brauzerning o'zida — serverga so'rov ketmaydi).

function Inlines({ parts, onNavigate }: { parts: Inline[]; onNavigate?: () => void }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "bold") return <strong key={i} className="font-semibold">{p.text}</strong>;
        if (p.kind === "code") return <code key={i} className="rounded bg-secondary px-1 py-0.5 text-[12px]">{p.text}</code>;
        if (p.kind === "link") {
          return (
            <Link key={i} href={p.href} onClick={onNavigate} className="font-medium text-primary underline underline-offset-2">
              {p.text}
            </Link>
          );
        }
        return <Fragment key={i}>{p.text}</Fragment>;
      })}
    </>
  );
}

/** Jadvalni CSV qilib yuklab beradi (fayl nomi — sana bilan). */
function downloadCsv(header: string[], rows: string[][]): void {
  const blob = new Blob([tableCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-jadval-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Table({ header, rows, onNavigate }: { header: string[]; rows: string[][]; onNavigate?: () => void }) {
  const { t } = useT();
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground">
        <span>{t("{n} ta qator", { n: rows.length })}</span>
        <button
          type="button"
          onClick={() => downloadCsv(header, rows)}
          title={t("Excel uchun CSV faylini yuklab olish")}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto overscroll-contain">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              {header.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                  <Inlines parts={parseInline(h)} onNavigate={onNavigate} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/70 even:bg-secondary/20">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1 align-top">
                    <Inlines parts={parseInline(c)} onNavigate={onNavigate} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MessageText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = useMemo(() => parseAiMarkdown(text), [text]);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
        if (b.kind === "table") return <Table key={i} header={b.header} rows={b.rows} onNavigate={onNavigate} />;
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => <li key={j}><Inlines parts={it} onNavigate={onNavigate} /></li>)}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => <li key={j}><Inlines parts={it} onNavigate={onNavigate} /></li>)}
            </ol>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((ln, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inlines parts={ln} onNavigate={onNavigate} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
