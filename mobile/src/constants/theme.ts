// mobile/src/constants/theme.ts
/**
 * Sacred Ledger Theme Tokens (ዐጸደ ንስሐ - Sanctuary Palette)
 * Directly mirroring the production PWA design system.
 */
export const THEME = {
  colors: {
    // Backgrounds
    sanctuaryBg: "#FDFCF6",      // Warm ivory parchment
    navigationBg: "#FDFAF1",     // Bottom tabs & top header parchment
    surface: "#FFFFFF",          // Pure white card surfaces
    surfaceAlt: "#F8FAFC",       // Subtle off-white input / highlight
    
    // Sacred Accents
    sacredCrimson: "#9B2D30",    // Sovereign Ethiopian Crimson (Active tab & brand)
    sacredCrimsonLight: "rgba(155, 45, 48, 0.08)",
    sacredCrimsonBorder: "rgba(155, 45, 48, 0.15)",
    
    sacredAmber: "#D97706",      // Warm golden grace
    amberGlow: "#F59E0B",
    amberLight: "rgba(217, 119, 6, 0.12)",
    amberBorder: "rgba(217, 119, 6, 0.25)",
    
    // Typography & Ink
    inkPrimary: "#0F172A",       // Slate 900 (High contrast text)
    inkSecondary: "#475569",     // Slate 600
    inkMuted: "#64748B",         // Slate 500
    inkSubtle: "#94A3B8",        // Slate 400
    
    // Actions
    buttonDark: "#020617",       // Slate 950 deep architectural button
    buttonDarkText: "#FFFFFF",
    
    // Status
    success: "#059669",          // Emerald 600
    successBg: "#ECFDF5",        // Emerald 50
    error: "#DC2626",            // Red 600
    errorBg: "#FEF2F2",          // Red 50
    errorBorder: "#FEE2E2",
    
    // Borders & Dividers
    border: "#E2E8F0",
    borderLight: "rgba(0, 0, 0, 0.05)",
  },
  shadows: {
    card: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    button: {
      shadowColor: "#020617",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 5,
    },
    halo: {
      shadowColor: "#D97706",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 9999,
  },
};
