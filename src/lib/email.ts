import "server-only";
import nodemailer from "nodemailer";

// Envio por SMTP quando SMTP_HOST estiver no .env. Sem SMTP o portal continua funcionando:
// a senha temporária aparece na tela para o admin repassar.
export function emailConfigurado() {
  return Boolean(process.env.SMTP_HOST);
}

function transporte() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function enviarSenhaTemporaria(p: { para: string; nome: string; senha: string; motivo: "nova_conta" | "redefinicao" }) {
  const url = process.env.APP_URL || "http://localhost:3000";
  const assunto = p.motivo === "nova_conta" ? "Seu acesso ao Portal de Dashboards" : "Sua senha do Portal de Dashboards foi redefinida";
  const texto = [
    `Olá, ${p.nome}.`,
    "",
    p.motivo === "nova_conta" ? "Uma conta foi criada para você no Portal de Dashboards." : "Sua senha foi redefinida pelo administrador.",
    "",
    `Endereço: ${url}/login`,
    `E-mail: ${p.para}`,
    `Senha temporária: ${p.senha}`,
    "",
    "No primeiro acesso você deverá escolher uma nova senha.",
  ].join("\n");

  await transporte().sendMail({
    from: process.env.SMTP_FROM || "Portal de Dashboards <nao-responda@localhost>",
    to: p.para,
    subject: assunto,
    text: texto,
  });
}
