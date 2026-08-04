export interface DavomatStudent {
  id: number;
  ident: string;
  name: string;
  phone: string;
  balance: number;
  group: string;
  teacher: string;
  moderator: string;
  reason: string;
  state: "attended" | "absent" | "late" | "excused";
}

export function formatDavomatBalance(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}
