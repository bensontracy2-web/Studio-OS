import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

let isInIframe = false;
try {
  isInIframe = window.self !== window.top;
} catch {
  isInIframe = true;
}

if ("serviceWorker" in navigator) {
  if (isInIframe) {
    // Skip SW registration in embedded preview iframes to avoid grey-screen interception
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((reg) => {
          void reg.unregister();
        });
      })
      .catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration skipped:", err);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

