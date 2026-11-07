import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="login">
      <div className="card login-card">
        <h1>Portal de Dashboards</h1>
        <p className="muted">Entre com o e-mail e a senha fornecidos pelo administrador.</p>
        <LoginForm />
      </div>
    </main>
  );
}
