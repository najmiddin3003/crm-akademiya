import EmployeeProfilePage from "@/components/employees/EmployeeProfilePage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfilePage id={Number(id)} />;
}
