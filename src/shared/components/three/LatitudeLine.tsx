/**
 * 纬线圈 3D 组件
 * 
 * 在球面上绘制纬线圈，用于标记赤道、回归线、极圈等
 */

import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { calculateLatitudePosition } from '../../utils';

interface LatitudeLineProps {
  /** 纬度（度），正数为北纬，负数为南纬 */
  latitude: number;
  /** 球体半径 */
  radius: number;
  /** 线条颜色 */
  color: string;
  /** 标签文本 */
  label: string;
  /** 是否显示标签，默认 true */
  showLabel?: boolean;
  /** 是否使用虚线，默认 false */
  dashed?: boolean;
  /** 线条宽度，默认 2 */
  lineWidth?: number;
}

export function LatitudeLine({
  latitude,
  radius,
  color,
  label,
  showLabel = true,
  dashed = false,
  lineWidth = 2,
}: LatitudeLineProps) {
  const { y, circleRadius } = calculateLatitudePosition(latitude, radius);

  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([
        Math.cos(angle) * circleRadius,
        y,
        Math.sin(angle) * circleRadius,
      ]);
    }
    return pts;
  }, [circleRadius, y]);

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        dashed={dashed}
        dashSize={0.1}
        gapSize={0.05}
      />
      {showLabel && (
        <Html position={[circleRadius + 0.3, y, 0]} center>
          <div style={{
            color: color,
            fontSize: '11px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
