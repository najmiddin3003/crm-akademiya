import CourseForm from "@/components/offline-courses/CourseForm";

// ?name=... — kurs nomini oldindan to'ldirish uchun (buyurtma detalidagi fan
// hali kurslar ro'yxatida bo'lmaganda o'sha yerdan shu manzilga o'tiladi).
export default async function Page({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  return <CourseForm initialName={name} />;
}
