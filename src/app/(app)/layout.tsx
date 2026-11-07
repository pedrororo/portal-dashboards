import { requireUser } from "@/lib/auth";
import { Topo } from "@/components/Topo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUser();
  return (
    <>
      <Topo usuario={usuario} />
      <main>{children}</main>
    </>
  );
}
