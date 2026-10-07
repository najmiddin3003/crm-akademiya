"use client";

import { Fragment, useMemo } from "react";
import Link from "@/components/ui/Link";
import { parseAiMarkdown, type Inline } from "./aiMarkdown";

// AI javobini chizish — `aiMarkdown.ts` daraxtidan, HTML'siz.
// Havola bosilganda panel yopiladi (`onNavigate`): sahifa ochiladi,
// suhbat esa saqlanib qoladi — robotni qayta bossangiz davom etadi.

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

export default function MessageText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = useMemo(() => parseAiMarkdown(text), [text]);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
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
