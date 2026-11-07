import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const u = await requireUser();
  redirect(u.papel === "admin" ? "/admin" : "/dashboards");
}
