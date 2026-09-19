#!/usr/bin/env bash
# Gate de verificação do RockNCine — fonte canônica.
#
# É o que `npm run gate` executa e o que o CI roda a cada push/PR.
# A skill `.commandcode/skills/quality-gate/` referencia este arquivo; ele mora
# aqui (e não dentro da skill) porque `.commandcode/` é local e não vai para o
# repositório — se o script vivesse lá, o CI quebraria num clone limpo.
#
# Roda, na ordem que funciona neste repo:
#   next typegen -> tsc --noEmit -> eslint . -> vitest run -> next build
#
# Uso:
#   bash scripts/gate.sh [--sem-build] [--dir <path>]
#
# Duas armadilhas de ambiente que este script normaliza (ambas verificadas neste repo):
#
#   1. `tsc` depende de `next-env.d.ts` e `.next/types/**`, que são gerados e gitignored.
#      Num clone limpo o tsc falha com "Cannot find name 'LayoutProps'". `next typegen`
#      resolve sem build completo, por isso roda primeiro.
#
#   2. `NODE_ENV` no ambiente quebra as três pontas:
#        NODE_ENV=production  -> `npm ci` omite devDependencies em silêncio
#                                (sem vitest/eslint/@types/node; gate falha com erro enganoso)
#                                E faz o React resolver o build de produção, onde `act` não
#                                é exportado — RTL morre com "React.act is not a function"
#                                (a vitest.config.mts força NODE_ENV=test, cobrindo esse caso)
#        NODE_ENV=development -> `next build` morre pré-renderizando /_global-error com
#                                "TypeError: Cannot read properties of null (reading 'useContext')"
#      Por isso: instala com NODE_ENV=development e roda o gate com NODE_ENV removido.

set -uo pipefail

DIR="."
RUN_BUILD=1

while [ $# -gt 0 ]; do
  case "$1" in
    --sem-build) RUN_BUILD=0; shift ;;
    --dir) DIR="${2:-.}"; shift 2 ;;
    *) echo "argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done

cd "$DIR" || exit 1

if [ ! -f package.json ]; then
  echo "erro: package.json não encontrado em $(pwd)" >&2
  exit 2
fi

printf '\033[1mGate — RockNCine\033[0m (%s)\n' "$(pwd)"

# --- guarda de dependências ---------------------------------------------------------------
if [ ! -x node_modules/.bin/vitest ] || [ ! -x node_modules/.bin/eslint ]; then
  echo "devDependencies ausentes (NODE_ENV=${NODE_ENV:-<vazio>}) — instalando a árvore completa..."
  NODE_ENV=development npm ci --include=dev || exit 1
else
  echo "dependências ok"
fi

# --- pré-condição de build ---------------------------------------------------------------
if [ ! -f .env ]; then
  echo "AVISO: .env ausente (é gitignored) — o build pode falhar por falta de DATABASE_URL/NEXTAUTH_SECRET."
fi

# NODE_ENV=development quebra o next build; o Next define production por conta própria.
unset NODE_ENV

fail=0
RESULTS=()

run() {
  local label="$1"; shift
  printf '\n\033[1m=== %s ===\033[0m\n' "$label"
  "$@"
  local code=$?
  if [ "$code" -eq 0 ]; then
    RESULTS+=("OK    $label")
  else
    RESULTS+=("FALHA $label (exit $code)")
    fail=1
  fi
  return 0
}

run "next typegen"          npx next typegen
run "typecheck (tsc)"       npx tsc --noEmit
run "lint (eslint)"         npx eslint .
run "testes (vitest)"       npx vitest run
if [ "$RUN_BUILD" -eq 1 ]; then
  run "build (next build)"  npx next build
fi

# --- advisory, não bloqueante -------------------------------------------------------------
printf '\n\033[1m=== npm audit (informativo) ===\033[0m\n'
npm audit --audit-level=critical 2>&1 | tail -12 || true

printf '\n\033[1mResumo\033[0m\n'
for line in "${RESULTS[@]}"; do printf '  %s\n' "$line"; done

if [ "$fail" -ne 0 ]; then
  printf '\n\033[1;31mGATE FALHOU\033[0m\n'
  exit 1
fi

printf '\n\033[1;32mGATE OK\033[0m\n'
