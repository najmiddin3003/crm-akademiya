import StudentEditPage from "@/components/students/StudentEditPage";
import { createInitialOrders } from "@/lib/ordersData";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = createInitialOrders().find((o) => String(o.id) === id);

  if (!order) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          O&apos;quvchi topilmadi: <strong>{id}</strong>
        </p>
      </div>
    );
  }

  return <StudentEditPage order={order} />;
}
