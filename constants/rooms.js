import { GROUP_ROOMS } from "./groups";

// Guruh → Xonalar uchun demo ma'lumotlar. Standart xonalar (GROUP_ROOMS: 201..219,
// 215 xonasiz — 18 ta) + bir nechta maxsus xona. Backend `/api/rooms` bo'sh
// kolleksiyani shu massivdan seed qiladi.
export const ROOM_SEED = [
  ...GROUP_ROOMS.map((name, i) => ({ id: i + 1, name, capacity: 35, note: "" })),
  { id: GROUP_ROOMS.length + 1, name: "Ustozlar xonasi", capacity: 10, note: "" },
  { id: GROUP_ROOMS.length + 2, name: "s1", capacity: 35, note: "" },
  { id: GROUP_ROOMS.length + 3, name: "240-xona", capacity: 15, note: "hello" },
];
