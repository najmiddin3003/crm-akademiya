"use client";

import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Lightbulb, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";

// YUZ TERMINALINI ULASH YO'RIQNOMASI (21.11.2026 — egasi: «ulash yo'riqnomasini saytda bosqichma-bosqich,
// aniq tiniq yoz»). Hikvision DS-K1T343MX (MinMoe) uchun yozilgan, shu turdagi boshqa terminallarga ham mos.
// Terminal ekranidagi qadamlar rasmiy Quick Start Guide (DS-K1T343, V1.1) dan; web sahifadagi menyu
// joylashuvi proshivkaga qarab farq qiladi — shuning uchun muqobil nomlar ham ko'rsatiladi.
// Menyu/maydon nomlari terminaldagidek INGLIZCHA qoladi (t() ga kirmaydi — parametr sifatida beriladi).

export type GuideTerminal = {
  id: number;
  name: string;
  ip: string | null;
  listenPath: string | null;
  state: "on" | "wait" | "off";
};

function Path({ parts }: { parts: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="text-v2-text-3">
              →
            </span>
          )}
          <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-px font-sans text-v2-small font-semibold text-v2-text">{p}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v2-brand text-v2-small font-semibold tabular-nums text-white">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="font-semibold text-v2-text">{title}</h3>
        {note && <p className="text-v2-small text-v2-text-3">{note}</p>}
        <ul className="mt-2 space-y-2 text-v2-body text-v2-text">{children}</ul>
      </div>
    </li>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-4 leading-relaxed before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-v2-text-3">
      {children}
    </li>
  );
}

function Tip({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const Icon = tone === "warn" ? AlertTriangle : Lightbulb;
  return (
    <div className={`flex gap-2 rounded-v2-md px-3 py-2 text-v2-small text-v2-text ${tone === "warn" ? "bg-v2-warning-bg" : "bg-v2-surface-2"}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone === "warn" ? "text-v2-warning" : "text-v2-text-2"}`} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CopyRow({ field, hint, value }: { field: string; hint?: string; value: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-v2-caption text-v2-text-2">
          <span className="font-semibold text-v2-text">{field}</span>
          {hint && <span> · {hint}</span>}
        </div>
        <code className="mt-0.5 block break-all font-mono text-v2-body text-v2-text">{value}</code>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          });
        }}
        className={`${secondaryBtn} shrink-0`}
        aria-label={t("Nusxa olish")}
      >
        {done ? <Check className="size-4 text-v2-success" strokeWidth={2} aria-hidden /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden />}
        <span className="max-sm:hidden">{done ? t("Olindi") : t("Nusxa")}</span>
      </button>
    </div>
  );
}

function StatePill({ state }: { state: GuideTerminal["state"] }) {
  const { t } = useT();
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-v2-caption font-semibold ${
        state === "on" ? "bg-v2-success-bg text-v2-success" : state === "wait" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {state === "on" ? t("Ulangan") : state === "wait" ? t("Hali ulanmagan") : t("To'xtatilgan")}
    </span>
  );
}

export default function FaceTerminalGuideV2({
  terminals,
  initialId,
  onAddTerminal,
  onClose,
}: {
  terminals: GuideTerminal[];
  initialId: number | null;
  onAddTerminal: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [pickedId, setPickedId] = useState<number | null>(initialId);
  const picked = terminals.find((x) => x.id === pickedId) ?? terminals[0] ?? null;

  const loc = typeof window !== "undefined" ? window.location : null;
  const https = loc?.protocol === "https:";
  const host = loc?.hostname ?? "";
  const port = loc?.port || (https ? "443" : "80");
  const ip = picked?.ip || "192.168.1.64";

  return (
    <V2Dialog
      title={t("Yuz terminalini ulash — bosqichma-bosqich")}
      subtitle={t("Hikvision DS-K1T343MX va shu turdagi terminallar · bir marta qilinadi, 15–20 daqiqa")}
      onClose={onClose}
      width={680}
      footerStart={<span className="text-v2-caption text-v2-text-3 max-sm:hidden">{t("Oyna ochiq tursa ham bo'ladi — terminal holati o'zi yangilanadi")}</span>}
      footer={(api) => (
        <button type="button" onClick={api.close} className={primaryBtn}>
          {t("Tushunarli")}
        </button>
      )}
    >
      <div className="space-y-5">
        {/* Kerak bo'ladi */}
        <div className="rounded-v2-md border border-v2-border p-3">
          <h3 className="font-semibold text-v2-text">{t("Boshlashdan oldin kerak bo'ladi")}</h3>
          <ul className="mt-2 space-y-1.5 text-v2-body text-v2-text">
            <Item>{t("Terminal tokka va internetga ulangan bo'lsin (LAN kabel yoki Wi-Fi orqali).")}</Item>
            <Item>{t("Terminalning admin paroli — terminal birinchi yoqilganda qo'yilgan aktivatsiya paroli.")}</Item>
            <Item>{t("Terminal bilan bitta tarmoqqa (bitta routerga) ulangan kompyuter yoki noutbuk.")}</Item>
          </ul>
        </div>

        <ol className="space-y-6">
          {/* 1 */}
          <Step n={1} title={t("Terminalni internetga ulang va IP manzilini bilib oling")} note={t("Terminal ekranida")}>
            <Item>{t("Ekranni barmoq bilan 3 soniya bosib turing, o'ngga yoki chapga suring va admin parolini kiriting.")}</Item>
            <Item>
              {t("Menyudan oching:")} <Path parts={["Comm.", "Wired Network"]} />{" "}
              <span className="text-v2-text-2">{t("(Wi-Fi orqali ulangan bo'lsa — {x})", { x: "Comm. → Wi-Fi" })}</span>
            </Item>
            <Item>{t("«{x}» yoqilgan bo'lsin — IP manzil, shlyuz va DNS o'zi olinadi.", { x: "DHCP" })}</Item>
            <Item>{t("Ekrandagi «{x}» qatorini yozib oling, masalan {ip}.", { x: "IP Address", ip: "192.168.1.64" })}</Item>
            <Tip>{t("IP manzilni qo'lda (DHCP'siz) qo'ysangiz, «{x}» ga {dns} yozing — aks holda terminal saytimiz manzilini topa olmaydi.", { x: "DNS", dns: "8.8.8.8" })}</Tip>
          </Step>

          {/* 2 */}
          <Step n={2} title={t("Kompyuterdan terminal sahifasiga kiring")} note={t("Kompyuterda, Chrome brauzerida")}>
            <Item>
              {t("Manzil satriga terminal IP manzilini yozing va Enter bosing:")}{" "}
              <code className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-px font-mono text-v2-small font-semibold text-v2-text">http://{ip}</code>
            </Item>
            <Item>{t("Foydalanuvchi: {user}, parol: terminal admin paroli.", { user: "admin" })}</Item>
            <Item>{t("Sahifa ochilmasa — kompyuter terminal bilan bitta tarmoqdami, tekshiring.")}</Item>
            <Tip>{t("Keyingi qadamlardagi menyu nomlari terminal sahifasidagi inglizcha nomlar. Proshivka versiyasiga qarab joylashuvi biroz farq qilishi mumkin — shuning uchun muqobil nomlari ham yozilgan.")}</Tip>
          </Step>

          {/* 3 */}
          <Step n={3} title={t("Terminal soatini to'g'rilang")} note={t("Muhim: kechikish terminal soati bo'yicha hisoblanadi")}>
            <Item>
              {t("Oching:")} <Path parts={["Configuration", "System", "Time Settings"]} />{" "}
              <span className="text-v2-text-2">{t("(ba'zi proshivkada — «{x}»)", { x: "Time Management" })}</span>
            </Item>
            <Item>{t("«{a}» ro'yxatidan {b} ni tanlang.", { a: "Time Zone", b: "(GMT+05:00) … Tashkent" })}</Item>
            <Item>{t("«{a}» ni yoqing (server: {s}) yoki «{b}» tugmasini bosing.", { a: "NTP", s: "pool.ntp.org", b: "Sync. with computer time" })}</Item>
            <Item>{t("«{x}» tugmasini bosing.", { x: "Save" })}</Item>
          </Step>

          {/* 4 */}
          <Step n={4} title={t("Davomat CRM'ga yuborilishini yoqing")} note={t("HTTP Listening — terminal har bir o'tishni shu saytga yuboradi")}>
            <Item>
              {t("Oching:")} <Path parts={["Configuration", "Network", "HTTP Listening"]} />
            </Item>
            <Item>
              <span className="text-v2-text-2">
                {t("«HTTP Listening» bandi proshivkaga qarab «{a}», «{b}» yoki «{c}» ichida bo'ladi.", { a: "Network Service", b: "Advanced Settings", c: "Device Access" })}
              </span>
            </Item>
            <Item>{t("Quyidagi qiymatlarni «Nusxa» tugmasi bilan olib, terminaldagi mos maydonlarga qo'ying:")}</Item>
            {picked ? (
              <li>
                <div className="rounded-v2-md border border-v2-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-v2-border bg-v2-surface-2 px-3 py-2">
                    {terminals.length > 1 ? (
                      <div className="w-60 max-w-full">
                        <V2Select
                          label={t("Terminal")}
                          value={String(picked.id)}
                          onChange={(v) => setPickedId(Number(v))}
                          clearable={false}
                          options={terminals.map((x) => ({ value: String(x.id), label: x.name }))}
                        />
                      </div>
                    ) : (
                      <span className="font-semibold text-v2-text">{picked.name}</span>
                    )}
                    <StatePill state={picked.state} />
                  </div>
                  <div className="divide-y divide-v2-border">
                    <CopyRow field="Event Alarm IP/Domain Name" hint={t("yoki «{x}»", { x: "Destination IP or Host Name" })} value={host} />
                    <CopyRow field="URL" value={picked.listenPath ?? ""} />
                    <CopyRow field="Port" value={port} />
                    <CopyRow field="Protocol" value={https ? "HTTPS" : "HTTP"} />
                  </div>
                </div>
              </li>
            ) : (
              <li>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-3">
                  <span className="text-v2-body text-v2-text-2">{t("Bu qiymatlar terminal qo'shilgach shu yerda chiqadi.")}</span>
                  <button type="button" onClick={onAddTerminal} className={primaryBtn}>
                    <Plus className="size-4" strokeWidth={2} aria-hidden />
                    {t("Terminal qo'shish")}
                  </button>
                </div>
              </li>
            )}
            <Item>{t("«{a}» tugmasini bosing. «{b}» tugmasi bo'lsa — uni ham bosing.", { a: "Save", b: "Test" })}</Item>
            {https && <Tip tone="warn">{t("«{a}» ro'yxatida {b} bo'lmasa, bizga yozing — server tomonda kichik sozlash kerak bo'ladi.", { a: "Protocol", b: "HTTPS" })}</Tip>}
          </Step>

          {/* 5 */}
          <Step n={5} title={t("ISUP'ni o'chiring")} note={t("Ixtiyoriy — terminalda ISUP yoqilgan bo'lsa")}>
            <Item>
              {t("Oching:")} <Path parts={["Configuration", "Network", "Platform Access"]} />{" "}
              <span className="text-v2-text-2">{t("(ba'zi proshivkada — «{x}»)", { x: "Device Access" })}</span>
            </Item>
            <Item>{t("«{a}» bandida «{b}» belgisini olib tashlang va «{c}» ni bosing.", { a: "ISUP", b: "Enable", c: "Save" })}</Item>
            <Item>
              <span className="text-v2-text-2">{t("ISUP endi kerak emas — davomat HTTP Listening orqali keladi. O'chirmasangiz ham davomatga zarar qilmaydi.")}</span>
            </Item>
          </Step>

          {/* 6 */}
          <Step n={6} title={t("Odamlarni terminalga qo'shing")} note={t("Xodimlar ham, o'quvchilar ham — har biri bir marta")}>
            <Item>
              {t("Terminal ekranida admin menyusiga kiring (1-qadamdagidek) va oching:")} <Path parts={["User", "+"]} />
            </Item>
            <Item>{t("«{x}» — har odamga alohida raqam (1, 2, 3 …). CRM'da odam shu raqam bilan bog'lanadi.", { x: "Employee ID" })}</Item>
            <Item>{t("«{x}» — CRM'dagidek «Familiya Ism» yozing. Ism CRM'dagi bilan aynan bir xil bo'lsa, bu sahifada bir bosishda bog'lanadi.", { x: "Name" })}</Item>
            <Item>{t("«{x}» ni bosing, yuzni ramka o'rtasiga qarating, suratga oling, keyin ✓ va saqlash belgisini bosing.", { x: "Face" })}</Item>
            <Item>
              {t("Kompyuterdan ham qo'shish mumkin:")} <Path parts={["Person Management", "Add"]} />{" "}
              <span className="text-v2-text-2">{t("— xuddi shu maydonlar, yuz rasmini yuklash bilan.")}</span>
            </Item>
            <Tip>{t("Yuzga rasm olishda: kameraga tik qarang, ifoda tabiiy bo'lsin, ko'zoynak va bosh kiyimsiz, soch ko'zni yopmasin. Terminalgacha 0,5 m atrofida turing.")}</Tip>
          </Step>

          {/* 7 */}
          <Step n={7} title={t("Tekshiring")} note={t("Shu sahifada, 1 daqiqa ichida")}>
            <Item>{t("Terminal oldida turing — ekranda yashil tasdiq chiqsin.")}</Item>
            <Item>
              {t("Bu sahifada terminal «Ulangan» bo'ladi, odam esa «Bog'lanmagan odamlar» ro'yxatida chiqadi.")}
              {picked && (
                <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
                  <span className="text-v2-small text-v2-text-2">{t("Hozir:")}</span>
                  <StatePill state={picked.state} />
                </span>
              )}
            </Item>
            <Item>{t("«Bog'lash» tugmasini bosing — o'sha o'tish davomatga yoziladi. Keyingi o'tishlar o'zi yoziladi.")}</Item>
            <Item>
              <span className="text-v2-text-2">{t("Kunning birinchi o'tishi — «keldi», kamida 30 daqiqadan keyingi o'tish — «ketdi» (eng oxirgisi hisoblanadi).")}</span>
            </Item>
          </Step>
        </ol>

        {/* Ishlamasa */}
        <div className="rounded-v2-md border border-v2-border p-3">
          <h3 className="font-semibold text-v2-text">{t("Ishlamasa")}</h3>
          <ul className="mt-2 space-y-1.5 text-v2-body text-v2-text">
            <Item>{t("Terminal «Hali ulanmagan» qolsa: terminal internetga chiqyaptimi, URL oxirigacha to'liq nusxalanganmi, port va protokol to'g'rimi — tekshiring.")}</Item>
            <Item>{t("Odam ro'yxatda chiqmasa: terminal uni tanidimi (ekranda yashil yozuv). Notanish yuz CRM'ga yuborilmaydi.")}</Item>
            <Item>{t("Kelgan-ketgan vaqti noto'g'ri yozilsa — 3-qadamni qayta qiling.")}</Item>
          </ul>
        </div>

        <Tip tone="warn">{t("URL'dagi kalit — terminal paroli kabi: kimdir bilsa, shu terminal nomidan davomat yubora oladi. Boshqalarga bermang.")}</Tip>
      </div>
    </V2Dialog>
  );
}
