import Svg, { Circle, Path } from 'react-native-svg';

/** USDC brand blue. */
export const USDC_BLUE = '#2775ca';

/** USDC coin mark — blue disc + white dollar glyph (Circle's USDC). */
export function UsdcMark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={12} fill={USDC_BLUE} />
      <Path d="M12 5.4V18.6" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
      <Path
        d="M15.3 8.5c-.7-.95-1.85-1.45-3.2-1.45-1.85 0-3.25.95-3.25 2.45 0 3.5 6.55 1.8 6.55 5.35 0 1.55-1.5 2.5-3.45 2.5-1.45 0-2.7-.6-3.4-1.6"
        fill="none"
        stroke="#fff"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Google "G" mark (full color). */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 01-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0012 23z"
      />
      <Path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 010-4.2V7.3H2.3a11 11 0 000 9.8z" />
      <Path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 002.3 7.3L6 10.1c.9-2.6 3.2-4.7 6-4.7z"
      />
    </Svg>
  );
}

/** Apple mark (monochrome). */
export function AppleMark({ size = 20, fill = '#f1f4f6' }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={fill}
        d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.1.9-1.3 1.2-2.5 1.3-2.5-.1 0-2.5-1-2.5-3.7zM14.2 5.4c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.1z"
      />
    </Svg>
  );
}
