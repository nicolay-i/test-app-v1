import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app">
      <h1>APE Scaffold</h1>
      <p>Replace this placeholder during benchmark generation.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
