import Link from "next/link";
import type { Usuario } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export function Topo({ usuario }: { usuario: Usuario }) {
  return (
    <header className="topo">
      <Link href="/" className="marca">Portal de Dashboards</Link>
      <nav>
        <Link href="/dashboards">Dashboards</Link>
        {usuario.papel === "admin" && (
          <>
            <Link href="/admin">Clientes</Link>
            <Link href="/admin/auditoria">Auditoria</Link>
          </>
        )}
      </nav>
      <div className="usuario">
        <span>
          {usuario.nome}
          {usuario.cliente_nome ? ` · ${usuario.cliente_nome}` : " · admin"}
        </span>
        <Link href="/conta">Minha conta</Link>
        <form action={logout}>
          <button type="submit" className="secundario">Sair</button>
        </form>
      </div>
    </header>
  );
}
