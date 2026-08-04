// Guruh → Xonalar (group/rooms). MongoDB `rooms` kolleksiyasi.
export interface Room {
  id: number;
  name: string; // Sarlavha — xona nomi
  capacity: number; // O'quvchi sig'imi
  note: string; // Izoh
}
