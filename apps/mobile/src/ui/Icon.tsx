import { color } from '@getsava/ui';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line-icon set used by the auth surface. Ported 1:1 from the design handoff. */
export type IconName =
  | 'back'
  | 'check'
  | 'alert'
  | 'locksmall'
  | 'key'
  | 'doc'
  | 'bank'
  | 'earn'
  | 'mail'
  | 'info';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: string;
}

export function Icon({ name, size = 20, stroke = color.ink }: IconProps) {
  const common = {
    stroke,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'back' && <Path d="M15 5l-7 7 7 7" strokeWidth={2} {...common} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 6.5" strokeWidth={2.4} {...common} />}
      {name === 'alert' && (
        <>
          <Path d="M12 4l9 16H3z" strokeWidth={1.8} {...common} />
          <Path d="M12 10v4M12 17h.01" strokeWidth={1.9} {...common} />
        </>
      )}
      {name === 'locksmall' && (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2.2} strokeWidth={1.7} {...common} />
          <Path d="M8 11V8a4 4 0 018 0v3" strokeWidth={1.7} {...common} />
        </>
      )}
      {name === 'key' && (
        <>
          <Circle cx={8} cy={12} r={4} strokeWidth={1.8} {...common} />
          <Path d="M11.5 11.5H21l-2 2.5M16 11.5v3.2" strokeWidth={1.8} {...common} />
        </>
      )}
      {name === 'doc' && (
        <>
          <Path
            d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            strokeWidth={1.7}
            {...common}
          />
          <Path d="M13 3v5h5M9 13h6M9 16.5h6" strokeWidth={1.6} {...common} />
        </>
      )}
      {name === 'bank' && (
        <>
          <Path d="M4 9.5L12 4l8 5.5" strokeWidth={1.8} {...common} />
          <Path d="M5.5 9.5h13V18h-13z" strokeWidth={1.7} {...common} />
          <Path d="M8 12v3M12 12v3M16 12v3M4 20h16" strokeWidth={1.7} {...common} />
        </>
      )}
      {name === 'earn' && (
        <>
          <Path d="M4 16l5-5 3.5 3L20 6" strokeWidth={2} {...common} />
          <Path d="M14 6h6v6" strokeWidth={2} {...common} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} strokeWidth={1.7} {...common} />
          <Path d="M4 7l8 5.5L20 7" strokeWidth={1.7} {...common} />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9} strokeWidth={1.7} {...common} />
          <Path d="M12 11v5M12 7.6h.01" strokeWidth={1.9} {...common} />
        </>
      )}
    </Svg>
  );
}
