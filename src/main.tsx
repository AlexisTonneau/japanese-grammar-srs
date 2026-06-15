import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSync, pullAll } from "./srs/sync";
import "./index.css";

// Kick off Supabase session check + initial pull. No-op when env vars are unset.
void initSync();

// Re-pull from Supabase whenever the tab regains focus. Cheap freshness:
// grade on phone, switch to laptop, the laptop's data updates as soon as
// you tab back. pullAll() is no-op when sync isn't enabled.
window.addEventListener("focus", () => {
  void pullAll();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
