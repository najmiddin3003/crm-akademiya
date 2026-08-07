// Blok test → Blok test turlari (block-test/types). MongoDB `block_test_types`
// kolleksiyasi.
export interface BlockTestSubject {
  subject: string; // Fan
  questionsCount: number; // Savollar soni
  pointsPerCorrect: number; // Har bir to'g'ri javob uchun ball
}

export interface BlockTestType {
  id: number;
  name: string; // Nomi
  code: string; // Kodi — avtomatik ("BT-0001")
  kind: string; // Turi (kodi) — constants/blockTestTypes.js BLOCK_TEST_KINDS.value
  durationMinutes: number; // Davomiyligi (daqiqa)
  subjects: BlockTestSubject[]; // Fanlar
  active: boolean; // Faol
  createdAt: string; // Qo'shilgan sana — "DD.MM.YYYY | HH:mm"
}
