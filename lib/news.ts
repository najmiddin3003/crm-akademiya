// Sotuv va marketing → Yangiliklar (sidebar: Sotuv va marketing >
// Yangiliklar, href /sales-news). MongoDB `news` kolleksiyasi.
export interface NewsItem {
  id: number;
  image: string; // Rasm URL (bo'sh bo'lishi mumkin)
  title: string; // Sarlavha
  content: string; // Kontent
  views: number; // Ko'rilganlar
  createdAt: string; // "DD-MM-YYYY | HH:mm" — referensdagi format
}
