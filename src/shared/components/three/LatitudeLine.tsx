/**
 * 纬线圈 3D 组件
 * 
 * 在球面上绘制纬线圈，用于标记赤道、回归线、极圈等
 */

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { calculateLatitudePosition } from '../../utils';
import * as THREE from 'three';

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

/** 纬线标签组件 - 始终面向相机且保持在纬线圈前方 */
function LatitudeLabel({ 
  latitude, 
  radius, 
  color, 
  label,
  circleRadius,
  y,
}: { 
  latitude: number;
  radius: number;
  color: string;
  label: string;
  circleRadius: number;
  y: number;
}) {
  const { camera } = useThree();
  const labelRef = useMemo(() => ({ position: new THREE.Vector3(circleRadius + 0.3, y, 0) }), [circleRadius, y]);

  useFrame(() => {
    // 获取相机在 XZ 平面的方向
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    
    // 计算相机在 XZ 平面的角度
    const angle = Math.atan2(-cameraDir.x, -cameraDir.z);
    
    // 将标签放在纬线圈上最靠近相机的位置
    labelRef.position.set(
      Math.cos(angle) * (circleRadius + 0.15),
      y,
      Math.sin(angle) * (circleRadius + 0.15)
    );
  });

  return (
    <Html position={labelRef.position} center zIndexRange={[100, 0]}>
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
  );
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
        <LatitudeLabel
          latitude={latitude}
          radius={radius}
          color={color}
          label={label}
          circleRadius={circleRadius}
          y={y}
        />
      )}
    </group>
  );
}
