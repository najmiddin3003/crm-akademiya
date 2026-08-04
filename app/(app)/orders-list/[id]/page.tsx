"use client";

import { useParams } from "next/navigation";
import OrderDetailPage from "@/components/orders/OrderDetailPage";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <OrderDetailPage orderId={Number(params.id)} />;
}
