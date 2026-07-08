// Umumiy demo ma'lumotlar: hozircha backend yo'q, shu bois barcha
// "o'quvchilar ro'yxati" ko'rinishidagi sahifalar (masalan Birinchi darsga
// yozilganlar) shu yerdagi bitta STUDENTS massividan foydalanadi. Har doim
// 50 ta yozuv qaytaradi — pastdagi sahifalash (1, 2, 3, ... 20) faqat vizual,
// qaysi sahifa bosilishidan qat'iy nazar hammasi shu 50 ta o'quvchini
// ko'rsataveradi. Backend ulanganda bu massiv real API chaqiruviga almashadi.

export const STATUS_LABELS = {
  YOZILDI: "Yozildi",
  ESLATILDI: "Eslatildi",
  KELDI: "Keldi",
  KELMADI: "Kelmadi",
  QAYTA_BELGILANDI: "Qayta belgilandi",
  GURUHGA_QOSHILDI: "Guruhga qo'shildi",
  RAD_ETDI: "Rad etdi",
  ALOQA_KERAK: "Aloqa kerak",
};

export const COURSES = ["Ingliz tili", "Arab tili", "Rus tili", "Matematika"];
export const LEVELS = ["1-bosqich", "2-bosqich", "3-bosqich"];
export const TEACHERS = [
  "Abdushukur Abdug'aniyev",
  "Yaxyoxo'ja Yigitaliyev",
  "Jasurbek O'rinboyev",
  "Hasanboy Obidov",
  "Sevinch Madaminova",
  "Ilhomjon Sharabidinov",
  "Gulbahor Jo'raboyeva",
  "Jasurbek Komiljonov",
  "Mahmud Toshmatov",
  "Dilnoza Nabijanova",
  "Rayxona To'lqinova",
  "Musoxon Maxamadaliyev",
];
export const MODERATORS = ["Dilmurod Komilov", "Nilufar Sharipova", "Abdulloh Raxmatullayev"];
export const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export const STUDENTS = [
  { id: 3000, name: "Hilola Ahmadjanov", phone: "90 100 00 00", created: "10.04.2025 | 11:21", firstLesson: "01.01.2025 | 08:00", teacher: "Abdushukur Abdug'aniyev", course: "Ingliz tili", level: "1-bosqich", day: "Dushanba", moderator: "Dilmurod Komilov", status: "YOZILDI" },
  { id: 3001, name: "Jahongir Olimova", phone: "91 137 11 23", created: "13.09.2025 | 12:28", firstLesson: "04.06.2025 | 09:07", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "2-bosqich", day: "Seshanba", moderator: "Nilufar Sharipova", status: "ESLATILDI" },
  { id: 3002, name: "Muattar Tursunxojayeva", phone: "93 174 22 46", created: "16.02.2025 | 13:35", firstLesson: "07.11.2025 | 10:14", teacher: "Jasurbek O'rinboyev", course: "Rus tili", level: "3-bosqich", day: "Chorshanba", moderator: "Abdulloh Raxmatullayev", status: "KELDI" },
  { id: 3003, name: "Saida Shodmanov", phone: "94 211 33 69", created: "19.07.2025 | 14:42", firstLesson: "10.04.2025 | 11:21", teacher: "Hasanboy Obidov", course: "Matematika", level: "1-bosqich", day: "Payshanba", moderator: "Dilmurod Komilov", status: "KELMADI" },
  { id: 3004, name: "Aziza Yusupova", phone: "95 248 44 92", created: "22.12.2025 | 15:49", firstLesson: "13.09.2025 | 12:28", teacher: "Sevinch Madaminova", course: "Ingliz tili", level: "2-bosqich", day: "Juma", moderator: "Nilufar Sharipova", status: "QAYTA_BELGILANDI" },
  { id: 3005, name: "Shahnoza Toshpo'latova", phone: "97 285 55 15", created: "25.05.2025 | 16:56", firstLesson: "16.02.2025 | 13:35", teacher: "Ilhomjon Sharabidinov", course: "Arab tili", level: "3-bosqich", day: "Shanba", moderator: "Abdulloh Raxmatullayev", status: "GURUHGA_QOSHILDI" },
  { id: 3006, name: "Maftuna Muhammadjonov", phone: "98 322 66 38", created: "28.10.2025 | 17:03", firstLesson: "19.07.2025 | 14:42", teacher: "Gulbahor Jo'raboyeva", course: "Rus tili", level: "1-bosqich", day: "Yakshanba", moderator: "Dilmurod Komilov", status: "RAD_ETDI" },
  { id: 3007, name: "Ruxshona Xolmirzayeva", phone: "99 359 77 61", created: "03.03.2025 | 08:10", firstLesson: "22.12.2025 | 15:49", teacher: "Jasurbek Komiljonov", course: "Matematika", level: "2-bosqich", day: "Dushanba", moderator: "Nilufar Sharipova", status: "ALOQA_KERAK" },
  { id: 3008, name: "Mushtariy Nasriddinova", phone: "90 396 88 84", created: "06.08.2025 | 09:17", firstLesson: "25.05.2025 | 16:56", teacher: "Mahmud Toshmatov", course: "Ingliz tili", level: "3-bosqich", day: "Seshanba", moderator: "Abdulloh Raxmatullayev", status: "YOZILDI" },
  { id: 3009, name: "Bekzod Orinboyeva", phone: "91 433 99 07", created: "09.01.2025 | 10:24", firstLesson: "28.10.2025 | 17:03", teacher: "Dilnoza Nabijanova", course: "Arab tili", level: "1-bosqich", day: "Chorshanba", moderator: "Dilmurod Komilov", status: "ESLATILDI" },
  { id: 3010, name: "Aziz Abdulazizova", phone: "93 470 10 30", created: "12.06.2025 | 11:31", firstLesson: "03.03.2025 | 08:10", teacher: "Rayxona To'lqinova", course: "Rus tili", level: "2-bosqich", day: "Payshanba", moderator: "Nilufar Sharipova", status: "KELDI" },
  { id: 3011, name: "Sevinch Tumanova", phone: "94 507 21 53", created: "15.11.2025 | 12:38", firstLesson: "06.08.2025 | 09:17", teacher: "Musoxon Maxamadaliyev", course: "Matematika", level: "3-bosqich", day: "Juma", moderator: "Abdulloh Raxmatullayev", status: "KELMADI" },
  { id: 3012, name: "Diyorbek Salimov", phone: "95 544 32 76", created: "18.04.2025 | 13:45", firstLesson: "09.01.2025 | 10:24", teacher: "Abdushukur Abdug'aniyev", course: "Ingliz tili", level: "1-bosqich", day: "Shanba", moderator: "Dilmurod Komilov", status: "QAYTA_BELGILANDI" },
  { id: 3013, name: "Karim Tursunov", phone: "97 581 43 99", created: "21.09.2025 | 14:52", firstLesson: "12.06.2025 | 11:31", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "2-bosqich", day: "Yakshanba", moderator: "Nilufar Sharipova", status: "GURUHGA_QOSHILDI" },
  { id: 3014, name: "Madina Tashkentov", phone: "98 618 54 22", created: "24.02.2025 | 15:59", firstLesson: "15.11.2025 | 12:38", teacher: "Jasurbek O'rinboyev", course: "Rus tili", level: "3-bosqich", day: "Dushanba", moderator: "Abdulloh Raxmatullayev", status: "RAD_ETDI" },
  { id: 3015, name: "Nilufar Ahmadjanov", phone: "99 655 65 45", created: "27.07.2025 | 16:06", firstLesson: "18.04.2025 | 13:45", teacher: "Hasanboy Obidov", course: "Matematika", level: "1-bosqich", day: "Seshanba", moderator: "Dilmurod Komilov", status: "ALOQA_KERAK" },
  { id: 3016, name: "Zuhra Olimova", phone: "90 692 76 68", created: "02.12.2025 | 17:13", firstLesson: "21.09.2025 | 14:52", teacher: "Sevinch Madaminova", course: "Ingliz tili", level: "2-bosqich", day: "Chorshanba", moderator: "Nilufar Sharipova", status: "YOZILDI" },
  { id: 3017, name: "Vasila Tursunxojayeva", phone: "91 729 87 91", created: "05.05.2025 | 08:20", firstLesson: "24.02.2025 | 15:59", teacher: "Ilhomjon Sharabidinov", course: "Arab tili", level: "3-bosqich", day: "Payshanba", moderator: "Abdulloh Raxmatullayev", status: "ESLATILDI" },
  { id: 3018, name: "Abdusamad Shodmanov", phone: "93 766 98 14", created: "08.10.2025 | 09:27", firstLesson: "27.07.2025 | 16:06", teacher: "Gulbahor Jo'raboyeva", course: "Rus tili", level: "1-bosqich", day: "Juma", moderator: "Dilmurod Komilov", status: "KELDI" },
  { id: 3019, name: "Samandar Yusupova", phone: "94 803 09 37", created: "11.03.2025 | 10:34", firstLesson: "02.12.2025 | 17:13", teacher: "Jasurbek Komiljonov", course: "Matematika", level: "2-bosqich", day: "Shanba", moderator: "Nilufar Sharipova", status: "KELMADI" },
  { id: 3020, name: "Qosimjon Toshpo'latova", phone: "95 840 20 60", created: "14.08.2025 | 11:41", firstLesson: "05.05.2025 | 08:20", teacher: "Mahmud Toshmatov", course: "Ingliz tili", level: "3-bosqich", day: "Yakshanba", moderator: "Abdulloh Raxmatullayev", status: "QAYTA_BELGILANDI" },
  { id: 3021, name: "Asal Muhammadjonov", phone: "97 877 31 83", created: "17.01.2025 | 12:48", firstLesson: "08.10.2025 | 09:27", teacher: "Dilnoza Nabijanova", course: "Arab tili", level: "1-bosqich", day: "Dushanba", moderator: "Dilmurod Komilov", status: "GURUHGA_QOSHILDI" },
  { id: 3022, name: "Tojixon Xolmirzayeva", phone: "98 914 42 06", created: "20.06.2025 | 13:55", firstLesson: "11.03.2025 | 10:34", teacher: "Rayxona To'lqinova", course: "Rus tili", level: "2-bosqich", day: "Seshanba", moderator: "Nilufar Sharipova", status: "RAD_ETDI" },
  { id: 3023, name: "Gulasal Nasriddinova", phone: "99 951 53 29", created: "23.11.2025 | 14:02", firstLesson: "14.08.2025 | 11:41", teacher: "Musoxon Maxamadaliyev", course: "Matematika", level: "3-bosqich", day: "Chorshanba", moderator: "Abdulloh Raxmatullayev", status: "ALOQA_KERAK" },
  { id: 3024, name: "Nazokat Orinboyeva", phone: "90 988 64 52", created: "26.04.2025 | 15:09", firstLesson: "17.01.2025 | 12:48", teacher: "Abdushukur Abdug'aniyev", course: "Ingliz tili", level: "1-bosqich", day: "Payshanba", moderator: "Dilmurod Komilov", status: "YOZILDI" },
  { id: 3025, name: "Davron Abdulazizova", phone: "91 125 75 75", created: "01.09.2025 | 16:16", firstLesson: "20.06.2025 | 13:55", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "2-bosqich", day: "Juma", moderator: "Nilufar Sharipova", status: "ESLATILDI" },
  { id: 3026, name: "Odina Tumanova", phone: "93 162 86 98", created: "04.02.2025 | 17:23", firstLesson: "23.11.2025 | 14:02", teacher: "Jasurbek O'rinboyev", course: "Rus tili", level: "3-bosqich", day: "Shanba", moderator: "Abdulloh Raxmatullayev", status: "KELDI" },
  { id: 3027, name: "Dildora Salimov", phone: "94 199 97 21", created: "07.07.2025 | 08:30", firstLesson: "26.04.2025 | 15:09", teacher: "Hasanboy Obidov", course: "Matematika", level: "1-bosqich", day: "Yakshanba", moderator: "Dilmurod Komilov", status: "KELMADI" },
  { id: 3028, name: "Dilshoda Tursunov", phone: "95 236 08 44", created: "10.12.2025 | 09:37", firstLesson: "01.09.2025 | 16:16", teacher: "Sevinch Madaminova", course: "Ingliz tili", level: "2-bosqich", day: "Dushanba", moderator: "Nilufar Sharipova", status: "QAYTA_BELGILANDI" },
  { id: 3029, name: "Feruza Tashkentov", phone: "97 273 19 67", created: "13.05.2025 | 10:44", firstLesson: "04.02.2025 | 17:23", teacher: "Ilhomjon Sharabidinov", course: "Arab tili", level: "3-bosqich", day: "Seshanba", moderator: "Abdulloh Raxmatullayev", status: "GURUHGA_QOSHILDI" },
  { id: 3030, name: "Umida Ahmadjanov", phone: "98 310 30 90", created: "16.10.2025 | 11:51", firstLesson: "07.07.2025 | 08:30", teacher: "Gulbahor Jo'raboyeva", course: "Rus tili", level: "1-bosqich", day: "Chorshanba", moderator: "Dilmurod Komilov", status: "RAD_ETDI" },
  { id: 3031, name: "Karomat Olimova", phone: "99 347 41 13", created: "19.03.2025 | 12:58", firstLesson: "10.12.2025 | 09:37", teacher: "Jasurbek Komiljonov", course: "Matematika", level: "2-bosqich", day: "Payshanba", moderator: "Nilufar Sharipova", status: "ALOQA_KERAK" },
  { id: 3032, name: "Azizbek Tursunxojayeva", phone: "90 384 52 36", created: "22.08.2025 | 13:05", firstLesson: "13.05.2025 | 10:44", teacher: "Mahmud Toshmatov", course: "Ingliz tili", level: "3-bosqich", day: "Juma", moderator: "Abdulloh Raxmatullayev", status: "YOZILDI" },
  { id: 3033, name: "Bahodir Shodmanov", phone: "91 421 63 59", created: "25.01.2025 | 14:12", firstLesson: "16.10.2025 | 11:51", teacher: "Dilnoza Nabijanova", course: "Arab tili", level: "1-bosqich", day: "Shanba", moderator: "Dilmurod Komilov", status: "ESLATILDI" },
  { id: 3034, name: "Sardor Yusupova", phone: "93 458 74 82", created: "28.06.2025 | 15:19", firstLesson: "19.03.2025 | 12:58", teacher: "Rayxona To'lqinova", course: "Rus tili", level: "2-bosqich", day: "Yakshanba", moderator: "Nilufar Sharipova", status: "KELDI" },
  { id: 3035, name: "Akmal Toshpo'latova", phone: "94 495 85 05", created: "03.11.2025 | 16:26", firstLesson: "22.08.2025 | 13:05", teacher: "Musoxon Maxamadaliyev", course: "Matematika", level: "3-bosqich", day: "Dushanba", moderator: "Abdulloh Raxmatullayev", status: "KELMADI" },
  { id: 3036, name: "Jamol Muhammadjonov", phone: "95 532 96 28", created: "06.04.2025 | 17:33", firstLesson: "25.01.2025 | 14:12", teacher: "Abdushukur Abdug'aniyev", course: "Ingliz tili", level: "1-bosqich", day: "Seshanba", moderator: "Dilmurod Komilov", status: "QAYTA_BELGILANDI" },
  { id: 3037, name: "Sherzod Xolmirzayeva", phone: "97 569 07 51", created: "09.09.2025 | 08:40", firstLesson: "28.06.2025 | 15:19", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "2-bosqich", day: "Chorshanba", moderator: "Nilufar Sharipova", status: "GURUHGA_QOSHILDI" },
  { id: 3038, name: "Otabek Nasriddinova", phone: "98 606 18 74", created: "12.02.2025 | 09:47", firstLesson: "03.11.2025 | 16:26", teacher: "Jasurbek O'rinboyev", course: "Rus tili", level: "3-bosqich", day: "Payshanba", moderator: "Abdulloh Raxmatullayev", status: "RAD_ETDI" },
  { id: 3039, name: "Jasur Orinboyeva", phone: "99 643 29 97", created: "15.07.2025 | 10:54", firstLesson: "06.04.2025 | 17:33", teacher: "Hasanboy Obidov", course: "Matematika", level: "1-bosqich", day: "Juma", moderator: "Dilmurod Komilov", status: "ALOQA_KERAK" },
  { id: 3040, name: "Anvar Abdulazizova", phone: "90 680 40 20", created: "18.12.2025 | 11:01", firstLesson: "09.09.2025 | 08:40", teacher: "Sevinch Madaminova", course: "Ingliz tili", level: "2-bosqich", day: "Shanba", moderator: "Nilufar Sharipova", status: "YOZILDI" },
  { id: 3041, name: "Sanjar Tumanova", phone: "91 717 51 43", created: "21.05.2025 | 12:08", firstLesson: "12.02.2025 | 09:47", teacher: "Ilhomjon Sharabidinov", course: "Arab tili", level: "3-bosqich", day: "Yakshanba", moderator: "Abdulloh Raxmatullayev", status: "ESLATILDI" },
  { id: 3042, name: "Murod Salimov", phone: "93 754 62 66", created: "24.10.2025 | 13:15", firstLesson: "15.07.2025 | 10:54", teacher: "Gulbahor Jo'raboyeva", course: "Rus tili", level: "1-bosqich", day: "Dushanba", moderator: "Dilmurod Komilov", status: "KELDI" },
  { id: 3043, name: "Rustam Tursunov", phone: "94 791 73 89", created: "27.03.2025 | 14:22", firstLesson: "18.12.2025 | 11:01", teacher: "Jasurbek Komiljonov", course: "Matematika", level: "2-bosqich", day: "Seshanba", moderator: "Nilufar Sharipova", status: "KELMADI" },
  { id: 3044, name: "Iroda Tashkentov", phone: "95 828 84 12", created: "02.08.2025 | 15:29", firstLesson: "21.05.2025 | 12:08", teacher: "Mahmud Toshmatov", course: "Ingliz tili", level: "3-bosqich", day: "Chorshanba", moderator: "Abdulloh Raxmatullayev", status: "QAYTA_BELGILANDI" },
  { id: 3045, name: "Zilola Ahmadjanov", phone: "97 865 95 35", created: "05.01.2025 | 16:36", firstLesson: "24.10.2025 | 13:15", teacher: "Dilnoza Nabijanova", course: "Arab tili", level: "1-bosqich", day: "Payshanba", moderator: "Dilmurod Komilov", status: "GURUHGA_QOSHILDI" },
  { id: 3046, name: "Malika Olimova", phone: "98 902 06 58", created: "08.06.2025 | 17:43", firstLesson: "27.03.2025 | 14:22", teacher: "Rayxona To'lqinova", course: "Rus tili", level: "2-bosqich", day: "Juma", moderator: "Nilufar Sharipova", status: "RAD_ETDI" },
  { id: 3047, name: "Gulnoza Tursunxojayeva", phone: "99 939 17 81", created: "11.11.2025 | 08:50", firstLesson: "02.08.2025 | 15:29", teacher: "Musoxon Maxamadaliyev", course: "Matematika", level: "3-bosqich", day: "Shanba", moderator: "Abdulloh Raxmatullayev", status: "ALOQA_KERAK" },
  { id: 3048, name: "Dilfuza Shodmanov", phone: "90 976 28 04", created: "14.04.2025 | 09:57", firstLesson: "05.01.2025 | 16:36", teacher: "Abdushukur Abdug'aniyev", course: "Ingliz tili", level: "1-bosqich", day: "Yakshanba", moderator: "Dilmurod Komilov", status: "YOZILDI" },
  { id: 3049, name: "Mohira Yusupova", phone: "91 113 39 27", created: "17.09.2025 | 10:04", firstLesson: "08.06.2025 | 17:43", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "2-bosqich", day: "Dushanba", moderator: "Nilufar Sharipova", status: "ESLATILDI" },
];
