/**
 * 时区 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 帮助学生理解：
 * 1. 时区的划分（每15°经度为一个时区）
 * 2. 地方时与区时的区别
 * 3. 时差计算（东加西减）
 * 4. 国际日期变更线
 * 5. 东西半球的划分
 */

import { useRef, useState, useMemo, Suspense, useCallback } from 'react';
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
  CompareArrows as CompareIcon,
} from '@mui/icons-material';

// 导入公共组件和工具
import {
  ASTRONOMY_COLORS,
} from '../../shared/constants';
import {
  CameraController,
  LatitudeLine,
  AnimationPageLayout,
  SceneLoading,
  type CameraControllerHandle,
} from '../../shared/components';

// ===================== 类型定义 =====================

interface TimeZoneDemo3DProps {
  initialLongitude?: number;
}

// ===================== 常量 =====================

const COLORS = {
  ...ASTRONOMY_COLORS,
  primeMeridian: '#EF4444',      // 本初子午线 - 红色
  eastLongitude: '#3B82F6',      // 东经 - 蓝色
  westLongitude: '#F59E0B',      // 西经 - 橙色
  dateLine: '#8B5CF6',           // 国际日期变更线 - 紫色
  selectedZone: '#10B981',       // 选中的时区 - 绿色
  dayNight: '#1E293B',           // 昼夜分界
  easternHemisphere: '#3B82F6',  // 东半球 - 蓝色
  westernHemisphere: '#F59E0B',  // 西半球 - 橙色
  timeZoneLine: '#6366F1',       // 时区线 - 紫色
};

/** 格式化经度 */
const formatLongitude = (value: number): string => {
  const absValue = Math.abs(value);
  const degrees = Math.floor(absValue);
  
  if (Math.abs(value) < 0.01) {
    return "0°（本初子午线）";
  }
  if (Math.abs(Math.abs(value) - 180) < 0.01) {
    return "180°（日期变更线）";
  }
  
  const direction = value > 0 ? 'E' : 'W';
  return `${degrees}°${direction}`;
};

/** 获取时区名称 */
const getTimeZoneName = (zone: number): string => {
  if (zone === 0) return 'UTC/GMT';
  const sign = zone > 0 ? '+' : '';
  return `UTC${sign}${zone}`;
};

/** 判断经度是否在东半球 */
const isEasternHemisphere = (longitude: number): boolean => {
  // 东半球：20°W → 0° → 160°E
  if (longitude >= -20 && longitude <= 160) return true;
  return false;
};

/** 著名城市及其经纬度和时区 */
const TIMEZONE_CITIES = [
  { name: '伦敦', longitude: 0, latitude: 51.5, emoji: '🇬🇧', timezone: 0, description: 'UTC+0 格林尼治标准时间' },
  { name: '巴黎', longitude: 2.3, latitude: 48.9, emoji: '🇫🇷', timezone: 1, description: 'UTC+1 中欧时间' },
  { name: '开罗', longitude: 31.2, latitude: 30.0, emoji: '🇪🇬', timezone: 2, description: 'UTC+2 东欧时间' },
  { name: '莫斯科', longitude: 37.6, latitude: 55.8, emoji: '🇷🇺', timezone: 3, description: 'UTC+3 莫斯科时间' },
  { name: '迪拜', longitude: 55.3, latitude: 25.3, emoji: '🇦🇪', timezone: 4, description: 'UTC+4 海湾标准时间' },
  { name: '新德里', longitude: 77.2, latitude: 28.6, emoji: '🇮🇳', timezone: 5.5, description: 'UTC+5:30 印度标准时间' },
  { name: '曼谷', longitude: 100.5, latitude: 13.8, emoji: '🇹🇭', timezone: 7, description: 'UTC+7 印度支那时间' },
  { name: '北京', longitude: 116.4, latitude: 39.9, emoji: '🇨🇳', timezone: 8, description: 'UTC+8 北京时间' },
  { name: '东京', longitude: 139.7, latitude: 35.7, emoji: '🇯🇵', timezone: 9, description: 'UTC+9 日本标准时间' },
  { name: '悉尼', longitude: 151.2, latitude: -33.9, emoji: '🇦🇺', timezone: 10, description: 'UTC+10 澳大利亚东部时间' },
  { name: '惠灵顿', longitude: 174.8, latitude: -41.3, emoji: '🇳🇿', timezone: 12, description: 'UTC+12 新西兰标准时间' },
  { name: '檀香山', longitude: -157.9, latitude: 21.3, emoji: '🇺🇸', timezone: -10, description: 'UTC-10 夏威夷时间' },
  { name: '洛杉矶', longitude: -118.2, latitude: 34.0, emoji: '🇺🇸', timezone: -8, description: 'UTC-8 太平洋时间' },
  { name: '丹佛', longitude: -104.9, latitude: 39.7, emoji: '🇺🇸', timezone: -7, description: 'UTC-7 山地时间' },
  { name: '芝加哥', longitude: -87.6, latitude: 41.9, emoji: '🇺🇸', timezone: -6, description: 'UTC-6 中部时间' },
  { name: '纽约', longitude: -74.0, latitude: 40.7, emoji: '🇺🇸', timezone: -5, description: 'UTC-5 东部时间' },
  { name: '里约', longitude: -43.2, latitude: -22.9, emoji: '🇧🇷', timezone: -3, description: 'UTC-3 巴西利亚时间' },
];

// ===================== 3D 组件 =====================

/** 时区线组件 */
function TimeZoneLine({ 
  longitude, 
  color, 
  lineWidth = 1,
  dashed = false,
  isSelected = false,
}: { 
  longitude: number; 
  color: string;
  lineWidth?: number;
  dashed?: boolean;
  isSelected?: boolean;
}) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const lonRad = (longitude * Math.PI) / 180;
    const radius = 2.01;
    
    for (let lat = -90; lat <= 90; lat += 2) {
      const latRad = (lat * Math.PI) / 180;
      pts.push([
        Math.cos(latRad) * Math.cos(lonRad) * radius,
        Math.sin(latRad) * radius,
        -Math.cos(latRad) * Math.sin(lonRad) * radius,
      ]);
    }
    return pts;
  }, [longitude]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={isSelected ? lineWidth * 2 : lineWidth}
      dashed={dashed}
      dashSize={0.1}
      gapSize={0.05}
    />
  );
}

/** 时区标签组件 */
function TimeZoneLabel({ 
  longitude, 
  zone,
  showLabel,
}: { 
  longitude: number;
  zone: number;
  showLabel: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();
  
  const lonRad = (longitude * Math.PI) / 180;
  const radius = 2.3;
  
  const position: [number, number, number] = [
    Math.cos(lonRad) * radius,
    0,
    -Math.sin(lonRad) * radius,
  ];

  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      const dot = normal.dot(toCamera);
      setIsVisible(dot > 0.1);
    }
  });

  if (!showLabel || !isVisible) return <group ref={groupRef} position={position} />;

  return (
    <group ref={groupRef} position={position}>
      <Html center>
        <div style={{
          background: 'rgba(99, 102, 241, 0.9)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {zone >= 0 ? `+${zone}` : zone}
        </div>
      </Html>
    </group>
  );
}

/** 经线标签组件 - 带可见性检测 */
function MeridianLabel({ 
  longitude, 
  label,
  color,
  showLabel,
  yOffset = 0.5,
}: { 
  longitude: number;
  label: string;
  color: string;
  showLabel: boolean;
  yOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();
  
  const lonRad = (longitude * Math.PI) / 180;
  const radius = 2.3;
  
  const position: [number, number, number] = [
    Math.cos(lonRad) * radius,
    yOffset,
    -Math.sin(lonRad) * radius,
  ];

  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      const dot = normal.dot(toCamera);
      setIsVisible(dot > 0.1);
    }
  });

  if (!showLabel || !isVisible) return <group ref={groupRef} position={position} />;

  return (
    <group ref={groupRef} position={position}>
      <Html center>
        <div style={{
          background: color,
          color: 'white',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/** 东西半球分界线 */
function HemisphereDividers({ showLabels }: { showLabels: boolean }) {
  // 20°W 和 160°E 是东西半球分界线
  return (
    <>
      <TimeZoneLine longitude={-20} color={COLORS.westernHemisphere} lineWidth={2} />
      <TimeZoneLine longitude={160} color={COLORS.easternHemisphere} lineWidth={2} />
      
      {showLabels && (
        <>
          <group position={[Math.cos((-20 * Math.PI) / 180) * 2.4, 1.5, -Math.sin((-20 * Math.PI) / 180) * 2.4]}>
            <Html center>
              <div style={{
                background: 'rgba(245, 158, 11, 0.9)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 9,
                whiteSpace: 'nowrap',
              }}>
                20°W 西半球界
              </div>
            </Html>
          </group>
          <group position={[Math.cos((160 * Math.PI) / 180) * 2.4, 1.5, -Math.sin((160 * Math.PI) / 180) * 2.4]}>
            <Html center>
              <div style={{
                background: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 9,
                whiteSpace: 'nowrap',
              }}>
                160°E 东半球界
              </div>
            </Html>
          </group>
        </>
      )}
    </>
  );
}

/** 城市标记组件 */
function CityMarker({ 
  longitude, 
  latitude,
  name, 
  emoji,
  isSelected,
  showLabel,
  onClick,
}: { 
  longitude: number; 
  latitude: number;
  name: string;
  emoji: string;
  isSelected: boolean;
  showLabel: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();
  
  const lonRad = (longitude * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;
  const radius = 2.02;
  
  const position: [number, number, number] = [
    Math.cos(latRad) * Math.cos(lonRad) * radius,
    Math.sin(latRad) * radius,
    -Math.cos(latRad) * Math.sin(lonRad) * radius,
  ];

  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      const dot = normal.dot(toCamera);
      setIsVisible(dot > -0.1);
    }
  });

  if (!isVisible) {
    return <group ref={groupRef} position={position} />;
  }

  if (!showLabel && !isSelected) {
    return (
      <group ref={groupRef} position={position}>
        <mesh>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" opacity={0.5} transparent />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <sphereGeometry args={[isSelected ? 0.1 : 0.06, 16, 16]} />
        <meshBasicMaterial color={isSelected ? COLORS.selectedZone : '#FFFFFF'} />
      </mesh>
      
      <Html position={[0, 0.2, 0]} center occlude={false}>
        <div 
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            background: isSelected 
              ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)' 
              : 'rgba(15, 23, 42, 0.85)',
            color: 'white',
            padding: isSelected ? '4px 10px' : '2px 8px',
            borderRadius: 8,
            fontSize: isSelected ? 12 : 10,
            fontWeight: isSelected ? 600 : 400,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            border: isSelected ? '2px solid white' : 'none',
            boxShadow: isSelected ? '0 2px 10px rgba(16, 185, 129, 0.5)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {emoji} {name}
        </div>
      </Html>
    </group>
  );
}

/** 地球组件 */
interface EarthProps {
  showLabels: boolean;
  autoRotate: boolean;
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onCityClick: (name: string) => void;
  targetLongitude: number | null;
  showTimeZones: boolean;
  showHemispheres: boolean;
}

function Earth({ 
  showLabels, 
  autoRotate,
  cities,
  selectedCity,
  compareCity,
  onCityClick,
  targetLongitude,
  showTimeZones,
  showHemispheres,
}: EarthProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const initialRotation = targetLongitude !== null ? -targetLongitude * Math.PI / 180 : 0;
  const targetRotationRef = useRef<number>(initialRotation);
  const isAnimatingRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  useMemo(() => {
    if (targetLongitude !== null) {
      targetRotationRef.current = -targetLongitude * Math.PI / 180;
      if (hasInitializedRef.current) {
        isAnimatingRef.current = true;
      }
    }
  }, [targetLongitude]);

  useFrame(({ clock }) => {
    if (earthGroupRef.current) {
      if (!hasInitializedRef.current) {
        earthGroupRef.current.rotation.y = targetRotationRef.current;
        hasInitializedRef.current = true;
        return;
      }
      
      if (autoRotate && !isAnimatingRef.current) {
        earthGroupRef.current.rotation.y = clock.elapsedTime * 0.1;
      } else if (isAnimatingRef.current) {
        const currentRotation = earthGroupRef.current.rotation.y;
        const targetRotation = targetRotationRef.current;
        
        let diff = targetRotation - currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        const speed = 0.08;
        if (Math.abs(diff) > 0.01) {
          earthGroupRef.current.rotation.y += diff * speed;
        } else {
          earthGroupRef.current.rotation.y = targetRotation;
          isAnimatingRef.current = false;
        }
      }
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
            emissiveIntensity={0.25}
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

        {/* 赤道 */}
        <LatitudeLine 
          latitude={0} 
          radius={2.01} 
          color={COLORS.equator} 
          label="赤道 0°"
          showLabel={false}
        />

        {/* 本初子午线 */}
        <TimeZoneLine longitude={0} color={COLORS.primeMeridian} lineWidth={3} />
        <MeridianLabel 
          longitude={0} 
          label="0° 本初子午线" 
          color="rgba(239, 68, 68, 0.9)"
          showLabel={showLabels}
        />

        {/* 国际日期变更线 */}
        <TimeZoneLine longitude={180} color={COLORS.dateLine} lineWidth={2} dashed />
        <MeridianLabel 
          longitude={180} 
          label="180° 日期变更线" 
          color="rgba(139, 92, 246, 0.9)"
          showLabel={showLabels}
        />

        {/* 时区线 - 每15度一条 */}
        {showTimeZones && (
          <>
            {[-165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map(lon => (
              <TimeZoneLine 
                key={lon}
                longitude={lon} 
                color={COLORS.timeZoneLine}
                lineWidth={1}
                dashed
              />
            ))}
            {/* 时区标签 */}
            {[-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(zone => (
              <TimeZoneLabel 
                key={zone}
                longitude={zone * 15} 
                zone={zone}
                showLabel={showLabels}
              />
            ))}
          </>
        )}

        {/* 东西半球分界线 */}
        {showHemispheres && <HemisphereDividers showLabels={showLabels} />}

        {/* 城市标记 */}
        {cities.map(city => (
          <CityMarker
            key={city.name}
            longitude={city.longitude}
            latitude={city.latitude}
            name={city.name}
            emoji={city.emoji}
            isSelected={selectedCity === city.name || compareCity === city.name}
            showLabel={showLabels}
            onClick={() => onCityClick(city.name)}
          />
        ))}
      </group>
    </group>
  );
}

/** 场景组件 */
interface SceneProps {
  showLabels: boolean;
  autoRotate: boolean;
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onCityClick: (name: string) => void;
  cameraRef: React.RefObject<CameraControllerHandle>;
  targetLongitude: number | null;
  showTimeZones: boolean;
  showHemispheres: boolean;
}

function Scene({ 
  showLabels, 
  autoRotate,
  cities,
  selectedCity,
  compareCity,
  onCityClick,
  cameraRef,
  targetLongitude,
  showTimeZones,
  showHemispheres,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 3, 5]} intensity={2.0} />
      <directionalLight position={[-3, 2, -3]} intensity={0.8} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      <Suspense fallback={null}>
        <Earth 
          showLabels={showLabels}
          autoRotate={autoRotate}
          cities={cities}
          selectedCity={selectedCity}
          compareCity={compareCity}
          onCityClick={onCityClick}
          targetLongitude={targetLongitude}
          showTimeZones={showTimeZones}
          showHemispheres={showHemispheres}
        />
      </Suspense>
      
      <CameraController ref={cameraRef} defaultPosition={[8, 2, 0]} />
    </>
  );
}

// ===================== 2D 视图 =====================

function TwoDView({ 
  cities,
  selectedCity,
  compareCity,
  onCityClick,
}: { 
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onCityClick: (name: string) => void;
}) {
  const width = 400;
  const height = 200;
  const padding = 20;
  
  const lonToX = (lon: number) => {
    return padding + ((lon + 180) / 360) * (width - 2 * padding);
  };

  return (
    <svg width={width} height={height} style={{ background: 'rgba(15, 23, 42, 0.9)', borderRadius: 8 }}>
      {/* 背景网格 - 时区线 */}
      {Array.from({ length: 25 }, (_, i) => i * 15 - 180).map(lon => (
        <g key={lon}>
          <line
            x1={lonToX(lon)}
            y1={padding}
            x2={lonToX(lon)}
            y2={height - padding}
            stroke={lon === 0 ? COLORS.primeMeridian : lon === 180 || lon === -180 ? COLORS.dateLine : '#374151'}
            strokeWidth={lon === 0 ? 2 : 1}
            strokeDasharray={lon !== 0 && lon !== 180 && lon !== -180 ? '4,4' : undefined}
          />
          {lon % 30 === 0 && (
            <text
              x={lonToX(lon)}
              y={height - 5}
              fill="#9CA3AF"
              fontSize={8}
              textAnchor="middle"
            >
              {lon === 0 ? '0°' : lon === 180 ? '180°' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`}
            </text>
          )}
        </g>
      ))}

      {/* 东西半球分界线 */}
      <line
        x1={lonToX(-20)}
        y1={padding}
        x2={lonToX(-20)}
        y2={height - padding}
        stroke={COLORS.westernHemisphere}
        strokeWidth={2}
      />
      <line
        x1={lonToX(160)}
        y1={padding}
        x2={lonToX(160)}
        y2={height - padding}
        stroke={COLORS.easternHemisphere}
        strokeWidth={2}
      />
      
      {/* 纬度线 */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke={COLORS.equator}
        strokeWidth={1}
      />

      {/* 城市标记 */}
      {cities.map(city => {
        const x = lonToX(city.longitude);
        const y = height / 2 - (city.latitude / 90) * (height / 2 - padding);
        const isSelected = selectedCity === city.name || compareCity === city.name;
        
        return (
          <g key={city.name} onClick={() => onCityClick(city.name)} style={{ cursor: 'pointer' }}>
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 6 : 4}
              fill={isSelected ? COLORS.selectedZone : '#FFFFFF'}
              stroke={isSelected ? '#FFFFFF' : 'none'}
              strokeWidth={2}
            />
            {isSelected && (
              <text
                x={x}
                y={y - 10}
                fill="#FFFFFF"
                fontSize={10}
                textAnchor="middle"
                fontWeight="bold"
              >
                {city.emoji} {city.name}
              </text>
            )}
          </g>
        );
      })}

      {/* 图例 */}
      <g transform="translate(10, 10)">
        <rect width={80} height={55} fill="rgba(0,0,0,0.5)" rx={4} />
        <circle cx={10} cy={12} r={4} fill={COLORS.primeMeridian} />
        <text x={20} y={16} fill="#FFFFFF" fontSize="9">本初子午线</text>
        <circle cx={10} cy={28} r={4} fill={COLORS.dateLine} />
        <text x={20} y={32} fill="#FFFFFF" fontSize="9">日期变更线</text>
        <circle cx={10} cy={44} r={4} fill={COLORS.selectedZone} />
        <text x={20} y={48} fill="#FFFFFF" fontSize="9">选中城市</text>
      </g>
    </svg>
  );
}

// ===================== 时差计算器组件 =====================

function TimeDiffCalculator({
  cities,
  selectedCity,
  compareCity,
  onSelectCity,
  onSelectCompareCity,
  utcHour,
}: {
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onSelectCity: (name: string) => void;
  onSelectCompareCity: (name: string) => void;
  utcHour: number;
}) {
  const city1 = cities.find(c => c.name === selectedCity);
  const city2 = cities.find(c => c.name === compareCity);

  const getTimeForCity = (city: typeof TIMEZONE_CITIES[0]) => {
    let hour = utcHour + city.timezone;
    while (hour < 0) hour += 24;
    while (hour >= 24) hour -= 24;
    return `${Math.floor(hour).toString().padStart(2, '0')}:00`;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#6366F1', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CompareIcon fontSize="small" /> 时差计算器
      </Typography>

      {/* 城市1 */}
      <div style={{ marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary">城市 A</Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {cities.slice(0, 8).map(city => (
            <Chip
              key={city.name}
              label={`${city.emoji} ${city.name}`}
              size="small"
              onClick={() => onSelectCity(city.name)}
              sx={{
                background: selectedCity === city.name 
                  ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' 
                  : 'rgba(59, 130, 246, 0.1)',
                color: selectedCity === city.name ? 'white' : '#3B82F6',
                fontWeight: selectedCity === city.name ? 600 : 400,
                fontSize: 10,
              }}
            />
          ))}
        </div>
      </div>

      {/* 城市2 */}
      <div style={{ marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary">城市 B</Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {cities.slice(0, 8).map(city => (
            <Chip
              key={city.name}
              label={`${city.emoji} ${city.name}`}
              size="small"
              onClick={() => onSelectCompareCity(city.name)}
              sx={{
                background: compareCity === city.name 
                  ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' 
                  : 'rgba(245, 158, 11, 0.1)',
                color: compareCity === city.name ? 'white' : '#F59E0B',
                fontWeight: compareCity === city.name ? 600 : 400,
                fontSize: 10,
              }}
            />
          ))}
        </div>
      </div>

      {/* 计算结果 */}
      {city1 && city2 && (
        <div style={{
          background: 'white',
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{city1.emoji} {city1.name}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#3B82F6' }}>
                {getTimeForCity(city1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">{getTimeZoneName(city1.timezone)}</Typography>
            </div>
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <CompareIcon sx={{ color: '#9CA3AF' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981' }}>
                {Math.abs(city1.timezone - city2.timezone)}小时
              </Typography>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{city2.emoji} {city2.name}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                {getTimeForCity(city2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">{getTimeZoneName(city2.timezone)}</Typography>
            </div>
          </div>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            {city1.timezone > city2.timezone 
              ? `${city1.name}比${city2.name}早${city1.timezone - city2.timezone}小时`
              : city1.timezone < city2.timezone 
              ? `${city2.name}比${city1.name}早${city2.timezone - city1.timezone}小时`
              : '两城市处于同一时区'}
          </Typography>
        </div>
      )}
    </div>
  );
}

// ===================== 控制面板 =====================

interface ControlPanelProps {
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onCityClick: (name: string) => void;
  onCompareCityClick: (name: string) => void;
  utcHour: number;
  setUtcHour: (hour: number) => void;
  showTimeZones: boolean;
  setShowTimeZones: (show: boolean) => void;
  showHemispheres: boolean;
  setShowHemispheres: (show: boolean) => void;
}

function ControlPanel({
  cities,
  selectedCity,
  compareCity,
  onCityClick,
  onCompareCityClick,
  utcHour,
  setUtcHour,
  showTimeZones,
  setShowTimeZones,
  showHemispheres,
  setShowHemispheres,
}: ControlPanelProps) {
  const selectedCityData = cities.find(c => c.name === selectedCity);

  return (
    <Card sx={{ 
      background: 'rgba(255,255,255,0.95)', 
      backdropFilter: 'blur(10px)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ flex: 1, overflow: 'auto' }}>
        {/* 标题 */}
        <Typography variant="h6" sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}>
          🕐 时区探索
        </Typography>

        {/* UTC时间控制 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <Typography variant="caption" color="text.secondary">UTC/GMT 时间</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#6366F1' }}>
            {utcHour.toString().padStart(2, '0')}:00
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
            sx={{ color: '#6366F1', mt: 1 }}
          />
        </div>

        {/* 显示选项 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            显示选项
          </Typography>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip
              label="时区线"
              size="small"
              onClick={() => setShowTimeZones(!showTimeZones)}
              sx={{
                background: showTimeZones ? '#6366F1' : 'rgba(99, 102, 241, 0.1)',
                color: showTimeZones ? 'white' : '#6366F1',
              }}
            />
            <Chip
              label="东西半球"
              size="small"
              onClick={() => setShowHemispheres(!showHemispheres)}
              sx={{
                background: showHemispheres ? '#6366F1' : 'rgba(99, 102, 241, 0.1)',
                color: showHemispheres ? 'white' : '#6366F1',
              }}
            />
          </div>
        </div>

        {/* 时差计算器 */}
        <TimeDiffCalculator
          cities={cities}
          selectedCity={selectedCity}
          compareCity={compareCity}
          onSelectCity={onCityClick}
          onSelectCompareCity={onCompareCityClick}
          utcHour={utcHour}
        />

        {/* 选中城市信息 */}
        {selectedCityData && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            borderLeft: '3px solid #10B981',
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#10B981' }}>
              {selectedCityData.emoji} {selectedCityData.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              经度：{formatLongitude(selectedCityData.longitude)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              时区：{getTimeZoneName(selectedCityData.timezone)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              半球：{isEasternHemisphere(selectedCityData.longitude) ? '东半球' : '西半球'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedCityData.description}
            </Typography>
          </div>
        )}

        {/* 知识卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
          borderRadius: 8,
          padding: 12,
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#6366F1', mb: 1 }}>
            📚 时区知识点
          </Typography>
          <Typography variant="caption" component="div" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            • <b>时区划分</b>：全球分为24个时区，每个时区跨经度15°<br/>
            • <b>区时计算</b>：东加西减，每差1个时区相差1小时<br/>
            • <b>日期变更线</b>：大致沿180°经线，向东过线减一天<br/>
            • <b>东半球</b>：20°W → 0° → 160°E<br/>
            • <b>西半球</b>：160°E → 180° → 20°W
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== 移动端控制面板 =====================

interface MobileControlPanelProps {
  cities: typeof TIMEZONE_CITIES;
  selectedCity: string | null;
  compareCity: string | null;
  onCityClick: (name: string) => void;
  utcHour: number;
  setUtcHour: (hour: number) => void;
}

function MobileControlPanel({
  cities,
  selectedCity,
  compareCity,
  onCityClick,
  utcHour,
  setUtcHour,
}: MobileControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedCityData = cities.find(c => c.name === selectedCity);
  const compareCityData = cities.find(c => c.name === compareCity);

  const getTimeForCity = (city: typeof TIMEZONE_CITIES[0]) => {
    let hour = utcHour + city.timezone;
    while (hour < 0) hour += 24;
    while (hour >= 24) hour -= 24;
    return `${Math.floor(hour).toString().padStart(2, '0')}:00`;
  };

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
          background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
          borderRadius: 20,
          padding: '4px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
        }}>
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
            {isExpanded ? '收起' : '时区控制'}
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
              {/* UTC时间 */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Typography variant="caption" color="text.secondary">UTC时间</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#6366F1' }}>
                  {utcHour.toString().padStart(2, '0')}:00
                </Typography>
                <Slider
                  value={utcHour}
                  onChange={(_, v) => setUtcHour(v as number)}
                  min={0}
                  max={23}
                  step={1}
                  sx={{ color: '#6366F1' }}
                />
              </div>

              {/* 城市选择 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {cities.slice(0, 10).map(city => (
                  <Chip
                    key={city.name}
                    label={`${city.emoji} ${city.name}`}
                    size="small"
                    onClick={() => onCityClick(city.name)}
                    sx={{
                      background: selectedCity === city.name 
                        ? 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)' 
                        : 'rgba(99, 102, 241, 0.1)',
                      color: selectedCity === city.name ? 'white' : '#6366F1',
                      fontWeight: selectedCity === city.name ? 600 : 400,
                    }}
                  />
                ))}
              </div>

              {/* 时差显示 */}
              {selectedCityData && compareCityData && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Typography variant="caption">{selectedCityData.emoji} {selectedCityData.name}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#6366F1' }}>
                        {getTimeForCity(selectedCityData)}
                      </Typography>
                    </div>
                    <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
                      差{Math.abs(selectedCityData.timezone - compareCityData.timezone)}h
                    </Typography>
                    <div style={{ textAlign: 'center' }}>
                      <Typography variant="caption">{compareCityData.emoji} {compareCityData.name}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                        {getTimeForCity(compareCityData)}
                      </Typography>
                    </div>
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

export default function TimeZoneDemo3D({
  initialLongitude = 116.4,
}: TimeZoneDemo3DProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>('北京');
  const [compareCity, setCompareCity] = useState<string | null>('纽约');
  const [targetLongitude, setTargetLongitude] = useState<number | null>(initialLongitude);
  const [utcHour, setUtcHour] = useState(12);
  const [showTimeZones, setShowTimeZones] = useState(true);
  const [showHemispheres, setShowHemispheres] = useState(false);
  
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  const handleCityClick = useCallback((name: string) => {
    const city = TIMEZONE_CITIES.find(c => c.name === name);
    if (city) {
      setSelectedCity(name);
      setTargetLongitude(city.longitude);
      cameraControllerRef.current?.reset();
    }
  }, []);

  const handleCompareCityClick = useCallback((name: string) => {
    setCompareCity(name);
  }, []);

  // 知识点信息内容
  const infoContent = (
    <>
      <Typography variant="h6" gutterBottom sx={{ color: '#6366F1' }}>
        📚 时区与时差（高考重点）
      </Typography>
      <Typography variant="body2" component="div" sx={{ lineHeight: 2 }}>
        <b>1. 地方时计算 ⭐⭐⭐</b><br/>
        • 经度每差15° → 时差1小时<br/>
        • 经度每差1° → 时差4分钟<br/>
        • <span style={{color: '#EF4444'}}>公式：所求地方时 = 已知地方时 ± 经度差×4分钟</span><br/>
        • 东加西减：往东时间早，往西时间晚<br/><br/>
        
        <b>2. 区时计算 ⭐⭐⭐</b><br/>
        • 时区划分：全球24个时区，每15°为一个时区<br/>
        • <span style={{color: '#EF4444'}}>中央经线 = 时区数 × 15°</span><br/>
        • <span style={{color: '#3B82F6'}}>北京时间 = 东八区区时（120°E）</span><br/>
        • 公式：所求区时 = 已知区时 ± 时区差<br/><br/>
        
        <b>3. 日期变更 ⭐⭐</b><br/>
        • <span style={{color: '#8B5CF6'}}>国际日界线</span>：大致沿180°经线<br/>
        • <span style={{color: '#10B981'}}>自然日界线</span>：0时/24时所在经线<br/>
        • 向东过国际日界线：日期<b>减</b>一天<br/>
        • 向西过国际日界线：日期<b>加</b>一天<br/>
        • 全球日期分布：两条日界线将地球分成"今天"和"昨天"<br/><br/>
        
        <b>4. 东西半球划分 ⭐</b><br/>
        • 东半球：20°W → 0° → 160°E<br/>
        • 西半球：160°E → 180° → 20°W<br/>
        • <span style={{color: '#EF4444'}}>注意：不是以0°和180°划分！</span>
      </Typography>
    </>
  );

  return (
    <AnimationPageLayout
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas camera={{ position: [8, 2, 0], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <Scene
              showLabels={showLabels}
              autoRotate={autoRotate}
              cities={TIMEZONE_CITIES}
              selectedCity={selectedCity}
              compareCity={compareCity}
              onCityClick={handleCityClick}
              cameraRef={cameraControllerRef}
              targetLongitude={targetLongitude}
              showTimeZones={showTimeZones}
              showHemispheres={showHemispheres}
            />
          </Canvas>
        </Suspense>
      }
      scene2D={
        <TwoDView
          cities={TIMEZONE_CITIES}
          selectedCity={selectedCity}
          compareCity={compareCity}
          onCityClick={handleCityClick}
        />
      }
      controlPanel={
        <ControlPanel
          cities={TIMEZONE_CITIES}
          selectedCity={selectedCity}
          compareCity={compareCity}
          onCityClick={handleCityClick}
          onCompareCityClick={handleCompareCityClick}
          utcHour={utcHour}
          setUtcHour={setUtcHour}
          showTimeZones={showTimeZones}
          setShowTimeZones={setShowTimeZones}
          showHemispheres={showHemispheres}
          setShowHemispheres={setShowHemispheres}
        />
      }
      mobileControlPanel={
        <MobileControlPanel
          cities={TIMEZONE_CITIES}
          selectedCity={selectedCity}
          compareCity={compareCity}
          onCityClick={handleCityClick}
          utcHour={utcHour}
          setUtcHour={setUtcHour}
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
                  sx={{ color: showLabels ? '#4ADE80' : 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                >
                  {showLabels ? <LabelIcon /> : <LabelOffIcon />}
                </IconButton>
              </Tooltip>
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
        </>
      )}
      infoContent={infoContent}
      controlHint={(mobile) => mobile ? '👆 拖拽旋转 | 双指缩放' : '🖱️ 拖拽旋转 | 滚轮缩放'}
    />
  );
}
