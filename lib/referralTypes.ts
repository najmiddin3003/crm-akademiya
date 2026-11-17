// SOTUV VA MARKETING → «REFERALLAR» (29-qism) — klient va server uchun umumiy.
// Server: lib/referrals.ts; API: app/api/referrals.

export type RefKind = "ustoz" | "oquvchi" | "ota-ona" | "boshqa";
export const REF_KINDS: RefKind[] = ["ustoz", "oquvchi", "ota-ona", "boshqa"];
export const REF_KIND_LABELS: Record<RefKind, string> = { ustoz: "Maktab ustozi", oquvchi: "O'quvchi", "ota-ona": "Ota-ona", boshqa: "Boshqa" };

export type RefVia = "kod" | "havola" | "tavsiya" | "sertifikat";
export const REF_VIA_LABELS: Record<RefVia, string> = { kod: "Kod", havola: "Havola", tavsiya: "Tavsiya", sertifikat: "Sertifikat" };

/** Taklif qilinganning holati: lid → birinchi dars → guruh → to'lov → hisoblandi (+1). */
export type RefState = "lid" | "sinov" | "guruh" | "qisman" | "hisoblandi" | "rad";
export const REF_STATE_LABELS: Record<RefState, string> = {
  lid: "Lid",
  sinov: "Birinchi dars",
  guruh: "Guruhda",
  qisman: "To'lov qisman",
  hisoblandi: "Hisoblandi",
  rad: "Rad etdi",
};

export interface Referrer {
  id: number;
  kind: RefKind;
  name: string;
  phone: string;
  /** «Chortoq, 7-maktab · boshlang'ich sinf», «Diyora va Ismoilning otasi». */
  note: string;
  pupilId: number | null;
  branchId: number;
  code: string;
  createdAt: string;
  createdBy: string;
}

export interface RefLink {
  id: number;
  referrerId: number;
  leadId: number | null;
  pupilId: number | null;
  via: RefVia;
  cert: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface RefGift {
  id: number;
  name: string;
  desc: string;
  price: number;
  stock: number;
  active: boolean;
}

export type RefRequestStatus = "pending" | "approved" | "rejected";
export interface RefRequest {
  id: number;
  referrerId: number;
  giftId: number;
  price: number;
  status: RefRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string;
  comment: string;
}

export interface RefSettings {
  kinds: Record<RefKind, boolean>;
  certificates: boolean;
}
export const DEFAULT_REF_SETTINGS: RefSettings = { kinds: { ustoz: true, oquvchi: true, "ota-ona": true, boshqa: true }, certificates: true };

export interface LinkRow extends RefLink {
  name: string;
  phone: string;
  branchName: string;
  groupLabel: string;
  state: RefState;
  /** «1-oy to'landi · 224 000», «140 000 / 280 000 to'landi», «hali guruhga yozilmagan». */
  stateSub: string;
  /** Hisoblangan sana (birinchi oy to'liq to'langan kun). */
  countedAt: string | null;
  referrerName: string;
  referrerKind: RefKind;
}

export interface ReferrerRow extends Referrer {
  branchName: string;
  invited: number;
  counted: number;
  spent: number;
  balance: number;
  pending: RefRequest | null;
}

export interface ReferralsPayload {
  ok: true;
  today: string;
  branches: { id: number; name: string }[];
  referrers: ReferrerRow[];
  links: LinkRow[];
  gifts: (RefGift & { given: number; canTake: number })[];
  requests: (RefRequest & { referrerName: string; referrerKind: RefKind; giftName: string; balance: number })[];
  settings: RefSettings;
  kpi: { referrers: number; byKind: Record<RefKind, number>; invited: number; paid: number; counted: number; thisMonth: number; prevMonth: number; pendingRequests: number; given: number; balances: number };
}
