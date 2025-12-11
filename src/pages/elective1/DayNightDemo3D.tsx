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

import { useRef, useState, useMemo, Suspense, useCallback, useEffect } from 'react';
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
  onBack?: () => void;
}

// ===================== 常量 =====================

/** 地球半径 */
const EARTH_RADIUS = 4;

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

/** 常用城市数据 */
const FAMOUS_CITIES = [
  { name: '北京', lat: 39.9, lon: 116.4, timezone: 8 },
  { name: '上海', lat: 31.2, lon: 121.5, timezone: 8 },
  { name: '广州', lat: 23.1, lon: 113.3, timezone: 8 },
  { name: '东京', lat: 35.7, lon: 139.7, timezone: 9 },
  { name: '伦敦', lat: 51.5, lon: 0, timezone: 0 },
  { name: '纽约', lat: 40.7, lon: -74.0, timezone: -5 },
  { name: '悉尼', lat: -33.9, lon: 151.2, timezone: 10 },
  { name: '开普敦', lat: -33.9, lon: 18.4, timezone: 2 },
  { name: '莫斯科', lat: 55.8, lon: 37.6, timezone: 3 },
  { name: '新加坡', lat: 1.3, lon: 103.8, timezone: 8 },
];

interface CityInfo {
  name: string;
  lat: number;
  lon: number;
  timezone: number;
}

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

/** 根据UTC小时和经度计算地方时 */
const getLocalTime = (utcHour: number, longitude: number): number => {
  // 经度每15度对应1小时时差
  const localTime = utcHour + longitude / 15;
  // 归一化到0-24
  return ((localTime % 24) + 24) % 24;
};

/** 根据地方时和太阳直射点纬度判断某地是白天还是黑夜 */
const isDaytime = (localTime: number, latitude: number, subsolarLat: number): boolean => {
  const dayLength = getDayLength(latitude, subsolarLat);
  if (dayLength === 24) return true;  // 极昼
  if (dayLength === 0) return false;  // 极夜
  
  // 日出时间 = 12 - 昼长/2，日落时间 = 12 + 昼长/2
  const sunrise = 12 - dayLength / 2;
  const sunset = 12 + dayLength / 2;
  
  return localTime >= sunrise && localTime < sunset;
};

/** 计算日出日落时间 */
const getSunriseSunset = (latitude: number, subsolarLat: number): { sunrise: number; sunset: number } | null => {
  const dayLength = getDayLength(latitude, subsolarLat);
  if (dayLength === 24 || dayLength === 0) return null; // 极昼极夜
  
  const sunrise = 12 - dayLength / 2;
  const sunset = 12 + dayLength / 2;
  return { sunrise, sunset };
};

/** 格式化时间为 HH:MM */
const formatTime = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
    EARTH_RADIUS * Math.cos(latRad),
    EARTH_RADIUS * Math.sin(latRad),
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
        <Html position={[0, 1, 0]} center zIndexRange={[100, 0]}>
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

/** 经纬度标签组件 */
function GraticuleLabel({ 
  text, 
  position, 
  color = '#ffffff' 
}: { 
  text: string; 
  position: THREE.Vector3;
  color?: string;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // 获取标签的世界坐标
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    
    // 计算法向量和相机方向
    const normal = worldPos.clone().normalize();
    const toCamera = camera.position.clone().sub(worldPos).normalize();
    
    setIsVisible(normal.dot(toCamera) > 0.15);
  });

  return (
    <group ref={groupRef} position={position}>
      {isVisible && (
        <Html center zIndexRange={[50, 0]}>
          <div style={{
            color: color,
            fontSize: '9px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.4)',
            padding: '1px 4px',
            borderRadius: 3,
            opacity: 0.8,
          }}>
            {text}
          </div>
        </Html>
      )}
    </group>
  );
}

/** 经纬网格组件 */
function Graticule({ radius, showLabels = true }: { radius: number; showLabels?: boolean }) {
  // 生成纬线点（每15度一条，不含极点和已有的特殊纬线）
  const latitudeLines = useMemo(() => {
    const allLines: { points: [number, number, number][]; lat: number }[] = [];
    const skipLats = [0, OBLIQUITY, -OBLIQUITY, ARCTIC_CIRCLE_LAT, -ARCTIC_CIRCLE_LAT]; // 跳过已有的特殊纬线
    
    for (let lat = -75; lat <= 75; lat += 15) {
      // 跳过特殊纬线（赤道、回归线、极圈）
      if (skipLats.some(skip => Math.abs(lat - skip) < 1)) continue;
      
      const latRad = (lat * Math.PI) / 180;
      const r = Math.cos(latRad) * radius;
      const y = Math.sin(latRad) * radius;
      
      const points: [number, number, number][] = [];
      for (let lon = 0; lon <= 360; lon += 5) {
        const lonRad = (lon * Math.PI) / 180;
        points.push([
          r * Math.cos(lonRad),
          y,
          -r * Math.sin(lonRad)
        ]);
      }
      allLines.push({ points, lat });
    }
    return allLines;
  }, [radius]);

  // 生成经线点（每15度一条）
  const longitudeLines = useMemo(() => {
    const allLines: { points: [number, number, number][]; lon: number }[] = [];
    
    for (let lon = 0; lon < 360; lon += 15) {
      const lonRad = (lon * Math.PI) / 180;
      const points: [number, number, number][] = [];
      
      for (let lat = -90; lat <= 90; lat += 5) {
        const latRad = (lat * Math.PI) / 180;
        points.push([
          radius * Math.cos(latRad) * Math.cos(lonRad),
          radius * Math.sin(latRad),
          -radius * Math.cos(latRad) * Math.sin(lonRad)
        ]);
      }
      allLines.push({ points, lon });
    }
    return allLines;
  }, [radius]);

  // 纬度标签位置（放在本初子午线上）
  const latLabels = useMemo(() => {
    const labels: { text: string; position: THREE.Vector3 }[] = [];
    const labelRadius = radius + 0.08;
    const skipLats = [0, OBLIQUITY, -OBLIQUITY, ARCTIC_CIRCLE_LAT, -ARCTIC_CIRCLE_LAT]; // 跳过已有特殊纬线
    
    for (let lat = -75; lat <= 75; lat += 15) {
      // 跳过特殊纬线（赤道、回归线、极圈）
      if (skipLats.some(skip => Math.abs(lat - skip) < 1)) continue;
      
      const latRad = (lat * Math.PI) / 180;
      const position = new THREE.Vector3(
        labelRadius * Math.cos(latRad),
        labelRadius * Math.sin(latRad),
        0
      );
      labels.push({
        text: `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`,
        position
      });
    }
    return labels;
  }, [radius]);

  // 经度标签位置（放在赤道上）
  const lonLabels = useMemo(() => {
    const labels: { text: string; position: THREE.Vector3 }[] = [];
    const labelRadius = radius + 0.08;
    
    for (let lon = 0; lon < 360; lon += 15) {
      const lonRad = (lon * Math.PI) / 180;
      const displayLon = lon > 180 ? lon - 360 : lon;
      const position = new THREE.Vector3(
        labelRadius * Math.cos(lonRad),
        0,
        -labelRadius * Math.sin(lonRad)
      );
      labels.push({
        text: displayLon === 0 ? '0°' : `${Math.abs(displayLon)}°${displayLon > 0 ? 'E' : 'W'}`,
        position
      });
    }
    return labels;
  }, [radius]);

  return (
    <group>
      {/* 纬线 */}
      {latitudeLines.map(({ points }, i) => (
        <Line key={`lat-${i}`} points={points} color="#ffffff" lineWidth={0.5} transparent opacity={0.2} />
      ))}
      {/* 经线 */}
      {longitudeLines.map(({ points }, i) => (
        <Line key={`lon-${i}`} points={points} color="#ffffff" lineWidth={0.5} transparent opacity={0.2} />
      ))}
      {/* 纬度标签 */}
      {showLabels && latLabels.map(({ text, position }, i) => (
        <GraticuleLabel key={`lat-label-${i}`} text={text} position={position} />
      ))}
      {/* 经度标签 */}
      {showLabels && lonLabels.map(({ text, position }, i) => (
        <GraticuleLabel key={`lon-label-${i}`} text={text} position={position} />
      ))}
    </group>
  );
}

/** 晨昏线组件 - 大圆 */
function TerminatorLine({ 
  subsolarLat, 
  showLabels,
  showDawn = true,
  showDusk = true,
  utcHour,
}: { 
  subsolarLat: number;
  showLabels: boolean;
  showDawn?: boolean;
  showDusk?: boolean;
  utcHour: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [dawnVisible, setDawnVisible] = useState(true);
  const [duskVisible, setDuskVisible] = useState(true);

  // 晨昏线是与太阳光线垂直的大圆
  // 太阳方向向量: sunDir = (cos(s), sin(s), 0)，其中 s = subsolarLat
  // 晨昏线上的点满足: dot(position, sunDir) = 0
  // 
  // 参数化晨昏线（大圆）：
  // 晨昏线平面的两个基向量:
  //   v1 = (-sin(s), cos(s), 0)  - 在x-y平面内，垂直于sunDir
  //   v2 = (0, 0, 1)             - z轴方向
  // 
  // 晨昏线上的点: P(θ) = radius * (cos(θ) * v1 + sin(θ) * v2)
  //            = radius * (-sin(s)*cos(θ), cos(s)*cos(θ), sin(θ))
  //
  // 地球绕Y轴逆时针自转（从北极看），所以：
  // - z > 0 的半球是"西侧"，即将迎来太阳 → 晨线
  // - z < 0 的半球是"东侧"，即将告别太阳 → 昏线
  //
  // sin(θ) > 0 当 0° < θ < 180°，所以：
  // - 晨线: θ 从 0° 到 180°（z 从 0 → +radius → 0）
  // - 昏线: θ 从 180° 到 360°（z 从 0 → -radius → 0）
  
  const subsolarLatRad = subsolarLat * Math.PI / 180;
  const sinS = Math.sin(subsolarLatRad);
  const cosS = Math.cos(subsolarLatRad);
  
  // 晨线点：θ 从 0° 到 180°（z > 0 的半圆，西侧，即将日出）
  const dawnPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = EARTH_RADIUS + 0.02;
    
    for (let i = 0; i <= 180; i += 2) {
      const theta = (i * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      pts.push([
        -sinS * cosTheta * radius,
        cosS * cosTheta * radius,
        sinTheta * radius
      ]);
    }
    return pts;
  }, [sinS, cosS]);

  // 昏线点：θ 从 180° 到 360°（z < 0 的半圆，东侧，即将日落）
  const duskPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = EARTH_RADIUS + 0.02;
    
    for (let i = 180; i <= 360; i += 2) {
      const theta = (i * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      pts.push([
        -sinS * cosTheta * radius,
        cosS * cosTheta * radius,
        sinTheta * radius
      ]);
    }
    return pts;
  }, [sinS, cosS]);

  // 计算晨线和昏线标签位置 - 放在晨昏线与赤道的交点处
  // 晨昏线参数方程: P(θ) = radius * (-sin(s)*cos(θ), cos(s)*cos(θ), sin(θ))
  // 赤道交点: y = cos(s)*cos(θ) = 0，即 cos(θ) = 0，θ = 90° 或 270°
  // θ=90°: P = (0, 0, radius) - 晨线与赤道交点（z > 0，西侧）
  // θ=270°: P = (0, 0, -radius) - 昏线与赤道交点（z < 0，东侧）
  const dawnPosition = useMemo(() => {
    const radius = EARTH_RADIUS + 0.15;
    // 晨线与赤道交点 θ=90°，z > 0
    return [0, 0, radius] as [number, number, number];
  }, []);

  const duskPosition = useMemo(() => {
    const radius = EARTH_RADIUS + 0.15;
    // 昏线与赤道交点 θ=270°，z < 0
    return [0, 0, -radius] as [number, number, number];
  }, []);

  // 计算晨昏线与赤道交点的经度（和 ControlPanel 一致）
  // UTC 12:00 时正午线在 0° 经度
  // 每小时正午线向西移动 15°
  const { dawnLongitude, duskLongitude } = useMemo(() => {
    const noonLon = ((12 - utcHour) * 15 + 360) % 360;
    const noonLonDisplay = noonLon > 180 ? noonLon - 360 : noonLon;
    
    // 晨线经度 = 正午线 - 90°（西边，地方时 6:00）
    let dawnLon = (noonLonDisplay - 90 + 360) % 360;
    if (dawnLon > 180) dawnLon -= 360;
    
    // 昏线经度 = 正午线 + 90°（东边，地方时 18:00）
    let duskLon = (noonLonDisplay + 90 + 360) % 360;
    if (duskLon > 180) duskLon -= 360;
    
    return { dawnLongitude: dawnLon, duskLongitude: duskLon };
  }, [utcHour]);

  // 检测标签可见性（交点朝向摄像机时才可见）
  // 需要将本地坐标转换为世界坐标，因为组件可能在旋转的父组中
  useFrame(() => {
    if (groupRef.current) {
      // 获取本地坐标点
      const dawnLocal = new THREE.Vector3(...dawnPosition);
      const duskLocal = new THREE.Vector3(...duskPosition);
      
      // 转换为世界坐标
      const dawnWorld = groupRef.current.localToWorld(dawnLocal.clone());
      const duskWorld = groupRef.current.localToWorld(duskLocal.clone());
      
      // 世界坐标系下的法向量（从地球中心指向表面点）
      const earthCenter = new THREE.Vector3(0, 0, 0);
      groupRef.current.localToWorld(earthCenter);
      
      const dawnNormal = dawnWorld.clone().sub(earthCenter).normalize();
      const duskNormal = duskWorld.clone().sub(earthCenter).normalize();
      
      const toCamera = camera.position.clone().normalize();
      
      setDawnVisible(dawnNormal.dot(toCamera) > 0.1);
      setDuskVisible(duskNormal.dot(toCamera) > 0.1);
    }
  });

  // 格式化经度显示
  const formatLongitude = (lon: number) => {
    const absLon = Math.abs(lon);
    const deg = Math.floor(absLon);
    const min = Math.round((absLon - deg) * 60);
    const dir = lon >= 0 ? 'E' : 'W';
    return `${deg}°${min > 0 ? min + "'" : ''} ${dir}`;
  };

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
      
      {/* 晨线标签 - 在赤道交点处，可见时才显示 */}
      {showLabels && showDawn && dawnVisible && (
        <group position={dawnPosition}>
          <Html center zIndexRange={[100, 0]}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              🌅 晨线 6:00 {formatLongitude(dawnLongitude)}
            </div>
          </Html>
        </group>
      )}
      
      {/* 昏线标签 - 在赤道交点处，可见时才显示 */}
      {showLabels && showDusk && duskVisible && (
        <group position={duskPosition}>
          <Html center zIndexRange={[100, 0]}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              🌆 昏线 18:00 {formatLongitude(duskLongitude)}
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
  utcHour,
}: { 
  subsolarLat: number;
  showLabel: boolean;
  utcHour: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();

  // 正午线是太阳直射的经线，地方时为12:00
  // 它是一条从北极到南极的半圆弧，位于X-Y平面上（z=0）
  // 注意：正午线相对太阳固定，随地球自转，对应的地球经度会变化
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const radius = EARTH_RADIUS + 0.02;
    
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

  // 直射点标签位置 - 稍微偏移到Z轴负方向，避免和纬线标签重叠
  const subsolarLabelPosition: [number, number, number] = useMemo(() => {
    const radius = EARTH_RADIUS + 0.15;
    const latRad = subsolarLat * Math.PI / 180;
    const zOffset = -0.8; // Z轴偏移
    return [
      Math.cos(latRad) * radius * 0.9,
      Math.sin(latRad) * radius + 0.3, // Y轴稍微上移
      zOffset
    ];
  }, [subsolarLat]);

  // 计算正午线经度（和 ControlPanel 一致）
  // UTC 12:00 时正午线在 0° 经度
  // 每小时正午线向西移动 15°
  const noonLongitude = useMemo(() => {
    const noonLon = ((12 - utcHour) * 15 + 360) % 360;
    return noonLon > 180 ? noonLon - 360 : noonLon;
  }, [utcHour]);

  // 格式化经度显示
  const formatLongitude = (lon: number) => {
    const absLon = Math.abs(lon);
    const deg = Math.floor(absLon);
    const min = Math.round((absLon - deg) * 60);
    const dir = lon >= 0 ? 'E' : 'W';
    return `${deg}°${min > 0 ? min + "'" : ''} ${dir}`;
  };

  // 检测可见性（需要考虑父组件旋转）
  useFrame(() => {
    if (groupRef.current) {
      // 获取本地坐标点并转换为世界坐标
      const localPos = new THREE.Vector3(...subsolarLabelPosition);
      const worldPos = groupRef.current.localToWorld(localPos.clone());
      
      // 获取地球中心的世界坐标
      const earthCenter = new THREE.Vector3(0, 0, 0);
      groupRef.current.localToWorld(earthCenter);
      
      // 世界坐标系下的法向量
      const normal = worldPos.clone().sub(earthCenter).normalize();
      const toCamera = camera.position.clone().normalize();
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
          <Html center zIndexRange={[100, 0]}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.9)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              ☀️ 太阳直射点 12:00 {formatLongitude(noonLongitude)}
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
      <sphereGeometry args={[EARTH_RADIUS + 0.015, 64, 64]} />
    </mesh>
  );
}

/** 城市标记组件 */
function CityMarker({ city, radius }: { city: CityInfo; radius: number }) {
  const { camera } = useThree();
  const [isVisible, setIsVisible] = useState(true);
  const groupRef = useRef<THREE.Group>(null);
  
  // 将经纬度转换为3D坐标
  const latRad = city.lat * Math.PI / 180;
  const lonRad = city.lon * Math.PI / 180;
  const markerRadius = radius + 0.05;
  
  const position = useMemo(() => new THREE.Vector3(
    markerRadius * Math.cos(latRad) * Math.cos(lonRad),
    markerRadius * Math.sin(latRad),
    -markerRadius * Math.cos(latRad) * Math.sin(lonRad)
  ), [latRad, lonRad, markerRadius]);
  
  // 实时检测标记是否面向相机（考虑父组件的旋转）
  useFrame(() => {
    if (groupRef.current) {
      // 获取标记在世界坐标中的实际位置
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      
      // 世界坐标中的法向量
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      setIsVisible(normal.dot(toCamera) > 0.1);
    }
  });
  
  // 始终渲染 group 以便获取世界位置，只控制内容可见性
  return (
    <group ref={groupRef} position={position}>
      {isVisible && (
        <>
          {/* 标记点 */}
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="#EF4444" />
          </mesh>
          {/* 标记环 */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.16, 32]} />
            <meshBasicMaterial color="#EF4444" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
          {/* 城市名称标签 */}
          <Html
            center
            style={{
              color: 'white',
              background: 'rgba(239, 68, 68, 0.9)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translateY(-24px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            📍 {city.name}
          </Html>
        </>
      )}
    </group>
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
  utcHour,
  selectedCity,
}: {
  showLabels: boolean;
  subsolarLat: number;
  showDawnLine: boolean;
  showDuskLine: boolean;
  showNoonLine: boolean;
  showShading: boolean;
  viewMode: 'sun' | 'earth';
  rotationAngle: number;
  utcHour: number;
  selectedCity: CityInfo | null;
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
          <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
          <meshStandardMaterial
            map={earthMap}
            normalMap={earthNormal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughnessMap={earthSpec}
            roughness={0.3}
            metalness={0.0}
            emissive="#4a6080"
            emissiveIntensity={0.35}
          />
        </mesh>
        
        {/* 云层 */}
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS + 0.02, 64, 64]} />
          <meshBasicMaterial
            map={cloudsMap}
            transparent
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>

        {/* 特殊纬线 - 随地球 */}
        {SPECIAL_LATITUDES.map(({ name, lat, color }) => (
          <LatitudeLine 
            key={name}
            latitude={lat} 
            radius={EARTH_RADIUS + 0.01} 
            color={color} 
            label={`${name} ${formatDegreeMinute(lat, false)}`}
            showLabel={showLabels && Math.abs(lat) > 0}
          />
        ))}

        {/* 经纬网格 */}
        <Graticule radius={EARTH_RADIUS + 0.005} />

        {/* 城市标记 */}
        {selectedCity && <CityMarker city={selectedCity} radius={EARTH_RADIUS} />}
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
            utcHour={utcHour}
          />
        )}

        {/* 正午线 */}
        {showNoonLine && (
          <NoonLine 
            subsolarLat={subsolarLat}
            showLabel={showLabels}
            utcHour={utcHour}
          />
        )}
      </group>
    </group>
  );
}

/** 场景组件 */
interface SceneProps {
  showLabels: boolean;
  subsolarLat: number;
  showDawnLine: boolean;
  showDuskLine: boolean;
  showNoonLine: boolean;
  showShading: boolean;
  showSun: boolean;
  showSunRays: boolean;
  viewMode: 'sun' | 'earth';
  cameraRef: React.RefObject<CameraControllerHandle>;
  utcHour: number;
  selectedCity: CityInfo | null;
}

function Scene({ 
  showLabels, 
  subsolarLat,
  showDawnLine,
  showDuskLine,
  showNoonLine,
  showShading,
  showSun,
  showSunRays,
  viewMode,
  cameraRef,
  utcHour,
  selectedCity,
}: SceneProps) {
  const sunGroupRef = useRef<THREE.Group>(null);
  
  // 根据 UTC 时间计算地球的旋转角度
  // UTC 12:00 时，0° 经度正对太阳（正午线在 0° 经度）
  // UTC 时间每增加 1 小时，地球向东转 15°
  const rotationAngle = useMemo(() => {
    return (utcHour - 12) * 15 * Math.PI / 180;
  }, [utcHour]);

  // 处理太阳组的旋转（地球视角下太阳需要转）
  useFrame(() => {
    if (viewMode === 'earth' && sunGroupRef.current) {
      sunGroupRef.current.rotation.y = -rotationAngle;
    } else if (sunGroupRef.current) {
      sunGroupRef.current.rotation.y = 0;
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
          rotationAngle={rotationAngle}
          utcHour={utcHour}
          selectedCity={selectedCity}
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

// ===================== 控制面板 =====================

interface ControlPanelProps {
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
  initialDayOfYear: number;
  subsolarLat: number;
  utcHour: number;
  setUtcHour: (hour: number) => void;
  selectedCity: CityInfo | null;
  setSelectedCity: (city: CityInfo | null) => void;
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
  utcHour,
  setUtcHour,
  selectedCity,
  setSelectedCity,
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
  const [citySearch, setCitySearch] = useState('');

  // 计算选中城市的信息
  const cityInfo = useMemo(() => {
    if (!selectedCity) return null;
    const localTime = getLocalTime(utcHour, selectedCity.lon);
    const dayLength = getDayLength(selectedCity.lat, subsolarLat);
    const sunTimes = getSunriseSunset(selectedCity.lat, subsolarLat);
    const isDay = isDaytime(localTime, selectedCity.lat, subsolarLat);
    return { localTime, dayLength, sunTimes, isDay };
  }, [selectedCity, utcHour, subsolarLat]);

  // 正午线经度（UTC时间对应的太阳直射经度）
  const noonLongitude = useMemo(() => {
    // UTC 12:00 时正午线在 0° 经度
    // 每小时正午线向西移动 15°
    return ((12 - utcHour) * 15 + 360) % 360;
  }, [utcHour]);

  // 转换为 -180 到 180 的范围
  const noonLonDisplay = noonLongitude > 180 ? noonLongitude - 360 : noonLongitude;

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

        {/* 第一步：日期 → 太阳直射点纬度 */}
        <div style={{ 
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(251, 191, 36, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F59E0B', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ 
              background: '#F59E0B', 
              color: 'white', 
              borderRadius: '50%', 
              width: 20, 
              height: 20, 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700
            }}>1</span>
            日期 → 太阳直射点纬度
          </Typography>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Typography variant="caption" color="text.secondary">
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
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

          {/* 结果：太阳直射点 */}
          <div style={{
            marginTop: 12,
            background: 'white',
            borderRadius: 8,
            padding: 8,
            textAlign: 'center',
          }}>
            <Typography variant="caption" color="text.secondary">☀️ 太阳直射点纬度</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#F59E0B', lineHeight: 1.2 }}>
              {formatDegreeMinute(subsolarLat)}
            </Typography>
          </div>
        </div>

        {/* 第二步：时间 → 正午线经度 */}
        <div style={{ 
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3B82F6', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ 
              background: '#3B82F6', 
              color: 'white', 
              borderRadius: '50%', 
              width: 20, 
              height: 20, 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700
            }}>2</span>
            时间 (UTC) → 正午线位置
          </Typography>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
              UTC {utcHour.toString().padStart(2, '0')}:00
            </Typography>
            <Slider
              value={utcHour}
              onChange={(_, v) => setUtcHour(v as number)}
              min={0}
              max={23}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 6, label: '6' },
                { value: 12, label: '12' },
                { value: 18, label: '18' },
                { value: 23, label: '23' },
              ]}
              sx={{ color: '#3B82F6', flex: 1 }}
            />
          </div>

          {/* 结果：正午线位置 */}
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            justifyContent: 'space-around',
          }}>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">🕐 正午线</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#EF4444' }}>
                {Math.abs(noonLonDisplay).toFixed(0)}°{noonLonDisplay >= 0 ? 'E' : 'W'}
              </Typography>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">🌅 晨线</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#10B981' }}>
                {Math.abs((noonLonDisplay - 90 + 360) % 360 > 180 ? (noonLonDisplay - 90 + 360) % 360 - 360 : (noonLonDisplay - 90 + 360) % 360).toFixed(0)}°
                {((noonLonDisplay - 90 + 360) % 360 > 180 ? (noonLonDisplay - 90 + 360) % 360 - 360 : (noonLonDisplay - 90 + 360) % 360) >= 0 ? 'E' : 'W'}
              </Typography>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">🌆 昏线</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                {Math.abs((noonLonDisplay + 90 + 360) % 360 > 180 ? (noonLonDisplay + 90 + 360) % 360 - 360 : (noonLonDisplay + 90 + 360) % 360).toFixed(0)}°
                {((noonLonDisplay + 90 + 360) % 360 > 180 ? (noonLonDisplay + 90 + 360) % 360 - 360 : (noonLonDisplay + 90 + 360) % 360) >= 0 ? 'E' : 'W'}
              </Typography>
            </div>
          </div>
        </div>

        {/* 第三步：位置（城市） → 当地昼夜状态 */}
        <div style={{ 
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#10B981', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ 
              background: '#10B981', 
              color: 'white', 
              borderRadius: '50%', 
              width: 20, 
              height: 20, 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700
            }}>3</span>
            位置 → 当地昼夜状态
          </Typography>

          {/* 城市搜索 */}
          <input
            type="text"
            placeholder="🔍 搜索城市..."
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              marginBottom: 8,
              fontSize: 14,
              outline: 'none',
            }}
          />

          {/* 城市列表 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {FAMOUS_CITIES
              .filter(city => citySearch === '' || city.name.includes(citySearch))
              .map((city) => (
                <Chip
                  key={city.name}
                  label={city.name}
                  size="small"
                  onClick={() => setSelectedCity(city)}
                  sx={{
                    background: selectedCity?.name === city.name
                      ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' 
                      : 'rgba(16, 185, 129, 0.1)',
                    color: selectedCity?.name === city.name ? 'white' : '#10B981',
                    fontWeight: selectedCity?.name === city.name ? 600 : 400,
                    fontSize: 11,
                  }}
                />
              ))}
          </div>

          {/* 选中城市的信息 */}
          {selectedCity && cityInfo && (
            <div style={{
              background: 'white',
              borderRadius: 8,
              padding: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  📍 {selectedCity.name}
                </Typography>
                <div style={{
                  background: cityInfo.isDay 
                    ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)' 
                    : 'linear-gradient(135deg, #1E3A5A 0%, #312E81 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {cityInfo.isDay ? '☀️ 白天' : '🌙 黑夜'}
                </div>
              </div>
              
              <div style={{ fontSize: 12, color: '#666' }}>
                <div>经度：{selectedCity.lon.toFixed(1)}°{selectedCity.lon >= 0 ? 'E' : 'W'} | 纬度：{selectedCity.lat.toFixed(1)}°{selectedCity.lat >= 0 ? 'N' : 'S'}</div>
                <div style={{ marginTop: 4 }}>
                  <b style={{ color: '#3B82F6' }}>当地时间：{formatTime(cityInfo.localTime)}</b>
                </div>
                <div style={{ marginTop: 4 }}>
                  昼长：<b style={{ color: '#F59E0B' }}>{formatDayLength(cityInfo.dayLength)}</b>
                </div>
                {cityInfo.sunTimes && (
                  <div style={{ marginTop: 4 }}>
                    日出 <b style={{ color: '#10B981' }}>{formatTime(cityInfo.sunTimes.sunrise)}</b> | 
                    日落 <b style={{ color: '#8B5CF6' }}>{formatTime(cityInfo.sunTimes.sunset)}</b>
                  </div>
                )}
              </div>
            </div>
          )}
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
  utcHour: number;
  setUtcHour: (hour: number) => void;
  viewMode: 'sun' | 'earth';
  setViewMode: (mode: 'sun' | 'earth') => void;
  selectedCity: CityInfo | null;
  setSelectedCity: (city: CityInfo | null) => void;
}

function MobileControlPanel({
  dayOfYear,
  setDayOfYear,
  initialDayOfYear,
  subsolarLat,
  utcHour,
  setUtcHour,
  viewMode,
  setViewMode,
  selectedCity,
  setSelectedCity,
}: MobileControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 计算选中城市的信息
  const cityInfo = useMemo(() => {
    if (!selectedCity) return null;
    const localTime = getLocalTime(utcHour, selectedCity.lon);
    const dayLength = getDayLength(selectedCity.lat, subsolarLat);
    const isDay = isDaytime(localTime, selectedCity.lat, subsolarLat);
    return { localTime, dayLength, isDay };
  }, [selectedCity, utcHour, subsolarLat]);

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
            <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
              {/* 视角模式选择 */}
              <div style={{ marginBottom: 12 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#8B5CF6', mb: 0.5, display: 'block' }}>
                  👁️ 观察视角
                </Typography>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Chip
                    icon={<SunIcon sx={{ fontSize: 14 }} />}
                    label="太阳视角"
                    size="small"
                    onClick={() => setViewMode('sun')}
                    sx={{
                      flex: 1,
                      background: viewMode === 'sun' 
                        ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' 
                        : 'rgba(245, 158, 11, 0.1)',
                      color: viewMode === 'sun' ? 'white' : '#F59E0B',
                      fontWeight: viewMode === 'sun' ? 600 : 400,
                      fontSize: 11,
                      '& .MuiChip-icon': { color: viewMode === 'sun' ? 'white' : '#F59E0B' },
                    }}
                  />
                  <Chip
                    icon={<span style={{ fontSize: 12 }}>🌍</span>}
                    label="地球视角"
                    size="small"
                    onClick={() => setViewMode('earth')}
                    sx={{
                      flex: 1,
                      background: viewMode === 'earth' 
                        ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' 
                        : 'rgba(59, 130, 246, 0.1)',
                      color: viewMode === 'earth' ? 'white' : '#3B82F6',
                      fontWeight: viewMode === 'earth' ? 600 : 400,
                      fontSize: 11,
                    }}
                  />
                </div>
              </div>

              {/* 太阳直射点 */}
              <div style={{ textAlign: 'center', marginBottom: 12, background: 'rgba(251, 191, 36, 0.1)', padding: 8, borderRadius: 8 }}>
                <Typography variant="caption" color="text.secondary">☀️ 太阳直射点纬度</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#F59E0B', lineHeight: 1.2 }}>
                  {formatDegreeMinute(subsolarLat)}
                </Typography>
              </div>

              {/* 日期滑块 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
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

              {/* UTC 时间滑块 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    🕐 UTC {utcHour.toString().padStart(2, '0')}:00
                  </Typography>
                </div>
                <Slider
                  value={utcHour}
                  onChange={(_, v) => setUtcHour(v as number)}
                  min={0}
                  max={23}
                  step={1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 12, label: '12' },
                    { value: 23, label: '23' },
                  ]}
                  sx={{ color: '#3B82F6' }}
                />
              </div>

              {/* 城市选择 */}
              <div style={{ marginBottom: 8 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#10B981', mb: 0.5, display: 'block' }}>
                  📍 选择城市
                </Typography>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {FAMOUS_CITIES.slice(0, 6).map((city) => (
                    <Chip
                      key={city.name}
                      label={city.name}
                      size="small"
                      onClick={() => setSelectedCity(city)}
                      sx={{
                        background: selectedCity?.name === city.name
                          ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' 
                          : 'rgba(16, 185, 129, 0.1)',
                        color: selectedCity?.name === city.name ? 'white' : '#10B981',
                        fontWeight: selectedCity?.name === city.name ? 600 : 400,
                        fontSize: 10,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 选中城市的信息 */}
              {selectedCity && cityInfo && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 8,
                  padding: 8,
                  fontSize: 11,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{selectedCity.name}</span>
                    <span style={{
                      background: cityInfo.isDay ? '#F59E0B' : '#1E3A5A',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: 8,
                      fontSize: 10,
                    }}>
                      {cityInfo.isDay ? '☀️ 白天' : '🌙 黑夜'}
                    </span>
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>
                    当地时间：<b style={{ color: '#3B82F6' }}>{formatTime(cityInfo.localTime)}</b> | 
                    昼长：<b style={{ color: '#F59E0B' }}>{formatDayLength(cityInfo.dayLength)}</b>
                  </div>
                </div>
              )}
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
  onBack,
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
  const [utcHour, setUtcHour] = useState(() => new Date().getUTCHours());
  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(FAMOUS_CITIES[0]);
  
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  // 自动旋转时更新UTC时间（每500ms增加1小时）
  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      setUtcHour(prev => {
        const next = prev + 1;
        return next >= 24 ? 0 : next;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [autoRotate]);

  // 计算太阳直射点纬度
  const subsolarLat = useMemo(() => getSubsolarLatitude(dayOfYear), [dayOfYear]);

  // 处理视角切换，同时移动相机
  const handleViewModeChange = useCallback((mode: 'sun' | 'earth') => {
    setViewMode(mode);
    if (cameraControllerRef.current) {
      if (mode === 'sun') {
        // 太阳视角：从太阳方向看地球（从左前方看，能看到昼夜分界）
        cameraControllerRef.current.setPosition([14, 5, 10]);
      } else {
        // 地球视角：从地球上空俯视（从正上方偏前看）
        cameraControllerRef.current.setPosition([0, 12, 8]);
      }
    }
  }, []);

  // 知识点信息内容 - 使用卡片数组格式
  const infoContent = [
    {
      title: '晨昏线',
      icon: '🌓',
      stars: 3,
      content: (
        <>
          • 晨昏线是昼夜半球的分界线，始终<b>垂直于太阳光线</b><br/><br/>
          • <span style={{color: '#10B981'}}>晨线</span>：由夜半球进入昼半球的界线（日出线）<br/><br/>
          • <span style={{color: '#8B5CF6'}}>昏线</span>：由昼半球进入夜半球的界线（日落线）<br/><br/>
          💡 晨昏线始终平分地球，是一个过地心的大圆
        </>
      ),
    },
    {
      title: '正午线与地方时',
      icon: '🕐',
      stars: 3,
      content: (
        <>
          <b>核心知识点：</b><br/><br/>
          • <span style={{color: '#EF4444'}}>正午线</span>：太阳直射的<b>经线</b>，地方时 = <b>12:00</b><br/><br/>
          • 午夜线：正午线对面180°，地方时 = <b>0:00</b><br/><br/>
          • <span style={{color: '#10B981'}}>晨线</span>：地方时 = <b>6:00</b>（比正午线西90°）<br/><br/>
          • <span style={{color: '#8B5CF6'}}>昏线</span>：地方时 = <b>18:00</b>（比正午线东90°）<br/><br/>
          💡 这三条线相对太阳固定，地球自转时地表经线依次经过它们
        </>
      ),
    },
    {
      title: '地方时计算',
      icon: '🧮',
      stars: 3,
      content: (
        <>
          <b>计算规则：</b><br/><br/>
          • 地方时由<b>经度</b>决定，同一经线上地方时相同<br/><br/>
          • 经度每差<b>15°</b>，时间差<b>1小时</b><br/><br/>
          • 经度每差<b>1°</b>，时间差<b>4分钟</b><br/><br/>
          • <b>东加西减</b>：东边时间早，西边时间晚<br/><br/>
          <b>公式：</b><br/>
          所求地方时 = 已知地方时 ± 经度差×4分钟
        </>
      ),
    },
    {
      title: '太阳直射点移动',
      icon: '☀️',
      stars: 2,
      content: (
        <>
          <b>全年移动规律：</b><br/><br/>
          • 春分(3/21)→夏至(6/22)：<b>向北</b>移动<br/><br/>
          • 夏至(6/22)→秋分(9/23)：<b>向南</b>移动<br/><br/>
          • 秋分(9/23)→冬至(12/22)：<b>向南</b>移动<br/><br/>
          • 冬至(12/22)→春分(3/21)：<b>向北</b>移动<br/><br/>
          💡 直射点在南北回归线之间往返移动
        </>
      ),
    },
    {
      title: '昼夜长短变化',
      icon: '🌗',
      stars: 3,
      content: (
        <>
          <b>变化规律：</b><br/><br/>
          • 太阳直射点在哪个半球，该半球<b>昼长夜短</b><br/><br/>
          • 纬度越高，昼夜长短变化越大<br/><br/>
          • <b>赤道</b>上全年昼夜平分（12小时）<br/><br/>
          • <b>极圈内</b>有极昼极夜现象<br/><br/>
          💡 夏至日北半球白昼最长，冬至日白昼最短
        </>
      ),
    },
    {
      title: '特殊纬度',
      icon: '🌐',
      stars: 1,
      content: (
        <>
          <b>回归线（23°26′）：</b><br/>
          太阳直射的最北/最南界限<br/><br/>
          <b>极圈（66°34′）：</b><br/>
          极昼极夜的最低纬度<br/><br/>
          <b>记忆技巧：</b><br/>
          回归线 + 极圈 = 90°<br/>
          23°26′ + 66°34′ = 90°
        </>
      ),
    },
  ];

  return (
    <AnimationPageLayout
      onBack={onBack}
      pageTitle="昼夜与晨昏线"
      backButtonColor="#F59E0B"
      infoAccentColor="#F59E0B"
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas camera={{ position: [14, 5, 10], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <Scene
              showLabels={showLabels}
              subsolarLat={subsolarLat}
              showDawnLine={showDawnLine}
              showDuskLine={showDuskLine}
              showNoonLine={showNoonLine}
              showShading={showShading}
              showSun={showSun}
              showSunRays={showSunRays}
              viewMode={viewMode}
              cameraRef={cameraControllerRef}
              utcHour={utcHour}
              selectedCity={selectedCity}
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
          utcHour={utcHour}
          setUtcHour={setUtcHour}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          showDawnLine={showDawnLine}
          setShowDawnLine={setShowDawnLine}
          showDuskLine={showDuskLine}
          setShowDuskLine={setShowDuskLine}
          showNoonLine={showNoonLine}
          setShowNoonLine={setShowNoonLine}
          showShading={showShading}
          setShowShading={setShowShading}
          viewMode={viewMode}
          setViewMode={handleViewModeChange}
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
          utcHour={utcHour}
          setUtcHour={setUtcHour}
          viewMode={viewMode}
          setViewMode={handleViewModeChange}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
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
