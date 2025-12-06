/**
 * 太阳 3D 组件
 * 
 * 包含太阳本体、光晕效果和标签
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ASTRONOMY_COLORS } from '../../constants';

interface SunProps {
  /** 太阳位置，默认在原点 */
  position?: [number, number, number];
  /** 太阳半径，默认 1.2 */
  radius?: number;
  /** 光晕半径，默认 1.8 */
  glowRadius?: number;
  /** 是否显示标签，默认 true */
  showLabel?: boolean;
  /** 光源强度，默认 3 */
  lightIntensity?: number;
}

export function Sun({
  position = [0, 0, 0],
  radius = 1.2,
  glowRadius = 1.8,
  showLabel = true,
  lightIntensity = 3,
}: SunProps) {
  const glowRef = useRef<THREE.Mesh>(null);

  // 光晕脉冲动画
  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2) * 0.05);
    }
  });

  return (
    <group position={position}>
      {/* 太阳光晕 */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[glowRadius, 32, 32]} />
        <meshBasicMaterial 
          color={ASTRONOMY_COLORS.sunGlow} 
          transparent 
          opacity={0.3} 
        />
      </mesh>
      
      {/* 太阳本体 */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial color={ASTRONOMY_COLORS.sun} />
      </mesh>
      
      {/* 太阳光源 */}
      <pointLight 
        intensity={lightIntensity} 
        distance={100} 
        color={ASTRONOMY_COLORS.sun} 
      />
      
      {/* 太阳标签 */}
      {showLabel && (
        <Html position={[0, -(radius + 1.3), 0]} center>
          <div style={{ 
            color: ASTRONOMY_COLORS.sun, 
            fontSize: '14px', 
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(255,217,61,0.8)',
            whiteSpace: 'nowrap'
          }}>
            ☀️ 太阳
          </div>
        </Html>
      )}
    </group>
  );
}
