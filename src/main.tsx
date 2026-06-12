import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSync } from "./srs/sync";
import "./index.css";

// Kick off Supabase session check + initial pull. No-op when env vars are unset.
void initSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
