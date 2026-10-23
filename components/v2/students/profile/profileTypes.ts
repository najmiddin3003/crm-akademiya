import type { ProfileEntry, ProfileGroup, PupilProfilePayload } from "@/lib/pupilProfile";
import type { ActivityItem } from "./profileActivity";
import type { ProfileFmt } from "./profileBits";
import type { Ledger } from "./profileLedger";

// YANGI VERSIYA — O'QUVCHI SAHIFASI: tablar bo'lishadigan tiplar.

/** Sahifa tablari (`?tab=`); eski profil tablari (`?tab=sms` …) — eski ko'rinish. */
export type ProfileTab = "umumiy" | "tolovlar" | "davomat" | "tarix";
export const PROFILE_TABS: ProfileTab[] = ["umumiy", "tolovlar", "davomat", "tarix"];

/** «To'lov qabul qilish» oynasiga oldindan qo'yiladigan qiymatlar («Shu oyni to'lash →»). */
export interface PayPreset {
  groupId?: number | null;
  /** "YYYY-MM". */
  month?: string;
  amount?: number;
}

export interface TabProps {
  data: PupilProfilePayload;
  ledger: Ledger;
  activity: ActivityItem[];
  fmt: ProfileFmt;
  canPay: boolean;
  canGroups: boolean;
  onPay: (preset?: PayPreset) => void;
  onSms: () => void;
  onAddGroup: () => void;
  onTransfer: (g: ProfileGroup) => void;
  onRemove: (g: ProfileGroup) => void;
  onReceipt: (e: ProfileEntry) => void;
  goTab: (tab: ProfileTab) => void;
}
