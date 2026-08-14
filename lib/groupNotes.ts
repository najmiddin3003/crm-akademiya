// Guruh → Davomat → "Izoh" ustunidagi xabar oynasi uchun umumiy tip.
// API route'lari va klient komponent shu faylni bo'lishadi.
// MongoDB kolleksiyasi: `group_notes`.
export interface GroupNote {
  id: number;
  groupId: number;
  pupilId: number;
  text: string;
  /** "15.08.2026 | 14:00" — loyihadagi boshqa sanalar bilan bir xil format. */
  createdAt: string;
}
