// O'quvchilar → O'quvchilar manzillari (referens: akademiya.edutizim.uz
// /students/locations — to'liq ekranli Leaflet/OpenStreetMap xaritasi,
// sidebar: O'quvchilar > O'quvchilar manzillari, href /student-addresses).
//
// Manbada har bir belgi (pin) bitta o'quvchining saqlangan manzili (bitta
// o'quvchida bir nechta manzil bo'lishi mumkin — student-edit'dagi "Manzil"
// tabidagi kabi). Backend yo'q — bu sahifa ham o'zining alohida, mustaqil
// generatoriga ega. `id` diapazoni 9000-9199 (studentsList.js'ning 823-6731
// va expiringSubs.js'ning 1-370 diapazonlari bilan to'qnashmasligi uchun) —
// ism/"Batafsil" havolasi /student-edit/[id]ga olib boradi.
//
// Koordinatalar Toshkent markazi (41.2995, 69.2401) atrofida seed'langan —
// haqiqiy uy manzillari emas, faqat xaritada real shaharga mos taqsimot.

const FIRST_NAMES = ["Aziz", "Bobur", "Davron", "Eldor", "Farhod", "Gulnoza", "Hasan", "Iroda", "Jamol", "Kamol", "Laylo", "Maftuna", "Nargiza", "Olim", "Pulat", "Qodir", "Rustam", "Sayyora", "Temur", "Umida", "Vasila", "Yusuf", "Zarina", "Anvar"];
const LAST_NAMES = ["Tursunov", "Karimov", "Nurmatov", "Rasulov", "Saidov", "Yusupov", "Akbarov", "Komilov", "Madaminov", "Obidov", "Mahmudov", "Rahimjanov", "Abdullayev", "Olimov", "Yoqubov", "Erkinov", "Sharipova", "Ismoilova", "Hakimova", "Sobirova"];
const PHONE_PREFIXES = ["90", "91", "93", "94", "97", "98", "99", "88"];
const ADDRESS_TYPES = ["Uy", "Ish"];
const FILIALS = ["Akademiya", "Akademiya 2-filial"];
// Toshkent tumanlari — faqat ko'rinish uchun, taxminiy markaz nuqtalari.
const DISTRICTS = [
  { name: "Chilonzor", lat: 41.2789, lng: 69.2044 },
  { name: "Yunusobod", lat: 41.3506, lng: 69.2878 },
  { name: "Mirzo Ulug'bek", lat: 41.3253, lng: 69.3275 },
  { name: "Yakkasaroy", lat: 41.2914, lng: 69.2632 },
  { name: "Mirobod", lat: 41.2244, lng: 69.2854 },
  { name: "Shayxontohur", lat: 41.3264, lng: 69.2287 },
  { name: "Sergeli", lat: 41.2136, lng: 69.2156 },
  { name: "Uchtepa", lat: 41.3061, lng: 69.1836 },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function seededRnd(seedIn) {
  let seed = seedIn * 9301 + 49297;
  return (min, max) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * (max - min + 1)) + min;
  };
}

function buildStudentAddresses(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rnd = seededRnd(i + 9000);
    const fn = FIRST_NAMES[rnd(0, FIRST_NAMES.length - 1)];
    const ln = LAST_NAMES[rnd(0, LAST_NAMES.length - 1)];
    const pp = PHONE_PREFIXES[rnd(0, PHONE_PREFIXES.length - 1)];
    const phone = `+998${pp}${pad2(rnd(0, 99))}${pad2(rnd(0, 99))}${pad2(rnd(0, 99))}${rnd(0, 9)}`;
    const district = DISTRICTS[rnd(0, DISTRICTS.length - 1)];
    // Tuman markazi atrofida ~2km radiusda tarqatish.
    const lat = district.lat + (rnd(-200, 200) / 10000);
    const lng = district.lng + (rnd(-200, 200) / 10000);

    out.push({
      id: 9000 + i,
      name: `${fn} ${ln}`,
      phone,
      addressType: ADDRESS_TYPES[rnd(0, ADDRESS_TYPES.length - 1)],
      addressLabel: `${district.name} tumani`,
      filial: FILIALS[rnd(0, 9) < 8 ? 0 : 1],
      lat,
      lng,
    });
  }
  return out;
}

export const STUDENT_ADDRESSES = buildStudentAddresses(140);
