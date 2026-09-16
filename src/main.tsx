import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";

const initialTheme = window.localStorage.getItem("arka-theme") || "dark";
document.documentElement.dataset.theme = initialTheme === "light" ? "light" : "dark";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.DEV) {
  // A previously installed production worker can otherwise continue controlling
  // localhost and make development appear stuck on an older ARKA bundle.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js?v=39").then((registration) => {
      // Force an update check so an older ARKA shell cannot keep stale routing
      // code after a deployment.
      registration.update().catch(() => {});
    }).catch(() => {
      // PWA is progressive enhancement; the app remains fully usable without it.
    });
  });
}
