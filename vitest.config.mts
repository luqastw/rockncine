import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // espelha o `paths` do tsconfig.json — sem isto, nenhum módulo que importa
    // "@/..." resolve dentro dos testes (o Vitest não lê compilerOptions.paths).
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // Sem isto, um ambiente que exporte NODE_ENV=production faz o React
    // resolver o build de PRODUÇÃO, onde `act` não é exportado — e o React
    // Testing Library quebra com "React.act is not a function" antes de rodar
    // qualquer teste. Forçar aqui protege também quem chama `npx vitest run`
    // direto, sem passar pelo script do npm.
    env: {
      NODE_ENV: "test",
    },
  },
});
