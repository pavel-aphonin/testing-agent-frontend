import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "antd/dist/reset.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Hide the boot splash defined in index.html. We wait two animation
// frames after the React render call: the first frame paints the
// initial DOM, the second gives AntD's runtime CSS-in-JS a chance to
// flush its <style> tags so we don't fade the splash out into a few
// hundred ms of unstyled content. requestAnimationFrame is enough
// here — no need for any heavier readiness signal.
const splash = document.getElementById("ta-boot-splash");
if (splash) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add("fade");
      // Remove from the DOM after the fade transition so screen
      // readers don't keep announcing it.
      setTimeout(() => splash.remove(), 250);
    });
  });
}
