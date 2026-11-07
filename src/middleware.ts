// Primeira barreira: sem sessão válida, nenhuma página além do login abre.
// A checagem completa (usuário ativo, papel, acesso ao dashboard) é feita no servidor de cada página.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const id = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!id) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"], // /trocar-senha também exige sessão
};
