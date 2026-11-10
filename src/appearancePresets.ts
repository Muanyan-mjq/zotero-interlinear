// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — built-in appearance presets.
//
// This module is intentionally data-only (no imports) so the Node unit tests
// can load it with type stripping. The UI merges each partial over
// DEFAULT_APPEARANCE and runs normalizeAppearance before applying it.

export interface BuiltInAppearancePreset {
  id: string;
  nameKey: string;
  appearance: Record<string, unknown>;
}

export const BUILT_IN_APPEARANCE_PRESETS: readonly BuiltInAppearancePreset[] = [
  {
    id: "default",
    nameKey: "appearance-preset-default",
    appearance: {},
  },
  {
    id: "paper",
    nameKey: "appearance-preset-paper",
    appearance: {
      theme: "light",
      color: "#333333",
      background: "#faf7f0",
      lineHeight: 1.8,
      paragraphSpacing: 1.35,
      ribbon: true,
      ribbonColor: "#c7354a",
      underline: false,
    },
  },
  {
    id: "academic",
    nameKey: "appearance-preset-academic",
    appearance: {
      theme: "light",
      color: "#222222",
      background: "#f6f6f6",
      fontStack: {
        primary: "Georgia",
        fallbacks: ["Times New Roman", "Noto Serif"],
        generic: "serif",
      },
      lineHeight: 1.85,
      paragraphSpacing: 1.15,
      textAlign: "justify",
      ribbon: true,
      ribbonColor: "#7c3aed",
      underline: false,
    },
  },
  {
    id: "contrast",
    nameKey: "appearance-preset-contrast",
    appearance: {
      theme: "light",
      color: "#000000",
      background: "#ffffff",
      fontWeight: 500,
      underline: true,
      underlineColor: "#000000",
      ribbon: true,
      ribbonColor: "#000000",
      blockBorderWidth: 1,
      blockBorderStyle: "solid",
      colors: {
        border: { mode: "single", light: "#000000", dark: "#000000" },
      },
    },
  },
  {
    id: "dark",
    nameKey: "appearance-preset-dark",
    appearance: {
      theme: "dark",
      color: "#e8e8e8",
      background: "#2b2b2b",
      ribbon: true,
      ribbonColor: "#4f8ff0",
      sourceDim: 80,
      blockBorderWidth: 1,
      blockBorderStyle: "solid",
      colors: {
        border: { mode: "split", light: "#d9d9d9", dark: "#4a4a4a" },
      },
    },
  },
  {
    id: "minimal",
    nameKey: "appearance-preset-minimal",
    appearance: {
      theme: "auto",
      color: "",
      background: "",
      ribbon: false,
      underline: false,
      textDecoration: [],
      divider: false,
      blockBorderWidth: 0,
      blockRadius: 0,
      textAlign: "start",
    },
  },
];
