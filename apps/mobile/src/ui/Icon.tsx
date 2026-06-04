import { color } from '@getsava/ui';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line-icon set, ported 1:1 from the Claude Design handoff (ui.jsx PATHS). */
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
  | 'info'
  | 'plus'
  | 'clock'
  | 'shield'
  | 'shieldPlain'
  | 'lock'
  | 'copy'
  | 'external'
  | 'refresh'
  | 'x'
  | 'gear'
  | 'home'
  | 'list'
  | 'chevR'
  | 'arrowDown'
  | 'arrowUp'
  | 'wallet'
  | 'globe'
  | 'signout'
  | 'spark'
  | 'help'
  | 'qr'
  | 'share'
  | 'usdc'
  | 'vault'
  | 'card'
  | 'calc'
  | 'plane'
  | 'gift'
  | 'flag'
  | 'target';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: string;
}

export function Icon({ name, size = 20, stroke = color.ink }: IconProps) {
  const c = {
    stroke,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'back' && <Path d="M15 5l-7 7 7 7" strokeWidth={2} {...c} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 6.5" strokeWidth={2.4} {...c} />}
      {name === 'x' && <Path d="M6 6l12 12M18 6L6 18" strokeWidth={2} {...c} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" strokeWidth={2.2} {...c} />}
      {name === 'chevR' && <Path d="M9 6l6 6-6 6" strokeWidth={1.9} {...c} />}
      {name === 'arrowDown' && <Path d="M12 5v14M6 13l6 6 6-6" strokeWidth={1.9} {...c} />}
      {name === 'arrowUp' && <Path d="M12 19V5M6 11l6-6 6 6" strokeWidth={1.9} {...c} />}
      {name === 'alert' && (
        <>
          <Path d="M12 4l9 16H3z" strokeWidth={1.8} {...c} />
          <Path d="M12 10v4M12 17h.01" strokeWidth={1.9} {...c} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8} strokeWidth={1.8} {...c} />
          <Path d="M12 8v4l3 2" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'shield' && (
        <>
          <Path
            d="M12 3l7 2.7v4.8c0 4.4-3 7.3-7 8.5-4-1.2-7-4.1-7-8.5V5.7z"
            strokeWidth={1.7}
            {...c}
          />
          <Path d="M8.8 12l2.1 2.1L15.4 9.6" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'shieldPlain' && (
        <Path
          d="M12 3l7 2.7v4.8c0 4.4-3 7.3-7 8.5-4-1.2-7-4.1-7-8.5V5.7z"
          strokeWidth={1.7}
          {...c}
        />
      )}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9} strokeWidth={1.7} {...c} />
          <Path d="M12 11v5M12 7.6h.01" strokeWidth={1.9} {...c} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x={4} y={10.5} width={16} height={10} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M7.5 10.5V7.5a4.5 4.5 0 019 0v3" strokeWidth={1.7} {...c} />
          <Path d="M12 14v3" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'locksmall' && (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2.2} strokeWidth={1.7} {...c} />
          <Path d="M8 11V8a4 4 0 018 0v3" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'key' && (
        <>
          <Circle cx={8} cy={12} r={4} strokeWidth={1.8} {...c} />
          <Path d="M11.5 11.5H21l-2 2.5M16 11.5v3.2" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'copy' && (
        <>
          <Rect x={8} y={8} width={11} height={11} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M5 15.5V6a2 2 0 012-2h8.5" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'external' && (
        <>
          <Path d="M14 5h5v5M19 5l-8 8" strokeWidth={1.8} {...c} />
          <Path
            d="M17 13v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 015 18V9a1.5 1.5 0 011.5-1.5H11"
            strokeWidth={1.8}
            {...c}
          />
        </>
      )}
      {name === 'refresh' && (
        <>
          <Path d="M19 5v5h-5M5 19v-5h5" strokeWidth={1.8} {...c} />
          <Path d="M18.5 10A7 7 0 006 7M5.5 14A7 7 0 0018 17" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3.2} strokeWidth={1.7} {...c} />
          <Path
            d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7L5 5"
            strokeWidth={1.7}
            {...c}
          />
        </>
      )}
      {name === 'home' && (
        <>
          <Path d="M4 11l8-7 8 7" strokeWidth={1.8} {...c} />
          <Path d="M6 9.5V19a1 1 0 001 1h10a1 1 0 001-1V9.5" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'list' && (
        <>
          <Path d="M8 6h12M8 12h12M8 18h12" strokeWidth={1.8} {...c} />
          <Circle cx={4} cy={6} r={1.3} fill={stroke} />
          <Circle cx={4} cy={12} r={1.3} fill={stroke} />
          <Circle cx={4} cy={18} r={1.3} fill={stroke} />
        </>
      )}
      {name === 'wallet' && (
        <>
          <Rect x={3} y={6} width={18} height={13} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M3 9.5h18" strokeWidth={1.7} {...c} />
          <Circle cx={16.5} cy={13} r={1.3} fill={stroke} />
        </>
      )}
      {name === 'globe' && (
        <>
          <Circle cx={12} cy={12} r={9} strokeWidth={1.7} {...c} />
          <Path
            d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
            strokeWidth={1.7}
            {...c}
          />
        </>
      )}
      {name === 'doc' && (
        <>
          <Path
            d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            strokeWidth={1.7}
            {...c}
          />
          <Path d="M13 3v5h5M9 13h6M9 16.5h6" strokeWidth={1.6} {...c} />
        </>
      )}
      {name === 'signout' && (
        <>
          <Path d="M14 5H7a1.5 1.5 0 00-1.5 1.5v11A1.5 1.5 0 007 19h7" strokeWidth={1.8} {...c} />
          <Path d="M11 12h10M17 8l4 4-4 4" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'bank' && (
        <>
          <Path d="M4 9.5L12 4l8 5.5" strokeWidth={1.8} {...c} />
          <Path d="M5.5 9.5h13V18h-13z" strokeWidth={1.7} {...c} />
          <Path d="M8 12v3M12 12v3M16 12v3M4 20h16" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'earn' && (
        <>
          <Path d="M4 16l5-5 3.5 3L20 6" strokeWidth={2} {...c} />
          <Path d="M14 6h6v6" strokeWidth={2} {...c} />
        </>
      )}
      {name === 'spark' && (
        <Path
          d="M12 3l2.2 6.3L20 11l-5.8 1.7L12 19l-2.2-6.3L4 11l5.8-1.7z"
          strokeWidth={1.7}
          {...c}
        />
      )}
      {name === 'mail' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M4 7l8 5.5L20 7" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'help' && (
        <>
          <Circle cx={12} cy={12} r={9} strokeWidth={1.7} {...c} />
          <Path
            d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 .9-1 1.7M12 16.5h.01"
            strokeWidth={1.8}
            {...c}
          />
        </>
      )}
      {name === 'qr' && (
        <>
          <Rect x={4} y={4} width={6} height={6} rx={1.2} strokeWidth={1.7} {...c} />
          <Rect x={14} y={4} width={6} height={6} rx={1.2} strokeWidth={1.7} {...c} />
          <Rect x={4} y={14} width={6} height={6} rx={1.2} strokeWidth={1.7} {...c} />
          <Path d="M14 14h2.5v2.5M20 14v.01M14 20h2.5M20 17.5V20h-2" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'share' && (
        <>
          <Path d="M12 3v12" strokeWidth={1.8} {...c} />
          <Path d="M8.5 6.5L12 3l3.5 3.5" strokeWidth={1.8} {...c} />
          <Path
            d="M7 11H5.5A1.5 1.5 0 004 12.5v6A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0018.5 11H17"
            strokeWidth={1.8}
            {...c}
          />
        </>
      )}
      {name === 'usdc' && (
        <>
          <Circle cx={12} cy={12} r={9.4} fill={stroke} />
          <Path
            d="M12 6.2v11.6"
            fill="none"
            stroke="#fff"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
          <Path
            d="M14.8 8.9c-.6-.8-1.6-1.25-2.8-1.25-1.55 0-2.8.8-2.8 2.05 0 2.95 5.7 1.5 5.7 4.5 0 1.3-1.25 2.1-2.95 2.1-1.25 0-2.3-.5-2.9-1.35"
            fill="none"
            stroke="#fff"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {name === 'vault' && (
        <>
          <Rect x={3.5} y={4.5} width={17} height={15} rx={2.5} strokeWidth={1.7} {...c} />
          <Circle cx={12} cy={12} r={3.4} strokeWidth={1.7} {...c} />
          <Path d="M12 12h2.2" strokeWidth={1.7} {...c} />
          <Path d="M7 19.5v1.6M17 19.5v1.6" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'card' && (
        <>
          <Rect x={3} y={5.5} width={18} height={13} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M3 9.5h18" strokeWidth={1.7} {...c} />
          <Path d="M6.5 14.5h3" strokeWidth={1.8} {...c} />
        </>
      )}
      {name === 'calc' && (
        <>
          <Rect x={5} y={3} width={14} height={18} rx={2.5} strokeWidth={1.7} {...c} />
          <Path d="M8.5 7h7" strokeWidth={1.7} {...c} />
          <Path
            d="M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 17.5h.01M12 17.5h.01M15 17.5h.01"
            strokeWidth={2}
            {...c}
          />
        </>
      )}
      {name === 'plane' && (
        <>
          <Path d="M21 4L3 10.6l6.3 2.3L12 19l3-7.8z" strokeWidth={1.7} {...c} />
          <Path d="M9.3 12.9L21 4" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'gift' && (
        <>
          <Rect x={4} y={8} width={16} height={4} rx={1} strokeWidth={1.7} {...c} />
          <Path d="M5.5 12v7.5a1 1 0 001 1h11a1 1 0 001-1V12" strokeWidth={1.7} {...c} />
          <Path d="M12 8v12.5" strokeWidth={1.7} {...c} />
          <Path
            d="M12 8C11 8 8.5 7.6 8.5 5.8 8.5 4.5 9.6 4 10.3 4.4 11.4 5 12 8 12 8zM12 8c1 0 3.5-.4 3.5-2.2 0-1.3-1.1-1.8-1.8-1.4C12.6 5 12 8 12 8z"
            strokeWidth={1.6}
            {...c}
          />
        </>
      )}
      {name === 'flag' && (
        <>
          <Path d="M6 21V4" strokeWidth={1.9} {...c} />
          <Path d="M6 4.5h11.5l-2.2 3.6 2.2 3.6H6" strokeWidth={1.7} {...c} />
        </>
      )}
      {name === 'target' && (
        <>
          <Circle cx={12} cy={12} r={8.5} strokeWidth={1.7} {...c} />
          <Circle cx={12} cy={12} r={5} strokeWidth={1.7} {...c} />
          <Circle cx={12} cy={12} r={1.9} fill={stroke} />
        </>
      )}
    </Svg>
  );
}
