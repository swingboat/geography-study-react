/**
 * 季节位置标记 3D 组件
 * 
 * 在轨道上标记四季节气的位置
 * 
 * 坐标系说明：
 * - 使用 (cos(angle), 0, -sin(angle)) 逆时针坐标系
 * - 地轴指向+X（北极星方向）
 * - 冬至: angle=0 → 右下(+X) → 北极背离太阳
 * - 春分: angle=π/2 → 右上(-Z)
 * - 夏至: angle=π → 左上(-X) → 北极朝向太阳
 * - 秋分: angle=3π/2 → 左下(+Z)
 */

import { Html } from '@react-three/drei';
import { ORBIT_RADIUS } from '../../constants';

interface SeasonMarker {
  angle: number;
  label: string;
  emoji: string;
  color: string;
}

const DEFAULT_MARKERS: SeasonMarker[] = [
  { angle: 0, label: '冬至', emoji: '❄️', color: '#3B82F6' },
  { angle: Math.PI / 2, label: '春分', emoji: '🌸', color: '#10B981' },
  { angle: Math.PI, label: '夏至', emoji: '☀️', color: '#EF4444' },
  { angle: (Math.PI * 3) / 2, label: '秋分', emoji: '🍂', color: '#F59E0B' },
];

interface SeasonMarkersProps {
  /** 轨道半径，默认 ORBIT_RADIUS */
  radius?: number;
  /** 标记距离轨道的偏移量，默认 1.5 */
  labelOffset?: number;
  /** 标记的 Y 高度，默认 0.5 */
  labelHeight?: number;
  /** 自定义标记配置 */
  markers?: SeasonMarker[];
}

export function SeasonMarkers({
  radius = ORBIT_RADIUS,
  labelOffset = 1.5,
  labelHeight = 0.5,
  markers = DEFAULT_MARKERS,
}: SeasonMarkersProps) {
  return (
    <group>
      {markers.map((marker, i) => (
        <Html 
          key={i}
          position={[
            Math.cos(marker.angle) * (radius + labelOffset),
            labelHeight,
            -Math.sin(marker.angle) * (radius + labelOffset),
          ]} 
          center
          zIndexRange={[100, 0]}
        >
          <div style={{ 
            color: marker.color, 
            fontSize: '12px', 
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {marker.emoji} {marker.label}
          </div>
        </Html>
      ))}
    </group>
  );
}
