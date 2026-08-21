// Código de convite curto e ditável. `Room.code` já existe no schema (String
// @unique) com `@default(cuid())` — um cuid de 25 caracteres aleatórios é
// impossível de ditar pro amigo entrar na sala, que é exatamente o uso que a
// seção 8 de docs/specs/01-fundacao-mvp/spec.md atribui a ele. Aqui o valor é gerado na aplicação e
// passado explicitamente no `create`, sem mudança de schema/migração; salas
// antigas continuam válidas com o código longo que já têm.
//
// Alfabeto sem 0/O, 1/I/L e U: elimina ambiguidade ao ditar e ao ler em mono.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;

export function generateRoomCode(length = CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
