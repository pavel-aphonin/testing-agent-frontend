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

// Hide the boot splash defined in index.html. We need to keep it up
// until AntD's CSS-in-JS has actually flushed its style tags into
// <head> — otherwise the user sees a few hundred ms of "DOM rendered
// but invisible" because ``.ant-card`` etc. don't have computed
// backgrounds yet (we hit this once already, see PER-89).
//
// Two animation frames (~32 ms) wasn't long enough on cold load.
// Instead we poll until at least one AntD class has a meaningful
// computed style, with a 1-second hard cap so a broken page can
// still show whatever it has rather than spin forever.
const splash = document.getElementById("ta-boot-splash");
if (splash) {
  const start = performance.now();
  const check = (): void => {
    const probe = document.querySelector<HTMLElement>(
      ".ant-card, .ant-form-item, .ant-input, .ant-btn, .ant-typography",
    );
    let ready = false;
    if (probe) {
      const cs = window.getComputedStyle(probe);
      // AntD components always set non-zero padding OR a defined
      // background once their styles inject. Either signal is good
      // enough — we just need to know "the rules have applied".
      const padded = Boolean(
        cs.padding && cs.padding !== "0px",
      );
      const bg = cs.backgroundColor;
      const styledBg = Boolean(
        bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent",
      );
      ready = padded || styledBg;
    }
    if (ready || performance.now() - start > 1000) {
      splash.classList.add("fade");
      // Remove from the DOM after the fade transition so screen
      // readers don't keep announcing it.
      setTimeout(() => splash.remove(), 250);
      return;
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
