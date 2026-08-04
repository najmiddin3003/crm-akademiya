// Sozlamalar → Integratsiyalar. Referens saytdagi provayderlar ro'yxati
// (kategoriyalari va o'rnatilgan/o'rnatilmagan holati bilan).
//
// Holat MongoDB `settings` kolleksiyasida "integration.installed" kaliti
// ostida saqlanadi — bu yerda faqat boshlang'ich qiymat.
export const INTEGRATION_CATEGORIES = [
  "Payment type",
  "Sms",
  "Admittance",
  "Messenger",
  "Mobile",
  "Attendance",
];

export const INTEGRATIONS = [
  { key: "click", name: "Click", category: "Payment type", installed: true },
  { key: "payme", name: "Payme", category: "Payment type", installed: true },
  { key: "payze", name: "Payze", category: "Payment type", installed: false },
  { key: "uzum", name: "Uzum", category: "Payment type", installed: true },
  { key: "multicard", name: "Multicard", category: "Payment type", installed: true },
  { key: "atmos", name: "Atmos", category: "Payment type", installed: false },

  { key: "playMobile", name: "Play mobile", category: "Sms", installed: false },
  { key: "eskiz", name: "Eskiz", category: "Sms", installed: true },
  { key: "osonSms", name: "Oson SMS", category: "Sms", installed: true },

  { key: "coursesBot", name: "Kurslarga yozilish uchun bot", category: "Admittance", installed: true },
  { key: "leadSite", name: "Lead Site Admittance", category: "Admittance", installed: true },
  { key: "kommo", name: "Kommo", category: "Admittance", installed: true },
  { key: "external", name: "External", category: "Admittance", installed: true },
  { key: "googleSheets", name: "Google Sheets", category: "Admittance", installed: false },

  { key: "supportBot", name: "Murojaat bot", category: "Messenger", installed: true },

  { key: "onlinePbx", name: "OnlinePBX", category: "Mobile", installed: true },
  { key: "moizvonki", name: "Moizvonki", category: "Mobile", installed: true },

  { key: "hikvision", name: "Hikvision", category: "Attendance", installed: true },
];
