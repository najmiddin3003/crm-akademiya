// Nazorat > Xodimlar reytingi (crm-akademiya #view-nazorat-staff-rating,
// src/app.js STAFF_RATINGS/renderStaffRating() ~line 28674). Sidebar:
// Nazorat > Xodimlar reytingi, href /nazorat-staff-rating.
export const SR_TEACHERS = [
  { name: "Jasurbek O'rinboyev", weight: 70 },
  { name: "Abdullo Rahmatullayev", weight: 18 },
  { name: "Otabek Nurmatov", weight: 8 },
  { name: "Bekzod Aliyev", weight: 4 },
];

export const SR_STUDENTS = [
  "Raximova Farangiz", "Mamasoliyeva Laylo", "Karimova Nilufar", "Saidova Munira",
  "Tursunova Sarvinoz", "Yusupov Karim", "Akbarova Sevinch", "Nazarov Sardor",
];

export const SR_COURSES = ["Ingliz tili", "Matematika", "Dasturlash"];

export const SR_GROUPS_BY_COURSE = {
  "Ingliz tili": ["9", "UJDCHJ1012ING", "RASPSH46ING"],
  Matematika: ["MAT-101", "MAT-202"],
  Dasturlash: ["JS-12", "PY-08"],
};

export const SR_NOTES = ["", "", "", "", "", "Yaxshi tushuntirdi", "Mashqlarni ko'p berdi", "Sabrli o'qituvchi", "Darslar qiziq", "Ko'proq amaliyot kerak"];

export const SR_ALL_GROUPS = Object.values(SR_GROUPS_BY_COURSE).flat();

export const SR_RATING_OPTIONS = [5, 4, 3, 2, 1];
