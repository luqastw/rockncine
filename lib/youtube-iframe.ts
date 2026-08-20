let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadYouTubeIframeApi só roda no client."));
  }
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return apiPromise;
}
