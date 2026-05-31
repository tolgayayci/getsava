/**
 * @getsava/ui — design tokens (Sava "Ledger" direction).
 *
 * The single visual vocabulary screens compose from. Values are the concrete
 * Claude Design decisions from the sign-in/onboarding handoff, converted from
 * OKLCH to RN-compatible sRGB hex / rgba. No inline hex or spacing should appear
 * downstream — import from here.
 */

export const color = {
  // surfaces
  bg: '#0d0f10',
  bg2: '#111314',
  surface: '#151819',
  surface2: '#1b1f21',
  // text tiers
  ink: '#f1f4f6',
  inkDim: '#9ca1a3',
  inkFaint: '#717577',
  // hairlines
  hair: 'rgba(255, 255, 255, 0.08)',
  hairSoft: 'rgba(255, 255, 255, 0.055)',
  // earning / positive (green) — reserved for yield/positive only
  green: '#58da98',
  greenInk: '#001f0f',
  greenDim: '#58a57b',
  greenSoft: 'rgba(88, 218, 152, 0.13)',
  // brand / interactive (purple)
  purple: '#806bf6',
  purple2: '#6d55de',
  purpleInk: '#fcfcfc',
  purpleSoft: 'rgba(128, 107, 246, 0.16)',
  purpleBd: 'rgba(128, 107, 246, 0.32)',
  // caution (variable / not guaranteed)
  amber: '#d8ba7e',
  amberSoft: 'rgba(216, 186, 126, 0.13)',
  amberBd: 'rgba(216, 186, 126, 0.30)',
  // error
  red: '#f2716a',
  redSoft: 'rgba(242, 113, 106, 0.13)',
  redBd: 'rgba(242, 113, 106, 0.32)',
  // info
  blue: '#67b5e1',
  blueSoft: 'rgba(103, 181, 225, 0.12)',
  blueBd: 'rgba(103, 181, 225, 0.30)',
} as const;

/** 4px base spacing scale + layout gutter. */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 28,
  s8: 32,
  gutter: 20,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

/**
 * Font family identifiers. These match the @expo-google-fonts export names the
 * app loads at startup (see apps/mobile/src/ui/fonts.ts). Weight is baked into
 * the family on React Native, so set `fontFamily` rather than `fontWeight`.
 */
export const font = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semiBold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  extraBold: 'HankenGrotesk_800ExtraBold',
  mono: 'SplineSansMono_400Regular',
  monoMedium: 'SplineSansMono_500Medium',
} as const;

/** Type scale — fontFamily + fontSize + lineHeight only (decoration in-component). */
export const type = {
  display: { fontFamily: font.extraBold, fontSize: 47, lineHeight: 50 },
  h1: { fontFamily: font.extraBold, fontSize: 25, lineHeight: 28 },
  h2: { fontFamily: font.extraBold, fontSize: 24, lineHeight: 28 },
  title: { fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  bodyStrong: { fontFamily: font.semiBold, fontSize: 15.5, lineHeight: 21 },
  body: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 22 },
  button: { fontFamily: font.bold, fontSize: 15.5, lineHeight: 20 },
  label: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 18 },
  micro: { fontFamily: font.regular, fontSize: 11, lineHeight: 15 },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18 },
} as const;

export type ColorToken = keyof typeof color;
export type SpaceToken = keyof typeof space;
