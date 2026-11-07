import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

// Sem caracteres ambíguos (0/O, 1/l/I)
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function gerarSenhaTemporaria(tamanho = 12) {
  return Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

export function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}
