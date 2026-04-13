import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";

import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";

import "./styles/tokens.css";
import "./styles/global.css";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);
