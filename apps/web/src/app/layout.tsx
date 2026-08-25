import type { Metadata } from "next";
import Link from "next/link";

import "./styles.css";

export const metadata: Metadata = {
  title: "WeaveTrail",
  description: "Weave signals into replayable evidence.",
};

const navigation = [
  ["Overview", "/"],
  ["Lab", "/lab"],
  ["Evals", "/evals"],
  ["Methodology", "/methodology"],
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">
            <span className="wordmark-mark" aria-hidden="true">
              W
            </span>
            WeaveTrail
          </Link>
          <nav aria-label="Primary navigation">
            {navigation.map(([label, href]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <span>Weave signals into replayable evidence.</span>
          <span>Deterministic fixture mode · synthetic data only</span>
        </footer>
      </body>
    </html>
  );
}
