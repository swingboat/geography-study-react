/**
 * 昼夜与晨昏线 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 帮助学生理解：
 * 1. 晨昏线的概念（晨线与昏线）
 * 2. 晨昏线上的地方时（晨线6:00，昏线18:00）
 * 3. 太阳直射点与正午12:00
 * 4. 昼夜长短的变化
 * 5. 不同纬度的昼夜情况
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Stars, 
  Line,
  Html,
  useTexture
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
  WbSunny as SunIcon,
  NightsStay as MoonIcon,
} from '@mui/icons-material';

// 导入公共组件和工具
import {
  ASTRONOMY_COLORS,
  OBLIQUITY,
  ARCTIC_CIRCLE_LAT,
} from '../../shared/constants';
import { formatDegreeMinute } from '../../shared/utils';
import {
  CameraController,
  LatitudeLine,
  AnimationPageLayout,
  SceneLoading,
  type CameraControllerHandle,
} from '../../shared/components';

// ===================== 类型定义 =====================

interface DayNightDemo3DProps {
  initialDate?: Date;
}

// ===================== 常量 =====================

const COLORS = {
  sun: '#FCD34D',
  sunGlow: '#F59E0B',
  dayLight: '#87CEEB',
  nightDark: '#1E3A5A',
  terminatorLine: '#F59E0B',  // 晨昏线 - 橙色
  dawnLine: '#10B981',        // 晨线 - 绿色
  duskLine: '#8B5CF6',        // 昏线 - 紫色
  noonLine: '#EF4444',        // 正午线 - 红色
  equator: ASTRONOMY_COLORS.equator,
  tropicCancer: ASTRONOMY_COLORS.tropicOfCancer,
  tropicCapricorn: ASTRONOMY_COLORS.tropicOfCapricorn,
  arcticCircle: ASTRONOMY_COLORS.arcticCircle,
  antarcticCircle: ASTRONOMY_COLORS.antarcticCircle,
};

/** 特殊日期 */
const SPECIAL_DATES = [
  { name: '春分', date: '3月21日', dayOfYear: 80, subsolarLat: 0, description: '太阳直射赤道，全球昼夜平分' },
  { name: '夏至', date: '6月22日', dayOfYear: 173, subsolarLat: OBLIQUITY, description: '太阳直射北回归线，北半球白昼最长' },
  { name: '秋分', date: '9月23日', dayOfYear: 266, subsolarLat: 0, description: '太阳直射赤道，全球昼夜平分' },
  { name: '冬至', date: '12月22日', dayOfYear: 356, subsolarLat: -OBLIQUITY, description: '太阳直射南回归线，北半球白昼最短' },
];

/** 特殊纬度 */
const SPECIAL_LATITUDES = [
  { name: '北极圈', lat: ARCTIC_CIRCLE_LAT, color: COLORS.arcticCircle },
  { name: '北回归线', lat: OBLIQUITY, color: COLORS.tropicCancer },
  { name: '赤道', lat: 0, color: COLORS.equator },
  { name: '南回归线', lat: -OBLIQUITY, color: COLORS.tropicCapricorn },
  { name: '南极圈', lat: -ARCTIC_CIRCLE_LAT, color: COLORS.antarcticCircle },
];

// ===================== 工具函数 =====================

/** 根据一年中的天数计算太阳直射点纬度 */
const getSubsolarLatitude = (dayOfYear: number): number => {
  // 简化公式：太阳直射点纬度 = ${OBLIQUITY}° × sin((284 + N) × 360° / 365)
  // 其中 N 是一年中的第几天
  const angle = ((284 + dayOfYear) * 360 / 365) * Math.PI / 180;
  return OBLIQUITY * Math.sin(angle);
};

/** 将一年中的第几天转换为月日格式 */
const dayOfYearToDate = (dayOfYear: number): string => {
  const date = new Date(2025, 0, 1); // 使用非闰年作为基准
  date.setDate(dayOfYear);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

/** 根据太阳直射点纬度计算某纬度的昼长（小时） */
const getDayLength = (latitude: number, subsolarLat: number): number => {
  const latRad = latitude * Math.PI / 180;
  const subLatRad = subsolarLat * Math.PI / 180;
  
  // 极昼极夜判断
  if (latitude >= 0) {
    // 北半球
    if (latitude >= 90 - Math.abs(subsolarLat) && subsolarLat > 0) return 24; // 极昼
    if (latitude >= 90 - Math.abs(subsolarLat) && subsolarLat < 0) return 0;  // 极夜
  } else {
    // 南半球
    if (-latitude >= 90 - Math.abs(subsolarLat) && subsolarLat < 0) return 24; // 极昼
    if (-latitude >= 90 - Math.abs(subsolarLat) && subsolarLat > 0) return 0;  // 极夜
  }
  
  // 一般情况：昼长公式
  const cosHourAngle = -Math.tan(latRad) * Math.tan(subLatRad);
  
  if (cosHourAngle <= -1) return 24; // 极昼
  if (cosHourAngle >= 1) return 0;   // 极夜
  
  const hourAngle = Math.acos(cosHourAngle);
  return (hourAngle * 2 * 12) / Math.PI; // 转换为小时
};

/** 格式化昼长为时:分 */
const formatDayLength = (hours: number): string => {
  if (hours === 24) return '24:00 (极昼)';
  if (hours === 0) return '0:00 (极夜)';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}小时${m}分`;
};

// ===================== 3D 组件 =====================

/** 太阳组件 */
function Sun3D({ subsolarLat, showSunRays }: { subsolarLat: number; showSunRays: boolean }) {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // 太阳位置：距离地球一定距离，在太阳直射点方向
  const sunDistance = 8;
  const latRad = subsolarLat * Math.PI / 180;
  
  const sunPosition: [number, number, number] = [
    sunDistance * Math.cos(latRad),
    sunDistance * Math.sin(latRad),
    0
  ];

  // 太阳直射点在地球表面的位置
  const subsolarPointOnEarth: [number, number, number] = [
    2 * Math.cos(latRad),
    2 * Math.sin(latRad),
    0
  ];

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(scale);
    }
  });

  // 生成太阳直射线
  const sunRay = useMemo(() => {
    if (!showSunRays) return null;
    
    // 主直射线（从太阳到直射点）
    return {
      start: sunPosition,
      end: subsolarPointOnEarth,
    };
  }, [sunPosition, subsolarPointOnEarth, showSunRays]);

  return (
    <group>
      <group position={sunPosition}>
        {/* 太阳本体 */}
        <mesh ref={sunRef}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color={COLORS.sun} />
        </mesh>
        
        {/* 光晕 */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshBasicMaterial color={COLORS.sunGlow} transparent opacity={0.3} />
        </mesh>
        
        {/* 太阳光源 */}
        <pointLight color={COLORS.sun} intensity={2} distance={20} />
        
        {/* 太阳标签 */}
        <Html position={[0, 1, 0]} center>
          <div style={{
            background: 'rgba(251, 191, 36, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            ☀️ 太阳
          </div>
        </Html>
      </group>

      {/* 太阳直射线 */}
      {showSunRays && sunRay && (
        <Line
          points={[sunRay.start, sunRay.end]}
          color="#FF6B6B"
          lineWidth={3}
        />
      )}

      {/* 直射点标记 */}
      {showSunRays && (
        <mesh position={subsolarPointOnEarth}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#FF6B6B" />
        </mesh>
      )}
    </group>
  );
}

/** 晨昏线组件 - 大圆 */
function TerminatorLine({ 
  subsolarLat, 
  showLabels,
  showDawn = true,
  showDusk = true,
}: { 
  subsolarLat: number;
  showLabels: boolean;
  showDawn?: boolean;
  showDusk?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [dawnVisible, setDawnVisible] = useState(true);
  const [duskVisible, setDuskVisible] = useState(true);

  // 晨昏线是与太阳光线垂直的大圆
  // 正午线在 X-Y 平面 (z=0)，经度 0°
  // 晨线在正午线西边 90°，即 +Z 方向，经度 90°W（或 270°E）
  // 昏线在正午线东边 90°，即 -Z 方向，经度 90°E
  
  // 晨线点：从南极到北极，经过 +Z 方向（西经90°）
  // 晨昏线需要根据太阳直射点纬度倾斜
  const dawnPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = 2.02;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    
    // 晨线在 Y-Z 平面上（x=0, z>0 的半圆），然后根据直射点纬度倾斜
    for (let i = -90; i <= 90; i += 2) {
      const latRad = (i * Math.PI) / 180;
      
      // 基础位置：在 Y-Z 平面的半圆（z > 0）
      let x = 0;
      let y = Math.sin(latRad) * radius;
      let z = Math.cos(latRad) * radius;
      
      // 绕 Z 轴旋转（根据太阳直射点纬度倾斜晨昏线）
      // 当太阳直射北半球时，晨昏线向北极方向倾斜
      const cosLat = Math.cos(-subsolarLatRad);
      const sinLat = Math.sin(-subsolarLatRad);
      const x2 = x * cosLat - y * sinLat;
      const y2 = x * sinLat + y * cosLat;
      
      pts.push([x2, y2, z]);
    }
    return pts;
  }, [subsolarLat]);

  // 昏线点：从北极到南极，经过 -Z 方向（东经90°）
  const duskPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = 2.02;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    
    // 昏线在 Y-Z 平面上（x=0, z<0 的半圆）
    for (let i = 90; i >= -90; i -= 2) {
      const latRad = (i * Math.PI) / 180;
      
      // 基础位置：在 Y-Z 平面的半圆（z < 0）
      let x = 0;
      let y = Math.sin(latRad) * radius;
      let z = -Math.cos(latRad) * radius;
      
      // 绕 Z 轴旋转（根据太阳直射点纬度倾斜晨昏线）
      const cosLat = Math.cos(-subsolarLatRad);
      const sinLat = Math.sin(-subsolarLatRad);
      const x2 = x * cosLat - y * sinLat;
      const y2 = x * sinLat + y * cosLat;
      
      pts.push([x2, y2, z]);
    }
    return pts;
  }, [subsolarLat]);

  // 计算晨线和昏线标签位置
  // 晨线在地球的+Z侧，昏线在-Z侧
  const dawnPosition = useMemo(() => {
    const radius = 2.3;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    
    // 晨线上赤道位置的点：在+Z方向（x=0, y=0, z=radius）
    // 然后根据太阳直射点纬度倾斜
    let x = 0;
    let y = 0;
    let z = radius;
    
    // 绕Z轴倾斜（与晨昏线相同的旋转，注意是负的subsolarLatRad）
    const cosLat = Math.cos(-subsolarLatRad);
    const sinLat = Math.sin(-subsolarLatRad);
    const x2 = x * cosLat - y * sinLat;
    const y2 = x * sinLat + y * cosLat;
    
    return [x2, y2, z] as [number, number, number];
  }, [subsolarLat]);

  const duskPosition = useMemo(() => {
    const radius = 2.3;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    
    // 昏线上赤道位置的点：在-Z方向
    let x = 0;
    let y = 0;
    let z = -radius;
    
    const cosLat = Math.cos(-subsolarLatRad);
    const sinLat = Math.sin(-subsolarLatRad);
    const x2 = x * cosLat - y * sinLat;
    const y2 = x * sinLat + y * cosLat;
    
    return [x2, y2, z] as [number, number, number];
  }, [subsolarLat]);

  // 检测标签可见性
  useFrame(() => {
    if (groupRef.current) {
      const dawnWorld = new THREE.Vector3(...dawnPosition);
      const duskWorld = new THREE.Vector3(...duskPosition);
      
      const dawnNormal = dawnWorld.clone().normalize();
      const duskNormal = duskWorld.clone().normalize();
      
      const toCamera = camera.position.clone().normalize();
      
      setDawnVisible(dawnNormal.dot(toCamera) > 0.1);
      setDuskVisible(duskNormal.dot(toCamera) > 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 晨线 - 绿色 */}
      {showDawn && (
        <Line
          points={dawnPoints}
          color={COLORS.dawnLine}
          lineWidth={3}
        />
      )}
      {/* 昏线 - 紫色 */}
      {showDusk && (
        <Line
          points={duskPoints}
          color={COLORS.duskLine}
          lineWidth={3}
        />
      )}
      
      {/* 晨线标签 */}
      {showLabels && showDawn && dawnVisible && (
        <group position={dawnPosition}>
          <Html center>
            <div style={{
              background: 'rgba(16, 185, 129, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              🌅 晨线 6:00
            </div>
          </Html>
        </group>
      )}
      
      {/* 昏线标签 */}
      {showLabels && showDusk && duskVisible && (
        <group position={duskPosition}>
          <Html center>
            <div style={{
              background: 'rgba(139, 92, 246, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              🌆 昏线 18:00
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

/** 正午线（太阳直射经线，即12:00地方时的经线） */
function NoonLine({ 
  subsolarLat,
  showLabel,
}: { 
  subsolarLat: number;
  showLabel: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();

  // 正午线是太阳直射的经线，地方时为12:00
  // 它是一条从北极到南极的半圆弧，位于X-Y平面上（z=0）
  // 注意：正午线相对太阳固定，随地球自转，对应的地球经度会变化
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = 2.02;
    
    for (let lat = -90; lat <= 90; lat += 2) {
      const latRad = (lat * Math.PI) / 180;
      pts.push([
        Math.cos(latRad) * radius,
        Math.sin(latRad) * radius,
        0,
      ]);
    }
    return pts;
  }, []);

  // 太阳直射点位置 - 在正午线上
  const subsolarPosition: [number, number, number] = useMemo(() => {
    const radius = 2.15;
    const latRad = subsolarLat * Math.PI / 180;
    return [
      Math.cos(latRad) * radius,
      Math.sin(latRad) * radius,
      0
    ];
  }, [subsolarLat]);

  // 直射点标签位置 - 稍微偏移到Z轴负方向，避免和纬线标签重叠
  const subsolarLabelPosition: [number, number, number] = useMemo(() => {
    const radius = 2.15;
    const latRad = subsolarLat * Math.PI / 180;
    const zOffset = -0.8; // Z轴偏移
    return [
      Math.cos(latRad) * radius * 0.9,
      Math.sin(latRad) * radius + 0.3, // Y轴稍微上移
      zOffset
    ];
  }, [subsolarLat]);

  // 检测可见性
  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3(...subsolarPosition);
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      setIsVisible(normal.dot(toCamera) > 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      <Line
        points={points}
        color={COLORS.noonLine}
        lineWidth={3}
        dashed
        dashSize={0.15}
        dashScale={1}
        gapSize={0.08}
      />
      
      {/* 太阳直射点标签 */}
      {showLabel && isVisible && (
        <group position={subsolarLabelPosition}>
          <Html center>
            <div style={{
              background: 'rgba(239, 68, 68, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              ☀️ 太阳直射点 12:00
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

/** 昼夜半球着色 */
function DayNightShading({ subsolarLat }: { subsolarLat: number }) {
  // 创建一个半透明的球体来表示夜半球
  const nightRef = useRef<THREE.Mesh>(null);
  
  // 夜半球材质 - 不依赖 subsolarLat，避免重复创建
  const nightMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        subsolarLat: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float subsolarLat;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // 太阳方向（考虑太阳直射点纬度）
          vec3 sunDir = vec3(cos(subsolarLat), sin(subsolarLat), 0.0);
          
          // 计算该点是否在夜半球
          float dotProduct = dot(normalize(vPosition), sunDir);
          
          // 夜半球着色 - 更黑更明显
          if (dotProduct < -0.05) {
            // 深夜区域 - 非常暗
            gl_FragColor = vec4(0.02, 0.03, 0.08, 0.85);
          } else if (dotProduct < 0.0) {
            // 接近晨昏线的夜晚区域 - 渐变
            float t = (dotProduct + 0.05) / 0.05;
            float alpha = mix(0.85, 0.6, t);
            gl_FragColor = vec4(0.03, 0.05, 0.12, alpha);
          } else if (dotProduct < 0.05) {
            // 晨昏线附近的过渡区域（黄昏/黎明效果）
            float t = dotProduct / 0.05;
            float alpha = mix(0.6, 0.0, t);
            vec3 twilightColor = mix(vec3(0.05, 0.06, 0.15), vec3(0.3, 0.15, 0.05), t);
            gl_FragColor = vec4(twilightColor, alpha);
          } else {
            discard;
          }
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  }, []);

  // 使用 useFrame 更新 uniform，确保每帧都是最新值
  useFrame(() => {
    nightMaterial.uniforms.subsolarLat.value = subsolarLat * Math.PI / 180;
  });

  return (
    <mesh ref={nightRef} material={nightMaterial}>
      <sphereGeometry args={[2.015, 64, 64]} />
    </mesh>
  );
}

/** 地球组件 */
function Earth({ 
  showLabels, 
  subsolarLat,
  showDawnLine,
  showDuskLine,
  showNoonLine,
  showShading,
  viewMode,
  rotationAngle,
}: {
  showLabels: boolean;
  subsolarLat: number;
  showDawnLine: boolean;
  showDuskLine: boolean;
  showNoonLine: boolean;
  showShading: boolean;
  viewMode: 'sun' | 'earth';
  rotationAngle: number;
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const sunRelativeGroupRef = useRef<THREE.Group>(null);
  
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  // 根据视角模式设置旋转
  useFrame(() => {
    if (viewMode === 'sun') {
      // 太阳视角：地球自转，晨昏线固定
      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y = rotationAngle;
      }
      if (sunRelativeGroupRef.current) {
        sunRelativeGroupRef.current.rotation.y = 0;
      }
    } else {
      // 地球视角：地球固定，晨昏线/太阳绕地球转
      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y = 0;
      }
      if (sunRelativeGroupRef.current) {
        sunRelativeGroupRef.current.rotation.y = -rotationAngle;
      }
    }
  });

  return (
    <group>
      {/* 地球旋转组 - 在太阳视角下旋转 */}
      <group ref={earthGroupRef}>
        {/* 地球主体 */}
        <mesh>
          <sphereGeometry args={[2, 64, 64]} />
          <meshStandardMaterial
            map={earthMap}
            normalMap={earthNormal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughnessMap={earthSpec}
            roughness={0.3}
            metalness={0.0}
            emissive="#4a6080"
            emissiveIntensity={0.2}
          />
        </mesh>
        
        {/* 云层 */}
        <mesh>
          <sphereGeometry args={[2.02, 64, 64]} />
          <meshBasicMaterial
            map={cloudsMap}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>

        {/* 特殊纬线 - 随地球 */}
        {SPECIAL_LATITUDES.map(({ name, lat, color }) => (
          <LatitudeLine 
            key={name}
            latitude={lat} 
            radius={2.01} 
            color={color} 
            label={`${name} ${formatDegreeMinute(lat, false)}`}
            showLabel={showLabels && Math.abs(lat) > 0}
          />
        ))}
      </group>

      {/* 太阳相对组 - 在地球视角下旋转 */}
      <group ref={sunRelativeGroupRef}>
        {/* 昼夜着色 */}
        {showShading && <DayNightShading subsolarLat={subsolarLat} />}

        {/* 晨昏线 */}
        {(showDawnLine || showDuskLine) && (
          <TerminatorLine 
            subsolarLat={subsolarLat} 
            showLabels={showLabels}
            showDawn={showDawnLine}
            showDusk={showDuskLine}
          />
        )}

        {/* 正午线 */}
        {showNoonLine && (
          <NoonLine 
            subsolarLat={subsolarLat}
            showLabel={showLabels}
          />
        )}
      </group>
    </group>
  );
}

/** 场景组件 */
interface SceneProps {
  showLabels: boolean;
  autoRotate: boolean;
  subsolarLat: number;
  showDawnLine: boolean;
  showDuskLine: boolean;
  showNoonLine: boolean;
  showShading: boolean;
  showSun: boolean;
  showSunRays: boolean;
  viewMode: 'sun' | 'earth';
  cameraRef: React.RefObject<CameraControllerHandle>;
}

function Scene({ 
  showLabels, 
  autoRotate,
  subsolarLat,
  showDawnLine,
  showDuskLine,
  showNoonLine,
  showShading,
  showSun,
  showSunRays,
  viewMode,
  cameraRef,
}: SceneProps) {
  const sunGroupRef = useRef<THREE.Group>(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  // 处理自转动画
  useFrame(({ clock }) => {
    if (autoRotate) {
      const angle = clock.elapsedTime * 0.1;
      setRotationAngle(angle);
      
      // 地球视角下，太阳也要跟着转
      if (viewMode === 'earth' && sunGroupRef.current) {
        sunGroupRef.current.rotation.y = -angle;
      } else if (sunGroupRef.current) {
        sunGroupRef.current.rotation.y = 0;
      }
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <directionalLight position={[-3, 2, -3]} intensity={0.6} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      <Suspense fallback={null}>
        {/* 太阳组 - 在地球视角下旋转 */}
        <group ref={sunGroupRef}>
          {showSun && <Sun3D subsolarLat={subsolarLat} showSunRays={showSunRays} />}
        </group>
        
        <Earth 
          showLabels={showLabels}
          subsolarLat={subsolarLat}
          showDawnLine={showDawnLine}
          showDuskLine={showDuskLine}
          showNoonLine={showNoonLine}
          showShading={showShading}
          viewMode={viewMode}
          rotationAngle={autoRotate ? rotationAngle : 0}
        />
      </Suspense>
      
      <CameraController ref={cameraRef} defaultPosition={[14, 5, 10]} />
    </>
  );
}

// ===================== 2D 视图 =====================

function TwoDView({ 
  subsolarLat,
}: { 
  subsolarLat: number;
}) {
  const width = 400;
  const height = 220;
  const padding = 30;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  // 计算不同纬度的昼长
  const latitudes = [-90, -ARCTIC_CIRCLE_LAT, -45, -OBLIQUITY, 0, OBLIQUITY, 45, ARCTIC_CIRCLE_LAT, 90];
  
  return (
    <svg width={width} height={height} style={{ background: 'rgba(15, 23, 42, 0.9)', borderRadius: 8 }}>
      {/* 标题 */}
      <text x={width / 2} y={18} fill="#FFFFFF" fontSize={12} textAnchor="middle" fontWeight="bold">
        不同纬度昼长变化
      </text>

      {/* 坐标轴 */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#4B5563" strokeWidth={1} />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#4B5563" strokeWidth={1} />

      {/* Y轴标签（昼长） */}
      {[0, 6, 12, 18, 24].map(hours => {
        const y = height - padding - (hours / 24) * graphHeight;
        return (
          <g key={hours}>
            <line x1={padding - 5} y1={y} x2={padding} y2={y} stroke="#4B5563" />
            <text x={padding - 8} y={y + 4} fill="#9CA3AF" fontSize={9} textAnchor="end">
              {hours}h
            </text>
          </g>
        );
      })}

      {/* X轴标签（纬度） */}
      {latitudes.map((lat, i) => {
        const x = padding + (i / (latitudes.length - 1)) * graphWidth;
        return (
          <g key={lat}>
            <line x1={x} y1={height - padding} x2={x} y2={height - padding + 5} stroke="#4B5563" />
            <text x={x} y={height - padding + 16} fill="#9CA3AF" fontSize={8} textAnchor="middle">
              {Math.round(lat)}°
            </text>
          </g>
        );
      })}

      {/* 12小时参考线 */}
      <line 
        x1={padding} 
        y1={height - padding - (12 / 24) * graphHeight} 
        x2={width - padding} 
        y2={height - padding - (12 / 24) * graphHeight} 
        stroke="#4B5563" 
        strokeDasharray="4,4" 
      />

      {/* 昼长曲线 */}
      <path
        d={latitudes.map((lat, i) => {
          const x = padding + (i / (latitudes.length - 1)) * graphWidth;
          const dayLength = getDayLength(lat, subsolarLat);
          const y = height - padding - (dayLength / 24) * graphHeight;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none"
        stroke={COLORS.terminatorLine}
        strokeWidth={2}
      />

      {/* 数据点 */}
      {latitudes.map((lat, i) => {
        const x = padding + (i / (latitudes.length - 1)) * graphWidth;
        const dayLength = getDayLength(lat, subsolarLat);
        const y = height - padding - (dayLength / 24) * graphHeight;
        return (
          <circle 
            key={lat} 
            cx={x} 
            cy={y} 
            r={4} 
            fill={dayLength === 24 ? COLORS.sun : dayLength === 0 ? COLORS.nightDark : COLORS.terminatorLine}
            stroke="white"
            strokeWidth={1}
          />
        );
      })}

      {/* 太阳直射点纬度标记 */}
      <line
        x1={padding + ((subsolarLat + 90) / 180) * graphWidth}
        y1={padding}
        x2={padding + ((subsolarLat + 90) / 180) * graphWidth}
        y2={height - padding}
        stroke={COLORS.noonLine}
        strokeWidth={2}
        strokeDasharray="4,4"
      />
      <text 
        x={padding + ((subsolarLat + 90) / 180) * graphWidth} 
        y={padding - 5} 
        fill={COLORS.noonLine} 
        fontSize={9} 
        textAnchor="middle"
      >
        直射点 {formatDegreeMinute(subsolarLat)}
      </text>

      {/* 图例 */}
      <g transform={`translate(${width - 90}, ${padding})`}>
        <rect width={80} height={40} fill="rgba(0,0,0,0.5)" rx={4} />
        <circle cx={10} cy={12} r={4} fill={COLORS.sun} />
        <text x={20} y={16} fill="#FFFFFF" fontSize="9">极昼</text>
        <circle cx={10} cy={28} r={4} fill={COLORS.nightDark} />
        <text x={20} y={32} fill="#FFFFFF" fontSize="9">极夜</text>
      </g>
    </svg>
  );
}

// ===================== 昼长计算器 =====================

function DayLengthCalculator({
  subsolarLat,
}: {
  subsolarLat: number;
}) {
  const [selectedLat, setSelectedLat] = useState(39.9); // 默认北京纬度

  const dayLength = getDayLength(selectedLat, subsolarLat);
  const nightLength = 24 - dayLength;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SunIcon fontSize="small" /> 昼夜长短计算器
      </Typography>

      {/* 纬度选择 */}
      <div style={{ marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary">选择纬度</Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {[
            { name: '北京', lat: 39.9 },
            { name: '上海', lat: 31.2 },
            { name: '广州', lat: 23.1 },
            { name: '哈尔滨', lat: 45.8 },
            { name: '赤道', lat: 0 },
            { name: '北回归线', lat: OBLIQUITY },
            { name: '北极圈', lat: ARCTIC_CIRCLE_LAT },
          ].map(({ name, lat }) => (
            <Chip
              key={name}
              label={`${name} ${formatDegreeMinute(lat, false)}`}
              size="small"
              onClick={() => setSelectedLat(lat)}
              sx={{
                background: Math.abs(selectedLat - lat) < 0.1
                  ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' 
                  : 'rgba(245, 158, 11, 0.1)',
                color: Math.abs(selectedLat - lat) < 0.1 ? 'white' : '#F59E0B',
                fontWeight: Math.abs(selectedLat - lat) < 0.1 ? 600 : 400,
                fontSize: 10,
              }}
            />
          ))}
        </div>
      </div>

      {/* 自定义纬度 */}
      <div style={{ marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary">
          自定义纬度: {selectedLat.toFixed(1)}°{selectedLat >= 0 ? 'N' : 'S'}
        </Typography>
        <Slider
          value={selectedLat}
          onChange={(_, v) => setSelectedLat(v as number)}
          min={-90}
          max={90}
          step={0.1}
          sx={{ color: '#F59E0B' }}
        />
      </div>

      {/* 结果显示 */}
      <div style={{
        background: 'white',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <SunIcon sx={{ color: '#F59E0B', fontSize: 28 }} />
          <Typography variant="body2" color="text.secondary">昼长</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#F59E0B' }}>
            {formatDayLength(dayLength)}
          </Typography>
        </div>
        <div style={{ textAlign: 'center' }}>
          <MoonIcon sx={{ color: '#8B5CF6', fontSize: 28 }} />
          <Typography variant="body2" color="text.secondary">夜长</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
            {formatDayLength(nightLength)}
          </Typography>
        </div>
      </div>
    </div>
  );
}

// ===================== 控制面板 =====================

interface ControlPanelProps {
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
  initialDayOfYear: number;
  subsolarLat: number;
  showDawnLine: boolean;
  setShowDawnLine: (show: boolean) => void;
  showDuskLine: boolean;
  setShowDuskLine: (show: boolean) => void;
  showNoonLine: boolean;
  setShowNoonLine: (show: boolean) => void;
  showShading: boolean;
  setShowShading: (show: boolean) => void;
  showSun: boolean;
  setShowSun: (show: boolean) => void;
  showSunRays: boolean;
  setShowSunRays: (show: boolean) => void;
  viewMode: 'sun' | 'earth';
  setViewMode: (mode: 'sun' | 'earth') => void;
}

function ControlPanel({
  dayOfYear,
  setDayOfYear,
  initialDayOfYear,
  subsolarLat,
  showDawnLine,
  setShowDawnLine,
  showDuskLine,
  setShowDuskLine,
  showNoonLine,
  setShowNoonLine,
  showShading,
  setShowShading,
  showSun,
  setShowSun,
  showSunRays,
  setShowSunRays,
  viewMode,
  setViewMode,
}: ControlPanelProps) {

  return (
    <Card sx={{ 
      background: 'rgba(255,255,255,0.95)', 
      backdropFilter: 'blur(10px)',
      borderRadius: 3,
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    }}>
      <CardContent sx={{ p: 2 }}>
        {/* 视角模式选择 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#8B5CF6', mb: 1 }}>
            👁️ 观察视角
          </Typography>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip
              icon={<SunIcon sx={{ fontSize: 16 }} />}
              label="太阳视角"
              onClick={() => setViewMode('sun')}
              sx={{
                flex: 1,
                background: viewMode === 'sun' 
                  ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' 
                  : 'rgba(245, 158, 11, 0.1)',
                color: viewMode === 'sun' ? 'white' : '#F59E0B',
                fontWeight: viewMode === 'sun' ? 600 : 400,
                '& .MuiChip-icon': { color: viewMode === 'sun' ? 'white' : '#F59E0B' },
              }}
            />
            <Chip
              icon={<span style={{ fontSize: 14 }}>🌍</span>}
              label="地球视角"
              onClick={() => setViewMode('earth')}
              sx={{
                flex: 1,
                background: viewMode === 'earth' 
                  ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' 
                  : 'rgba(59, 130, 246, 0.1)',
                color: viewMode === 'earth' ? 'white' : '#3B82F6',
                fontWeight: viewMode === 'earth' ? 600 : 400,
              }}
            />
          </div>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1, fontSize: '10px' }}>
            {viewMode === 'sun' 
              ? '☀️ 太阳固定，地球自转 → 观察地表如何依次经过晨线、正午线、昏线'
              : '🌍 地球固定，太阳移动 → 观察某地一天中太阳位置的变化'}
          </Typography>
        </div>

        {/* 日期选择 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B' }}>
              🗓️ {dayOfYearToDate(dayOfYear)}（第 {dayOfYear} 天）
            </Typography>
            {dayOfYear !== initialDayOfYear && (
              <Chip
                label="今天"
                size="small"
                onClick={() => setDayOfYear(initialDayOfYear)}
                sx={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366F1',
                  fontSize: 10,
                  height: 20,
                  '&:hover': { background: 'rgba(99, 102, 241, 0.2)' },
                }}
              />
            )}
          </div>
          <Slider
            value={dayOfYear}
            onChange={(_, v) => setDayOfYear(v as number)}
            min={1}
            max={365}
            sx={{ color: '#F59E0B' }}
          />
          
          {/* 快速选择特殊日期 */}
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
                }}
              />
            ))}
          </div>
        </div>

        {/* 太阳直射点信息 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            ☀️ 太阳直射点位置
          </Typography>
          <div style={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">直射点纬度</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#F59E0B', lineHeight: 1.2 }}>
              {formatDegreeMinute(subsolarLat)}
            </Typography>
          </div>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1, fontSize: '10px' }}>
            💡 正午线（红色虚线）上所有点的地方时都是 12:00，晨线上是 6:00，昏线上是 18:00
          </Typography>
        </div>

        {/* 显示选项 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#6366F1', mb: 1 }}>
            显示选项
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Chip
              label="🌅 晨线"
              size="small"
              onClick={() => setShowDawnLine(!showDawnLine)}
              sx={{
                background: showDawnLine ? COLORS.dawnLine : 'rgba(0,0,0,0.05)',
                color: showDawnLine ? 'white' : 'text.secondary',
              }}
            />
            <Chip
              label="🌆 昏线"
              size="small"
              onClick={() => setShowDuskLine(!showDuskLine)}
              sx={{
                background: showDuskLine ? COLORS.duskLine : 'rgba(0,0,0,0.05)',
                color: showDuskLine ? 'white' : 'text.secondary',
              }}
            />
            <Chip
              label="正午线"
              size="small"
              onClick={() => setShowNoonLine(!showNoonLine)}
              sx={{
                background: showNoonLine ? COLORS.noonLine : 'rgba(0,0,0,0.05)',
                color: showNoonLine ? 'white' : 'text.secondary',
              }}
            />
            <Chip
              label="昼夜着色"
              size="small"
              onClick={() => setShowShading(!showShading)}
              sx={{
                background: showShading ? COLORS.nightDark : 'rgba(0,0,0,0.05)',
                color: showShading ? 'white' : 'text.secondary',
              }}
            />
            <Chip
              label="太阳"
              size="small"
              onClick={() => setShowSun(!showSun)}
              sx={{
                background: showSun ? COLORS.sun : 'rgba(0,0,0,0.05)',
                color: showSun ? 'white' : 'text.secondary',
              }}
            />
            <Chip
              label="直射线"
              size="small"
              onClick={() => setShowSunRays(!showSunRays)}
              sx={{
                background: showSunRays ? '#FF6B6B' : 'rgba(0,0,0,0.05)',
                color: showSunRays ? 'white' : 'text.secondary',
              }}
            />
          </div>
        </div>

        {/* 昼长计算器 */}
        <DayLengthCalculator subsolarLat={subsolarLat} />

        {/* 知识点介绍 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6366F1', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            📚 高考知识点
          </Typography>
          
          <Typography variant="body2" component="div" sx={{ lineHeight: 1.9, fontSize: '12px' }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#F59E0B' }}>1. 晨昏线 ⭐⭐⭐</b><br/>
              • <span style={{ color: '#10B981' }}>晨线</span>：夜→昼的分界线（日出线）<br/>
              • <span style={{ color: '#8B5CF6' }}>昏线</span>：昼→夜的分界线（日落线）<br/>
              • 晨昏线是过地心的大圆，始终<b>垂直于太阳光线</b>
            </div>

            <div style={{ marginBottom: 12, background: 'rgba(239, 68, 68, 0.08)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <b style={{ color: '#EF4444' }}>2. 正午线与地方时 ⭐⭐⭐</b><br/>
              • <span style={{ color: '#EF4444' }}>正午线</span>：太阳直射的<b>经线</b>，地方时 <b>12:00</b><br/>
              • 午夜线：正午线对面180°，地方时 <b>0:00</b><br/>
              • <span style={{ color: '#10B981' }}>晨线</span>：地方时 <b>6:00</b>（比正午线西90°）<br/>
              • <span style={{ color: '#8B5CF6' }}>昏线</span>：地方时 <b>18:00</b>（比正午线东90°）<br/>
            </div>

            <div style={{ marginBottom: 12, background: 'rgba(139, 92, 246, 0.08)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <b style={{ color: '#8B5CF6' }}>3. 两种观察视角 👁️</b><br/>
              • <b>☀️ 太阳视角</b>：太阳固定，地球自转<br/>
              　→ 晨线、昏线、正午线<b>固定不动</b><br/>
              　→ 观察地表如何依次经过晨线→正午线→昏线<br/>
              • <b>🌍 地球视角</b>：地球固定，太阳移动<br/>
              　→ 晨线、昏线、正午线<b>绕地球转动</b><br/>
              　→ 观察某地一天中太阳位置的变化
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#06B6D4' }}>4. 地方时计算 ⭐⭐⭐</b><br/>
              • 地方时由<b>经度</b>决定，同一经线地方时相同<br/>
              • 经度每差<b>15°</b>，时间差<b>1小时</b><br/>
              • 经度每差<b>1°</b>，时间差<b>4分钟</b><br/>
              • <b>东加西减</b>：东边时间早，西边时间晚<br/>
              <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                公式：所求地方时 = 已知地方时 ± 经度差×4分钟
              </div>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#3B82F6' }}>5. 太阳直射点移动 ⭐⭐</b><br/>
              • 春分→夏至：向<b>北</b>移<br/>
              • 夏至→秋分：向<b>南</b>移<br/>
              • 秋分→冬至：向<b>南</b>移<br/>
              • 冬至→春分：向<b>北</b>移
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#10B981' }}>6. 昼夜长短规律 ⭐⭐⭐</b><br/>
              • 直射点所在半球：<b>昼长夜短</b><br/>
              • 纬度越高变化越大<br/>
              • 赤道终年昼夜平分（12小时）<br/>
              • 极圈内有极昼极夜现象
            </div>
            
            <div>
              <b style={{ color: '#F59E0B' }}>7. 特殊日期 ⭐⭐</b><br/>
              • 春/秋分：全球昼夜平分，晨昏线过两极<br/>
              • 夏至：北半球昼最长，北极圈内极昼<br/>
              • 冬至：北半球夜最长，北极圈内极夜
            </div>
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== 移动端控制面板 =====================

interface MobileControlPanelProps {
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
  initialDayOfYear: number;
  subsolarLat: number;
}

function MobileControlPanel({
  dayOfYear,
  setDayOfYear,
  initialDayOfYear,
  subsolarLat,
}: MobileControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
            {isExpanded ? '收起' : '昼夜控制'}
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
              {/* 太阳直射点 */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Typography variant="caption" color="text.secondary">太阳直射点纬度</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                  {formatDegreeMinute(subsolarLat)}
                </Typography>
              </div>

              {/* 日期滑块 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    日期：{dayOfYearToDate(dayOfYear)}（第 {dayOfYear} 天）
                  </Typography>
                  {dayOfYear !== initialDayOfYear && (
                    <Chip
                      label="今天"
                      size="small"
                      onClick={() => setDayOfYear(initialDayOfYear)}
                      sx={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366F1',
                        fontSize: 10,
                        height: 20,
                      }}
                    />
                  )}
                </div>
                <Slider
                  value={dayOfYear}
                  onChange={(_, v) => setDayOfYear(v as number)}
                  min={1}
                  max={365}
                  sx={{ color: '#F59E0B' }}
                />
              </div>

              {/* 特殊日期 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================== 主组件 =====================

export default function DayNightDemo3D({
  initialDate = new Date(),
}: DayNightDemo3DProps) {
  // 计算初始的年中第几天
  const initialDayOfYear = useMemo(() => {
    const start = new Date(initialDate.getFullYear(), 0, 0);
    const diff = initialDate.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [initialDate]);

  const [autoRotate, setAutoRotate] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [dayOfYear, setDayOfYear] = useState(initialDayOfYear);
  const [showDawnLine, setShowDawnLine] = useState(true);
  const [showDuskLine, setShowDuskLine] = useState(true);
  const [showNoonLine, setShowNoonLine] = useState(true);
  const [showShading, setShowShading] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [showSunRays, setShowSunRays] = useState(true);
  const [viewMode, setViewMode] = useState<'sun' | 'earth'>('sun');
  
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  // 计算太阳直射点纬度
  const subsolarLat = useMemo(() => getSubsolarLatitude(dayOfYear), [dayOfYear]);

  // 知识点信息内容
  const infoContent = (
    <>
      <Typography variant="h6" gutterBottom sx={{ color: '#F59E0B' }}>
        📚 昼夜与晨昏线（高考重点）
      </Typography>
      <Typography variant="body2" component="div" sx={{ lineHeight: 2 }}>
        <b>1. 晨昏线 ⭐⭐⭐</b><br/>
        • 晨昏线是昼夜半球的分界线，始终<b>垂直于太阳光线</b><br/>
        • <span style={{color: '#10B981'}}>晨线</span>：由夜半球进入昼半球的界线（日出线）<br/>
        • <span style={{color: '#8B5CF6'}}>昏线</span>：由昼半球进入夜半球的界线（日落线）<br/><br/>
        
        <b>2. 正午线与地方时 ⭐⭐⭐（核心）</b><br/>
        • <span style={{color: '#EF4444'}}>正午线</span>：太阳直射的<b>经线</b>，地方时 = <b>12:00</b><br/>
        • 午夜线：正午线对面180°，地方时 = <b>0:00</b><br/>
        • <span style={{color: '#10B981'}}>晨线</span>：地方时 = <b>6:00</b>（比正午线西90°）<br/>
        • <span style={{color: '#8B5CF6'}}>昏线</span>：地方时 = <b>18:00</b>（比正午线东90°）<br/>
        • 💡 这三条线相对太阳固定，地球自转时地表经线依次经过它们<br/><br/>
        
        <b>3. 地方时计算 ⭐⭐⭐</b><br/>
        • 地方时由<b>经度</b>决定，同一经线上地方时相同<br/>
        • 经度每差<b>15°</b>，时间差<b>1小时</b><br/>
        • 经度每差<b>1°</b>，时间差<b>4分钟</b><br/>
        • <b>东加西减</b>：东边时间早，西边时间晚<br/>
        • 公式：所求地方时 = 已知地方时 ± 经度差×4分钟<br/><br/>
        
        <b>4. 太阳直射点移动 ⭐⭐</b><br/>
        • 春分(3/21)→夏至(6/22)：向北移动<br/>
        • 夏至(6/22)→秋分(9/23)：向南移动<br/>
        • 秋分(9/23)→冬至(12/22)：向南移动<br/>
        • 冬至(12/22)→春分(3/21)：向北移动<br/><br/>
        
        <b>5. 昼夜长短变化 ⭐⭐⭐</b><br/>
        • 太阳直射点在哪个半球，该半球昼长夜短<br/>
        • 纬度越高，昼夜长短变化越大<br/>
        • 赤道上全年昼夜平分（12小时）<br/>
        • 极圈内有极昼极夜现象<br/><br/>
        
        <b>6. 特殊纬度 ⭐</b><br/>
        • 回归线（23°26′）：太阳直射的最北/南界限<br/>
        • 极圈（66°34′）：极昼极夜的最低纬度
      </Typography>
    </>
  );

  return (
    <AnimationPageLayout
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas camera={{ position: [14, 5, 10], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <Scene
              showLabels={showLabels}
              autoRotate={autoRotate}
              subsolarLat={subsolarLat}
              showDawnLine={showDawnLine}
              showDuskLine={showDuskLine}
              showNoonLine={showNoonLine}
              showShading={showShading}
              showSun={showSun}
              showSunRays={showSunRays}
              viewMode={viewMode}
              cameraRef={cameraControllerRef}
            />
          </Canvas>
        </Suspense>
      }
      scene2D={
        <TwoDView
          subsolarLat={subsolarLat}
        />
      }
      controlPanel={
        <ControlPanel
          dayOfYear={dayOfYear}
          setDayOfYear={setDayOfYear}
          initialDayOfYear={initialDayOfYear}
          subsolarLat={subsolarLat}
          showDawnLine={showDawnLine}
          setShowDawnLine={setShowDawnLine}
          showDuskLine={showDuskLine}
          setShowDuskLine={setShowDuskLine}
          showNoonLine={showNoonLine}
          setShowNoonLine={setShowNoonLine}
          showShading={showShading}
          setShowShading={setShowShading}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showSun={showSun}
          setShowSun={setShowSun}
          showSunRays={showSunRays}
          setShowSunRays={setShowSunRays}
        />
      }
      mobileControlPanel={
        <MobileControlPanel
          dayOfYear={dayOfYear}
          setDayOfYear={setDayOfYear}
          initialDayOfYear={initialDayOfYear}
          subsolarLat={subsolarLat}
        />
      }
      bottomControls={(is3D) => (
        <>
          {is3D && (
            <>
              <Tooltip title={autoRotate ? '暂停地球自转' : '开启地球自转'}>
                <IconButton
                  onClick={() => setAutoRotate(!autoRotate)}
                  sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                >
                  {autoRotate ? <PauseIcon /> : <PlayIcon />}
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
