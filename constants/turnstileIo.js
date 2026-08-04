// Nazorat > Turniket kirish-chiqish analitikasi uchun demo ma'lumot.
// Backend /api/turnstile-io bo'sh kolleksiyani shu ro'yxatdan seed qiladi.
//
// Xodimlar ro'yxati constants/turnstile.js dagi TA_USERS bilan bir xil
// odamlardan olingan — ikkala turniket sahifasi bir xil jamoani ko'rsatishi
// uchun. Sanalar seed vaqtidagi "bugun"ga bog'lanadi (route.ts da), chunki
// sahifa standart holatda bugungi kunni ko'rsatadi.
export const TURNSTILE_IO_PEOPLE = [
  { name: "Abdulloh Raxmatullayev", type: "employee" },
  { name: "Nilufar Sharipova", type: "employee" },
  { name: "Dilmurod Komilov", type: "employee" },
  { name: "Jasurbek O'rinboyev", type: "employee" },
  { name: "Otabek Nurmatov", type: "employee" },
  { name: "Bekzod Aliyev", type: "employee" },
  { name: "Nodira Teshaboyeva", type: "employee" },
  { name: "Shoxsanam Obidova", type: "employee" },
  { name: "Mohinur Abdurahimova", type: "employee" },
  { name: "Odina Ahmedova", type: "employee" },
  { name: "Sarvinoz Tursunova", type: "student" },
  { name: "Yo'ldashev Tursunboy", type: "student" },
  { name: "Akmalov Sherzod", type: "student" },
  { name: "Karimova Nilufar", type: "student" },
  { name: "Rasulov Sardor", type: "student" },
  { name: "Dilnavoz Zuxriddinova", type: "student" },
  { name: "Ogiloy Toxtaboyeva", type: "student" },
  { name: "Bekzodbek Obidjanov", type: "student" },
  { name: "Zilola Rahimjanova", type: "student" },
  { name: "Dilafruz Ergasheva", type: "student" },
];

// Nechta kun uchun yozuv yaratiladi (bugundan orqaga).
export const TURNSTILE_IO_DAYS = 14;

// Ish boshlanish vaqti — shundan keyin kelgan "kechikkan" hisoblanadi.
export const TURNSTILE_IO_SHIFT_START = "09:00";
