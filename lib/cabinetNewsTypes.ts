// Yangiliklar va hikoyalar (36-qism) — klient va server uchun umumiy turlar (lib/cabinetNews.ts).

export type NewsType = "news" | "story";
export type NewsWho = "all" | "students" | "parents";
export type NewsState = "draft" | "scheduled" | "published" | "expired";
export const NEWS_ICONS = ["info", "trophy", "gift", "chart", "sun", "book", "percent", "users"] as const;
export type NewsIcon = (typeof NEWS_ICONS)[number];


export interface NewsAudience {
  scope: "all" | "branch" | "course" | "group";
  who: NewsWho;
  branchId?: number;
  course?: string;
  groupId?: number;
}

export interface NewsRow {
  id: number;
  type: NewsType;
  title: string;
  body: string;
  image: string;
  icon: NewsIcon;
  audience: NewsAudience;
  draft: boolean;
  publishAt: string;
  telegram: boolean;
  tgSent?: number;
  createdBy: string;
  createdAt: string;
  state: NewsState;
  views: number;
  total: number;
  audienceLabel: { main: string; sub: string };
}

/** Kabinetdagi yangilik/hikoya (lib/cabinetNews.ts → cabinetFeed). */
export interface CabinetFeedItem {
  id: number;
  type: NewsType;
  title: string;
  body: string;
  image: string;
  icon: NewsIcon;
  publishAt: string;
}
