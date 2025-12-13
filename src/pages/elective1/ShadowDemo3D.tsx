/**
 * 影子与太阳方位 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 帮助学生理解：
 * 1. 影子的方向与太阳方位的关系
 * 2. 影子的长短与太阳高度角的关系
 * 3. 不同时间、不同季节的影子变化
 * 4. 根据影子判断方向和时间
 */

import { useRef, useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Stars, 
  Line,
  Html,
  Sky as DreiSky,
  Cloud,
  Environment,
  ContactShadows,
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  Card,
  CardContent,
  Typography,
  Slider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  RestartAlt as ResetIcon,
  Label as LabelIcon,
  LabelOff as LabelOffIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

// 导入公共组件和工具
import {
  OBLIQUITY,
} from '../../shared/constants';
import { formatDegreeMinute } from '../../shared/utils';
import {
  CameraController,
  AnimationPageLayout,
  SceneLoading,
  LocationSelector,
  type City,
  type CameraControllerHandle,
} from '../../shared/components';

// ===================== 类型定义 =====================

interface ShadowDemo3DProps {
  initialDate?: Date;
  onBack?: () => void;
}

// ===================== 常量 =====================

const COLORS = {
  sun: '#FCD34D',
  sunGlow: '#F59E0B',
  shadow: '#1E293B',
  ground: '#4ADE80',
  person: '#60A5FA',
  stick: '#8B4513',
  compass: {
    north: '#EF4444',
    south: '#3B82F6',
    east: '#10B981',
    west: '#F59E0B',
  },
};

/** 特殊日期 */
const SPECIAL_DATES = [
  { name: '春分', date: '3月21日', dayOfYear: 80, subsolarLat: 0, description: '太阳直射赤道' },
  { name: '夏至', date: '6月22日', dayOfYear: 173, subsolarLat: OBLIQUITY, description: '太阳直射北回归线' },
  { name: '秋分', date: '9月23日', dayOfYear: 266, subsolarLat: 0, description: '太阳直射赤道' },
  { name: '冬至', date: '12月22日', dayOfYear: 356, subsolarLat: -OBLIQUITY, description: '太阳直射南回归线' },
];

// ===================== 工具函数 =====================

/** 根据一年中的天数计算太阳直射点纬度 */
const getSubsolarLatitude = (dayOfYear: number): number => {
  const angle = ((284 + dayOfYear) * 360 / 365) * Math.PI / 180;
  return OBLIQUITY * Math.sin(angle);
};

/** 将一年中的第几天转换为月日格式 */
const dayOfYearToDate = (dayOfYear: number): string => {
  const date = new Date(2025, 0, 1);
  date.setDate(dayOfYear);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

/** 计算太阳高度角（度）
 * @param lat 观测点纬度
 * @param subsolarLat 太阳直射点纬度
 * @param hourAngle 时角（度，正午为0，上午为负，下午为正）
 */
const getSunAltitude = (lat: number, subsolarLat: number, hourAngle: number): number => {
  const latRad = lat * Math.PI / 180;
  const subLatRad = subsolarLat * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;
  
  // 太阳高度角公式: sin(h) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(H)
  const sinH = Math.sin(latRad) * Math.sin(subLatRad) + 
               Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourRad);
  
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinH))) * 180 / Math.PI;
  return Math.max(0, altitude); // 太阳在地平线以下时返回0
};

/** 计算太阳方位角（度，从正北顺时针计算）
 * @param lat 观测点纬度
 * @param subsolarLat 太阳直射点纬度
 * @param hourAngle 时角（度）
 */
const getSunAzimuth = (lat: number, subsolarLat: number, hourAngle: number): number => {
  const latRad = lat * Math.PI / 180;
  const subLatRad = subsolarLat * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;
  
  // 太阳高度角
  const sinH = Math.sin(latRad) * Math.sin(subLatRad) + 
               Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinH)));
  
  if (Math.cos(altitude) < 0.001) return 0; // 太阳在天顶附近
  
  // 方位角公式
  const cosA = (Math.sin(subLatRad) - Math.sin(latRad) * sinH) / 
               (Math.cos(latRad) * Math.cos(altitude));
  
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
  
  // 根据时角判断东西方向
  if (hourAngle > 0) {
    azimuth = 360 - azimuth; // 下午太阳在西边
  }
  
  return azimuth;
};

/** 地方时转时角（度）*/
const localTimeToHourAngle = (localTime: number): number => {
  // 正午12:00时角为0，每小时15度
  return (localTime - 12) * 15;
};

/** 格式化时间 */
const formatTime = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/** 方位角转方向描述 */
const azimuthToDirection = (azimuth: number): string => {
  const directions = [
    { min: 337.5, max: 360, name: '北' },
    { min: 0, max: 22.5, name: '北' },
    { min: 22.5, max: 67.5, name: '东北' },
    { min: 67.5, max: 112.5, name: '东' },
    { min: 112.5, max: 157.5, name: '东南' },
    { min: 157.5, max: 202.5, name: '南' },
    { min: 202.5, max: 247.5, name: '西南' },
    { min: 247.5, max: 292.5, name: '西' },
    { min: 292.5, max: 337.5, name: '西北' },
  ];
  
  const normalized = ((azimuth % 360) + 360) % 360;
  for (const dir of directions) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir.name;
    }
  }
  return '北';
};

/** 影子方向（与太阳方位相反） */
const getShadowDirection = (sunAzimuth: number): string => {
  const shadowAzimuth = (sunAzimuth + 180) % 360;
  return azimuthToDirection(shadowAzimuth);
};

// ===================== 3D 组件 =====================

/** 太阳组件 */
function Sun3D({ 
  altitude, 
  azimuth,
  localTime,
  distance = 18,
  showRays = true,
}: { 
  altitude: number; 
  azimuth: number;
  localTime: number;
  distance?: number;
  showRays?: boolean;
}) {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const glow2Ref = useRef<THREE.Mesh>(null);
  const raysRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // 将高度角和方位角转换为3D坐标
  const altRad = altitude * Math.PI / 180;
  const aziRad = azimuth * Math.PI / 180;
  
  const sunPosition: [number, number, number] = useMemo(() => [
    distance * Math.cos(altRad) * Math.sin(aziRad),
    distance * Math.sin(altRad),
    -distance * Math.cos(altRad) * Math.cos(aziRad)
  ], [altitude, azimuth, distance]);

  // 计算太阳到地面中心的光线终点
  const groundTarget: [number, number, number] = [0, 0, 0];

  // 将太阳组件放到 layer 1，避免参与阴影计算
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        child.layers.set(0); // 保持在默认层以便渲染
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    }
  }, []);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
      glowRef.current.scale.setScalar(scale);
    }
    if (glow2Ref.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 1.5 + 1) * 0.1;
      glow2Ref.current.scale.setScalar(scale);
    }
    if (raysRef.current) {
      raysRef.current.rotation.z = clock.elapsedTime * 0.2;
    }
  });

  // 太阳在地平线以下时不显示
  if (altitude <= 0) return null;

  // 根据高度角调整太阳颜色（低时偏红/橙）
  const sunColor = altitude < 20 ? '#FF8C00' : altitude < 40 ? '#FFB347' : COLORS.sun;
  const glowColor = altitude < 20 ? '#FF6347' : COLORS.sunGlow;

  return (
    <>
      <group ref={groupRef} position={sunPosition}>
        {/* 太阳本体 - 更大更明显，不投射阴影 */}
        <mesh ref={sunRef} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial color={sunColor} />
        </mesh>
        
        {/* 内层光晕 - 不投射阴影 */}
        <mesh ref={glowRef} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[2.0, 32, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.4} />
        </mesh>
        
        {/* 外层光晕 - 不投射阴影 */}
        <mesh ref={glow2Ref} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[2.8, 32, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.15} />
        </mesh>

        {/* 太阳光芒 - 放射状线条 */}
        {showRays && (
          <group ref={raysRef}>
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (i * 30) * Math.PI / 180;
              const innerRadius = 1.8;
              const outerRadius = 3.0;
              return (
                <Line
                  key={i}
                  points={[
                    [Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0],
                    [Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, 0]
                  ]}
                  color={sunColor}
                  lineWidth={2}
                  transparent
                  opacity={0.6}
                />
              );
            })}
          </group>
        )}
        
        {/* 太阳光源 */}
        <pointLight color={sunColor} intensity={3} distance={40} />
        
        {/* 太阳标签 - 更详细 */}
        <Html position={[0, 3, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)',
            color: 'white',
            padding: '8px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
            border: '2px solid rgba(255,255,255,0.3)',
            textAlign: 'center',
          }}>
            ☀️ 太阳
            <div style={{ fontSize: 11, opacity: 0.95, marginTop: 4 }}>
              时间: {formatTime(localTime)}
            </div>
            <div style={{ fontSize: 10, opacity: 0.85 }}>
              高度角: {altitude.toFixed(1)}° | 方位: {azimuthToDirection(azimuth)}
            </div>
          </div>
        </Html>
      </group>

      {/* 太阳光线 - 从太阳射向地面 */}
      {showRays && (
        <>
          {/* 主光线 */}
          <Line
            points={[sunPosition, groundTarget]}
            color="#FCD34D"
            lineWidth={3}
            transparent
            opacity={0.6}
            dashed
            dashSize={0.3}
            dashScale={1}
            gapSize={0.15}
          />
          {/* 光线落点标记 - 不投射阴影 */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial color="#FCD34D" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </>
  );
}

/** 人物模型组件 - 更真实的人物 */
function Person3D({ 
  height = 1.7,
  shadowLength,
  shadowDirection,
  showLabel,
}: { 
  height?: number;
  shadowLength: number;
  shadowDirection: number;
  showLabel: boolean;
}) {
  const position: [number, number, number] = [0, 0, 0];
  
  const shadowDirRad = shadowDirection * Math.PI / 180;
  const shadowEnd: [number, number, number] = [
    shadowLength * Math.sin(shadowDirRad),
    0.02,
    -shadowLength * Math.cos(shadowDirRad)
  ];

  // 人物比例
  const headRadius = height * 0.09;
  const bodyHeight = height * 0.35;
  const legHeight = height * 0.45;
  const armLength = height * 0.35;

  return (
    <group position={position}>
      {/* 头部 */}
      <mesh position={[0, height - headRadius, 0]} castShadow>
        <sphereGeometry args={[headRadius, 24, 24]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.6} />
      </mesh>
      
      {/* 头发 */}
      <mesh position={[0, height - headRadius * 0.3, 0]}>
        <sphereGeometry args={[headRadius * 1.05, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#1F2937" roughness={0.8} />
      </mesh>

      {/* 身体/躲干 */}
      <mesh position={[0, height - headRadius * 2 - bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, bodyHeight, 16]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.7} />
      </mesh>
      
      {/* 肩膀 */}
      <mesh position={[0, height - headRadius * 2 - 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 12]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.7} />
      </mesh>

      {/* 左手臂 */}
      <mesh position={[-0.22, height - headRadius * 2 - armLength / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, armLength, 12]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.6} />
      </mesh>
      
      {/* 右手臂 */}
      <mesh position={[0.22, height - headRadius * 2 - armLength / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, armLength, 12]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.6} />
      </mesh>

      {/* 左腿 */}
      <mesh position={[-0.08, legHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, legHeight, 12]} />
        <meshStandardMaterial color="#1E3A5A" roughness={0.8} />
      </mesh>
      
      {/* 右腿 */}
      <mesh position={[0.08, legHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, legHeight, 12]} />
        <meshStandardMaterial color="#1E3A5A" roughness={0.8} />
      </mesh>
      
      {/* 左脚 */}
      <mesh position={[-0.08, 0.04, 0.03]}>
        <boxGeometry args={[0.1, 0.08, 0.18]} />
        <meshStandardMaterial color="#1F2937" roughness={0.9} />
      </mesh>
      
      {/* 右脚 */}
      <mesh position={[0.08, 0.04, 0.03]}>
        <boxGeometry args={[0.1, 0.08, 0.18]} />
        <meshStandardMaterial color="#1F2937" roughness={0.9} />
      </mesh>

      {/* 人物标签 */}
      {showLabel && (
        <Html position={[0, height + 0.4, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
          }}>
            🧁 观测者 ({height}m)
          </div>
        </Html>
      )}

      {/* 影子 - 更真实的渐变效果 */}
      {shadowLength > 0 && (
        <group>
          {/* 人形影子主体 */}
          <mesh 
            rotation={[-Math.PI / 2, 0, shadowDirRad]} 
            position={[shadowEnd[0] / 2, 0.02, shadowEnd[2] / 2]}
          >
            <planeGeometry args={[0.5, shadowLength]} />
            <meshBasicMaterial 
              color="#000000" 
              transparent 
              opacity={0.4} 
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          
          {/* 影子头部 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[shadowEnd[0], 0.02, shadowEnd[2]]}>
            <circleGeometry args={[0.18, 24]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          
          {/* 影子渐变边缘 */}
          <mesh 
            rotation={[-Math.PI / 2, 0, shadowDirRad]} 
            position={[shadowEnd[0] / 2, 0.015, shadowEnd[2] / 2]}
          >
            <planeGeometry args={[0.7, shadowLength * 1.1]} />
            <meshBasicMaterial 
              color="#000000" 
              transparent 
              opacity={0.15} 
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* 影子方向指示 */}
          {showLabel && (
            <Html position={[shadowEnd[0], 0.3, shadowEnd[2]]} center zIndexRange={[100, 0]}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}>
                🌑 影子 → {getShadowDirection((shadowDirection + 180) % 360)}
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
}

/** 木杆/旗杆组件 - 更真实 */
function Stick3D({ 
  height = 2,
  position: pos,
  shadowLength,
  shadowDirection,
  showLabel,
}: { 
  height?: number;
  position: [number, number, number];
  shadowLength: number;
  shadowDirection: number;
  showLabel: boolean;
}) {
  const shadowDirRad = shadowDirection * Math.PI / 180;
  const shadowEnd: [number, number, number] = [
    pos[0] + shadowLength * Math.sin(shadowDirRad),
    0.02,
    pos[2] - shadowLength * Math.cos(shadowDirRad)
  ];

  return (
    <group position={pos}>
      {/* 木杆底座 */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.1, 16]} />
        <meshStandardMaterial color="#5D4037" roughness={0.9} />
      </mesh>
      
      {/* 木杆主体 - 有木纹效果 */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.07, height, 16]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>
      
      {/* 木杆高光环 */}
      <mesh position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
        <meshStandardMaterial color="#A0522D" roughness={0.6} />
      </mesh>
      <mesh position={[0, height * 0.6, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.02, 16]} />
        <meshStandardMaterial color="#A0522D" roughness={0.6} />
      </mesh>
      
      {/* 杆顶红色球 */}
      <mesh position={[0, height + 0.08, 0]} castShadow>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial color="#DC2626" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* 影子 - 更真实 */}
      {shadowLength > 0 && (
        <group>
          {/* 主影子线 */}
          <Line
            points={[[0, 0.02, 0], [shadowEnd[0] - pos[0], 0.02, shadowEnd[2] - pos[2]]]}
            color="#000000"
            lineWidth={6}
            transparent
            opacity={0.5}
          />
          {/* 影子边缘模糊 */}
          <Line
            points={[[0, 0.015, 0], [shadowEnd[0] - pos[0], 0.015, shadowEnd[2] - pos[2]]]}
            color="#000000"
            lineWidth={12}
            transparent
            opacity={0.15}
          />
          {/* 杆顶影子 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[shadowEnd[0] - pos[0], 0.02, shadowEnd[2] - pos[2]]}>
            <circleGeometry args={[0.12, 24]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* 标签 */}
      {showLabel && (
        <Html position={[0, height + 0.5, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.95) 0%, rgba(101, 67, 33, 0.95) 100%)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(139, 69, 19, 0.4)',
          }}>
            📍 标杆 {height}m
          </div>
        </Html>
      )}
    </group>
  );
}

/** 指南针/方向盘组件 */
function Compass3D({ radius = 4 }: { radius?: number }) {
  return (
    <group position={[0, 0.02, 0]}>
      {/* 方向标记 */}
      {[
        { dir: '北', angle: 0, color: COLORS.compass.north },
        { dir: '东', angle: 90, color: COLORS.compass.east },
        { dir: '南', angle: 180, color: COLORS.compass.south },
        { dir: '西', angle: 270, color: COLORS.compass.west },
      ].map(({ dir, angle, color }) => {
        const rad = angle * Math.PI / 180;
        const x = radius * Math.sin(rad);
        const z = -radius * Math.cos(rad);
        return (
          <group key={dir}>
            {/* 方向线 */}
            <Line
              points={[[0, 0, 0], [x * 0.9, 0, z * 0.9]]}
              color={color}
              lineWidth={2}
              dashed
              dashScale={3}
            />
            {/* 方向标签 */}
            <Html position={[x, 0.3, z]} center zIndexRange={[50, 0]}>
              <div style={{
                background: color,
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}>
                {dir}
              </div>
            </Html>
          </group>
        );
      })}

      {/* 圆形参考线 */}
      <Line
        points={Array.from({ length: 73 }, (_, i) => {
          const angle = (i * 5) * Math.PI / 180;
          return [radius * Math.sin(angle), 0, -radius * Math.cos(angle)] as [number, number, number];
        })}
        color="#94A3B8"
        lineWidth={1}
        transparent
        opacity={0.5}
      />
    </group>
  );
}

/** 学校操场地面组件 - 更真实的塑胶跑道和足球场 */
function Ground() {
  // 创建操场纹理
  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;  // 更高分辨率
    canvas.height = 4096;
    const ctx = canvas.getContext('2d')!;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 整体背景 - 浅灰色水泥地面（带真实纹理）
    const concreteGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    concreteGradient.addColorStop(0, '#D8D4CC');
    concreteGradient.addColorStop(0.5, '#CCC8C0');
    concreteGradient.addColorStop(1, '#D0CCC4');
    ctx.fillStyle = concreteGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 水泥裂缝和纹理
    ctx.strokeStyle = 'rgba(160, 155, 145, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 5; j++) {
        ctx.lineTo(
          startX + (Math.random() - 0.5) * 100,
          startY + (Math.random() - 0.5) * 100
        );
      }
      ctx.stroke();
    }
    
    // 水泥颗粒纹理
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const gray = 170 + Math.random() * 50;
      ctx.fillStyle = `rgba(${gray}, ${gray - 5}, ${gray - 10}, ${0.2 + Math.random() * 0.3})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    
    // 足球场绿色草坪
    const fieldWidth = 2400;
    const fieldHeight = 1600;
    const fieldX = centerX - fieldWidth / 2;
    const fieldY = centerY - fieldHeight / 2;
    
    // 草坪基础渐变
    const grassGradient = ctx.createLinearGradient(fieldX, fieldY, fieldX, fieldY + fieldHeight);
    grassGradient.addColorStop(0, '#2A5A24');
    grassGradient.addColorStop(0.5, '#2D6227');
    grassGradient.addColorStop(1, '#2A5A24');
    ctx.fillStyle = grassGradient;
    ctx.fillRect(fieldX, fieldY, fieldWidth, fieldHeight);
    
    // 草坪条纹效果（修剪过的草坪）- 更精细
    const stripeCount = 16;
    for (let i = 0; i < stripeCount; i++) {
      const stripeY = fieldY + i * (fieldHeight / stripeCount);
      const stripeGradient = ctx.createLinearGradient(fieldX, stripeY, fieldX, stripeY + fieldHeight / stripeCount);
      if (i % 2 === 0) {
        stripeGradient.addColorStop(0, '#2D5A27');
        stripeGradient.addColorStop(0.5, '#326429');
        stripeGradient.addColorStop(1, '#2D5A27');
      } else {
        stripeGradient.addColorStop(0, '#357A30');
        stripeGradient.addColorStop(0.5, '#3A8535');
        stripeGradient.addColorStop(1, '#357A30');
      }
      ctx.fillStyle = stripeGradient;
      ctx.fillRect(fieldX, stripeY, fieldWidth, fieldHeight / stripeCount);
    }
    
    // 草坪纹理细节 - 模拟草叶
    for (let i = 0; i < 30000; i++) {
      const x = fieldX + Math.random() * fieldWidth;
      const y = fieldY + Math.random() * fieldHeight;
      const shade = Math.random() * 40 - 20;
      const length = 3 + Math.random() * 5;
      const angle = (Math.random() - 0.5) * 0.5;
      
      ctx.strokeStyle = `rgba(${40 + shade}, ${90 + shade}, ${35 + shade}, ${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(angle) * 2, y - length);
      ctx.stroke();
    }
    
    // 足球场白线 - 更粗更清晰
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 外边线
    ctx.strokeRect(fieldX + 40, fieldY + 40, fieldWidth - 80, fieldHeight - 80);
    
    // 中线
    ctx.beginPath();
    ctx.moveTo(centerX, fieldY + 40);
    ctx.lineTo(centerX, fieldY + fieldHeight - 40);
    ctx.stroke();
    
    // 中圈
    ctx.beginPath();
    ctx.arc(centerX, centerY, 160, 0, Math.PI * 2);
    ctx.stroke();
    
    // 中点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    // 禁区（两个）
    const penaltyWidth = 400;
    const penaltyHeight = 600;
    ctx.strokeRect(fieldX + 40, centerY - penaltyHeight / 2, penaltyWidth, penaltyHeight);
    ctx.strokeRect(fieldX + fieldWidth - 40 - penaltyWidth, centerY - penaltyHeight / 2, penaltyWidth, penaltyHeight);
    
    // 小禁区
    const goalAreaWidth = 160;
    const goalAreaHeight = 300;
    ctx.strokeRect(fieldX + 40, centerY - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);
    ctx.strokeRect(fieldX + fieldWidth - 40 - goalAreaWidth, centerY - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);
    
    // 点球点
    ctx.beginPath();
    ctx.arc(fieldX + 40 + 220, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fieldX + fieldWidth - 40 - 220, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 禁区弧
    ctx.beginPath();
    ctx.arc(fieldX + 40 + 220, centerY, 180, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fieldX + fieldWidth - 40 - 220, centerY, 180, Math.PI - 0.6, Math.PI + 0.6);
    ctx.stroke();
    
    // 角球区
    const cornerRadius = 20;
    [[fieldX + 40, fieldY + 40], [fieldX + fieldWidth - 40, fieldY + 40], 
     [fieldX + 40, fieldY + fieldHeight - 40], [fieldX + fieldWidth - 40, fieldY + fieldHeight - 40]].forEach(([cx, cy], i) => {
      ctx.beginPath();
      const startAngle = [0, Math.PI * 0.5, Math.PI * 1.5, Math.PI][i];
      ctx.arc(cx, cy, cornerRadius, startAngle, startAngle + Math.PI * 0.5);
      ctx.stroke();
    });
    
    // 塑胶跑道 - 椭圆形，更真实的红色橡胶质感
    const trackOuterHeight = 2000;
    const trackWidth = 125; // 跑道总宽度（5条跑道）
    const laneCount = 5;  // 改为5条跑道
    const laneWidth = trackWidth / laneCount;
    
    // 跑道底色
    for (let lane = 0; lane < laneCount; lane++) {
      const laneOffset = lane * laneWidth;
      const h = trackOuterHeight - laneOffset * 2;
      
      // 红色跑道 - 带橡胶颗粒质感
      const trackColor = lane % 2 === 0 ? '#C4402F' : '#B83828';
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = laneWidth;
      
      ctx.beginPath();
      ctx.arc(centerX - (fieldWidth / 2 - 100), centerY, h / 2 - laneOffset, Math.PI / 2, -Math.PI / 2);
      ctx.lineTo(centerX + (fieldWidth / 2 - 100), centerY - h / 2 + laneOffset);
      ctx.arc(centerX + (fieldWidth / 2 - 100), centerY, h / 2 - laneOffset, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(centerX - (fieldWidth / 2 - 100), centerY + h / 2 - laneOffset);
      ctx.stroke();
    }
    
    // 跑道颗粒纹理
    for (let i = 0; i < 30000; i++) {
      const laneIdx = Math.floor(Math.random() * laneCount);
      const laneOffset = laneIdx * laneWidth + Math.random() * laneWidth;
      const h = trackOuterHeight - laneOffset * 2;
      
      // 计算跑道上的点
      let x, y;
      const t = Math.random();
      if (t < 0.25) {
        // 左半圆
        const a = Math.PI / 2 + Math.random() * Math.PI;
        x = centerX - (fieldWidth / 2 - 100) + Math.cos(a) * (h / 2 - laneOffset);
        y = centerY + Math.sin(a) * (h / 2 - laneOffset);
      } else if (t < 0.5) {
        // 右半圆
        const a = -Math.PI / 2 + Math.random() * Math.PI;
        x = centerX + (fieldWidth / 2 - 100) + Math.cos(a) * (h / 2 - laneOffset);
        y = centerY + Math.sin(a) * (h / 2 - laneOffset);
      } else if (t < 0.75) {
        // 上直道
        x = centerX - (fieldWidth / 2 - 100) + Math.random() * (fieldWidth - 200);
        y = centerY - h / 2 + laneOffset + (Math.random() - 0.5) * laneWidth;
      } else {
        // 下直道
        x = centerX - (fieldWidth / 2 - 100) + Math.random() * (fieldWidth - 200);
        y = centerY + h / 2 - laneOffset + (Math.random() - 0.5) * laneWidth;
      }
      
      const brightness = 180 + Math.random() * 40;
      ctx.fillStyle = `rgba(${brightness}, ${brightness * 0.3}, ${brightness * 0.2}, ${0.15 + Math.random() * 0.2})`;
      ctx.fillRect(x, y, 2, 2);
    }
    
    // 跑道分道线（白色）
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    for (let lane = 0; lane <= laneCount; lane++) {
      const laneOffset = lane * laneWidth;
      const h = trackOuterHeight - laneOffset * 2;
      
      ctx.beginPath();
      ctx.arc(centerX - (fieldWidth / 2 - 100), centerY, h / 2 - laneOffset, Math.PI / 2, -Math.PI / 2);
      ctx.lineTo(centerX + (fieldWidth / 2 - 100), centerY - h / 2 + laneOffset);
      ctx.arc(centerX + (fieldWidth / 2 - 100), centerY, h / 2 - laneOffset, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(centerX - (fieldWidth / 2 - 100), centerY + h / 2 - laneOffset);
      ctx.stroke();
    }
    
    // 起跑线标记
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    for (let i = 0; i < laneCount; i++) {
      const y = centerY + trackOuterHeight / 2 - 100 - i * laneWidth - laneWidth / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, y);
      ctx.lineTo(centerX + 40, y);
      ctx.stroke();
    }
    
    // 100米起跑标记
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    for (let i = 1; i <= laneCount; i++) {
      const y = centerY + trackOuterHeight / 2 - 100 - (i - 1) * laneWidth - laneWidth / 2;
      ctx.fillText(i.toString(), centerX - 70, y + 12);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 16;
    return texture;
  }, []);

  return (
    <group>
      {/* 更远处的自然草地 - 最底层 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#5D8A3E" roughness={1} metalness={0} />
      </mesh>
      
      {/* 操场周围的草地 - 中间层 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#7A9A5C" roughness={0.95} metalness={0} />
      </mesh>
      
      {/* 主操场地面 - 最上层 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial 
          map={groundTexture}
          roughness={0.75}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/** 篮球场地面组件 */
function BasketballCourt({ 
  position,
  rotation = 0,
}: { 
  position: [number, number, number];
  rotation?: number;
}) {
  const courtTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    const w = canvas.width;
    const h = canvas.height;
    
    // 篮球场地面 - 深红色/棕红色塑胶
    const baseGradient = ctx.createLinearGradient(0, 0, w, h);
    baseGradient.addColorStop(0, '#8B3A3A');
    baseGradient.addColorStop(0.5, '#7A3232');
    baseGradient.addColorStop(1, '#8B3A3A');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, w, h);
    
    // 添加塑胶颗粒纹理
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const brightness = 120 + Math.random() * 40;
      ctx.fillStyle = `rgba(${brightness}, ${brightness * 0.4}, ${brightness * 0.35}, ${0.2 + Math.random() * 0.2})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    
    // 白色边线
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    
    // 中线
    ctx.beginPath();
    ctx.moveTo(w / 2, 20);
    ctx.lineTo(w / 2, h - 20);
    ctx.stroke();
    
    // 中圈
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    
    // 三分线（两端）
    ctx.lineWidth = 6;
    // 左侧三分线
    ctx.beginPath();
    ctx.moveTo(20, h / 2 - 140);
    ctx.lineTo(80, h / 2 - 140);
    ctx.arc(80, h / 2, 140, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(20, h / 2 + 140);
    ctx.stroke();
    
    // 右侧三分线
    ctx.beginPath();
    ctx.moveTo(w - 20, h / 2 - 140);
    ctx.lineTo(w - 80, h / 2 - 140);
    ctx.arc(w - 80, h / 2, 140, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(w - 20, h / 2 + 140);
    ctx.stroke();
    
    // 罚球区
    ctx.strokeRect(20, h / 2 - 80, 120, 160);
    ctx.strokeRect(w - 140, h / 2 - 80, 120, 160);
    
    // 罚球线半圆
    ctx.beginPath();
    ctx.arc(140, h / 2, 60, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 140, h / 2, 60, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }, []);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial 
          map={courtTexture}
          roughness={0.7}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/** 升旗台和旗杆组件 */
function FlagPole({ 
  position,
  shadowLength,
  shadowDirection,
  showLabel,
  sunAltitude,
}: {
  position: [number, number, number];
  shadowLength: number;
  shadowDirection: number;
  showLabel: boolean;
  sunAltitude: number;
}) {
  const flagRef = useRef<THREE.Group>(null);
  const poleHeight = 8; // 标准旗杆高度
  const shadowDirRad = shadowDirection * Math.PI / 180;
  
  // 旗帜飘动动画
  useFrame(({ clock }) => {
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.1;
    }
  });
  
  const shadowEnd: [number, number, number] = [
    position[0] + shadowLength * Math.sin(shadowDirRad),
    0.02,
    position[2] - shadowLength * Math.cos(shadowDirRad)
  ];

  return (
    <group position={position}>
      {/* 升旗台底座 - 大理石平台 */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.3, 2]} />
        <meshStandardMaterial color="#E8E8E8" roughness={0.3} metalness={0.1} />
      </mesh>
      
      {/* 台阶 */}
      <mesh position={[0, 0.05, 1.2]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#D0D0D0" roughness={0.4} />
      </mesh>
      
      {/* 旗杆底座 */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
        <meshStandardMaterial color="#C0C0C0" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* 旗杆主体 - 不锈钢 */}
      <mesh position={[0, poleHeight / 2 + 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, poleHeight, 16]} />
        <meshStandardMaterial color="#E0E0E0" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* 旗杆顶部装饰球 */}
      <mesh position={[0, poleHeight + 0.65, 0]} castShadow>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#FFD700" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* 红旗 */}
      <group ref={flagRef} position={[0.6, poleHeight - 0.3, 0]}>
        <mesh castShadow>
          <planeGeometry args={[1.2, 0.8]} />
          <meshStandardMaterial color="#DE2910" side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
        {/* 五星 */}
        <mesh position={[-0.35, 0.15, 0.01]}>
          <circleGeometry args={[0.12, 5]} />
          <meshStandardMaterial color="#FFDE00" />
        </mesh>
        {[
          { x: -0.15, y: 0.28 },
          { x: -0.08, y: 0.18 },
          { x: -0.08, y: 0.05 },
          { x: -0.15, y: -0.05 },
        ].map((pos, i) => (
          <mesh key={i} position={[pos.x, pos.y, 0.01]}>
            <circleGeometry args={[0.04, 5]} />
            <meshStandardMaterial color="#FFDE00" />
          </mesh>
        ))}
      </group>
      
      {/* 旗杆影子 - 只在太阳升起时显示 */}
      {sunAltitude > 0 && shadowLength > 0 && (
        <group>
          <Line
            points={[[0, 0.02, 0], [shadowEnd[0] - position[0], 0.02, shadowEnd[2] - position[2]]]}
            color="#000000"
            lineWidth={6}
            transparent
            opacity={0.5}
          />
          <Line
            points={[[0, 0.015, 0], [shadowEnd[0] - position[0], 0.015, shadowEnd[2] - position[2]]]}
            color="#000000"
            lineWidth={12}
            transparent
            opacity={0.15}
          />
        </group>
      )}
      
      {/* 标签 - 只在太阳升起时显示 */}
      {showLabel && sunAltitude > 0 && (
        <Html position={[0, poleHeight + 1.5, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(222, 41, 16, 0.95) 0%, rgba(180, 30, 10, 0.95) 100%)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(222, 41, 16, 0.4)',
          }}>
            🚩 旗杆 {poleHeight}m
          </div>
        </Html>
      )}
    </group>
  );
}

/** 篮球架组件 - 更真实的设计 */
function BasketballHoop({ 
  position, 
  rotation = 0,
}: { 
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 底座配重块 */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.3, 0.6]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.9} />
      </mesh>
      
      {/* 主支柱 - 方形钢管 */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[0.15, 3.1, 0.15]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 斜撑 */}
      <mesh position={[0.3, 2.5, 0]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[0.08, 1.2, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 横臂 */}
      <mesh position={[0.7, 3.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.12, 1.3, 0.12]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 篮板支架 */}
      <mesh position={[1.25, 3.0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 篮板 - 透明亚克力 */}
      <mesh position={[1.35, 2.85, 0]} castShadow>
        <boxGeometry args={[0.03, 1.05, 1.8]} />
        <meshPhysicalMaterial 
          color="#FFFFFF" 
          roughness={0.1} 
          metalness={0}
          transparent 
          opacity={0.85}
          transmission={0.3}
        />
      </mesh>
      
      {/* 篮板边框 - 红色 */}
      {/* 上边 */}
      <mesh position={[1.35, 3.37, 0]}>
        <boxGeometry args={[0.04, 0.04, 1.84]} />
        <meshStandardMaterial color="#FF3333" roughness={0.5} />
      </mesh>
      {/* 下边 */}
      <mesh position={[1.35, 2.33, 0]}>
        <boxGeometry args={[0.04, 0.04, 1.84]} />
        <meshStandardMaterial color="#FF3333" roughness={0.5} />
      </mesh>
      {/* 左边 */}
      <mesh position={[1.35, 2.85, -0.9]}>
        <boxGeometry args={[0.04, 1.08, 0.04]} />
        <meshStandardMaterial color="#FF3333" roughness={0.5} />
      </mesh>
      {/* 右边 */}
      <mesh position={[1.35, 2.85, 0.9]}>
        <boxGeometry args={[0.04, 1.08, 0.04]} />
        <meshStandardMaterial color="#FF3333" roughness={0.5} />
      </mesh>
      
      {/* 篮板上的方框 */}
      <mesh position={[1.34, 2.7, 0]}>
        <boxGeometry args={[0.01, 0.45, 0.6]} />
        <meshBasicMaterial color="#FF3333" wireframe />
      </mesh>
      
      {/* 篮圈支架 */}
      <mesh position={[1.42, 2.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
        <meshStandardMaterial color="#FF6B35" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 篮圈 - 橙色金属 */}
      <mesh position={[1.52, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.018, 12, 32]} />
        <meshStandardMaterial color="#FF6B35" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* 篮圈连接杆 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[1.52, 2.45, 0]} rotation={[Math.PI / 2, angle, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.23, 6]} />
            <meshStandardMaterial color="#FF6B35" roughness={0.3} metalness={0.8} />
          </mesh>
        );
      })}
      
      {/* 篮网 */}
      <mesh position={[1.52, 2.22, 0]}>
        <cylinderGeometry args={[0.23, 0.15, 0.45, 16, 4, true]} />
        <meshBasicMaterial color="#FFFFFF" wireframe transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** 足球门组件 */
function SoccerGoal({ 
  position, 
  rotation = 0,
}: { 
  position: [number, number, number];
  rotation?: number;
}) {
  const goalWidth = 3;
  const goalHeight = 2;
  const goalDepth = 1;
  
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 左门柱 */}
      <mesh position={[-goalWidth / 2, goalHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, goalHeight, 12]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
      </mesh>
      
      {/* 右门柱 */}
      <mesh position={[goalWidth / 2, goalHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, goalHeight, 12]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
      </mesh>
      
      {/* 横梁 */}
      <mesh position={[0, goalHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, goalWidth, 12]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
      </mesh>
      
      {/* 后支架 */}
      <mesh position={[-goalWidth / 2, goalHeight / 2, -goalDepth]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, goalHeight, 8]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.6} />
      </mesh>
      <mesh position={[goalWidth / 2, goalHeight / 2, -goalDepth]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, goalHeight, 8]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.6} />
      </mesh>
      
      {/* 后横梁 */}
      <mesh position={[0, goalHeight, -goalDepth]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, goalWidth, 8]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.6} />
      </mesh>
      
      {/* 顶部连接 */}
      <mesh position={[-goalWidth / 2, goalHeight, -goalDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, goalDepth, 8]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.6} />
      </mesh>
      <mesh position={[goalWidth / 2, goalHeight, -goalDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, goalDepth, 8]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.6} />
      </mesh>
      
      {/* 球网（简化） */}
      <mesh position={[0, goalHeight / 2, -goalDepth / 2]}>
        <boxGeometry args={[goalWidth, goalHeight, goalDepth]} />
        <meshBasicMaterial color="#FFFFFF" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/** 教学楼组件 */
function SchoolBuilding({ 
  position,
  width = 20,
  height = 12,
  depth = 8,
  isMainBuilding = false,
}: { 
  position: [number, number, number];
  width?: number;
  height?: number;
  depth?: number;
  isMainBuilding?: boolean;
}) {
  const floors = 4;
  const windowsPerFloor = Math.floor(width / 2.5);
  
  return (
    <group position={position}>
      {/* 主体建筑 */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#F5F5DC" roughness={0.8} />
      </mesh>
      
      {/* 屋顶 */}
      <mesh position={[0, height + 0.3, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.6, depth + 0.5]} />
        <meshStandardMaterial color="#8B4513" roughness={0.7} />
      </mesh>
      
      {/* 窗户 */}
      {Array.from({ length: floors }).map((_, floor) => 
        Array.from({ length: windowsPerFloor }).map((_, win) => {
          // 大门位置不放窗户（中间2-3个位置，一楼）
          const doorArea = floor === 0 && Math.abs(win - windowsPerFloor / 2) < 1.5;
          if (doorArea) return null;
          
          return (
            <mesh 
              key={`${floor}-${win}`}
              position={[
                -width / 2 + 1.5 + win * 2.5, 
                1.5 + floor * (height / floors), 
                depth / 2 + 0.01
              ]}
            >
              <planeGeometry args={[1.5, 1.8]} />
              <meshStandardMaterial 
                color="#87CEEB" 
                roughness={0.1} 
                metalness={0.9}
                transparent
                opacity={0.8}
              />
            </mesh>
          );
        })
      )}
      
      {/* 大门入口 - 只有主楼才有 */}
      {isMainBuilding && <group position={[0, 0, depth / 2]}>
        {/* 门廊地面台阶 */}
        <mesh position={[0, 0.1, 0.8]} receiveShadow>
          <boxGeometry args={[5, 0.2, 1.6]} />
          <meshStandardMaterial color="#A0A0A0" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.25, 1.2]} receiveShadow>
          <boxGeometry args={[4.5, 0.1, 0.6]} />
          <meshStandardMaterial color="#909090" roughness={0.9} />
        </mesh>
        
        {/* 门框 - 深色边框 */}
        <mesh position={[0, 2, 0.02]}>
          <boxGeometry args={[4, 4, 0.1]} />
          <meshStandardMaterial color="#4A3728" roughness={0.7} />
        </mesh>
        
        {/* 双开门 - 左扇 */}
        <mesh position={[-0.9, 1.8, 0.08]} castShadow>
          <boxGeometry args={[1.6, 3.4, 0.08]} />
          <meshStandardMaterial color="#8B4513" roughness={0.6} />
        </mesh>
        {/* 左门玻璃窗 */}
        <mesh position={[-0.9, 2.3, 0.13]}>
          <boxGeometry args={[1.2, 1.8, 0.02]} />
          <meshStandardMaterial color="#B8D4E8" roughness={0.1} metalness={0.5} transparent opacity={0.7} />
        </mesh>
        {/* 左门把手 */}
        <mesh position={[-0.2, 1.8, 0.18]}>
          <boxGeometry args={[0.08, 0.25, 0.06]} />
          <meshStandardMaterial color="#C9A227" roughness={0.3} metalness={0.8} />
        </mesh>
        
        {/* 双开门 - 右扇 */}
        <mesh position={[0.9, 1.8, 0.08]} castShadow>
          <boxGeometry args={[1.6, 3.4, 0.08]} />
          <meshStandardMaterial color="#8B4513" roughness={0.6} />
        </mesh>
        {/* 右门玻璃窗 */}
        <mesh position={[0.9, 2.3, 0.13]}>
          <boxGeometry args={[1.2, 1.8, 0.02]} />
          <meshStandardMaterial color="#B8D4E8" roughness={0.1} metalness={0.5} transparent opacity={0.7} />
        </mesh>
        {/* 右门把手 */}
        <mesh position={[0.2, 1.8, 0.18]}>
          <boxGeometry args={[0.08, 0.25, 0.06]} />
          <meshStandardMaterial color="#C9A227" roughness={0.3} metalness={0.8} />
        </mesh>
        
        {/* 门上方的门楣/雨棚 */}
        <mesh position={[0, 4.2, 0.6]} castShadow>
          <boxGeometry args={[5, 0.15, 1.2]} />
          <meshStandardMaterial color="#606060" roughness={0.5} />
        </mesh>
        {/* 雨棚支撑 */}
        <mesh position={[-2, 3.5, 0.5]} castShadow>
          <boxGeometry args={[0.1, 1.4, 0.1]} />
          <meshStandardMaterial color="#505050" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[2, 3.5, 0.5]} castShadow>
          <boxGeometry args={[0.1, 1.4, 0.1]} />
          <meshStandardMaterial color="#505050" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>}
      
      {/* 校名牌 - 只有主楼才有 */}
      {isMainBuilding && (
        <>
          <mesh position={[0, height - 1, depth / 2 + 0.02]}>
            <boxGeometry args={[8, 1.2, 0.1]} />
            <meshStandardMaterial color="#8B0000" roughness={0.5} />
          </mesh>
          {/* 校名牌金色边框 */}
          <mesh position={[0, height - 1, depth / 2 + 0.06]}>
            <boxGeometry args={[7.6, 0.9, 0.02]} />
            <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.7} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** 公园长椅组件 */
function ParkBench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const woodColor = '#6B4423';
  const metalColor = '#2C2C2C';
  
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 金属支架 - 左侧 */}
      <mesh position={[-0.55, 0.25, 0]} castShadow>
        <boxGeometry args={[0.05, 0.5, 0.4]} />
        <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* 金属支架 - 右侧 */}
      <mesh position={[0.55, 0.25, 0]} castShadow>
        <boxGeometry args={[0.05, 0.5, 0.4]} />
        <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.8} />
      </mesh>
      
      {/* 座面木板 */}
      {[-0.12, 0, 0.12].map((z, i) => (
        <mesh key={`seat-${i}`} position={[0, 0.45, z]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.04, 0.1]} />
          <meshStandardMaterial color={woodColor} roughness={0.8} />
        </mesh>
      ))}
      
      {/* 靠背木板 */}
      {[0.08, 0.22].map((yOffset, i) => (
        <mesh key={`back-${i}`} position={[0, 0.6 + yOffset, -0.18]} rotation={[0.15, 0, 0]} castShadow>
          <boxGeometry args={[1.3, 0.08, 0.02]} />
          <meshStandardMaterial color={woodColor} roughness={0.8} />
        </mesh>
      ))}
      
      {/* 靠背支撑 */}
      <mesh position={[-0.55, 0.65, -0.15]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
        <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0.55, 0.65, -0.15]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
        <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.8} />
      </mesh>
      
      {/* 扶手 */}
      <mesh position={[-0.6, 0.6, 0]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.35]} />
        <meshStandardMaterial color={woodColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.6, 0.6, 0]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.35]} />
        <meshStandardMaterial color={woodColor} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** 垃圾桶组件 */
function TrashBin({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 桶身 - 绿色 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.7, 16]} />
        <meshStandardMaterial color="#2D5A27" roughness={0.6} />
      </mesh>
      
      {/* 桶顶边缘 */}
      <mesh position={[0, 0.76, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 24]} />
        <meshStandardMaterial color="#1E3D1A" roughness={0.5} />
      </mesh>
      
      {/* 垃圾桶标志 */}
      <mesh position={[0, 0.45, 0.2]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.15, 0.15]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
      </mesh>
      
      {/* 底座 */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
        <meshStandardMaterial color="#1E3D1A" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** 路灯组件 */
function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 灯杆 */}
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 4, 12]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* 灯杆底座 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.2, 12]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* 灯臂 */}
      <mesh position={[0.2, 3.9, 0]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* 灯罩 */}
      <mesh position={[0.35, 3.85, 0]}>
        <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#404040" roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      {/* 灯泡 */}
      <mesh position={[0.35, 3.78, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#FFF8DC" />
      </mesh>
    </group>
  );
}

/** 围栏组件 */
function Fence({ 
  startPos, 
  endPos, 
  height = 1.2 
}: { 
  startPos: [number, number, number]; 
  endPos: [number, number, number];
  height?: number;
}) {
  const length = Math.sqrt(
    (endPos[0] - startPos[0]) ** 2 + 
    (endPos[2] - startPos[2]) ** 2
  );
  const midX = (startPos[0] + endPos[0]) / 2;
  const midZ = (startPos[2] + endPos[2]) / 2;
  const angle = Math.atan2(endPos[0] - startPos[0], endPos[2] - startPos[2]);
  
  const postCount = Math.max(2, Math.floor(length / 2));
  const railColor = '#6B8E23';  // 橄榄绿
  const postColor = '#556B2F';  // 暗橄榄绿
  
  return (
    <group position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
      {/* 横杆 - 上 */}
      <mesh position={[0, height - 0.1, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, length]} />
        <meshStandardMaterial color={railColor} roughness={0.6} />
      </mesh>
      
      {/* 横杆 - 中 */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, length]} />
        <meshStandardMaterial color={railColor} roughness={0.6} />
      </mesh>
      
      {/* 横杆 - 下 */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, length]} />
        <meshStandardMaterial color={railColor} roughness={0.6} />
      </mesh>
      
      {/* 立柱 */}
      {Array.from({ length: postCount + 1 }).map((_, i) => {
        const z = -length / 2 + (i / postCount) * length;
        return (
          <mesh key={i} position={[0, height / 2, z]} castShadow>
            <boxGeometry args={[0.06, height, 0.06]} />
            <meshStandardMaterial color={postColor} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

/** 学生人物组件 - 穿校服 */
function Student3D({ 
  height = 1.6,
  shadowLength,
  shadowDirection,
  showLabel,
  position = [0, 0, 0] as [number, number, number],
  sunAltitude = 90,
}: { 
  height?: number;
  shadowLength: number;
  shadowDirection: number;
  showLabel: boolean;
  position?: [number, number, number];
  sunAltitude?: number;
}) {
  const shadowDirRad = shadowDirection * Math.PI / 180;
  
  // 影子终点相对于人物位置的偏移（不是绝对位置）
  const shadowOffsetX = shadowLength * Math.sin(shadowDirRad);
  const shadowOffsetZ = -shadowLength * Math.cos(shadowDirRad);

  // 人物比例
  const headRadius = height * 0.09;
  const bodyHeight = height * 0.35;
  const legHeight = height * 0.45;

  return (
    <group position={position}>
      {/* 头部 */}
      <mesh position={[0, height - headRadius, 0]} castShadow>
        <sphereGeometry args={[headRadius, 24, 24]} />
        <meshStandardMaterial color="#FDBF6F" roughness={0.6} />
      </mesh>
      
      {/* 头发 */}
      <mesh position={[0, height - headRadius * 0.3, 0]}>
        <sphereGeometry args={[headRadius * 1.05, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.8} />
      </mesh>

      {/* 校服上衣 - 白色 */}
      <mesh position={[0, height - headRadius * 2 - bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, bodyHeight, 16]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </mesh>
      
      {/* 红领巾 */}
      <mesh position={[0, height - headRadius * 2.3, 0.08]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.08, 0.15, 3]} />
        <meshStandardMaterial color="#DC143C" roughness={0.6} />
      </mesh>

      {/* 手臂 - 白色校服袖子 */}
      <mesh position={[-0.2, height - headRadius * 2 - bodyHeight * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, bodyHeight * 0.8, 12]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </mesh>
      <mesh position={[0.2, height - headRadius * 2 - bodyHeight * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, bodyHeight * 0.8, 12]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </mesh>

      {/* 校服裤子 - 深蓝色 */}
      <mesh position={[-0.06, legHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, legHeight, 12]} />
        <meshStandardMaterial color="#1E3A5A" roughness={0.8} />
      </mesh>
      <mesh position={[0.06, legHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, legHeight, 12]} />
        <meshStandardMaterial color="#1E3A5A" roughness={0.8} />
      </mesh>
      
      {/* 白色运动鞋 */}
      <mesh position={[-0.06, 0.04, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.6} />
      </mesh>
      <mesh position={[0.06, 0.04, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.6} />
      </mesh>

      {/* 人物标签 - 只在太阳升起时显示 */}
      {showLabel && sunAltitude > 0 && (
        <Html position={[0, height + 0.4, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
          }}>
            👨‍🎓 学生 ({height}m)
          </div>
        </Html>
      )}

      {/* 影子 - 用Line3D从脚下画到远处，只在太阳升起时显示 */}
      {sunAltitude > 0 && shadowLength > 0 && (
        <group>
          {/* 影子主体 - 使用多个小片段组成 */}
          {Array.from({ length: Math.ceil(shadowLength * 4) }).map((_, i) => {
            const t = i / (shadowLength * 4);
            const x = shadowOffsetX * t;
            const z = shadowOffsetZ * t;
            const segWidth = 0.2 + t * 0.1; // 影子末端稍宽
            return (
              <mesh 
                key={i}
                position={[x, 0.01, z]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <circleGeometry args={[segWidth / 2, 8]} />
                <meshBasicMaterial color="#1a1a1a" transparent opacity={0.35 - t * 0.15} depthWrite={false} />
              </mesh>
            );
          })}

          {/* 影子方向指示 */}
          {showLabel && (
            <Html position={[shadowOffsetX * 0.7, 0.3, shadowOffsetZ * 0.7]} center zIndexRange={[100, 0]}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}>
                🌑 影子 → {getShadowDirection((shadowDirection + 180) % 360)}
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
}

/** 真实天空组件 - 使用drei的Sky */
function RealisticSky({ sunAltitude, sunAzimuth }: { sunAltitude: number; sunAzimuth: number }) {
  // 计算太阳位置向量
  const sunPosition = useMemo(() => {
    const altRad = sunAltitude * Math.PI / 180;
    const aziRad = sunAzimuth * Math.PI / 180;
    return [
      Math.cos(altRad) * Math.sin(aziRad),
      Math.sin(altRad),
      -Math.cos(altRad) * Math.cos(aziRad)
    ] as [number, number, number];
  }, [sunAltitude, sunAzimuth]);

  // 根据太阳高度调整天空参数
  const turbidity = sunAltitude > 20 ? 8 : sunAltitude > 0 ? 12 : 20;
  const rayleigh = sunAltitude > 30 ? 1 : sunAltitude > 10 ? 2 : sunAltitude > 0 ? 3 : 0.5;
  const mieCoefficient = sunAltitude > 20 ? 0.005 : sunAltitude > 0 ? 0.01 : 0.001;
  const mieDirectionalG = 0.8;

  if (sunAltitude <= -5) {
    // 深夜 - 纯色背景
    return (
      <mesh>
        <sphereGeometry args={[100, 32, 32]} />
        <meshBasicMaterial color="#0A0A15" side={THREE.BackSide} />
      </mesh>
    );
  }

  return (
    <>
      <DreiSky
        distance={450000}
        sunPosition={sunPosition}
        inclination={0}
        azimuth={0.25}
        turbidity={turbidity}
        rayleigh={rayleigh}
        mieCoefficient={mieCoefficient}
        mieDirectionalG={mieDirectionalG}
      />
      {/* 云层 - 白天显示 */}
      {sunAltitude > 15 && (
        <>
          <Cloud
            opacity={0.4}
            speed={0.2}
            bounds={[30, 5, 30]}
            segments={20}
            position={[-15, 20, -30]}
          />
          <Cloud
            opacity={0.3}
            speed={0.15}
            bounds={[25, 4, 25]}
            segments={15}
            position={[20, 22, -25]}
          />
          <Cloud
            opacity={0.35}
            speed={0.25}
            bounds={[20, 3, 20]}
            segments={12}
            position={[5, 18, -35]}
          />
        </>
      )}
    </>
  );
}

/** 地平线参考圈 */
function Horizon() {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 360; i += 5) {
      const angle = (i * Math.PI) / 180;
      pts.push([12 * Math.sin(angle), 0, -12 * Math.cos(angle)]);
    }
    return pts;
  }, []);

  return (
    <Line
      points={points}
      color="#94A3B8"
      lineWidth={2}
      transparent
      opacity={0.4}
    />
  );
}

/** 生成高质量树木纹理 - 更真实的效果 */
function createRealisticTreeTexture(seed: number, treeType: 'oak' | 'pine' | 'birch' = 'oak'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  
  // 伪随机函数
  const random = (offset: number) => {
    const x = Math.sin(seed * 9999 + offset) * 10000;
    return x - Math.floor(x);
  };
  
  // 清空画布（透明背景）
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const centerX = canvas.width / 2;
  const groundY = canvas.height - 10;
  
  // 照片级真实的绿色调色板
  const photoGreens = [
    { h: 82, s: 28, l: 22 },   // 深橄榄绿
    { h: 88, s: 32, l: 26 },   // 森林绿
    { h: 95, s: 25, l: 20 },   // 暗针叶绿
    { h: 78, s: 35, l: 28 },   // 夏日草绿
    { h: 105, s: 22, l: 18 },  // 深常绿
    { h: 70, s: 30, l: 32 },   // 黄绿叶
  ];
  
  // 真实的树干颜色
  const barkColors = [
    { h: 25, s: 35, l: 18 },
    { h: 20, s: 40, l: 15 },
    { h: 30, s: 30, l: 20 },
    { h: 15, s: 45, l: 12 },
  ];

  if (treeType === 'pine') {
    // 真实感松树
    const trunkH = 120 + random(1) * 60;
    const trunkW = 8 + random(2) * 5;
    const bark = barkColors[Math.floor(random(3) * barkColors.length)];
    
    // 树干 - 带有纹理渐变
    const trunkGrad = ctx.createLinearGradient(centerX - trunkW, 0, centerX + trunkW, 0);
    trunkGrad.addColorStop(0, `hsl(${bark.h}, ${bark.s}%, ${bark.l - 5}%)`);
    trunkGrad.addColorStop(0.3, `hsl(${bark.h}, ${bark.s - 5}%, ${bark.l + 3}%)`);
    trunkGrad.addColorStop(0.7, `hsl(${bark.h}, ${bark.s - 5}%, ${bark.l + 2}%)`);
    trunkGrad.addColorStop(1, `hsl(${bark.h}, ${bark.s}%, ${bark.l - 6}%)`);
    
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.moveTo(centerX - trunkW, groundY);
    ctx.lineTo(centerX - trunkW * 0.4, groundY - trunkH);
    ctx.lineTo(centerX + trunkW * 0.4, groundY - trunkH);
    ctx.lineTo(centerX + trunkW, groundY);
    ctx.fill();
    
    // 树干纹理
    ctx.strokeStyle = `hsla(${bark.h}, ${bark.s + 10}%, ${bark.l - 8}%, 0.4)`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 12; i++) {
      const y = groundY - random(100 + i) * trunkH * 0.9;
      ctx.beginPath();
      ctx.moveTo(centerX - trunkW * 0.8, y);
      ctx.lineTo(centerX + trunkW * 0.8, y + (random(110 + i) - 0.5) * 3);
      ctx.stroke();
    }
    
    // 松树针叶层 - 更真实的形状
    const layers = 5 + Math.floor(random(4) * 2);
    for (let layer = 0; layer < layers; layer++) {
      const layerY = groundY - trunkH * 0.15 - layer * 45;
      const layerW = 70 - layer * 10 + random(200 + layer) * 20;
      const layerH = 55 + random(210 + layer) * 20;
      
      // 多重针叶簇
      for (let j = 0; j < 8; j++) {
        const offsetX = (random(300 + layer * 10 + j) - 0.5) * layerW * 0.6;
        const offsetY = random(310 + layer * 10 + j) * layerH * 0.3;
        const green = photoGreens[Math.floor(random(320 + layer * 10 + j) * photoGreens.length)];
        const lightVar = (random(330 + j) - 0.5) * 8;
        
        ctx.fillStyle = `hsl(${green.h}, ${green.s}%, ${green.l + lightVar}%)`;
        ctx.beginPath();
        ctx.moveTo(centerX + offsetX, layerY - layerH + offsetY);
        ctx.lineTo(centerX + offsetX - layerW * 0.4, layerY + offsetY);
        ctx.lineTo(centerX + offsetX + layerW * 0.4, layerY + offsetY);
        ctx.fill();
      }
      
      // 主三角轮廓
      const mainGreen = photoGreens[Math.floor(random(400 + layer) * photoGreens.length)];
      ctx.fillStyle = `hsla(${mainGreen.h}, ${mainGreen.s + 5}%, ${mainGreen.l - 3}%, 0.7)`;
      ctx.beginPath();
      ctx.moveTo(centerX + (random(410 + layer) - 0.5) * 8, layerY - layerH);
      ctx.lineTo(centerX - layerW * 0.5, layerY);
      ctx.lineTo(centerX + layerW * 0.5, layerY);
      ctx.fill();
    }
    
    // 针叶边缘细节
    for (let i = 0; i < 60; i++) {
      const y = groundY - trunkH * 0.15 - random(500 + i) * (layers * 45);
      const x = centerX + (random(510 + i) - 0.5) * 80;
      const size = 2 + random(520 + i) * 4;
      const green = photoGreens[Math.floor(random(530 + i) * photoGreens.length)];
      
      ctx.fillStyle = `hsla(${green.h}, ${green.s + 8}%, ${green.l + 5}%, ${0.5 + random(540 + i) * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.3, y);
      ctx.lineTo(x + size * 0.3, y);
      ctx.fill();
    }
    
  } else if (treeType === 'birch') {
    // 真实感白桦树
    const trunkH = 180 + random(1) * 80;
    const trunkW = 10 + random(2) * 5;
    
    // 白色树干
    const whiteGrad = ctx.createLinearGradient(centerX - trunkW, 0, centerX + trunkW, 0);
    whiteGrad.addColorStop(0, '#C8C4BE');
    whiteGrad.addColorStop(0.3, '#E8E4DE');
    whiteGrad.addColorStop(0.5, '#F0EDE8');
    whiteGrad.addColorStop(0.7, '#E5E2DC');
    whiteGrad.addColorStop(1, '#C5C1BB');
    
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(centerX - trunkW, groundY - trunkH, trunkW * 2, trunkH);
    
    // 黑色条纹斑点 - 更真实
    for (let i = 0; i < 25; i++) {
      const markY = groundY - random(100 + i) * trunkH * 0.85 - 10;
      const markW = 4 + random(110 + i) * 12;
      const markH = 1 + random(120 + i) * 3;
      const markX = centerX - trunkW + random(130 + i) * trunkW * 1.8;
      
      ctx.fillStyle = `rgba(30, 25, 20, ${0.6 + random(140 + i) * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(markX, markY, markW, markH, (random(150 + i) - 0.5) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 轻盈的树冠
    const crownY = groundY - trunkH - 20;
    for (let layer = 0; layer < 4; layer++) {
      for (let i = 0; i < 12; i++) {
        const lx = centerX + (random(200 + layer * 20 + i) - 0.5) * 70;
        const ly = crownY + (random(210 + layer * 20 + i) - 0.5) * 60 - layer * 10;
        const ls = 12 + random(220 + layer * 20 + i) * 20;
        const green = photoGreens[Math.floor(random(230 + layer * 10 + i) * photoGreens.length)];
        const lightVar = layer * 3 + random(240 + i) * 6;
        
        ctx.fillStyle = `hsla(${green.h + 5}, ${green.s + 10}%, ${green.l + lightVar}%, ${0.6 + random(250 + i) * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(lx, ly, ls, ls * 0.75, random(260 + i) * Math.PI * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
  } else {
    // 真实感阔叶树（橡树）
    const trunkH = 90 + random(1) * 50;
    const trunkW = 18 + random(2) * 10;
    const bark = barkColors[Math.floor(random(5) * barkColors.length)];
    
    // 树干 - 有机形状
    const trunkGrad = ctx.createLinearGradient(centerX - trunkW, 0, centerX + trunkW, 0);
    trunkGrad.addColorStop(0, `hsl(${bark.h}, ${bark.s}%, ${bark.l - 5}%)`);
    trunkGrad.addColorStop(0.25, `hsl(${bark.h - 2}, ${bark.s - 5}%, ${bark.l + 2}%)`);
    trunkGrad.addColorStop(0.5, `hsl(${bark.h}, ${bark.s - 8}%, ${bark.l + 4}%)`);
    trunkGrad.addColorStop(0.75, `hsl(${bark.h + 2}, ${bark.s - 5}%, ${bark.l + 1}%)`);
    trunkGrad.addColorStop(1, `hsl(${bark.h}, ${bark.s}%, ${bark.l - 6}%)`);
    
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.moveTo(centerX - trunkW, groundY);
    ctx.bezierCurveTo(
      centerX - trunkW * 1.1, groundY - trunkH * 0.4,
      centerX - trunkW * 0.6, groundY - trunkH * 0.8,
      centerX - trunkW * 0.2, groundY - trunkH
    );
    ctx.lineTo(centerX + trunkW * 0.2, groundY - trunkH);
    ctx.bezierCurveTo(
      centerX + trunkW * 0.6, groundY - trunkH * 0.8,
      centerX + trunkW * 1.1, groundY - trunkH * 0.4,
      centerX + trunkW, groundY
    );
    ctx.fill();
    
    // 树干纹理
    ctx.strokeStyle = `hsla(${bark.h}, ${bark.s + 15}%, ${bark.l - 10}%, 0.3)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      const startY = groundY - random(300 + i) * trunkH * 0.9;
      ctx.beginPath();
      ctx.moveTo(centerX - trunkW * 0.8 + random(310 + i) * trunkW * 0.4, startY);
      ctx.quadraticCurveTo(
        centerX + (random(320 + i) - 0.5) * trunkW * 0.5,
        startY - 20 - random(330 + i) * 30,
        centerX + trunkW * 0.5 - random(340 + i) * trunkW * 0.8,
        startY - 40 - random(350 + i) * 40
      );
      ctx.stroke();
    }
    
    // 茂密树冠 - 多层真实叶簇
    const crownCenterY = groundY - trunkH - 70;
    const crownW = 90 + random(6) * 40;
    const crownH = 75 + random(7) * 35;
    
    // 底部阴影层
    ctx.fillStyle = 'rgba(15, 25, 15, 0.5)';
    ctx.beginPath();
    ctx.ellipse(centerX, crownCenterY + 20, crownW * 1.05, crownH * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 主树冠层
    for (let layer = 0; layer < 6; layer++) {
      const layerScale = 1 - layer * 0.08;
      const numBlobs = 10 + Math.floor(random(400 + layer) * 6);
      
      for (let i = 0; i < numBlobs; i++) {
        const angle = random(500 + layer * 20 + i) * Math.PI * 2;
        const dist = random(510 + layer * 20 + i) * 0.9;
        const bx = centerX + Math.cos(angle) * crownW * dist * layerScale;
        const by = crownCenterY + Math.sin(angle) * crownH * dist * 0.7 - layer * 8;
        const bSize = (15 + random(520 + layer * 20 + i) * 25) * layerScale;
        
        const green = photoGreens[Math.floor(random(530 + layer * 10 + i) * photoGreens.length)];
        const lightVar = layer * 2 + (random(540 + i) - 0.3) * 10;
        
        ctx.fillStyle = `hsl(${green.h + (random(550 + i) - 0.5) * 10}, ${green.s}%, ${green.l + lightVar}%)`;
        ctx.beginPath();
        ctx.ellipse(bx, by, bSize, bSize * 0.8, random(560 + i) * Math.PI * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // 边缘叶片细节
    for (let i = 0; i < 40; i++) {
      const angle = random(600 + i) * Math.PI * 2;
      const dist = 0.85 + random(610 + i) * 0.3;
      const ex = centerX + Math.cos(angle) * crownW * dist;
      const ey = crownCenterY + Math.sin(angle) * crownH * dist * 0.75;
      const eSize = 5 + random(620 + i) * 10;
      
      const green = photoGreens[Math.floor(random(630 + i) * photoGreens.length)];
      ctx.fillStyle = `hsla(${green.h + 3}, ${green.s + 10}%, ${green.l + 8}%, ${0.5 + random(640 + i) * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(ex, ey, eSize, eSize * 0.6, random(650 + i) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 高光点
    for (let i = 0; i < 25; i++) {
      const hx = centerX + (random(700 + i) - 0.5) * crownW * 1.5;
      const hy = crownCenterY + (random(710 + i) - 0.6) * crownH;
      const hSize = 3 + random(720 + i) * 6;
      
      ctx.fillStyle = `hsla(85, 40%, 55%, ${0.2 + random(730 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(hx, hy, hSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.premultiplyAlpha = true;
  return texture;
}

/** Billboard树木 - 始终面向相机 */
function BillboardTree({ 
  position, 
  scale, 
  seed,
  treeType
}: { 
  position: [number, number, number]; 
  scale: number;
  seed: number;
  treeType: 'oak' | 'pine' | 'birch';
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 生成树木纹理
  const texture = useMemo(() => createRealisticTreeTexture(seed, treeType), [seed, treeType]);
  
  // 使Billboard始终面向相机
  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
  });

  const height = scale * 3;
  const width = scale * 2;

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + height / 2, position[2]]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial 
        map={texture} 
        transparent 
        alphaTest={0.1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 创建树皮纹理 */
function createBarkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // 基础棕色
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(0, 0, size, size);
  
  // 添加树皮纹理 - 垂直裂纹
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const width = 2 + Math.random() * 4;
    ctx.fillStyle = `rgba(25, 15, 8, ${0.3 + Math.random() * 0.4})`;
    ctx.fillRect(x, 0, width, size);
  }
  
  // 添加横向细节
  for (let i = 0; i < 50; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const w = 10 + Math.random() * 30;
    ctx.fillStyle = `rgba(60, 40, 25, ${0.2 + Math.random() * 0.3})`;
    ctx.fillRect(x, y, w, 1 + Math.random() * 2);
  }
  
  // 添加一些亮点（苔藓/光照）
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(70, 55, 35, ${0.1 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
}

/** 3D实体树木 - 更真实的版本 */
function SolidTree({ 
  position, 
  scale, 
  seed,
  treeStyle = 'mixed'
}: { 
  position: [number, number, number]; 
  scale: number;
  seed: number;
  treeStyle?: 'deciduous' | 'conifer' | 'mixed';
}) {
  // 伪随机函数
  const random = (offset: number) => {
    const x = Math.sin(seed * 9999 + offset) * 10000;
    return x - Math.floor(x);
  };

  const treeType = treeStyle === 'mixed' 
    ? (random(0) > 0.6 ? 'deciduous' : 'conifer')
    : treeStyle;
  
  // 树皮纹理
  const barkTexture = useMemo(() => createBarkTexture(), []);
  
  // 树干参数 - 更真实的比例
  const trunkHeight = scale * (treeType === 'conifer' ? 2.5 + random(4) * 1.0 : 1.8 + random(4) * 0.8);
  const trunkRadiusBottom = scale * (treeType === 'conifer' ? 0.12 : 0.15 + random(5) * 0.05);
  const trunkRadiusTop = trunkRadiusBottom * 0.4;

  // 树冠数据
  const crownData = useMemo(() => {
    if (treeType === 'conifer') {
      // 针叶树 - 圆锥形树冠
      const layers: { y: number; radius: number; color: string }[] = [];
      const numLayers = 6 + Math.floor(random(15) * 3);
      const crownStart = trunkHeight * 0.25;
      const crownHeight = trunkHeight * 0.9;
      
      for (let i = 0; i < numLayers; i++) {
        const t = i / (numLayers - 1);
        const y = crownStart + t * crownHeight;
        // 底部宽，顶部窄的锥形
        const radius = scale * (0.8 - t * 0.7) * (0.9 + random(20 + i) * 0.2);
        
        const hueVar = (random(30 + i) - 0.5) * 15;
        const lightVar = t * 8; // 顶部更亮
        layers.push({
          y,
          radius,
          color: `hsl(${100 + hueVar}, ${35 + random(40 + i) * 10}%, ${22 + lightVar}%)`
        });
      }
      return { type: 'conifer' as const, layers };
    } else {
      // 落叶树 - 球形/不规则树冠
      const clusters: { pos: [number, number, number]; size: number; color: string }[] = [];
      const numClusters = 25 + Math.floor(random(10) * 20);
      const crownCenter = trunkHeight + scale * 0.5;
      const crownRadiusH = scale * 1.0;
      const crownRadiusV = scale * 0.8;
      
      for (let i = 0; i < numClusters; i++) {
        // 球面分布
        const phi = Math.acos(2 * random(20 + i) - 1);
        const theta = random(30 + i) * Math.PI * 2;
        const r = 0.4 + random(35 + i) * 0.6;
        
        const x = Math.sin(phi) * Math.cos(theta) * crownRadiusH * r;
        const y = crownCenter + Math.cos(phi) * crownRadiusV * r * 0.9;
        const z = Math.sin(phi) * Math.sin(theta) * crownRadiusH * r;
        
        // 颜色变化 - 外围和顶部更亮
        const heightFactor = (y - trunkHeight) / (crownRadiusV * 2);
        const hueVar = (random(50 + i) - 0.5) * 20;
        const lightVar = heightFactor * 10 + random(60 + i) * 5;
        
        clusters.push({
          pos: [x, y, z],
          size: scale * (0.25 + random(70 + i) * 0.2),
          color: `hsl(${95 + hueVar}, ${35 + random(80 + i) * 15}%, ${25 + lightVar}%)`
        });
      }
      return { type: 'deciduous' as const, clusters };
    }
  }, [scale, seed, trunkHeight, treeType]);

  // 树枝数据（落叶树）
  const branches = useMemo(() => {
    if (treeType !== 'deciduous') return [];
    
    const branchData: { start: [number, number, number]; end: [number, number, number]; radius: number }[] = [];
    const numBranches = 4 + Math.floor(random(100) * 4);
    
    for (let i = 0; i < numBranches; i++) {
      const angle = (i / numBranches) * Math.PI * 2 + random(110 + i) * 0.5;
      const startY = trunkHeight * (0.5 + random(120 + i) * 0.3);
      const length = scale * (0.4 + random(130 + i) * 0.3);
      const upAngle = 0.3 + random(140 + i) * 0.4;
      
      branchData.push({
        start: [0, startY, 0],
        end: [
          Math.cos(angle) * length,
          startY + Math.sin(upAngle) * length,
          Math.sin(angle) * length
        ],
        radius: trunkRadiusBottom * (0.2 + random(150 + i) * 0.15)
      });
    }
    return branchData;
  }, [scale, seed, trunkHeight, trunkRadiusBottom, treeType]);

  return (
    <group position={position} rotation={[0, random(200) * Math.PI * 2, 0]}>
      {/* 树干 - 带纹理 */}
      <mesh position={[0, trunkHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[trunkRadiusTop, trunkRadiusBottom, trunkHeight, 12]} />
        <meshStandardMaterial 
          map={barkTexture}
          color="#5a3d2b"
          roughness={0.95}
        />
      </mesh>
      
      {/* 树根部凸起 */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[trunkRadiusBottom, trunkRadiusBottom * 1.3, 0.15, 12]} />
        <meshStandardMaterial color="#3d2817" roughness={1} />
      </mesh>
      
      {/* 树枝（落叶树） */}
      {branches.map((branch, i) => {
        const dx = branch.end[0] - branch.start[0];
        const dy = branch.end[1] - branch.start[1];
        const dz = branch.end[2] - branch.start[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const midX = (branch.start[0] + branch.end[0]) / 2;
        const midY = (branch.start[1] + branch.end[1]) / 2;
        const midZ = (branch.start[2] + branch.end[2]) / 2;
        
        return (
          <mesh 
            key={`branch-${i}`}
            position={[midX, midY, midZ]}
            rotation={[
              Math.atan2(Math.sqrt(dx * dx + dz * dz), dy) - Math.PI / 2,
              Math.atan2(dz, dx),
              0
            ]}
            castShadow
          >
            <cylinderGeometry args={[branch.radius * 0.6, branch.radius, length, 6]} />
            <meshStandardMaterial color="#4a3020" roughness={0.9} />
          </mesh>
        );
      })}
      
      {/* 树冠 */}
      {crownData.type === 'conifer' ? (
        // 针叶树 - 圆锥层
        crownData.layers.map((layer, i) => (
          <mesh key={i} position={[0, layer.y, 0]} castShadow>
            <coneGeometry args={[layer.radius, layer.radius * 0.6, 8]} />
            <meshStandardMaterial 
              color={layer.color}
              roughness={0.85}
              flatShading
            />
          </mesh>
        ))
      ) : (
        // 落叶树 - 球形簇
        crownData.clusters.map((cluster, i) => (
          <mesh key={i} position={cluster.pos} castShadow>
            <icosahedronGeometry args={[cluster.size, 1]} />
            <meshStandardMaterial 
              color={cluster.color}
              roughness={0.9}
              flatShading
            />
          </mesh>
        ))
      )}
    </group>
  );
}

function DistantTrees() {
  // 生成树木数据
  const trees = useMemo(() => {
    const treeData: { 
      angle: number; 
      distance: number; 
      scale: number; 
      seed: number;
      type: 'oak' | 'pine' | 'birch';
      use3D: boolean;
    }[] = [];
    
    // 近距离树木 - 使用3D模型（增加数量）
    for (let i = 0; i < 18; i++) {
      const baseAngle = (i / 18) * Math.PI * 2;
      treeData.push({
        angle: baseAngle + (Math.random() - 0.5) * 0.4,
        distance: 10 + Math.random() * 4,
        scale: 1.0 + Math.random() * 0.6,
        seed: i * 7 + 1,
        type: ['oak', 'pine', 'birch'][Math.floor(Math.random() * 3)] as 'oak' | 'pine' | 'birch',
        use3D: true
      });
    }
    
    // 中距离树木 - 混合3D和Billboard
    for (let i = 0; i < 25; i++) {
      const baseAngle = (i / 25) * Math.PI * 2 + 0.1;
      treeData.push({
        angle: baseAngle + (Math.random() - 0.5) * 0.25,
        distance: 15 + Math.random() * 4,
        scale: 0.8 + Math.random() * 0.5,
        seed: i * 13 + 100,
        type: ['oak', 'pine', 'birch'][Math.floor(Math.random() * 3)] as 'oak' | 'pine' | 'birch',
        use3D: i % 2 === 0  // 每两棵用3D
      });
    }
    
    // 远距离树木 - Billboard（更小更密）
    for (let i = 0; i < 40; i++) {
      const baseAngle = (i / 40) * Math.PI * 2 + 0.2;
      treeData.push({
        angle: baseAngle + (Math.random() - 0.5) * 0.2,
        distance: 20 + Math.random() * 6,
        scale: 0.4 + Math.random() * 0.3,
        seed: i * 17 + 200,
        type: ['oak', 'pine'][Math.floor(Math.random() * 2)] as 'oak' | 'pine',
        use3D: false
      });
    }
    
    return treeData;
  }, []);

  return (
    <group>
      {trees.map((tree, i) => {
        const x = tree.distance * Math.sin(tree.angle);
        const z = -tree.distance * Math.cos(tree.angle);
        
        if (tree.use3D) {
          return (
            <SolidTree 
              key={i}
              position={[x, 0, z]}
              scale={tree.scale}
              seed={tree.seed}
            />
          );
        } else {
          return (
            <BillboardTree 
              key={i}
              position={[x, 0, z]}
              scale={tree.scale}
              seed={tree.seed}
              treeType={tree.type}
            />
          );
        }
      })}
    </group>
  );
}

/** 地面上的小草丛 - 增加细节 */
function GrassTufts() {
  // 自然的草地颜色
  const grassColors = [
    '#5D6B3D', // 暗橄榄
    '#6B7B45', // 中橄榄
    '#4D5A32', // 深草绿
    '#7A8B52', // 亮草绿
    '#656F40', // 灰绿
  ];

  const tufts = useMemo(() => {
    const data: { x: number; z: number; scale: number; seed: number }[] = [];
    // 增加草丛数量
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.5 + Math.random() * 12;
      data.push({
        x: dist * Math.sin(angle),
        z: -dist * Math.cos(angle),
        scale: 0.1 + Math.random() * 0.2,
        seed: i
      });
    }
    return data;
  }, []);

  return (
    <group>
      {tufts.map((tuft, i) => (
        <group key={i} position={[tuft.x, 0, tuft.z]}>
          {/* 多片草叶组成草丛 */}
          {[0, 1, 2, 3, 4, 5, 6].map((j) => {
            const angle = (j / 7) * Math.PI * 2 + (tuft.seed * 0.1);
            const lean = 0.15 + Math.random() * 0.35;
            const height = tuft.scale * (0.8 + Math.random() * 0.4);
            const color = grassColors[Math.floor((tuft.seed + j) % grassColors.length)];
            return (
              <mesh 
                key={j} 
                position={[Math.sin(angle) * 0.02, height * 0.5, Math.cos(angle) * 0.02]}
                rotation={[lean, angle, 0]}
              >
                <coneGeometry args={[0.015 * tuft.scale, height * 1.2, 3]} />
                <meshStandardMaterial color={color} roughness={0.95} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** 地面上的小石头 - 更自然 */
function SmallRocks() {
  // 自然石头颜色
  const rockColors = [
    '#8B8680', // 暖灰
    '#7A746E', // 深灰棕
    '#9C9590', // 浅灰
    '#6B6560', // 暗灰
    '#A5A09A', // 亮灰
  ];

  const rocks = useMemo(() => {
    const data: { x: number; z: number; scale: number; rotation: number; colorIdx: number; shape: number }[] = [];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1 + Math.random() * 10;
      data.push({
        x: dist * Math.sin(angle),
        z: -dist * Math.cos(angle),
        scale: 0.05 + Math.random() * 0.12,
        rotation: Math.random() * Math.PI * 2,
        colorIdx: Math.floor(Math.random() * rockColors.length),
        shape: Math.random()
      });
    }
    return data;
  }, []);

  return (
    <group>
      {rocks.map((rock, i) => (
        <mesh 
          key={i} 
          position={[rock.x, rock.scale * 0.25, rock.z]} 
          rotation={[Math.random() * 0.3, rock.rotation, Math.random() * 0.3]}
          castShadow
        >
          {rock.shape > 0.5 ? (
            <dodecahedronGeometry args={[rock.scale, 0]} />
          ) : (
            <icosahedronGeometry args={[rock.scale, 0]} />
          )}
          <meshStandardMaterial 
            color={rockColors[rock.colorIdx]} 
            roughness={0.98}
            metalness={0.02}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

/** 太阳轨迹弧线 - 带时间标记 */
function SunPath({ 
  latitude, 
  subsolarLat,
  currentTime,
}: { 
  latitude: number;
  subsolarLat: number;
  currentTime: number;
}) {
  const distance = 12;

  const pathPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    
    for (let h = -90; h <= 90; h += 3) {
      const alt = getSunAltitude(latitude, subsolarLat, h);
      if (alt > 0) {
        const azi = getSunAzimuth(latitude, subsolarLat, h);
        const altRad = alt * Math.PI / 180;
        const aziRad = azi * Math.PI / 180;
        
        points.push([
          distance * Math.cos(altRad) * Math.sin(aziRad),
          distance * Math.sin(altRad),
          -distance * Math.cos(altRad) * Math.cos(aziRad)
        ]);
      }
    }
    return points;
  }, [latitude, subsolarLat]);

  // 计算关键时间点的位置
  const timeMarkers = useMemo(() => {
    const markers: { time: number; position: [number, number, number]; label: string }[] = [];
    const keyTimes = [6, 9, 12, 15, 18];
    
    keyTimes.forEach(time => {
      const hourAngle = localTimeToHourAngle(time);
      const alt = getSunAltitude(latitude, subsolarLat, hourAngle);
      if (alt > 0) {
        const azi = getSunAzimuth(latitude, subsolarLat, hourAngle);
        const altRad = alt * Math.PI / 180;
        const aziRad = azi * Math.PI / 180;
        
        markers.push({
          time,
          position: [
            distance * Math.cos(altRad) * Math.sin(aziRad),
            distance * Math.sin(altRad),
            -distance * Math.cos(altRad) * Math.cos(aziRad)
          ],
          label: `${time}:00`
        });
      }
    });
    return markers;
  }, [latitude, subsolarLat]);

  if (pathPoints.length < 2) return null;

  return (
    <group>
      {/* 太阳轨迹弧线 - 更明显 */}
      <Line
        points={pathPoints}
        color="#FBBF24"
        lineWidth={4}
        transparent
        opacity={0.6}
      />
      
      {/* 轨迹内侧虚线 */}
      <Line
        points={pathPoints}
        color="#FDE68A"
        lineWidth={2}
        transparent
        opacity={0.3}
        dashed
        dashScale={3}
      />

      {/* 日出日落位置标记 */}
      {pathPoints.length > 0 && (
        <>
          {/* 日出位置 */}
          <group position={pathPoints[0]}>
            <Html center zIndexRange={[70, 0]}>
              <div style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                🌅 日出
              </div>
            </Html>
          </group>
          {/* 日落位置 */}
          <group position={pathPoints[pathPoints.length - 1]}>
            <Html center zIndexRange={[70, 0]}>
              <div style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                🌇 日落
              </div>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}

/** 场景组件 - 学校操场场景 */
function Scene({ 
  latitude,
  subsolarLat,
  localTime,
  showLabels,
  cameraRef,
}: {
  latitude: number;
  subsolarLat: number;
  localTime: number;
  showLabels: boolean;
  cameraRef: React.RefObject<CameraControllerHandle>;
}) {
  const hourAngle = localTimeToHourAngle(localTime);
  const sunAltitude = getSunAltitude(latitude, subsolarLat, hourAngle);
  const sunAzimuth = getSunAzimuth(latitude, subsolarLat, hourAngle);
  
  // 影子方向（与太阳方位相反）
  const shadowDirection = (sunAzimuth + 180) % 360;
  
  // 影子长度 = 物体高度 / tan(太阳高度角)
  const studentHeight = 1.6;  // 学生身高
  const flagPoleHeight = 8;   // 旗杆高度
  const shadowLengthStudent = sunAltitude > 1 ? studentHeight / Math.tan(sunAltitude * Math.PI / 180) : 10;
  const shadowLengthFlagPole = sunAltitude > 1 ? flagPoleHeight / Math.tan(sunAltitude * Math.PI / 180) : 50;

  // 根据太阳高度调整环境光
  const ambientIntensity = sunAltitude > 0 ? 0.35 + sunAltitude / 90 : 0.15;
  
  // 太阳光颜色根据高度变化
  const sunLightColor = useMemo(() => {
    if (sunAltitude < 10) return '#FF8C00';
    if (sunAltitude < 30) return '#FFD700';
    return '#FFFAF0';
  }, [sunAltitude]);

  // 计算太阳方向光位置
  const sunLightPosition = useMemo(() => {
    const altRad = sunAltitude * Math.PI / 180;
    const aziRad = sunAzimuth * Math.PI / 180;
    const dist = 30;
    return [
      dist * Math.cos(altRad) * Math.sin(aziRad),
      dist * Math.sin(altRad),
      -dist * Math.cos(altRad) * Math.cos(aziRad)
    ] as [number, number, number];
  }, [sunAltitude, sunAzimuth]);

  // 根据时间计算雾的颜色
  const fogColor = useMemo(() => {
    if (sunAltitude < 0) return '#1A1A2E';
    if (sunAltitude < 10) return '#4A3C6E';
    if (sunAltitude < 30) return '#87CEEB';
    return '#B0E0E6';
  }, [sunAltitude]);

  return (
    <>
      {/* 雾效果 - 增加大气透视感 */}
      <fog attach="fog" args={[fogColor, 40, 100]} />
      
      {/* 环境光 - 随时间变化 */}
      <ambientLight intensity={ambientIntensity} color={sunAltitude > 10 ? '#FFFFFF' : '#FFE4B5'} />
      
      {/* 主光源 - 模拟太阳光 */}
      {sunAltitude > 0 && (
        <directionalLight 
          position={sunLightPosition} 
          intensity={0.6 + sunAltitude / 50}
          color={sunLightColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={80}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
      )}
      
      {/* 补光 - 防止阴影太暗 */}
      <directionalLight position={[-10, 15, -10]} intensity={0.15} color="#87CEEB" />
      
      {/* 半球光 - 模拟天空和地面反射 */}
      <hemisphereLight 
        color={sunAltitude > 10 ? '#87CEEB' : '#1E3A5A'} 
        groundColor="#8B9A6B" 
        intensity={0.35} 
      />
      
      {/* 真实天空背景 */}
      <RealisticSky sunAltitude={sunAltitude} sunAzimuth={sunAzimuth} />
      
      {/* 环境贴图 - 增强真实感 */}
      {sunAltitude > 5 && (
        <Environment preset="city" background={false} />
      )}
      
      {/* 注意：移除了 ContactShadows 组件，因为它会错误地为天空中的太阳生成阴影
          改为完全依赖 directionalLight 的 castShadow 来生成阴影 */}
      
      {/* 星空（夜晚显示更明显） */}
      <Stars radius={100} depth={50} count={sunAltitude > 10 ? 300 : 5000} factor={3} fade speed={1} />
      
      {/* 地平线参考 */}
      <Horizon />
      
      {/* ========== 学校操场场景 ========== */}
      
      {/* 操场地面（跑道 + 足球场） */}
      <Ground />
      
      {/* 指南针 - 帮助理解方向 */}
      <Compass3D radius={6} />
      
      {/* 升旗台和旗杆 - 位于操场北侧 */}
      <FlagPole 
        position={[0, 0, -10]}
        shadowLength={Math.min(shadowLengthFlagPole, 25)}
        shadowDirection={shadowDirection}
        showLabel={showLabels}
        sunAltitude={sunAltitude}
      />
      
      {/* 足球门 - 两端 */}
      <SoccerGoal position={[-10, 0, 0]} rotation={Math.PI / 2} />
      <SoccerGoal position={[10, 0, 0]} rotation={-Math.PI / 2} />
      
      {/* 篮球架 - 操场外侧的篮球场（右侧） */}
      <BasketballHoop position={[22, 0, 12]} rotation={Math.PI} />
      <BasketballHoop position={[22, 0, 6]} rotation={Math.PI} />
      
      {/* 教学楼 - 北侧背景（主楼有大门和校名牌） */}
      <SchoolBuilding position={[0, 0, -30]} width={25} height={15} depth={10} isMainBuilding={true} />
      
      {/* 侧面小建筑（普通建筑，无大门和校名牌）- 只在右侧 */}
      <SchoolBuilding position={[25, 0, -10]} width={12} height={10} depth={8} />
      
      {/* 操场周围的树木 - 少量装饰 */}
      {[
        { x: 18, z: 15 }, { x: 22, z: 12 }, { x: 20, z: 8 },
        { x: -18, z: 15 }, { x: -22, z: 12 }, { x: -20, z: 8 },
        { x: 18, z: -18 }, { x: -18, z: -18 },
        // 更多背景树木
        { x: 25, z: 18 }, { x: 28, z: 14 }, { x: 26, z: 10 },
        { x: -25, z: 18 }, { x: -28, z: 14 }, { x: -26, z: 10 },
        { x: 30, z: -15 }, { x: -30, z: -15 },
      ].map((pos, i) => (
        <SolidTree 
          key={i}
          position={[pos.x, 0, pos.z]}
          scale={1.2 + (i % 3) * 0.3}
          seed={i * 7 + 100}
          treeStyle={i % 3 === 0 ? 'conifer' : 'deciduous'}
        />
      ))}
      
      {/* 操场外侧的长椅 - 供观众休息 */}
      <ParkBench position={[20, 0, 16]} rotation={-Math.PI / 2} />
      <ParkBench position={[20, 0, -16]} rotation={-Math.PI / 2} />
      <ParkBench position={[-20, 0, 16]} rotation={Math.PI / 2} />
      <ParkBench position={[-20, 0, -16]} rotation={Math.PI / 2} />
      
      {/* 垃圾桶 - 放在长椅旁边 */}
      <TrashBin position={[19, 0, 14]} />
      <TrashBin position={[19, 0, -14]} />
      <TrashBin position={[-19, 0, 14]} />
      <TrashBin position={[-19, 0, -14]} />
      
      {/* 路灯 - 操场周围照明 */}
      <StreetLamp position={[22, 0, 0]} />
      <StreetLamp position={[-22, 0, 0]} />
      <StreetLamp position={[0, 0, 20]} />
      <StreetLamp position={[22, 0, 16]} />
      <StreetLamp position={[-22, 0, 16]} />
      
      {/* 围栏 - 操场外围边界 */}
      <Fence startPos={[28, 0, 22]} endPos={[28, 0, -22]} />
      <Fence startPos={[-28, 0, 22]} endPos={[-28, 0, -22]} />
      <Fence startPos={[28, 0, 22]} endPos={[-28, 0, 22]} />
      <Fence startPos={[28, 0, -22]} endPos={[-28, 0, -22]} />
      
      {/* 太阳轨迹 */}
      <SunPath latitude={latitude} subsolarLat={subsolarLat} currentTime={localTime} />
      
      {/* 太阳 */}
      <Sun3D altitude={sunAltitude} azimuth={sunAzimuth} localTime={localTime} showRays={showLabels} />
      
      {/* 学生 - 站在操场中央观察影子 */}
      <Student3D 
        height={studentHeight}
        shadowLength={Math.min(shadowLengthStudent, 10)}
        shadowDirection={shadowDirection}
        showLabel={showLabels}
        position={[0, 0, 3]}
        sunAltitude={sunAltitude}
      />
      
      {/* 另一个学生做对比 */}
      <Student3D 
        height={1.5}
        shadowLength={Math.min(sunAltitude > 1 ? 1.5 / Math.tan(sunAltitude * Math.PI / 180) : 10, 10)}
        shadowDirection={shadowDirection}
        showLabel={false}
        position={[3, 0, 5]}
        sunAltitude={sunAltitude}
      />
      
      <CameraController ref={cameraRef} defaultPosition={[25, 18, 25]} />
    </>
  );
}

// ===================== 控制面板 =====================

interface ControlPanelProps {
  latitude: number;
  setLatitude: (lat: number) => void;
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
  localTime: number;
  setLocalTime: (time: number) => void;
  subsolarLat: number;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
}

function ControlPanel({
  latitude,
  setLatitude,
  dayOfYear,
  setDayOfYear,
  localTime,
  setLocalTime,
  subsolarLat,
  selectedCity,
  setSelectedCity,
}: ControlPanelProps) {
  const hourAngle = localTimeToHourAngle(localTime);
  const sunAltitude = getSunAltitude(latitude, subsolarLat, hourAngle);
  const sunAzimuth = getSunAzimuth(latitude, subsolarLat, hourAngle);
  const shadowDirection = azimuthToDirection((sunAzimuth + 180) % 360);
  const sunDirection = azimuthToDirection(sunAzimuth);

  // 计算影子长度（相对于1米高的物体）
  const shadowLength = sunAltitude > 1 ? (1 / Math.tan(sunAltitude * Math.PI / 180)).toFixed(2) : '∞';

  return (
    <Card elevation={3} sx={{ 
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(10px)',
      borderRadius: 2,
      border: '1px solid rgba(0, 0, 0, 0.08)',
    }}>
      <CardContent sx={{ p: 2 }}>
        {/* 当前状态显示 */}
        <div style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          color: 'white',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            ☀️ 太阳位置
          </Typography>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div>
              <span style={{ opacity: 0.8 }}>高度角：</span>
              <b>{sunAltitude.toFixed(1)}°</b>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>方位角：</span>
              <b>{sunAzimuth.toFixed(1)}°</b>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>太阳方向：</span>
              <b>{sunDirection}</b>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>影子方向：</span>
              <b>{shadowDirection}</b>
            </div>
          </div>
        </div>

        {/* 影子信息 */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.1)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1E293B' }}>
            🌓 影子信息
          </Typography>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <div style={{ marginBottom: 4 }}>
              <span>1米高物体影子长度：</span>
              <b style={{ color: '#1E293B' }}>{shadowLength}米</b>
            </div>
            <div style={{
              background: 'rgba(30, 41, 59, 0.1)',
              padding: 8,
              borderRadius: 8,
              marginTop: 8,
              fontSize: 12,
            }}>
              💡 <b>规律：</b>太阳越高，影子越短；太阳越低，影子越长
            </div>
          </div>
        </div>

        {/* 城市选择 */}
        <LocationSelector
          selectedCity={selectedCity}
          onCitySelect={(city: City) => {
            setSelectedCity(city.name);
            setLatitude(city.lat);
          }}
        />

        {/* 纬度滑块 */}
        <div style={{ marginBottom: 16, paddingLeft: 8, paddingRight: 8 }}>
          <Typography variant="caption" color="text.secondary">
            🌐 观测点纬度：<b style={{ color: '#3B82F6' }}>{formatDegreeMinute(latitude)}</b>
          </Typography>
          <Slider
            value={latitude}
            onChange={(_, v) => setLatitude(v as number)}
            min={-66}
            max={66}
            step={1}
            marks={[
              { value: -66, label: '66°S' },
              { value: 0, label: '赤道' },
              { value: 66, label: '66°N' },
            ]}
            sx={{ 
              color: '#3B82F6',
              '& .MuiSlider-markLabel[data-index="0"]': {
                transform: 'translateX(0%)',
              },
              '& .MuiSlider-markLabel[data-index="2"]': {
                transform: 'translateX(-100%)',
              },
            }}
          />
        </div>

        {/* 日期选择 */}
        <div style={{ marginBottom: 16, paddingLeft: 8, paddingRight: 8 }}>
          <Typography variant="caption" color="text.secondary">
            🗓️ 日期：<b>{dayOfYearToDate(dayOfYear)}</b>
            <span style={{ marginLeft: 8, color: '#F59E0B' }}>
              （直射点 {formatDegreeMinute(subsolarLat)}）
            </span>
          </Typography>
          <Slider
            value={dayOfYear}
            onChange={(_, v) => setDayOfYear(v as number)}
            min={1}
            max={365}
            sx={{ color: '#F59E0B' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {SPECIAL_DATES.map(({ name, dayOfYear: day }) => (
              <Chip
                key={name}
                label={name}
                size="small"
                onClick={() => setDayOfYear(day)}
                sx={{
                  background: Math.abs(dayOfYear - day) < 5
                    ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' 
                    : 'rgba(245, 158, 11, 0.1)',
                  color: Math.abs(dayOfYear - day) < 5 ? 'white' : '#F59E0B',
                  fontWeight: Math.abs(dayOfYear - day) < 5 ? 600 : 400,
                  fontSize: 11,
                }}
              />
            ))}
          </div>
        </div>

        {/* 时间滑块 */}
        <div style={{ marginBottom: 16, paddingLeft: 8, paddingRight: 8 }}>
          <Typography variant="caption" color="text.secondary">
            🕐 地方时：<b style={{ color: '#8B5CF6' }}>{formatTime(localTime)}</b>
          </Typography>
          <Slider
            value={localTime}
            onChange={(_, v) => setLocalTime(v as number)}
            min={5}
            max={19}
            step={0.25}
            marks={[
              { value: 6, label: '6:00' },
              { value: 12, label: '12:00' },
              { value: 18, label: '18:00' },
            ]}
            sx={{ color: '#8B5CF6' }}
          />
          
          {/* 典型时刻快捷按钮 */}
          <div style={{ marginTop: 8 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ⏰ 典型时刻（点击观察影子变化）
            </Typography>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip
                label="🌅 9:00 上午"
                size="small"
                onClick={() => setLocalTime(9)}
                sx={{
                  background: Math.abs(localTime - 9) < 0.5 
                    ? 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)' 
                    : 'rgba(245, 158, 11, 0.1)',
                  color: Math.abs(localTime - 9) < 0.5 ? 'white' : '#F59E0B',
                  fontWeight: 600,
                  fontSize: 11,
                  '&:hover': { background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)', color: 'white' },
                }}
              />
              <Chip
                label="☀️ 12:00 正午"
                size="small"
                onClick={() => setLocalTime(12)}
                sx={{
                  background: Math.abs(localTime - 12) < 0.5 
                    ? 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)' 
                    : 'rgba(239, 68, 68, 0.1)',
                  color: Math.abs(localTime - 12) < 0.5 ? 'white' : '#EF4444',
                  fontWeight: 600,
                  fontSize: 11,
                  '&:hover': { background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)', color: 'white' },
                }}
              />
              <Chip
                label="🌇 15:00 下午"
                size="small"
                onClick={() => setLocalTime(15)}
                sx={{
                  background: Math.abs(localTime - 15) < 0.5 
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' 
                    : 'rgba(139, 92, 246, 0.1)',
                  color: Math.abs(localTime - 15) < 0.5 ? 'white' : '#8B5CF6',
                  fontWeight: 600,
                  fontSize: 11,
                  '&:hover': { background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', color: 'white' },
                }}
              />
            </div>
            {/* 时刻说明 */}
            <div style={{ 
              marginTop: 8, 
              padding: '6px 10px', 
              background: 'rgba(139, 92, 246, 0.08)', 
              borderRadius: 8,
              fontSize: 11,
              color: '#6366F1',
            }}>
              {localTime < 10.5 && '🌅 上午：太阳在东方，影子朝西偏北'}
              {localTime >= 10.5 && localTime < 13.5 && '☀️ 正午：太阳最高，影子最短，朝正北/正南'}
              {localTime >= 13.5 && '🌇 下午：太阳在西方，影子朝东偏北'}
            </div>
          </div>
        </div>

        {/* 解题技巧 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#6366F1' }}>
            📝 解题技巧
          </Typography>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
            <div>• <b>北半球</b>：正午影子朝<b style={{ color: '#EF4444' }}>北</b></div>
            <div>• <b>南半球</b>：正午影子朝<b style={{ color: '#3B82F6' }}>南</b></div>
            <div>• <b>上午</b>：影子偏<b style={{ color: '#F59E0B' }}>西</b></div>
            <div>• <b>下午</b>：影子偏<b style={{ color: '#10B981' }}>东</b></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== 移动端控制面板 =====================

function MobileControlPanel({
  latitude,
  setLatitude,
  dayOfYear,
  setDayOfYear,
  localTime,
  setLocalTime,
  subsolarLat,
  selectedCity,
  setSelectedCity,
}: {
  latitude: number;
  setLatitude: (lat: number) => void;
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
  localTime: number;
  setLocalTime: (time: number) => void;
  subsolarLat: number;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hourAngle = localTimeToHourAngle(localTime);
  const sunAltitude = getSunAltitude(latitude, subsolarLat, hourAngle);
  const sunAzimuth = getSunAzimuth(latitude, subsolarLat, hourAngle);
  const shadowDirection = azimuthToDirection((sunAzimuth + 180) % 360);

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 30%)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          borderRadius: 20,
          padding: '4px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)',
        }}>
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
            {isExpanded ? '收起' : `影子方向: ${shadowDirection}`}
          </Typography>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} style={{ display: 'flex', alignItems: 'center' }}>
            <ExpandMoreIcon sx={{ color: 'white', fontSize: 18 }} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ padding: 16, maxHeight: '50vh', overflowY: 'auto' }}>
              {/* 太阳信息 */}
              <div style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 12,
                color: 'white',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
                  <div><span style={{ opacity: 0.8 }}>高度角</span><br/><b>{sunAltitude.toFixed(1)}°</b></div>
                  <div><span style={{ opacity: 0.8 }}>太阳方向</span><br/><b>{azimuthToDirection(sunAzimuth)}</b></div>
                  <div><span style={{ opacity: 0.8 }}>影子方向</span><br/><b>{shadowDirection}</b></div>
                </div>
              </div>

              {/* 城市选择 */}
              <LocationSelector
                selectedCity={selectedCity}
                onCitySelect={(city: City) => {
                  setSelectedCity(city.name);
                  setLatitude(city.lat);
                }}
              />

              {/* 纬度 */}
              <div style={{ marginBottom: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  纬度：<b>{formatDegreeMinute(latitude)}</b>
                </Typography>
                <Slider
                  value={latitude}
                  onChange={(_, v) => setLatitude(v as number)}
                  min={-66}
                  max={66}
                  sx={{ color: '#3B82F6' }}
                />
              </div>

              {/* 日期 */}
              <div style={{ marginBottom: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  {dayOfYearToDate(dayOfYear)}
                </Typography>
                <Slider
                  value={dayOfYear}
                  onChange={(_, v) => setDayOfYear(v as number)}
                  min={1}
                  max={365}
                  sx={{ color: '#F59E0B' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {SPECIAL_DATES.map(({ name, dayOfYear: day }) => (
                    <Chip
                      key={name}
                      label={name}
                      size="small"
                      onClick={() => setDayOfYear(day)}
                      sx={{
                        background: Math.abs(dayOfYear - day) < 5 ? '#F59E0B' : 'rgba(245, 158, 11, 0.1)',
                        color: Math.abs(dayOfYear - day) < 5 ? 'white' : '#F59E0B',
                        fontSize: 10,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 时间 */}
              <div>
                <Typography variant="caption" color="text.secondary">
                  地方时：<b>{formatTime(localTime)}</b>
                </Typography>
                <Slider
                  value={localTime}
                  onChange={(_, v) => setLocalTime(v as number)}
                  min={5}
                  max={19}
                  step={0.25}
                  sx={{ color: '#8B5CF6' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================== 2D 视图 =====================

function TwoDView({ 
  latitude,
  subsolarLat,
  localTime,
}: { 
  latitude: number;
  subsolarLat: number;
  localTime: number;
}) {
  const width = 400;
  const height = 280;
  const centerX = width / 2;
  const centerY = height / 2 + 20;
  const compassRadius = 100;

  const hourAngle = localTimeToHourAngle(localTime);
  const sunAltitude = getSunAltitude(latitude, subsolarLat, hourAngle);
  const sunAzimuth = getSunAzimuth(latitude, subsolarLat, hourAngle);
  const shadowAzimuth = (sunAzimuth + 180) % 360;

  // 将方位角转换为SVG坐标（0度在顶部，顺时针）
  const azimuthToSvg = (azimuth: number, radius: number): { x: number; y: number } => {
    const rad = (azimuth - 90) * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad)
    };
  };

  const sunPos = azimuthToSvg(sunAzimuth, compassRadius * 0.7);
  const shadowEnd = azimuthToSvg(shadowAzimuth, compassRadius * 0.6);

  return (
    <svg width={width} height={height} style={{ background: 'rgba(15, 23, 42, 0.95)', borderRadius: 12 }}>
      {/* 标题 */}
      <text x={centerX} y={25} fill="#FFFFFF" fontSize={14} textAnchor="middle" fontWeight="bold">
        太阳方位与影子方向（俯视图）
      </text>

      {/* 方位圆 */}
      <circle cx={centerX} cy={centerY} r={compassRadius} fill="none" stroke="#4B5563" strokeWidth={2} />
      
      {/* 方向标记 */}
      {[
        { dir: '北', angle: 0, color: '#EF4444' },
        { dir: '东', angle: 90, color: '#10B981' },
        { dir: '南', angle: 180, color: '#3B82F6' },
        { dir: '西', angle: 270, color: '#F59E0B' },
      ].map(({ dir, angle, color }) => {
        const pos = azimuthToSvg(angle, compassRadius + 20);
        return (
          <g key={dir}>
            <text 
              x={pos.x} 
              y={pos.y + 5} 
              fill={color} 
              fontSize={14} 
              textAnchor="middle" 
              fontWeight="bold"
            >
              {dir}
            </text>
          </g>
        );
      })}

      {/* 太阳位置 */}
      {sunAltitude > 0 && (
        <>
          {/* 太阳方向线 */}
          <line 
            x1={centerX} y1={centerY} 
            x2={sunPos.x} y2={sunPos.y} 
            stroke="#FCD34D" 
            strokeWidth={3}
            markerEnd="url(#sunArrow)"
          />
          {/* 太阳图标 */}
          <circle cx={sunPos.x} cy={sunPos.y} r={12} fill="#FCD34D" />
          <text x={sunPos.x} y={sunPos.y + 4} fill="#000" fontSize={10} textAnchor="middle">☀</text>
        </>
      )}

      {/* 影子 */}
      {sunAltitude > 0 && (
        <>
          <line 
            x1={centerX} y1={centerY} 
            x2={shadowEnd.x} y2={shadowEnd.y} 
            stroke="#1E293B" 
            strokeWidth={8}
            opacity={0.6}
          />
        </>
      )}

      {/* 中心人物标记 */}
      <circle cx={centerX} cy={centerY} r={8} fill="#60A5FA" />

      {/* 图例 */}
      <g transform="translate(20, 230)">
        <rect x={0} y={0} width={12} height={12} fill="#FCD34D" />
        <text x={18} y={10} fill="#9CA3AF" fontSize={11}>太阳方向 ({azimuthToDirection(sunAzimuth)})</text>
        
        <rect x={0} y={18} width={12} height={12} fill="#1E293B" opacity={0.6} />
        <text x={18} y={28} fill="#9CA3AF" fontSize={11}>影子方向 ({azimuthToDirection(shadowAzimuth)})</text>
      </g>

      {/* 信息面板 */}
      <g transform={`translate(${width - 130}, 230)`}>
        <text x={0} y={0} fill="#F59E0B" fontSize={11}>高度角: {sunAltitude.toFixed(1)}°</text>
        <text x={0} y={18} fill="#8B5CF6" fontSize={11}>地方时: {formatTime(localTime)}</text>
      </g>

      {/* 箭头定义 */}
      <defs>
        <marker id="sunArrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#FCD34D" />
        </marker>
      </defs>
    </svg>
  );
}

// ===================== 主组件 =====================

export default function ShadowDemo3D({
  initialDate = new Date(),
  onBack,
}: ShadowDemo3DProps) {
  // 计算初始的年中第几天
  const initialDayOfYear = useMemo(() => {
    const start = new Date(initialDate.getFullYear(), 0, 0);
    const diff = initialDate.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [initialDate]);

  const [latitude, setLatitude] = useState(40); // 默认北京纬度
  const [dayOfYear, setDayOfYear] = useState(initialDayOfYear);
  const [localTime, setLocalTime] = useState(12); // 默认正午
  const [showLabels, setShowLabels] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [selectedCity, setSelectedCity] = useState('北京');
  
  const cameraControllerRef = useRef<CameraControllerHandle>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 计算太阳直射点纬度
  const subsolarLat = useMemo(() => getSubsolarLatitude(dayOfYear), [dayOfYear]);

  // 自动播放时间流逝 - 使用 requestAnimationFrame 实现丝滑动画
  useEffect(() => {
    if (!autoPlay) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    lastTimeRef.current = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      // 每秒推进 0.5 小时（可调整速度）
      const hoursPerSecond = 0.5;
      const increment = (deltaTime / 1000) * hoursPerSecond;
      
      setLocalTime(prev => {
        const next = prev + increment;
        if (next > 19) return 5;
        return next;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [autoPlay]);

  // 知识点信息内容
  const infoContent = [
    {
      title: '影子方向规律',
      icon: '🌓',
      stars: 3,
      content: (
        <>
          <b>核心原理：</b>影子方向与太阳方向相反<br/><br/>
          <b>北半球（大部分地区）：</b><br/>
          • 正午时，影子朝<b style={{color: '#EF4444'}}>北</b><br/>
          • 上午时，影子偏<b style={{color: '#F59E0B'}}>西北</b><br/>
          • 下午时，影子偏<b style={{color: '#10B981'}}>东北</b><br/><br/>
          <b>南半球：</b><br/>
          • 正午时，影子朝<b style={{color: '#3B82F6'}}>南</b>
        </>
      ),
    },
    {
      title: '影子长短规律',
      icon: '📏',
      stars: 3,
      content: (
        <>
          <b>计算公式：</b><br/>
          影长 = 物体高度 ÷ tan(太阳高度角)<br/><br/>
          <b>变化规律：</b><br/>
          • 太阳高度角越大 → 影子越短<br/>
          • 太阳高度角越小 → 影子越长<br/><br/>
          <b>一天中：</b><br/>
          • 正午影子最<b>短</b><br/>
          • 日出日落时影子最<b>长</b>
        </>
      ),
    },
    {
      title: '正午太阳高度',
      icon: '☀️',
      stars: 3,
      content: (
        <>
          <b>计算公式：</b><br/>
          H = 90° - |φ - δ|<br/>
          其中：φ=当地纬度，δ=太阳直射点纬度<br/><br/>
          <b>夏至日（δ=23.5°N）：</b><br/>
          • 北京(40°N): H = 90° - |40-23.5| = 73.5°<br/><br/>
          <b>冬至日（δ=23.5°S）：</b><br/>
          • 北京(40°N): H = 90° - |40-(-23.5)| = 26.5°
        </>
      ),
    },
    {
      title: '解题技巧',
      icon: '📝',
      stars: 2,
      content: (
        <>
          <b>根据影子判断方向：</b><br/>
          1. 找到影子方向<br/>
          2. 判断南北半球<br/>
          3. 正午影子反方向即为赤道方向<br/><br/>
          <b>根据影子判断时间：</b><br/>
          1. 影子朝正北/正南 → 正午12:00<br/>
          2. 影子偏西 → 上午<br/>
          3. 影子偏东 → 下午
        </>
      ),
    },
  ];

  return (
    <AnimationPageLayout
      onBack={onBack}
      pageTitle="影子与太阳方位"
      backButtonColor="#F59E0B"
      infoAccentColor="#F59E0B"
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas 
            camera={{ position: [18, 15, 18], fov: 55 }} 
            style={{ width: '100%', height: '100%' }}
            shadows
          >
            <Scene
              latitude={latitude}
              subsolarLat={subsolarLat}
              localTime={localTime}
              showLabels={showLabels}
              cameraRef={cameraControllerRef}
            />
          </Canvas>
        </Suspense>
      }
      scene2D={
        <TwoDView
          latitude={latitude}
          subsolarLat={subsolarLat}
          localTime={localTime}
        />
      }
      controlPanel={
        <ControlPanel
          latitude={latitude}
          setLatitude={setLatitude}
          dayOfYear={dayOfYear}
          setDayOfYear={setDayOfYear}
          localTime={localTime}
          setLocalTime={setLocalTime}
          subsolarLat={subsolarLat}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
        />
      }
      mobileControlPanel={
        <MobileControlPanel
          latitude={latitude}
          setLatitude={setLatitude}
          dayOfYear={dayOfYear}
          setDayOfYear={setDayOfYear}
          localTime={localTime}
          setLocalTime={setLocalTime}
          subsolarLat={subsolarLat}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
        />
      }
      bottomControls={(is3D) => (
        <>
          {is3D && (
            <>
              <Tooltip title={autoPlay ? '暂停' : '播放时间流逝'}>
                <IconButton
                  onClick={() => setAutoPlay(!autoPlay)}
                  sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                >
                  {autoPlay ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={showLabels ? '隐藏标签' : '显示标签'}>
                <IconButton
                  onClick={() => setShowLabels(!showLabels)}
                  sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                >
                  {showLabels ? <LabelIcon /> : <LabelOffIcon />}
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="重置视角">
            <IconButton
              onClick={() => cameraControllerRef.current?.reset()}
              sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
            >
              <ResetIcon />
            </IconButton>
          </Tooltip>
        </>
      )}
      infoContent={infoContent}
    />
  );
}
