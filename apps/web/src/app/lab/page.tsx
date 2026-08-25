import { Lab } from "./lab";

export default function LabPage() {
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Guided replay lab</span>
        <h1>Inspect the deterministic foundation.</h1>
        <p>
          Run one synthetic fixture as-is, shuffled, or with an exact duplicate.
          The canonical event order and result hash should remain identical.
        </p>
      </div>
      <Lab />
    </main>
  );
}
