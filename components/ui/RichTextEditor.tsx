"use client";

import { useEffect, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, AtSign, Bold, Code, Eraser, Highlighter,
  ImageIcon, IndentDecrease, IndentIncrease, Italic, Link as LinkIcon, List, ListOrdered, Maximize2,
  Minimize2, Minus, Palette, Printer, Quote, Redo2, Strikethrough, Subscript, Superscript, Table2,
  Underline, Undo2, Video,
} from "lucide-react";

// Qayta ishlatiladigan boy matn muharriri (Shartnoma andozasi tahrirlagichi
// uchun — skrinshotdagi asboblar paneli). Kutubxonasiz, contentEditable +
// document.execCommand asosida (loyihaga yangi bog'liqlik qo'shmaslik uchun
// foydalanuvchi bilan kelishilgan tanlov). `value`/`onChange` — boshqariladigan
// HTML, lekin DOM'ga faqat TASHQI o'zgarishlarda yoziladi (har harfda emas —
// aks holda kursor sakraydi).

const FONT_SIZES = [
  { label: "12px", px: "12" },
  { label: "13px", px: "13" },
  { label: "14px", px: "14" },
  { label: "16px", px: "16" },
  { label: "18px", px: "18" },
  { label: "20px", px: "20" },
  { label: "24px", px: "24" },
  { label: "28px", px: "28" },
];
const BLOCK_FORMATS = [
  { label: "Paragraf", tag: "p" },
  { label: "Sarlavha 1", tag: "h1" },
  { label: "Sarlavha 2", tag: "h2" },
  { label: "Sarlavha 3", tag: "h3" },
];

const toolBtn = "h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground";

export interface RichTextEditorField {
  label: string;
  token: string;
}

export default function RichTextEditor({
  value,
  onChange,
  fields = [],
  minHeight = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  fields?: RichTextEditorField[];
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const savedRange = useRef<Range | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const hiliteInputRef = useRef<HTMLInputElement>(null);

  const [codeView, setCodeView] = useState(false);
  // Asboblar panelidagi joriy shrift o'lchami / blok formati — faqat
  // ko'rsatish uchun (muharrir tanloviga qarab yangilanmaydi, avval ham
  // shunday edi: native select `defaultValue` bilan turardi).
  const [fontSize, setFontSize] = useState("13");
  const [blockFormat, setBlockFormat] = useState("p");
  const [codeDraft, setCodeDraft] = useState(value);
  const [fullscreen, setFullscreen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);

  // Tashqi `value` o'zgarsa (masalan mavjud shartnoma yuklanganda) DOM'ni
  // yangilaymiz — lekin faqat o'z onInput'imizdan kelmagan bo'lsa.
  useEffect(() => {
    if (codeView) return;
    if (editorRef.current && value !== lastEmitted.current) {
      editorRef.current.innerHTML = value || "";
      lastEmitted.current = value;
    }
  }, [value, codeView]);

  function emit() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function exec(cmd: string, arg?: string) {
    focusEditor();
    document.execCommand(cmd, false, arg);
    emit();
  }

  function applyFontSize(px: string) {
    focusEditor();
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((el) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
    emit();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0);
    }
  }

  function insertAtSavedRange(html: string) {
    focusEditor();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function insertLink() {
    const url = window.prompt("Havola manzili (URL):", "https://");
    if (!url) return;
    exec("createLink", url);
  }
  function insertImage() {
    const url = window.prompt("Rasm manzili (URL):", "https://");
    if (!url) return;
    exec("insertImage", url);
  }
  function insertVideo() {
    const url = window.prompt("Video manzili (YouTube yoki to'g'ridan-to'g'ri video URL):", "https://");
    if (!url) return;
    const isYoutube = /youtu\.?be/.test(url);
    const html = isYoutube
      ? `<p><iframe src="${url.replace("watch?v=", "embed/")}" style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen></iframe></p>`
      : `<p><video src="${url}" controls style="max-width:100%"></video></p>`;
    focusEditor();
    document.execCommand("insertHTML", false, html);
    emit();
  }
  function insertTable() {
    const rows = 3;
    const cols = 3;
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += '<td style="border:1px solid #cbd5e1;padding:8px;min-width:60px">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</table><p></p>";
    focusEditor();
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function toggleCodeView() {
    if (!codeView) {
      setCodeDraft(editorRef.current?.innerHTML || "");
      setCodeView(true);
    } else {
      lastEmitted.current = codeDraft;
      onChange(codeDraft);
      setCodeView(false);
    }
  }

  function printContent() {
    const html = editorRef.current?.innerHTML || "";
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(`<html><head><title>Chop etish</title><style>body{font-family:sans-serif;padding:24px;line-height:1.6}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[200] bg-card p-4 flex flex-col" : ""}>
      <div className="rounded-xl border border-border bg-card overflow-visible flex flex-col" style={fullscreen ? { flex: 1 } : undefined}>
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border flex-wrap">
          <button type="button" onClick={() => exec("undo")} className={toolBtn} title="Bekor qilish"><Undo2 className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("redo")} className={toolBtn} title="Qaytarish"><Redo2 className="w-4 h-4" /></button>

          {/* preserveFocus: tanlov muharrirda qolsin — aks holda buyruq hech narsaga qo'llanmaydi. */}
          <Select size="row" preserveFocus className="w-20" value={fontSize} onChange={(v) => { setFontSize(v); applyFontSize(v); }} options={FONT_SIZES.map((s) => ({ value: s.px, label: s.label }))} title="Shrift o'lchami" />
          <Select size="row" preserveFocus className="w-28" value={blockFormat} onChange={(v) => { setBlockFormat(v); exec("formatBlock", v); }} options={BLOCK_FORMATS.map((b) => ({ value: b.tag, label: b.label }))} title="Format" />

          <button type="button" onClick={() => exec("formatBlock", "blockquote")} className={toolBtn} title="Iqtibos"><Quote className="w-4 h-4" /></button>

          <span className="w-px h-5 bg-border mx-0.5" />

          <button type="button" onClick={() => exec("bold")} className={toolBtn} title="Qalin"><Bold className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("underline")} className={toolBtn} title="Tagiga chizish"><Underline className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("italic")} className={toolBtn} title="Qiya"><Italic className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("strikeThrough")} className={toolBtn} title="Ustiga chizish"><Strikethrough className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("subscript")} className={toolBtn} title="Quyi indeks"><Subscript className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("superscript")} className={toolBtn} title="Yuqori indeks"><Superscript className="w-4 h-4" /></button>

          <span className="w-px h-5 bg-border mx-0.5" />

          <button type="button" onClick={() => colorInputRef.current?.click()} className={toolBtn} title="Matn rangi"><Palette className="w-4 h-4" /></button>
          <input ref={colorInputRef} type="color" className="hidden" onChange={(e) => exec("foreColor", e.target.value)} />
          <button type="button" onClick={() => hiliteInputRef.current?.click()} className={toolBtn} title="Fon rangi"><Highlighter className="w-4 h-4" /></button>
          <input ref={hiliteInputRef} type="color" className="hidden" onChange={(e) => exec("hiliteColor", e.target.value)} />
          <button type="button" onClick={() => exec("removeFormat")} className={toolBtn} title="Formatni tozalash"><Eraser className="w-4 h-4" /></button>

          <span className="w-px h-5 bg-border mx-0.5" />

          <button type="button" onClick={() => exec("indent")} className={toolBtn} title="Chekinish"><IndentIncrease className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("outdent")} className={toolBtn} title="Chekinishni kamaytirish"><IndentDecrease className="w-4 h-4" /></button>

          <div className="relative">
            <button type="button" onClick={() => setAlignOpen((o) => !o)} className={toolBtn} title="Tekislash"><AlignLeft className="w-4 h-4" /></button>
            {alignOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 flex rounded-md border border-border bg-card shadow-xl p-1 gap-0.5">
                <button type="button" onClick={() => { exec("justifyLeft"); setAlignOpen(false); }} className={toolBtn} title="Chapga"><AlignLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => { exec("justifyCenter"); setAlignOpen(false); }} className={toolBtn} title="Markazga"><AlignCenter className="w-4 h-4" /></button>
                <button type="button" onClick={() => { exec("justifyRight"); setAlignOpen(false); }} className={toolBtn} title="O'ngga"><AlignRight className="w-4 h-4" /></button>
                <button type="button" onClick={() => { exec("justifyFull"); setAlignOpen(false); }} className={toolBtn} title="Kenglikka"><AlignJustify className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => exec("insertHorizontalRule")} className={toolBtn} title="Gorizontal chiziq"><Minus className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("insertUnorderedList")} className={toolBtn} title="Ro'yxat"><List className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec("insertOrderedList")} className={toolBtn} title="Raqamli ro'yxat"><ListOrdered className="w-4 h-4" /></button>

          <span className="w-px h-5 bg-border mx-0.5" />

          <button type="button" onClick={insertTable} className={toolBtn} title="Jadval"><Table2 className="w-4 h-4" /></button>
          <button type="button" onClick={insertLink} className={toolBtn} title="Havola"><LinkIcon className="w-4 h-4" /></button>
          <button type="button" onClick={insertImage} className={toolBtn} title="Rasm"><ImageIcon className="w-4 h-4" /></button>
          <button type="button" onClick={insertVideo} className={toolBtn} title="Video"><Video className="w-4 h-4" /></button>

          <span className="w-px h-5 bg-border mx-0.5" />

          <div className="relative">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => setMentionOpen((o) => !o)} className={toolBtn} title="Maydon qo'shish">
              <AtSign className="w-4 h-4" />
            </button>
            {mentionOpen && fields.length > 0 && (
              <div className="absolute top-full right-0 mt-1 z-50 w-56 max-h-64 overflow-y-auto rounded-md border border-border bg-card shadow-xl p-1">
                {fields.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    onClick={() => { insertAtSavedRange(`{{${f.token}}}`); setMentionOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-secondary text-[12px]"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={toggleCodeView} className={`${toolBtn} ${codeView ? "bg-primary/10 text-primary" : ""}`} title="Kod ko'rinishi"><Code className="w-4 h-4" /></button>
          <button type="button" onClick={printContent} className={toolBtn} title="Chop etish"><Printer className="w-4 h-4" /></button>
          <button type="button" onClick={() => setFullscreen((f) => !f)} className={`${toolBtn} ml-auto`} title={fullscreen ? "Kichraytirish" : "Kengaytirish"}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {codeView ? (
          <textarea
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            className="w-full flex-1 p-4 text-[13px] font-mono focus:outline-none resize-none"
            style={{ minHeight }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            className="w-full flex-1 p-4 text-sm focus:outline-none prose-editor"
            style={{ minHeight }}
          />
        )}
      </div>
    </div>
  );
}
