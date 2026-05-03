import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

interface Props {
  size?: number;
}

export default function AppLogo({ size = 80 }: Props) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.46;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <LinearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#2563EB" />
          <Stop offset="100%" stopColor="#1D4ED8" />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx={cx} cy={cy} r={r + 2} fill="url(#bg)" />

      {/* Subtle inner ring */}
      <Circle cx={cx} cy={cy} r={r - s * 0.04} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={s * 0.012} />

      {/* Letter P (white) */}
      <G>
        <Rect
          x={cx - s * 0.14}
          y={cy - s * 0.26}
          width={s * 0.1}
          height={s * 0.52}
          rx={s * 0.025}
          fill="white"
        />
        <Path
          d={`M ${cx - s * 0.04} ${cy - s * 0.26}
              A ${s * 0.165} ${s * 0.165} 0 0 1 ${cx - s * 0.04} ${cy + s * 0.07}
              L ${cx - s * 0.055} ${cy + s * 0.07}
              A ${s * 0.095} ${s * 0.095} 0 0 0 ${cx - s * 0.055} ${cy - s * 0.26}
              Z`}
          fill="white"
        />
      </G>

      {/* Small white dots */}
      <Circle cx={cx + s * 0.22} cy={cy - s * 0.22} r={s * 0.022} fill="white" opacity={0.5} />
      <Circle cx={cx + s * 0.28} cy={cy + s * 0.06} r={s * 0.015} fill="white" opacity={0.35} />
      <Circle cx={cx - s * 0.25} cy={cy + s * 0.2} r={s * 0.013} fill="white" opacity={0.3} />
    </Svg>
  );
}
