// MENING HISOBIM (37-qism, rasmlar «Profil», «Xavfsizlik», «Qurilmalar») — klient va server uchun umumiy turlar.

export type StartBranch = "last" | "ask" | string;
export type FilterMode = "button" | "inline" | "separate";

export interface AccountPrefs {
  /** Kirgandan keyin ochiladigan filial: oxirgi tanlangan, har safar so'rash yoki aniq filial id'si. */
  startBranch: StartBranch;
  /** Jadval filtrlari ko'rinishi. */
  filterMode: FilterMode;
  /** Filtrlar ochiq tursin. */
  filtersOpen: boolean;
  /** Avtomatik ekran qulfi — daqiqa; 0 — o'chiq. */
  autoLockMin: number;
}

export const DEFAULT_PREFS: AccountPrefs = { startBranch: "last", filterMode: "button", filtersOpen: false, autoLockMin: 0 };
export const AUTO_LOCK_OPTIONS = [0, 5, 15, 30, 60];

export interface AccountLogin {
  at: string;
  ok: boolean;
  device: string;
  ip: string;
  reason: string;
}

export interface MyAccount {
  ok: true;
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  /** «MM-DD» — yil saqlanmaydi. */
  birthday: string;
  email: string;
  avatar: string;
  roleLabel: string;
  branchesLabel: string;
  branchCount: number;
  branches: { id: number; name: string }[];
  telegram: { linked: boolean; since: string; name: string };
  prefs: AccountPrefs;
  createdAt: string | null;
  updatedAt: string | null;
  passwordUpdatedAt: string | null;
  sessions: { sid: string; label: string; ip: string; createdAt: string; lastSeenAt: string; current: boolean }[];
  logins: AccountLogin[];
}
