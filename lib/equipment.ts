// Guruh → Jihozlar (group/equipments). MongoDB `equipment` kolleksiyasi.
export interface Equipment {
  id: number;
  name: string; // Jihoz nomi
  inventoryCode: string; // Inventar kodi — bo'sh qoldirilsa avtomatik yaratiladi
  price: number; // Narxi (dona uchun)
  createdAt: string; // Yaratilgan sana — "DD.MM.YYYY | HH:mm"
}
