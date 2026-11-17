export type EmojiEntry = { emoji: string; nome: string };

export type EmojiCategory = {
  id: string;
  label: string;
  icon: string;
  emojis: readonly EmojiEntry[];
};

function parse(raw: string): EmojiEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [emoji, nome] = line.split("|");
      return { emoji, nome };
    });
}

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    id: "rostos",
    label: "Rostos",
    icon: "😀",
    emojis: parse(`
😀|sorriso
😃|sorriso de olhos grandes
😄|sorriso com olhos sorrindo
😁|sorriso radiante
😆|riso apertado
😅|riso com suor
😂|chorando de rir
🤣|rolando de rir
🙂|sorriso leve
🙃|rosto de cabeça para baixo
😉|piscadinha
😊|rosto corado sorrindo
😇|anjinho
🥰|apaixonado
😍|olhos de coração
🤩|deslumbrado
😘|beijinho
😋|saboroso
😛|língua para fora
😜|piscadinha com língua
🤪|maluco
🤗|abraço
🤔|pensativo
🤨|sobrancelha levantada
😐|neutro
😑|sem expressão
🙄|revirando os olhos
😏|sorriso de canto
😴|dormindo
😌|aliviado
🤤|babando
😎|óculos escuros
🤓|nerd
🧐|monóculo
😕|confuso
😟|preocupado
🙁|carranca leve
😮|boca aberta
😲|espantado
😳|envergonhado
🥺|olhos suplicantes
😢|chorando
😭|chorando alto
😱|gritando de medo
😖|aflito
😞|decepcionado
😓|suor frio
😤|bufando
😡|furioso
😠|bravo
🤬|xingando
🥵|com calor
🥶|com frio
🤒|doente
🤢|enjoado
🤮|vomitando
🥳|festa
🤯|cabeça explodindo
🤠|chapéu de cowboy
💀|caveira
👻|fantasma
👽|alienígena
🤖|robô
`),
  },
  {
    id: "gestos",
    label: "Gestos",
    icon: "👍",
    emojis: parse(`
👍|joinha
👎|polegar para baixo
👌|ok
✌️|paz
🤞|dedos cruzados
🤟|eu te amo
🤘|rock
🤙|me liga
👈|apontando para a esquerda
👉|apontando para a direita
👆|apontando para cima
👇|apontando para baixo
☝️|dedo para cima
✋|mão levantada
🖐️|mão aberta
👋|tchau
🤚|costas da mão
🖖|saudação vulcana
👏|palmas
🙌|mãos para cima
👐|mãos abertas
🤲|mãos em concha
🤝|aperto de mão
🙏|mãos juntas
✊|punho fechado
👊|soco
🤛|punho para a esquerda
🤜|punho para a direita
💪|braço forte
🦾|braço mecânico
✍️|escrevendo
💅|esmalte
🤳|selfie
👀|olhos
👁️|olho
👂|orelha
👃|nariz
👅|língua
👄|boca
🧠|cérebro
🫶|mãos de coração
🫡|continência
🫠|derretendo
🫣|espiando
🫢|mão na boca
🤭|mão na boca rindo
🤫|silêncio
🫰|dedos de estalo
`),
  },
  {
    id: "coracoes",
    label: "Corações",
    icon: "❤️",
    emojis: parse(`
❤️|coração vermelho
🧡|coração laranja
💛|coração amarelo
💚|coração verde
💙|coração azul
💜|coração roxo
🖤|coração preto
🤍|coração branco
🤎|coração marrom
💔|coração partido
❣️|exclamação de coração
💕|dois corações
💞|corações girando
💓|coração batendo
💗|coração crescendo
💖|coração brilhante
💘|coração com flecha
💝|coração com laço
💟|enfeite de coração
💌|carta de amor
💋|marca de beijo
💍|anel
💯|cem pontos
💢|raiva
💥|explosão
💫|tontura
💦|gotas de suor
💨|correndo
💤|sono
🔥|fogo
✨|brilhos
⭐|estrela
🌟|estrela brilhante
🎉|festa
🎊|confete
`),
  },
  {
    id: "natureza",
    label: "Natureza",
    icon: "🌿",
    emojis: parse(`
🐶|cachorro
🐱|gato
🐭|rato
🐹|hamster
🐰|coelho
🦊|raposa
🐻|urso
🐼|panda
🐨|coala
🐯|tigre
🦁|leão
🐮|vaca
🐷|porco
🐸|sapo
🐵|macaco
🙈|macaco que não vê
🙉|macaco que não ouve
🙊|macaco que não fala
🐔|galinha
🐧|pinguim
🐦|passarinho
🦉|coruja
🦇|morcego
🐺|lobo
🐴|cavalo
🦄|unicórnio
🐝|abelha
🦋|borboleta
🐌|caracol
🐞|joaninha
🐢|tartaruga
🐍|cobra
🐙|polvo
🐬|golfinho
🐳|baleia
🦈|tubarão
🐘|elefante
🦒|girafa
🐉|dragão
🌲|pinheiro
🌳|árvore
🌴|palmeira
🌵|cacto
🌿|erva
🍀|trevo
🍁|folha de bordo
🍂|folhas caídas
🌱|broto
🌷|tulipa
🌹|rosa
🌻|girassol
🌸|flor de cerejeira
🍄|cogumelo
🌙|lua
☀️|sol
☁️|nuvem
🌧️|chuva
⚡|raio
❄️|floco de neve
🌈|arco-íris
🌊|onda
🌍|planeta Terra
`),
  },
  {
    id: "comida",
    label: "Comida",
    icon: "🍕",
    emojis: parse(`
🍎|maçã vermelha
🍐|pera
🍊|laranja
🍋|limão
🍌|banana
🍉|melancia
🍇|uvas
🍓|morango
🍒|cerejas
🍑|pêssego
🥭|manga
🍍|abacaxi
🥥|coco
🥑|abacate
🍅|tomate
🥕|cenoura
🌽|milho
🥔|batata
🍞|pão
🥐|croissant
🧀|queijo
🥚|ovo
🥓|bacon
🍗|coxa de frango
🍖|carne no osso
🌭|cachorro-quente
🍔|hambúrguer
🍟|batata frita
🍕|pizza
🌮|taco
🌯|burrito
🍝|espaguete
🍜|macarrão
🍲|panelada
🍣|sushi
🍤|camarão frito
🍙|bolinho de arroz
🍦|sorvete
🍩|rosquinha
🍪|biscoito
🎂|bolo de aniversário
🍰|fatia de bolo
🍫|chocolate
🍬|bala
🍭|pirulito
🍿|pipoca
☕|café
🍵|chá
🥤|copo com canudo
🍺|cerveja
🍷|vinho
🥂|brinde
🍾|garrafa com rolha
`),
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: "🎮",
    emojis: parse(`
⚽|bola de futebol
🏀|bola de basquete
🏈|futebol americano
⚾|beisebol
🎾|tênis
🏐|vôlei
🏉|rúgbi
🎱|bilhar
🏓|pingue-pongue
🏸|badminton
🥊|luva de boxe
🥋|kimono
⛳|bandeira de golfe
🏹|arco e flecha
🎣|pescaria
🎿|esqui
🏂|snowboard
🏆|troféu
🥇|medalha de ouro
🥈|medalha de prata
🥉|medalha de bronze
🎯|alvo
🎮|videogame
🕹️|joystick
🎲|dado
🧩|quebra-cabeça
🎭|máscaras de teatro
🎨|paleta de tintas
🎬|claquete
🎤|microfone
🎧|fones de ouvido
🎼|partitura
🎹|teclado musical
🥁|bateria
🎷|saxofone
🎸|guitarra
🎺|trompete
🎻|violino
🍿|pipoca de cinema
🎟️|ingresso
🎪|circo
🚗|carro
🚀|foguete
✈️|avião
🚲|bicicleta
⛵|veleiro
`),
  },
  {
    id: "objetos",
    label: "Objetos",
    icon: "💡",
    emojis: parse(`
💡|lâmpada
🔦|lanterna
🕯️|vela
📱|celular
💻|notebook
🖥️|computador
⌨️|teclado
🖱️|mouse
📷|câmera
📺|televisão
📻|rádio
🔋|bateria carregada
🔌|tomada
📚|livros
📖|livro aberto
📝|bloco de notas
✏️|lápis
📌|alfinete
📎|clipe
✂️|tesoura
🔑|chave
🔒|cadeado fechado
🔓|cadeado aberto
🔔|sino
🔕|sino silenciado
📢|megafone
⏰|despertador
⌛|ampulheta
🧭|bússola
🗺️|mapa
🎁|presente
🎈|balão
🛡️|escudo
⚔️|espadas cruzadas
🗡️|adaga
🏰|castelo
👑|coroa
💎|diamante
🪙|moeda
💰|saco de dinheiro
🧪|tubo de ensaio
🔮|bola de cristal
🧸|ursinho de pelúcia
🪄|varinha mágica
📦|caixa
🧲|ímã
🔧|chave inglesa
`),
  },
  {
    id: "simbolos",
    label: "Símbolos",
    icon: "✅",
    emojis: parse(`
✅|marca de verificação
❌|x vermelho
❓|interrogação
❗|exclamação
‼️|dupla exclamação
⚠️|alerta
🚫|proibido
⛔|entrada proibida
🔴|círculo vermelho
🟠|círculo laranja
🟡|círculo amarelo
🟢|círculo verde
🔵|círculo azul
🟣|círculo roxo
⚫|círculo preto
⚪|círculo branco
🔺|triângulo vermelho
🔻|triângulo para baixo
🔶|losango laranja
🔷|losango azul
▶️|reproduzir
⏸️|pausar
⏹️|parar
⏩|avançar
⏪|voltar
🔁|repetir
🔀|aleatório
🔊|volume alto
🔇|mudo
➕|mais
➖|menos
✖️|multiplicar
➡️|seta para a direita
⬅️|seta para a esquerda
⬆️|seta para cima
⬇️|seta para baixo
🔄|setas em círculo
♻️|reciclagem
✔️|visto
💬|balão de fala
💭|balão de pensamento
🆗|ok em quadro
🆕|novo
🔝|topo
🏳️|bandeira branca
🏴|bandeira preta
🚩|bandeira triangular
`),
  },
];

const ALL: readonly EmojiEntry[] = EMOJI_CATEGORIES.flatMap((category) => category.emojis);

const NOME_BY_EMOJI = new Map<string, string>();
for (const entry of ALL) {
  if (!NOME_BY_EMOJI.has(entry.emoji)) NOME_BY_EMOJI.set(entry.emoji, entry.nome);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function nomeDoEmoji(emoji: string): string {
  return NOME_BY_EMOJI.get(emoji) ?? emoji;
}

export function searchEmojis(query: string): EmojiEntry[] {
  const needle = normalize(query);
  if (!needle) return [];
  const seen = new Set<string>();
  const result: EmojiEntry[] = [];
  for (const entry of ALL) {
    if (seen.has(entry.emoji)) continue;
    if (!normalize(entry.nome).includes(needle)) continue;
    seen.add(entry.emoji);
    result.push(entry);
  }
  return result;
}
