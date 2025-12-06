/**
 * 公转轨道 3D 组件
 * 
 * 包含轨道线和方向箭头，确保公转方向为逆时针（从北极俯视）
 */

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { ASTRONOMY_COLORS, ORBIT_RADIUS } from '../../constants';
import { calculateOrbitTangentRotation } from '../../utils';

interface OrbitPathProps {
  /** 轨道半径，默认 ORBIT_RADIUS */
  radius?: number;
  /** 是否显示方向箭头，默认 true */
  showDirectionArrows?: boolean;
  /** 方向箭头数量，默认 4 */
  arrowCount?: number;
  /** 轨道线颜色，默认白色 */
  orbitColor?: string;
  /** 轨道线透明度，默认 0.3 */
  orbitOpacity?: number;
  /** 箭头颜色，默认绿色 */
  arrowColor?: string;
  /** 箭头透明度，默认 0.7 */
  arrowOpacity?: number;
}

export function OrbitPath({
  radius = ORBIT_RADIUS,
  showDirectionArrows = true,
  arrowCount = 4,
  orbitColor = '#ffffff',
  orbitOpacity = 0.3,
  arrowColor = ASTRONOMY_COLORS.orbitDirection,
  arrowOpacity = 0.7,
}: OrbitPathProps) {
  // 轨道点
  const orbitPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([
        Math.cos(angle) * radius,
        0,
        -Math.sin(angle) * radius, // 负号确保逆时针
      ]);
    }
    return pts;
  }, [radius]);

  // 公转方向箭头位置
  const arrowPositions = useMemo(() => {
    const positions: { pos: [number, number, number]; rotationZ: number }[] = [];
    for (let i = 0; i < arrowCount; i++) {
      // 偏移一点避开可能的季节标记
      const angle = (i / arrowCount) * Math.PI * 2 + Math.PI / 8;
      const rotationZ = calculateOrbitTangentRotation(angle);
      
      positions.push({
        pos: [
          Math.cos(angle) * radius,
          0,
          -Math.sin(angle) * radius,
        ],
        rotationZ,
      });
    }
    return positions;
  }, [radius, arrowCount]);

  return (
    <group>
      {/* 轨道线 */}
      <Line
        points={orbitPoints}
        color={orbitColor}
        lineWidth={1}
        dashed
        dashSize={0.5}
        gapSize={0.3}
        transparent
        opacity={orbitOpacity}
      />
      
      {/* 公转方向箭头 */}
      {showDirectionArrows && arrowPositions.map((arrow, i) => (
        <group key={i} position={arrow.pos}>
          <mesh rotation={[Math.PI / 2, 0, arrow.rotationZ - Math.PI / 2]}>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshBasicMaterial 
              color={arrowColor} 
              transparent 
              opacity={arrowOpacity} 
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
