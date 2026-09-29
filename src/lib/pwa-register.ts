// Registro do service worker do app shell (B5.5) — chamado só pelas rotas
// que viram PWA instalável (/repositor e /conferente, DEC-B5-13). O
// manifest em si é linkado direto no <head> de cada rota (arquivo estático
// próprio por rota, não JS).
export function registerAppShellServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js");
}
