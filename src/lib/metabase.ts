// Embed assinado do Metabase (https://www.metabase.com/docs/latest/embedding/static-embedding).
// O token é gerado no servidor a cada visualização, depois da checagem de acesso, e expira rápido:
// copiar o link do navegador não dá acesso permanente.
import { SignJWT } from "jose";

export const VALIDADE_TOKEN_MINUTOS = 10;

export function metabaseConfigurado() {
  return Boolean(process.env.METABASE_SITE_URL && process.env.METABASE_SECRET_KEY);
}

export async function urlEmbedMetabase(
  dashboard: number,
  params: Record<string, string> = {},
  env: { site?: string; segredo?: string } = {}
): Promise<string> {
  const site = (env.site ?? process.env.METABASE_SITE_URL ?? "").replace(/\/$/, "");
  const segredo = env.segredo ?? process.env.METABASE_SECRET_KEY;
  if (!site || !segredo) throw new Error("Metabase não configurado (METABASE_SITE_URL / METABASE_SECRET_KEY)");

  const token = await new SignJWT({ resource: { dashboard }, params })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${VALIDADE_TOKEN_MINUTOS}m`)
    .sign(new TextEncoder().encode(segredo));
  return `${site}/embed/dashboard/${token}#bordered=false&titled=true`;
}
