import { OrdersProvider } from "@/components/orders/OrdersContext";
import { PupilsProvider } from "@/components/orders/PupilsContext";

// Scopes the shared orders + pupils stores to this route segment so the
// list page, /orders-list/[id] (order detail), and /orders-list/add all
// read/write the same records across client-side navigation.
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrdersProvider>
      <PupilsProvider>{children}</PupilsProvider>
    </OrdersProvider>
  );
}
