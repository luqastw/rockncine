let apiPromise: Promise<void> | null = null;

const API_LOAD_TIMEOUT_MS = 10000;

// apiPromise é um singleton de módulo (sobrevive a navegação client-side entre
// salas). Se o script travar/falhar, resolve() nunca chega — sem timeout/onerror
// isso deixava toda carga futura de vídeo YouTube na sessão presa num promise
// pendente pra sempre, com tela preta e nenhum erro visível (só um reload de
// página reavaliava o módulo). timeout + onerror rejeitam e resetam apiPromise
// pra null, permitindo que a próxima tentativa recarregue o script do zero.
export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadYouTubeIframeApi só roda no client."));
  }
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;

    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("timeout carregando a API do YouTube."));
    }, API_LOAD_TIMEOUT_MS);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      reject(new Error("falha ao carregar o script da API do YouTube."));
    };
    document.head.appendChild(tag);
  });

  return apiPromise;
}
