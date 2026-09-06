import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";

import "./styles.css";

import { getSiteUrl } from "./site-url";
import { SiteNavigation } from "./site-navigation";
import { LanguageProvider } from "./i18n/language";
import { LanguageSelector } from "./i18n/language-selector";
import { ChromeText } from "./i18n/chrome-text";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "WeaveTrail",
    template: "%s | WeaveTrail",
  },
  description: "Weave signals into replayable evidence.",
};

const plex = localFont({
  variable: "--font-sans-local",
  display: "swap",
  src: [
    { path: "../fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-sans/IBMPlexSans-Medium.woff2", weight: "500" },
    {
      path: "../fonts/ibm-plex-sans/IBMPlexSans-SemiBold.woff2",
      weight: "600",
    },
  ],
});

const mono = localFont({
  variable: "--font-mono-local",
  display: "swap",
  src: [
    {
      path: "../fonts/jetbrains-mono/JetBrainsMono-Regular.woff2",
      weight: "400",
    },
    {
      path: "../fonts/jetbrains-mono/JetBrainsMono-Medium.woff2",
      weight: "500",
    },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-Bold.woff2", weight: "700" },
  ],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${plex.variable} ${mono.variable}`} lang="en">
      <body>
        <LanguageProvider>
          <a className="skip-link" href="#main-content">
            <ChromeText id="skipToContent" />
          </a>
          <header className="site-header">
            <Link className="wordmark" href="/">
              {/* The SVG is served verbatim so its embedded C2PA metadata remains intact. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image would transform the provenance-bearing SVG. */}
              <img alt="" height="36" src="/brand/mark.svg" width="36" />
              <span>WeaveTrail</span>
            </Link>
            <span className="header-context">
              <ChromeText id="headerContext" />
            </span>
            <LanguageSelector />
          </header>
          <div className="app-shell">
            <aside className="side-nav">
              <SiteNavigation />
              <div className="side-nav-footer">
                <span>
                  <ChromeText id="roleProposals" />
                </span>
                <span>
                  <ChromeText id="roleApprovals" />
                </span>
                <span>
                  <ChromeText id="roleCode" />
                </span>
              </div>
            </aside>
            <div className="content-shell">
              <div id="main-content">{children}</div>
              <footer className="site-footer">
                <span>
                  <ChromeText id="footerTagline" />
                </span>
                <span>
                  <ChromeText id="footerStatus" />
                </span>
              </footer>
            </div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
