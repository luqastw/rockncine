"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useStageLayout() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  // fallback pra onde a Fullscreen API não existe pra elemento comum (Safari
  // no iPhone): o botão simplesmente não fazia nada, sem retorno nenhum
  // (achado 19). Aqui o stage vira `fixed inset-0` e o modo teatro continua
  // funcionando igual.
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || cssFullscreen;
  const [isTheater, setIsTheater] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setNativeFullscreen(active);
      if (!active) setIsTheater(false); // não fica "grudado" ao reentrar depois
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    // o botão de teatro só existe (clicável) em lg+ (docs/specs/03-auditoria-ui-ux/spec.md, seção 10, item
    // 4) — mas isso só fecha a porta de ENTRAR nesse estado por clique. Sem
    // isso aqui, redimensionar a janela pra baixo de lg com teatro já ligado
    // deixava `isTheater` grudado em `true`, reproduzindo o mesmo layout
    // quebrado (aside disputando altura com o vídeo empilhado) por resize
    // em vez de clique.
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!e.matches) setIsTheater(false);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    const nativeSupported = !!document.fullscreenEnabled && !!stage?.requestFullscreen;
    if (!nativeSupported) {
      setCssFullscreen((v) => {
        if (v) setIsTheater(false);
        return !v;
      });
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stage?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const exitCssFullscreen = useCallback(() => {
    setCssFullscreen(false);
    setIsTheater(false);
  }, []);

  const toggleTheater = useCallback(() => setIsTheater((v) => !v), []);

  const showAside = !isFullscreen || isTheater;

  return {
    stageRef,
    isFullscreen,
    cssFullscreen,
    isTheater,
    showAside,
    toggleFullscreen,
    toggleTheater,
    exitCssFullscreen,
  };
}
