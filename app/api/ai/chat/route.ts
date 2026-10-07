import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runChatTurn } from "@/lib/ai/chat";
import { aiProviderConfig, KEEPALIVE_MS, MAX_MESSAGE_CHARS } from "@/lib/ai/config";
import { loadAiContext } from "@/lib/ai/context";
import { aiDb } from "@/lib/ai/db";
import { AiProviderError } from "@/lib/ai/openai";
import type { AiStreamEvent } from "@/lib/ai/protocol";
import { loadAiSettings } from "@/lib/ai/settings";
import { findConversation, saveTurn } from "@/lib/ai/store";
import { refundQuota, takeQuota } from "@/lib/ai/usage";
import { normalizeLang } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/serverT";

// POST /api/ai/chat  { message, conversationId? }  →  NDJSON oqim
// (hodisalar shakli: lib/ai/protocol.ts).
//
// TARTIB — hammasi oqim BOSHLANISHIDAN OLDIN tekshiriladi (sessiya,
// yoqilganmi, kalit, savol, limit): xato bo'lsa oddiy JSON qaytadi va
// panel uni toast bilan ko'rsatadi. Oqim boshlangach xato ham oqim ichida
// keladi (`{type: "error"}`).
//
// Xodimning ruxsatlari va filiali shu yerda BIR MARTA yechiladi
// (lib/ai/context.ts) va vositalarga uzatiladi — vositalar oqim davomida,
// route qaytgandan keyin ishlaydi.
//
// NGINX: `X-Accel-Buffering: no` — bo'laklar buferda to'planmasin
// (node_modules/next/dist/docs → self-hosting, "Streaming"). Serverdagi
// sozlamada `proxy_buffering off` allaqachon bor; sarlavha — ikkinchi
// kafolat. `application/x-ndjson` gzip/brotli ro'yxatida yo'q, ya'ni
// siqish ham bo'laklarni ushlab turmaydi.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const db = await aiDb();
  const ctx = await loadAiContext(db);
  if (!ctx) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const settings = await loadAiSettings(db);
  if (!settings.enabled) {
    return NextResponse.json({ ok: false, error: "AI yordamchi o'chirilgan" }, { status: 403 });
  }
  const cfg = aiProviderConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "AI yordamchi sozlanmagan: serverda kalit yo'q" }, { status: 503 });
  }

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "Savol yozilmagan" }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ ok: false, error: `Savol juda uzun (ko'pi bilan ${MAX_MESSAGE_CHARS} belgi)` }, { status: 400 });
  }

  // Suhbat faqat egasiniki — begona id berilsa yangi suhbat boshlanadi.
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.slice(0, 64) : "";
  const conversation = conversationId ? await findConversation(db, ctx.userId, conversationId) : null;

  const limit = settings.dailyLimit;
  const quota = await takeQuota(db, ctx.userId, limit);
  if (!quota.ok) {
    return NextResponse.json({ ok: false, error: `Bugungi limit tugadi: kuniga ${limit} ta savol.` }, { status: 429 });
  }

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: AiStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true; // mijoz ketib qolgan
        }
      };
      const keepalive = setInterval(() => emit({ type: "ping" }), KEEPALIVE_MS);
      emit({ type: "meta", conversationId: conversation?.id ?? "", remaining: quota.remaining, limit });

      try {
        const { answer } = await runChatTurn({
          ctx,
          cfg,
          lang,
          history: conversation?.messages ?? [],
          question: message,
          emit,
          signal: req.signal,
        });
        if (req.signal.aborted) return; // chala javob saqlanmaydi
        if (!answer) {
          await refundQuota(db, ctx.userId);
          emit({ type: "error", message: "AI javob qaytarmadi. Savolni boshqacha yozib ko'ring." });
          return;
        }
        const id = await saveTurn(db, ctx.userId, conversation?.id ?? null, [
          { role: "user", content: message, at: new Date().toISOString() },
          { role: "assistant", content: answer, at: new Date().toISOString() },
        ]);
        emit({ type: "meta", conversationId: id, remaining: quota.remaining, limit });
        emit({ type: "done" });
      } catch (e) {
        // Xodim o'zi to'xtatdi (yoki sahifani yopdi) — xato emas va savol
        // qaytarilmaydi: javobning bir qismi kelgan, OpenAI'ga pul ketgan.
        // Aks holda "deyarli oxirigacha o'qib, to'xtatish" limitni chetlab
        // o'tardi.
        if (req.signal.aborted) return;
        // Xizmat aybi — xodim limitini yo'qotmasin.
        await refundQuota(db, ctx.userId);
        if (e instanceof AiProviderError) {
          console.error("[ai]", e.logDetail);
          emit({ type: "error", message: e.message });
        } else {
          console.error("[ai] kutilmagan xato", e);
          emit({ type: "error", message: "Kutilmagan xato yuz berdi. Birozdan keyin qayta urinib ko'ring." });
        }
      } finally {
        clearInterval(keepalive);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // allaqachon yopilgan
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
