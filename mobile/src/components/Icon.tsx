import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

// Simple line icons (Feather style) drawn with react-native-svg, so no icon font is needed.
export type IconName =
  | 'menu'
  | 'logout'
  | 'plus'
  | 'minus'
  | 'edit'
  | 'trash'
  | 'close'
  | 'camera'
  | 'chevronLeft'
  | 'chevronRight'
  | 'search'
  | 'file'
  | 'image'
  | 'check'
  | 'grip'
  | 'home'
  | 'user'
  | 'flame'
  | 'moon'
  | 'mic'
  | 'skip'
  | 'stop'
  | 'play'
  | 'download';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const { colors } = useTheme();
  const stroke = {
    stroke: color ?? colors.text,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon(name, stroke)}
    </Svg>
  );
}

function renderIcon(name: IconName, s: object) {
  switch (name) {
    case 'menu':
      return (
        <>
          <Line x1={3} y1={6} x2={21} y2={6} {...s} />
          <Line x1={3} y1={12} x2={21} y2={12} {...s} />
          <Line x1={3} y1={18} x2={21} y2={18} {...s} />
        </>
      );
    case 'grip':
      return (
        <>
          <Line x1={6} y1={8} x2={18} y2={8} {...s} />
          <Line x1={6} y1={12} x2={18} y2={12} {...s} />
          <Line x1={6} y1={16} x2={18} y2={16} {...s} />
        </>
      );
    case 'logout':
      return (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...s} />
          <Polyline points="16 17 21 12 16 7" {...s} />
          <Line x1={21} y1={12} x2={9} y2={12} {...s} />
        </>
      );
    case 'plus':
      return (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...s} />
          <Line x1={5} y1={12} x2={19} y2={12} {...s} />
        </>
      );
    case 'minus':
      return <Line x1={5} y1={12} x2={19} y2={12} {...s} />;
    case 'edit':
      return <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" {...s} />;
    case 'trash':
      return (
        <>
          <Polyline points="3 6 5 6 21 6" {...s} />
          <Path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            {...s}
          />
        </>
      );
    case 'close':
      return (
        <>
          <Line x1={18} y1={6} x2={6} y2={18} {...s} />
          <Line x1={6} y1={6} x2={18} y2={18} {...s} />
        </>
      );
    case 'camera':
      return (
        <>
          <Path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            {...s}
          />
          <Circle cx={12} cy={13} r={4} {...s} />
        </>
      );
    case 'chevronLeft':
      return <Polyline points="15 18 9 12 15 6" {...s} />;
    case 'chevronRight':
      return <Polyline points="9 18 15 12 9 6" {...s} />;
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={8} {...s} />
          <Line x1={21} y1={21} x2={16.65} y2={16.65} {...s} />
        </>
      );
    case 'file':
      return (
        <>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s} />
          <Polyline points="14 2 14 8 20 8" {...s} />
          <Line x1={16} y1={13} x2={8} y2={13} {...s} />
          <Line x1={16} y1={17} x2={8} y2={17} {...s} />
        </>
      );
    case 'image':
      return (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={2} {...s} />
          <Circle cx={8.5} cy={8.5} r={1.5} {...s} />
          <Polyline points="21 15 16 10 5 21" {...s} />
        </>
      );
    case 'check':
      return <Polyline points="20 6 9 17 4 12" {...s} />;
    case 'home':
      return (
        <>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...s} />
          <Polyline points="9 22 9 12 15 12 15 22" {...s} />
        </>
      );
    case 'user':
      return (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...s} />
          <Circle cx={12} cy={7} r={4} {...s} />
        </>
      );
    case 'moon':
      return <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...s} />;
    case 'mic':
      return (
        <>
          <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...s} />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" {...s} />
          <Line x1={12} y1={19} x2={12} y2={23} {...s} />
          <Line x1={8} y1={23} x2={16} y2={23} {...s} />
        </>
      );
    case 'skip':
      return (
        <>
          <Polyline points="5 4 15 12 5 20 5 4" {...s} />
          <Line x1={19} y1={5} x2={19} y2={19} {...s} />
        </>
      );
    case 'stop':
      return <Rect x={5} y={5} width={14} height={14} rx={2} {...s} />;
    case 'play':
      return <Polyline points="6 3 20 12 6 21 6 3" {...s} />;
    case 'download':
      return (
        <>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...s} />
          <Polyline points="7 10 12 15 17 10" {...s} />
          <Line x1={12} y1={15} x2={12} y2={3} {...s} />
        </>
      );
    case 'flame':
      return (
        <Path
          d="M12 2c.5 3.5 4.5 6 4.5 10.5a4.5 4.5 0 0 1-9 0c0-2.2 1.2-3.6 2.2-4.6.3 1.6 1 2.6 2 3.1C12 9 11 5.5 12 2z"
          {...s}
        />
      );
  }
}
