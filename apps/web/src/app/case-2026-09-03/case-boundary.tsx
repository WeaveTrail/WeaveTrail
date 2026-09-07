"use client";

import React from "react";

import { useLanguage } from "../i18n/language";
import { PublishedCaseSurface } from "./case-surface";
import type { ComponentProps } from "react";

type SurfaceProps = Omit<
  ComponentProps<typeof PublishedCaseSurface>,
  "language"
>;

export function CaseBoundary(props: SurfaceProps) {
  const { language } = useLanguage();
  return <PublishedCaseSurface {...props} language={language} />;
}
