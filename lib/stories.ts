// Sotuv va marketing → Hikoya (sidebar: Sotuv va marketing > Hikoya,
// href /sales-stories). MongoDB `stories` kolleksiyasi.
//
// Instagram-uslubidagi qisqa "story" — rasm/fayl va sarlavha.
export interface Story {
  id: number;
  image: string; // Rasm URL
  title: string; // Sarlavha
  file: string; // Biriktirilgan fayl nomi/URL
  createdAt: string; // "DD.MM.YYYY | HH:mm"
}
