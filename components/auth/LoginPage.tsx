"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AuthShell from "@/components/auth/AuthShell";
import PhoneField from "@/components/auth/PhoneField";
import PasswordField from "@/components/auth/PasswordField";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (phone.length < 9 || !password.trim()) {
      setError("Telefon raqam va parolni to'liq kiriting");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Kirishda xatolik yuz berdi");
        setLoading(false);
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch {
      setError("Server bilan bog'lanib bo'lmadi");
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold tracking-tight">Kirish</h1>
      <p className="mt-1 text-sm text-muted-foreground">Telefon raqam va parolingizni kiriting</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <PhoneField value={phone} onChange={setPhone} />
        <PasswordField label="Parol" value={password} onChange={setPassword} />

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <Button type="submit" className="w-full justify-center" disabled={loading}>
          {loading ? "Kirilmoqda..." : "Kirish"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Akkountingiz yo&apos;qmi?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </p>
    </AuthShell>
  );
}
