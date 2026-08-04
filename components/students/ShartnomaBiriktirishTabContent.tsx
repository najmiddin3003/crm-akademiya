"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import TextField from "@/components/students/fields/TextField";
import PhoneField from "@/components/students/fields/PhoneField";
import SelectField from "@/components/students/fields/SelectField";
import DateField from "@/components/students/fields/DateField";

// Ported from the real site's Shartnoma biriktirish tab: a left form (same
// field set as the Tahrirlash tab, single-column, "Shartnoma turi" prepended
// and "Teglar" moved to the end) + a right rich-text editor for the contract
// text. There's no rich-text library in this project yet, so the editor is a
// lightweight contentEditable + document.execCommand — enough for real
// bold/italic/underline/lists/undo-redo/print without adding a dependency.
// The remaining toolbar buttons (font/size/paragraph pickers, table, link,
// image, video, embed, code view, mention) are visual-only for now.

function ToolbarButton({
  onClick,
  title,
  active,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex-shrink-0 inline-flex items-center justify-center rounded-md text-sm ${
        active ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground/80"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />;
}

export default function ShartnomaBiriktirishTabContent({
  ism,
  familiya,
  phone,
}: {
  ism: string;
  familiya: string;
  phone: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <SelectField label="Shartnoma turi" />
        <TextField label="Ism" defaultValue={ism} />
        <TextField label="Familiya" defaultValue={familiya} />
        <PhoneField label="Telefon raqam" defaultValue={phone} />
        <TextField label="Elektron pochta" type="email" placeholder="example@gmail.com" />
        <DateField label="Tug'ilgan sanasi" />
        <SelectField label="Dars vaqti" placeholder="Dars shaklini tanlang" />
        <SelectField label="O'quvchi kategoriyasi" />
        <SelectField label="O'qish tili" />
        <DateField label="O'quvchining pul to'lash sanasi" />
        <SelectField label="Marketing so'rovnomasi" />
        <TextField label="Maqsadidagi universiteti" />
        <TextField label="Otasining ismi" />
        <PhoneField label="Telefon raqam" />
        <TextField label="Otasining ish joyi" />
        <TextField label="Onasining ismi" />
        <PhoneField label="Telefon raqam" />
        <TextField label="Onasining ish joyi" />
        <TextField label="Uy adresi" />
        <TextField label="O'qish joyi" />
        <TextField label="Izoh" />
        <SelectField label="Teglar" />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>
        <div className="border-b border-border p-2 flex flex-wrap items-center gap-1">
          <ToolbarButton title="Bekor qilish" onClick={() => exec("undo")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Qaytarish" onClick={() => exec("redo")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6" /><path d="M21 13a9 9 0 1 1-3-7" /></svg>
          </ToolbarButton>

          <ToolbarDivider />

          <select className="h-8 px-2 rounded-md border border-border bg-card text-xs" defaultValue="Nunito">
            <option>Nunito</option>
          </select>
          <select className="h-8 px-2 rounded-md border border-border bg-card text-xs" defaultValue="13px">
            <option>13px</option>
          </select>
          <select className="h-8 px-2 rounded-md border border-border bg-card text-xs" defaultValue="Paragraph">
            <option>Paragraph</option>
          </select>

          <ToolbarDivider />

          <ToolbarButton title="Qalin" onClick={() => exec("bold")}><span className="font-bold">B</span></ToolbarButton>
          <ToolbarButton title="Tagiga chizilgan" onClick={() => exec("underline")}><span className="underline">U</span></ToolbarButton>
          <ToolbarButton title="Qiya" onClick={() => exec("italic")}><span className="italic">I</span></ToolbarButton>
          <ToolbarButton title="Ustidan chizilgan" onClick={() => exec("strikeThrough")}><span className="line-through">S</span></ToolbarButton>
          <ToolbarButton title="Pastki indeks" onClick={() => exec("subscript")}>X<sub>2</sub></ToolbarButton>
          <ToolbarButton title="Yuqori indeks" onClick={() => exec("superscript")}>X<sup>2</sup></ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="Formatni tozalash" onClick={() => exec("removeFormat")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4L9 20" /><line x1="3" y1="21" x2="21" y2="3" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Chekinish" onClick={() => exec("indent")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" /><polyline points="3 10 6 12 3 14" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Chekinishni bekor qilish" onClick={() => exec("outdent")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" /><polyline points="6 10 3 12 6 14" /></svg>
          </ToolbarButton>
        </div>

        <div className="border-b border-border p-2 flex flex-wrap items-center gap-1">
          <ToolbarButton title="Chapga tekislash" onClick={() => exec("justifyLeft")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Chiziq qo'shish" onClick={() => exec("insertHorizontalRule")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Raqamli ro'yxat" onClick={() => exec("insertOrderedList")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
              <text x="2.5" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
              <text x="2.5" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
              <text x="2.5" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
            </svg>
          </ToolbarButton>
          <ToolbarButton title="Belgili ro'yxat" onClick={() => exec("insertUnorderedList")}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" />
              <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="Jadval">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
          </ToolbarButton>
          <ToolbarButton
            title="Havola"
            onClick={() => {
              const url = window.prompt("Havola manzili:");
              if (url) exec("createLink", url);
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Rasm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Video">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="14" height="14" rx="2" /><polygon points="22 8 16 12 22 16 22 8" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Kengaytirish">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
          </ToolbarButton>
          <ToolbarButton title="O'rnatish">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Kod">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Eslatish">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></svg>
          </ToolbarButton>
          <ToolbarButton title="Chop etish" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          </ToolbarButton>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="flex-1 p-4 text-sm focus:outline-none overflow-y-auto"
          style={{ minHeight: 240 }}
        />
      </div>
    </div>
  );
}
