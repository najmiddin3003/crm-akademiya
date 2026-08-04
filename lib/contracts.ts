// O'quv bo'limi → Shartnoma. MongoDB `contracts` kolleksiyasi. Har bir yozuv
// — bitta shartnoma andozasi (sarlavha + tur + boy matn muharriridan HTML).
export interface Contract {
  id: number;
  title: string;
  type: string;
  content: string;
  createdAt: string; // "DD.MM.YYYY"
}
