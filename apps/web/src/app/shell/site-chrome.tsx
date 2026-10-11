"use client";

import Link from "next/link";
import React from "react";

import { useCopy } from "../i18n/language";
import { shellCopy } from "./copy";
import { LanguageSelector } from "./language-selector";
import { SiteNavigation } from "./site-navigation";

/** The link a keyboard reader meets first, past the header to the page. */
export function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      {useCopy(shellCopy).skipToContent}
    </a>
  );
}

/** The mark, the destinations and the language switch, on every page. */
export function SiteHeader() {
  const text = useCopy(shellCopy);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" href="/">
          {/* The SVG is served verbatim so its embedded C2PA metadata remains intact. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image would transform the provenance-bearing SVG. */}
          <img alt="" height="32" src="/brand/mark.svg" width="32" />
          <span>{text.brand}</span>
        </Link>
        <SiteNavigation />
        <LanguageSelector />
      </div>
    </header>
  );
}

/** What runs here and on which data, and what is still planned. */
export function SiteFooter() {
  const text = useCopy(shellCopy);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>{text.footerStatus}</span>
        <span>{text.footerPlanned}</span>
      </div>
    </footer>
  );
}
