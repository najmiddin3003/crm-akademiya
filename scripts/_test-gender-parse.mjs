// Jins javobini o'qish mantig'ining sinovi (tarmoqqa chiqmaydi).
//
//   node --import ./scripts/_ts-alias.mjs scripts/_test-gender-parse.mjs
//
// ENG MUHIM HOLAT: "female" ichida "male" bor. `includes("male")` bilan
// yozilsa HAR BIR AYOL erkakka aylanib ketardi — quyidagi 2- va 5-satr
// aynan shuni ushlaydi.
import { chatBody, readGender } from "../lib/genderGuess.ts";

const cases = [
  ["male", "male"],
  ["female", "female"],
  ["Male\n", "male"],
  ["  FEMALE  ", "female"],
  ["The answer is female.", "female"],
  ["unknown", ""],
  ["", ""],
  [null, ""],
  ["ayol", ""],
  ["malelike", ""],
];

let bad = 0;
for (const [input, want] of cases) {
  const got = readGender(input);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "XATO"}  ${JSON.stringify(input)} -> ${JSON.stringify(got)}${ok ? "" : ` (kutilgan: ${JSON.stringify(want)})`}`);
}
console.log(bad === 0 ? `\n${cases.length} ta holat — hammasi to'g'ri` : `\n${bad} ta XATO`);

// So'rov tanasi: yangi modellar rad etadigan maydonlar (temperature,
// max_tokens, response_format) YO'Q ekanini tekshiramiz.
const body = chatBody("test-model", "Aziza Karimova");
const forbidden = ["temperature", "max_tokens", "response_format", "top_p"];
const extra = forbidden.filter((k) => k in body);
console.log("\nso'rov tanasi:", JSON.stringify(body));
console.log(extra.length === 0 ? "ortiqcha maydon yo'q — ok" : `XATO: ${extra.join(", ")}`);
if (extra.length > 0) bad++;

process.exit(bad === 0 ? 0 : 1);
