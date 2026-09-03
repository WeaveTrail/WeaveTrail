import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import "./styles.css";

export const metadata: Metadata = {
  title: "WeaveTrail",
  description: "Weave signals into replayable evidence.",
  icons: { icon: "/brand/marks/favicon-16.svg" },
};

const sans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
});

const navigation = [
  ["Overview", "/"],
  ["Architecture", "/architecture"],
  ["Lab", "/lab"],
  ["Evals", "/evals"],
  ["Methodology", "/methodology"],
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="wordmark" href="/">
            <Image
              src="/brand/marks/mark-inverse.svg"
              alt=""
              width="24"
              height="24"
            />
            <span>WeaveTrail</span>
          </Link>
          <span className="header-context">
            Deterministic fixture mode · synthetic data
          </span>
        </header>
        <div className="app-shell">
          <aside className="side-nav">
            <nav aria-label="Primary navigation">
              <span className="nav-label">Workbench</span>
              {navigation.map(([label, href]) => (
                <Link href={href} key={href}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="side-nav-footer">
              <span>AI proposals</span>
              <span>Human approvals</span>
              <span>Versioned code</span>
            </div>
          </aside>
          <div className="content-shell">
            <div id="main-content">{children}</div>
            <footer className="site-footer">
              <span>Weave signals into replayable evidence.</span>
              <span>Synthetic data only · fixture provider</span>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
