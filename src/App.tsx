import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "./theme/appIdentity";
import { LogoMark } from "./components/common/LogoMark";
import "./App.css";

type View = "home" | "notebook";

function App() {
  // Placeholder view state until the routing store exists.
  const [view] = useState<View>("home");
  return view === "home" ? <HomePlaceholder /> : <NotebookPlaceholder />;
}

function HomePlaceholder() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <LogoMark size={32} />
        <div>
          <h1 className="app-title">{APP_NAME}</h1>
          <p className="app-tagline">{APP_TAGLINE}</p>
        </div>
      </header>
      <section className="app-empty">
        <p>
          Your notebooks will live here. Creating, opening, and recent notebooks
          arrive with the first vertical slice.
        </p>
      </section>
    </main>
  );
}

function NotebookPlaceholder() {
  return (
    <main className="app-shell">
      <p className="app-tagline">Notebook view — arrives with the first vertical slice.</p>
    </main>
  );
}

export default App;
