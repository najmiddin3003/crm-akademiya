import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { actionViews, historyWithActionNotes } from "@/lib/ai/actions/store";
import { runChatTurn } from "@/lib/ai/chat";
import { aiProviderConfig, KEEPALIVE_MS, MAX_MESSAGE_CHARS } from "@/lib/ai/config";
import { loadAiContext } from "@/lib/ai/context";
import { aiDb } from "@/lib/ai/db";
import { modelChoices, resolveChoice } from "@/lib/ai/modelChoice";
import { adminDetail, AiProviderError } from "@/lib/ai/openai";
import type { AiStreamEvent } from "@/lib/ai/protocol";
import { loadAiSettings } from "@/lib/ai/settings";
import { findConversation, saveTurn } from "@/lib/ai/store";
import { refundQuota, takeQuota } from "@/lib/ai/usage";
import { normalizeLang } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/serverT";

// POST /api/ai/chat  { message, conversationId?, model?, effort? }  →  NDJSON
// oqim (hodisalar shakli: lib/ai/protocol.ts).
//
// `model` / `effort` — paneldagi tanlov (4-bosqich). Admin ochmagan model
// yoki model qabul qilmaydigan daraja so'ralsa — sukutga almashadi
// (lib/ai/modelChoice.ts); haqiqatda qaysi biri ishlatilgani `meta` da.
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

/** Model faqat qoralama tuzib, matn yozmagan javob — suhbatda bo'sh qolmasin. */
const DRAFT_ONLY_ANSWER = "Qoralama tayyor — kartani tekshirib, «Tasdiqlash» ni bosing.";

export async function POST(req: Request) {
  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const ctx = await loadAiContext(db, { actions: settings.actionsEnabled });
  if (!ctx) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  if (!settings.enabled) {
    return NextResponse.json({ ok: false, error: "AI yordamchi o'chirilgan" }, { status: 403 });
  }
  const cfg = aiProviderConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "AI yordamchi sozlanmagan: serverda kalit yo'q" }, { status: 503 });
  }

  let body: { message?: unknown; conversationId?: unknown; model?: unknown; effort?: unknown };
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

  // Hisobdagi modellar ro'yxati bu yerda so'ralmaydi (har savolga ortiqcha
  // kutish) — tanlov admin ro'yxatiga qarab tekshiriladi; hisobda yo'q
  // modelni OpenAI o'zi rad etadi.
  const choice = resolveChoice(modelChoices(cfg, settings), body.model, body.effort);
  const turnCfg = { ...cfg, model: choice.model };

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  // Oldingi javoblardagi qoralamalar qanday tugagani modelga ham ko'rinsin
  // ("saqlandimi?" savoliga taxmin bilan javob bermasin).
  const past = conversation?.messages ?? [];
  const history = historyWithActionNotes(past, await actionViews(db, ctx.userId, past.flatMap((m) => m.actionIds ?? [])));
  const encoder = new TextEncoder();
  // Yangi suhbatning id'si OLDINDAN, birinchi `meta` da mijozga ketadi: javob
  // to'xtatilsa yoki uzilsa ham mijoz keyingi savolni shu suhbatga yuboradi
  // (qoralama tuzilgan bo'lsa navbat baribir saqlanadi — pastda).
  const turnConversationId = conversation?.id ?? randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      // Mijozga ketgan matn va qoralamalar — navbat oxiriga yetmasa ham ma'lum.
      const sent = { text: "", actionIds: [] as string[] };
      const emit = (e: AiStreamEvent) => {
        if (e.type === "delta") sent.text += e.text;
        else if (e.type === "action") sent.actionIds.push(e.action.id);
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true; // mijoz ketib qolgan
        }
      };
      /**
       * Navbat to'xtatildi/uzildi, lekin qoralama KARTASI chiqib bo'lgan — u
       * 15 daqiqa tasdiqlanadigan bo'lib turadi. Navbat saqlanmasa model
       * keyingi savolda uni bilmay ikkinchisini tuzar, ikkalasi tasdiqlansa
       * pul ikki marta yozilardi (09.10.2026). Shuning uchun chala javob
       * qoralamalari bilan suhbatga yoziladi; qoralamasiz chala javob —
       * avvalgidek saqlanmaydi.
       */
      const saveInterrupted = async () => {
        if (!sent.actionIds.length) return;
        const at = new Date().toISOString();
        try {
          await saveTurn(
            db,
            ctx.userId,
            conversation?.id ?? null,
            [
              { role: "user", content: message, at },
              { role: "assistant", content: sent.text.trim() || DRAFT_ONLY_ANSWER, at, actionIds: [...sent.actionIds] },
            ],
            { newId: turnConversationId },
          );
        } catch (e) {
          console.error("[ai] uzilgan navbatni saqlab bo'lmadi", e);
        }
      };
      const keepalive = setInterval(() => emit({ type: "ping" }), KEEPALIVE_MS);
      const used = { model: choice.model, effort: choice.effort };
      emit({ type: "meta", conversationId: turnConversationId, remaining: quota.remaining, limit, ...used });

      try {
        const turn = await runChatTurn({
          ctx,
          cfg: turnCfg,
          lang,
          history,
          question: message,
          emit,
          signal: req.signal,
          effort: choice.effort,
        });
        if (req.signal.aborted) {
          // Chala javob saqlanmaydi — qoralamasi bo'lsa saqlanadi (yuqorida).
          await saveInterrupted();
          return;
        }
        const { actionIds } = turn;
        // Model faqat qoralama tuzib, matn yozmagan bo'lsa ham karta bor — javob bo'sh qolmasin.
        const answer = turn.answer || (actionIds.length ? DRAFT_ONLY_ANSWER : "");
        if (!answer) {
          await refundQuota(db, ctx.userId);
          emit({ type: "error", message: "AI javob qaytarmadi. Savolni boshqacha yozib ko'ring." });
          return;
        }
        const id = await saveTurn(
          db,
          ctx.userId,
          conversation?.id ?? null,
          [
            { role: "user", content: message, at: new Date().toISOString() },
            { role: "assistant", content: answer, at: new Date().toISOString(), ...(actionIds.length ? { actionIds } : {}) },
          ],
          { newId: turnConversationId },
        );
        emit({ type: "meta", conversationId: id, remaining: quota.remaining, limit, ...used });
        emit({ type: "done" });
      } catch (e) {
        // Xodim o'zi to'xtatdi (yoki sahifani yopdi) — xato emas va savol
        // qaytarilmaydi: javobning bir qismi kelgan, OpenAI'ga pul ketgan.
        // Aks holda "deyarli oxirigacha o'qib, to'xtatish" limitni chetlab
        // o'tardi. Qoralama kartasi chiqqan bo'lsa — navbat suhbatga yoziladi.
        await saveInterrupted();
        if (req.signal.aborted) return;
        // Xizmat aybi — xodim limitini yo'qotmasin.
        await refundQuota(db, ctx.userId);
        if (e instanceof AiProviderError) {
          console.error("[ai]", e.logDetail);
          // Sababni (model nomi, OpenAI matni) faqat admin ko'radi — kalitni
          // almashtirish yoki hisobni to'ldirish uning qo'lida.
          const detail = ctx.isAdmin ? adminDetail(e.logDetail) : undefined;
          emit({ type: "error", message: e.message, detail });
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
