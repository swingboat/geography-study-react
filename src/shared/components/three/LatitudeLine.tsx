/**
 * 纬线圈 3D 组件
 * 
 * 在球面上绘制纬线圈，用于标记赤道、回归线、极圈等
 */

import { useMemo, useRef, useState } from 'react';
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
  color, 
  label,
  circleRadius,
  y,
}: { 
  color: string;
  label: string;
  circleRadius: number;
  y: number;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // 获取相机位置
    const cameraPos = camera.position.clone();
    
    // 获取父组件的世界矩阵的逆矩阵，将相机位置转换到局部坐标系
    const parent = groupRef.current.parent;
    if (parent) {
      const inverseMatrix = new THREE.Matrix4();
      parent.updateWorldMatrix(true, false);
      inverseMatrix.copy(parent.matrixWorld).invert();
      cameraPos.applyMatrix4(inverseMatrix);
    }
    
    // 在局部坐标系中计算相机在 XZ 平面的角度
    const angle = Math.atan2(cameraPos.z, cameraPos.x);
    
    // 将标签放在纬线圈上最靠近相机的位置（局部坐标）
    const labelPos = new THREE.Vector3(
      Math.cos(angle) * (circleRadius + 0.15),
      y,
      Math.sin(angle) * (circleRadius + 0.15)
    );
    groupRef.current.position.copy(labelPos);
    
    // 检测可见性：标签位置是否面向相机
    // 获取标签的世界坐标
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    
    // 计算从原点到标签位置的法向量（在世界坐标中）
    const normal = worldPos.clone().normalize();
    // 计算从标签到相机的方向
    const toCamera = camera.position.clone().sub(worldPos).normalize();
    
    // 如果法向量和到相机方向的点积大于阈值，则可见
    setIsVisible(normal.dot(toCamera) > 0.1);
  });

  return (
    <group ref={groupRef}>
      {isVisible && (
        <Html center zIndexRange={[100, 0]}>
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
          color={color}
          label={label}
          circleRadius={circleRadius}
          y={y}
        />
      )}
    </group>
  );
}
