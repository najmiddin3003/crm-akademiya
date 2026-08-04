export interface Feedback {
  id: number;
  filial: string;
  from: string;
  name: string;
  phone: string;
  type: "Shikoyat" | "Taklif" | "Maqtov" | "Boshqa";
  izoh: string;
  createdAt: string;
}
