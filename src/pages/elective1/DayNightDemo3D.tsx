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
function Sun3D({ subsolarLat }: { subsolarLat: number }) {
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

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
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
      
      {/* 太阳光线 */}
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
  );
}

/** 晨昏线组件 - 大圆 */
function TerminatorLine({ 
  subsolarLat, 
  showLabels,
  hourOffset = 0, // 0 = 晨昏线, 6 = 正午线
}: { 
  subsolarLat: number;
  showLabels: boolean;
  hourOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [dawnVisible, setDawnVisible] = useState(true);
  const [duskVisible, setDuskVisible] = useState(true);

  // 晨昏线是与太阳光线垂直的大圆
  // hourOffset: 0 = 晨昏线（6:00/18:00），6 = 正午/午夜线（12:00/0:00）
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = 2.02;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    const offsetRad = (hourOffset * 15) * Math.PI / 180; // 每小时15度
    
    for (let i = 0; i <= 360; i += 2) {
      const angle = (i * Math.PI) / 180;
      
      // 晨昏线是过地心的大圆，垂直于太阳光线
      // 首先在XZ平面创建一个圆，然后绕Y轴旋转（根据时区偏移），再绕Z轴倾斜（根据太阳直射点纬度）
      let x = Math.cos(angle) * radius;
      let y = Math.sin(angle) * radius;
      let z = 0;
      
      // 绕Y轴旋转（时区偏移）
      const cosOffset = Math.cos(offsetRad);
      const sinOffset = Math.sin(offsetRad);
      const x1 = x * cosOffset - z * sinOffset;
      const z1 = x * sinOffset + z * cosOffset;
      x = x1;
      z = z1;
      
      // 绕Z轴倾斜（根据太阳直射点纬度）
      const cosLat = Math.cos(subsolarLatRad);
      const sinLat = Math.sin(subsolarLatRad);
      const x2 = x * cosLat - y * sinLat;
      const y2 = x * sinLat + y * cosLat;
      
      pts.push([x2, y2, z]);
    }
    return pts;
  }, [subsolarLat, hourOffset]);

  // 计算晨线和昏线标签位置
  const dawnPosition = useMemo(() => {
    const radius = 2.3;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    // 晨线在地球正面的赤道附近
    let x = 0;
    let y = radius;
    let z = 0;
    
    // 应用相同的旋转
    const cosLat = Math.cos(subsolarLatRad);
    const sinLat = Math.sin(subsolarLatRad);
    const x2 = x * cosLat - y * sinLat;
    const y2 = x * sinLat + y * cosLat;
    
    return [x2, y2, z] as [number, number, number];
  }, [subsolarLat]);

  const duskPosition = useMemo(() => {
    const radius = 2.3;
    const subsolarLatRad = subsolarLat * Math.PI / 180;
    // 昏线在地球正面的赤道附近（下方）
    let x = 0;
    let y = -radius;
    let z = 0;
    
    const cosLat = Math.cos(subsolarLatRad);
    const sinLat = Math.sin(subsolarLatRad);
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

  const lineColor = hourOffset === 0 ? COLORS.terminatorLine : COLORS.noonLine;

  return (
    <group ref={groupRef}>
      <Line
        points={points}
        color={lineColor}
        lineWidth={3}
      />
      
      {/* 晨线标签 */}
      {showLabels && hourOffset === 0 && dawnVisible && (
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
      {showLabels && hourOffset === 0 && duskVisible && (
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

/** 正午线（太阳直射经线） */
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

  // 正午线是太阳直射的经线（固定在X正方向，即经度0°方向）
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

  // 太阳直射点位置
  const subsolarPosition: [number, number, number] = useMemo(() => {
    const radius = 2.15;
    const latRad = subsolarLat * Math.PI / 180;
    return [
      Math.cos(latRad) * radius,
      Math.sin(latRad) * radius,
      0
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
        lineWidth={2}
      />
      
      {/* 太阳直射点标签 */}
      {showLabel && isVisible && (
        <group position={subsolarPosition}>
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
              ☀️ 直射点 12:00
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
  
  // 夜半球材质
  const nightMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        subsolarLat: { value: subsolarLat * Math.PI / 180 },
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
          
          // 夜半球（dotProduct < 0）显示深蓝色
          if (dotProduct < -0.02) {
            gl_FragColor = vec4(0.1, 0.15, 0.3, 0.4);
          } else if (dotProduct < 0.02) {
            // 晨昏线附近的过渡区域
            float t = (dotProduct + 0.02) / 0.04;
            gl_FragColor = vec4(0.1, 0.15, 0.3, 0.4 * (1.0 - t));
          } else {
            discard;
          }
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });
  }, [subsolarLat]);

  // 更新uniform
  useMemo(() => {
    nightMaterial.uniforms.subsolarLat.value = subsolarLat * Math.PI / 180;
  }, [subsolarLat, nightMaterial]);

  return (
    <mesh ref={nightRef} material={nightMaterial}>
      <sphereGeometry args={[2.01, 64, 64]} />
    </mesh>
  );
}

/** 地球组件 */
function Earth({ 
  showLabels, 
  autoRotate,
  subsolarLat,
  showTerminator,
  showNoonLine,
  showShading,
}: {
  showLabels: boolean;
  autoRotate: boolean;
  subsolarLat: number;
  showTerminator: boolean;
  showNoonLine: boolean;
  showShading: boolean;
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  useFrame(({ clock }) => {
    if (earthGroupRef.current && autoRotate) {
      earthGroupRef.current.rotation.y = clock.elapsedTime * 0.1;
    }
  });

  return (
    <group>
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

        {/* 昼夜着色 */}
        {showShading && <DayNightShading subsolarLat={subsolarLat} />}

        {/* 特殊纬线 */}
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

        {/* 晨昏线 */}
        {showTerminator && (
          <TerminatorLine 
            subsolarLat={subsolarLat} 
            showLabels={showLabels}
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
  showTerminator: boolean;
  showNoonLine: boolean;
  showShading: boolean;
  showSun: boolean;
  cameraRef: React.RefObject<CameraControllerHandle>;
}

function Scene({ 
  showLabels, 
  autoRotate,
  subsolarLat,
  showTerminator,
  showNoonLine,
  showShading,
  showSun,
  cameraRef,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <directionalLight position={[-3, 2, -3]} intensity={0.6} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      <Suspense fallback={null}>
        {showSun && <Sun3D subsolarLat={subsolarLat} />}
        <Earth 
          showLabels={showLabels}
          autoRotate={autoRotate}
          subsolarLat={subsolarLat}
          showTerminator={showTerminator}
          showNoonLine={showNoonLine}
          showShading={showShading}
        />
      </Suspense>
      
      <CameraController ref={cameraRef} defaultPosition={[6, 2, 4]} />
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
  showTerminator: boolean;
  setShowTerminator: (show: boolean) => void;
  showNoonLine: boolean;
  setShowNoonLine: (show: boolean) => void;
  showShading: boolean;
  setShowShading: (show: boolean) => void;
  showSun: boolean;
  setShowSun: (show: boolean) => void;
}

function ControlPanel({
  dayOfYear,
  setDayOfYear,
  initialDayOfYear,
  subsolarLat,
  showTerminator,
  setShowTerminator,
  showNoonLine,
  setShowNoonLine,
  showShading,
  setShowShading,
  showSun,
  setShowSun,
}: ControlPanelProps) {

  return (
    <Card sx={{ 
      background: 'rgba(255,255,255,0.95)', 
      backdropFilter: 'blur(10px)',
      borderRadius: 3,
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    }}>
      <CardContent sx={{ p: 2 }}>
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
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ☀️ 太阳直射点纬度
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#F59E0B' }}>
            {formatDegreeMinute(subsolarLat)}
          </Typography>
        </div>

        {/* 显示选项 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#6366F1', mb: 1 }}>
            显示选项
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Chip
              label="晨昏线"
              size="small"
              onClick={() => setShowTerminator(!showTerminator)}
              sx={{
                background: showTerminator ? COLORS.terminatorLine : 'rgba(0,0,0,0.05)',
                color: showTerminator ? 'white' : 'text.secondary',
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
              • <span style={{ color: '#10B981' }}>晨线</span>：夜→昼的分界线<br/>
              • <span style={{ color: '#8B5CF6' }}>昏线</span>：昼→夜的分界线<br/>
              • 晨昏线是过地心的大圆
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#EF4444' }}>2. 晨昏线与地方时 ⭐⭐⭐</b><br/>
              • 晨线上地方时 = <b>6:00</b><br/>
              • 昏线上地方时 = <b>18:00</b><br/>
              • 直射点经线 = <b>12:00</b><br/>
              • 对面经线 = <b>0:00/24:00</b>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#3B82F6' }}>3. 太阳直射点移动 ⭐⭐</b><br/>
              • 春分→夏至：向<b>北</b>移<br/>
              • 夏至→秋分：向<b>南</b>移<br/>
              • 秋分→冬至：向<b>南</b>移<br/>
              • 冬至→春分：向<b>北</b>移
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: '#10B981' }}>4. 昼夜长短规律 ⭐⭐⭐</b><br/>
              • 直射点所在半球：<b>昼长夜短</b><br/>
              • 纬度越高变化越大<br/>
              • 赤道终年昼夜平分<br/>
              • 极圈内有极昼极夜
            </div>
            
            <div>
              <b style={{ color: '#8B5CF6' }}>5. 特殊日期 ⭐⭐</b><br/>
              • 春/秋分：全球昼夜平分<br/>
              • 夏至：北半球昼最长<br/>
              • 冬至：北半球夜最长
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
  const [showTerminator, setShowTerminator] = useState(true);
  const [showNoonLine, setShowNoonLine] = useState(true);
  const [showShading, setShowShading] = useState(true);
  const [showSun, setShowSun] = useState(true);
  
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
        • 晨昏线是昼夜半球的分界线<br/>
        • <span style={{color: '#10B981'}}>晨线</span>：由夜半球进入昼半球的界线<br/>
        • <span style={{color: '#8B5CF6'}}>昏线</span>：由昼半球进入夜半球的界线<br/><br/>
        
        <b>2. 晨昏线与地方时 ⭐⭐⭐</b><br/>
        • <span style={{color: '#10B981'}}>晨线上各点地方时为 <b>6:00</b></span><br/>
        • <span style={{color: '#8B5CF6'}}>昏线上各点地方时为 <b>18:00</b></span><br/>
        • <span style={{color: '#EF4444'}}>太阳直射点所在经线地方时为 <b>12:00</b></span><br/>
        • 与直射点相对的经线地方时为 <b>0:00/24:00</b><br/><br/>
        
        <b>3. 太阳直射点移动 ⭐⭐</b><br/>
        • 春分(3/21)→夏至(6/22)：向北移动<br/>
        • 夏至(6/22)→秋分(9/23)：向南移动<br/>
        • 秋分(9/23)→冬至(12/22)：向南移动<br/>
        • 冬至(12/22)→春分(3/21)：向北移动<br/><br/>
        
        <b>4. 昼夜长短变化 ⭐⭐⭐</b><br/>
        • 太阳直射点在哪个半球，该半球昼长夜短<br/>
        • 纬度越高，昼夜长短变化越大<br/>
        • 赤道上全年昼夜平分（12小时）<br/>
        • 极圈内有极昼极夜现象<br/><br/>
        
        <b>5. 特殊纬度 ⭐</b><br/>
        • 回归线（23°26′）：太阳直射的最北/南界限<br/>
        • 极圈（66°34′）：极昼极夜的最低纬度
      </Typography>
    </>
  );

  return (
    <AnimationPageLayout
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas camera={{ position: [6, 2, 4], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <Scene
              showLabels={showLabels}
              autoRotate={autoRotate}
              subsolarLat={subsolarLat}
              showTerminator={showTerminator}
              showNoonLine={showNoonLine}
              showShading={showShading}
              showSun={showSun}
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
          showTerminator={showTerminator}
          setShowTerminator={setShowTerminator}
          showNoonLine={showNoonLine}
          setShowNoonLine={setShowNoonLine}
          showShading={showShading}
          setShowShading={setShowShading}
          showSun={showSun}
          setShowSun={setShowSun}
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
