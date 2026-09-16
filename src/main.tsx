import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/routes";
import { seedDatabase } from "@/db/seed";
import "./index.css";

// Seeding runs in the background: if IndexedDB is unavailable (private mode, blocked site
// data) the promise can hang forever, and awaiting it here would leave a permanently blank
// page. Live queries pick the palettes up whenever the seed lands.
void seedDatabase().catch((error: unknown) => {
  console.error("Could not seed built-in palettes", error);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
