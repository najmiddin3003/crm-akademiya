// MOLIYA → «SHARTNOMALAR» (32-qism) — o'quvchi bilan o'qish va to'lov shartnomasi. Klient va server uchun.
// Server: lib/studentContracts.ts; API: app/api/student-contracts.

export type ContractStatus = "pending" | "signed" | "cancelled";
/** Ko'rinadigan holat: imzolangan, lekin muddati yaqin / o'tgan — alohida. */
export type ContractView = "pending" | "signed" | "expiring" | "expired" | "cancelled";
export type SignerRelation = "onasi" | "otasi" | "o'zi" | "vasiy";

export const EXPIRING_DAYS = 14;

export interface StudentContract {
  id: number;
  /** «A1-2026/0131» — filial, yil, tartib raqami. */
  no: string;
  branchId: number;
  pupilId: number;
  pupilName: string;
  groupId: number | null;
  groupLabel: string;
  course: string;
  signerName: string;
  signerRelation: SignerRelation;
  signerPhone: string;
  price: number;
  from: string;
  to: string;
  status: ContractStatus;
  signedAt: string | null;
  signedVia: "qog'oz" | "kabinet" | null;
  cancelledAt: string | null;
  cancelReason: string;
  createdAt: string;
  createdBy: string;
  /** Uzaytirishlar tarixi. */
  extended?: { from: string; to: string; at: string; by: string }[];
}

export interface ContractRow extends StudentContract {
  view: ContractView;
  /** Muddatigacha qolgan kun (imzolangan va tugamagan). */
  daysLeft: number | null;
}

export const VIEW_LABELS: Record<ContractView, string> = {
  pending: "Imzo kutilmoqda",
  signed: "Imzolangan",
  expiring: "Muddati tugaydi",
  expired: "Muddati tugagan",
  cancelled: "Bekor qilingan",
};

export const RELATION_LABELS: Record<SignerRelation, string> = {
  onasi: "onasi",
  otasi: "otasi",
  "o'zi": "o'zi, 18 yoshdan katta",
  vasiy: "vasiysi",
};

export interface ContractPrefill {
  ok: true;
  pupil: { id: number; name: string; phone: string; branchId: number };
  parents: { relation: SignerRelation; name: string; phone: string }[];
  groups: { id: number; label: string; course: string; price: number | null }[];
  defaultTo: string;
}
