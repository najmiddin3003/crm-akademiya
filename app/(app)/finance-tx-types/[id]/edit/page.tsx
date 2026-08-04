import TransactionTypeFormPage from "@/components/finance/TransactionTypeFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionTypeFormPage typeId={Number(id)} />;
}
