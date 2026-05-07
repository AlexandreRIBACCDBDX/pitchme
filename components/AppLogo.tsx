import Svg, { Rect, Path, Circle } from 'react-native-svg';

interface Props {
  size?: number;
  light?: boolean; // white background, blue P — for dark backgrounds
}

export default function AppLogo({ size = 60, light = false }: Props) {
  const sc = size / 60;
  const r = (v: number) => v * sc;

  const bg    = light ? 'white'    : '#1D4ED8';
  const fill  = light ? '#1D4ED8' : 'white';
  const hole  = light ? 'white'    : '#1D4ED8';

  // Proportions derived from the 60×60 reference icon
  const bowlOuter   = `M ${r(22)} ${r(8)} L ${r(22)} ${r(38)} A ${r(18)} ${r(15)} 0 0 1 ${r(22)} ${r(8)} Z`;
  const bowlCounter = `M ${r(22)} ${r(15)} L ${r(22)} ${r(31)} A ${r(11)} ${r(8)} 0 0 1 ${r(22)} ${r(15)} Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background rounded square */}
      <Rect width={size} height={size} rx={r(15)} fill={bg} />

      {/* P — vertical stem */}
      <Rect
        x={r(13)} y={r(8)}
        width={r(9)} height={r(44)}
        rx={r(4.5)}
        fill={fill}
      />

      {/* P — bowl outer arc */}
      <Path d={bowlOuter} fill={fill} />

      {/* P — bowl counter (inner hole) */}
      <Path d={bowlCounter} fill={hole} />

      {/* Gold accent dot */}
      <Circle cx={r(47)} cy={r(47)} r={r(6)} fill="#F59E0B" />
    </Svg>
  );
}
