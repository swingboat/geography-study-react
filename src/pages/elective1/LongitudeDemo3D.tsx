/**
 * 经度 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 帮助学生理解：
 * 1. 经度的定义（本初子午线为0°）
 * 2. 东经和西经的概念
 * 3. 不同地区的经度位置
 * 4. 经度与时区的关系
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
  TextField,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  RestartAlt as ResetIcon,
  Label as LabelIcon,
  LabelOff as LabelOffIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
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

interface LongitudeDemo3DProps {
  initialLongitude?: number;
}

// ===================== 常量 =====================

const COLORS = {
  ...ASTRONOMY_COLORS,
  primeMeridian: '#EF4444',      // 本初子午线 - 红色
  eastLongitude: '#3B82F6',      // 东经 - 蓝色
  westLongitude: '#F59E0B',      // 西经 - 橙色
  selectedMeridian: '#10B981',   // 选中的经线 - 绿色
  dateLine: '#8B5CF6',           // 国际日期变更线 - 紫色
  equator: '#10B981',            // 赤道 - 绿色
  tropicOfCancer: '#F97316',     // 北回归线 - 橙色
  tropicOfCapricorn: '#F97316',  // 南回归线 - 橙色
  arcticCircle: '#06B6D4',       // 北极圈 - 青色
  antarcticCircle: '#06B6D4',    // 南极圈 - 青色
  latitudeLine: '#94A3B8',       // 普通纬度线 - 灰色
};

/** 格式化经度 */
const formatLongitude = (value: number): string => {
  const absValue = Math.abs(value);
  const degrees = Math.floor(absValue);
  const minutes = Math.round((absValue - degrees) * 60);
  
  if (Math.abs(value) < 0.01) {
    return "0°（本初子午线）";
  }
  if (Math.abs(Math.abs(value) - 180) < 0.01) {
    return "180°（国际日期变更线）";
  }
  
  const direction = value > 0 ? 'E' : 'W';
  return `${degrees}°${minutes > 0 ? minutes + "′" : ""}${direction}`;
};

/** 著名城市及其经纬度 - 覆盖每15度经度 */
const FAMOUS_CITIES = [
  // 0° 本初子午线
  { name: '伦敦', longitude: 0, latitude: 51.5, emoji: '🇬🇧', description: '本初子午线穿过格林尼治天文台' },
  // 15°E
  { name: '罗马', longitude: 12.5, latitude: 41.9, emoji: '🇮🇹', description: '东一区，UTC+1' },
  { name: '奥斯陆', longitude: 10.8, latitude: 59.9, emoji: '🇳🇴', description: '东一区，UTC+1' },
  // 30°E
  { name: '开罗', longitude: 31.2, latitude: 30.0, emoji: '🇪🇬', description: '东二区，UTC+2' },
  // 45°E
  { name: '莫斯科', longitude: 37.6, latitude: 55.8, emoji: '🇷🇺', description: '东三区，UTC+3' },
  // 60°E
  { name: '卡拉奇', longitude: 67.0, latitude: 24.9, emoji: '🇵🇰', description: '东五区，UTC+5' },
  // 75°E
  { name: '新德里', longitude: 77.2, latitude: 28.6, emoji: '🇮🇳', description: '东五区半，UTC+5:30' },
  // 90°E
  { name: '达卡', longitude: 90.4, latitude: 23.8, emoji: '🇧🇩', description: '东六区，UTC+6' },
  // 105°E
  { name: '曼谷', longitude: 100.5, latitude: 13.8, emoji: '🇹🇭', description: '东七区，UTC+7' },
  // 120°E
  { name: '北京', longitude: 116.4, latitude: 39.9, emoji: '🇨🇳', description: '东八区，UTC+8' },
  { name: '合肥', longitude: 117.3, latitude: 31.8, emoji: '🇨🇳', description: '东八区，UTC+8' },
  // 135°E
  { name: '东京', longitude: 139.7, latitude: 35.7, emoji: '🇯🇵', description: '东九区，UTC+9' },
  // 150°E
  { name: '悉尼', longitude: 151.2, latitude: -33.9, emoji: '🇦🇺', description: '东十区，UTC+10' },
  // 165°E
  { name: '惠灵顿', longitude: 174.8, latitude: -41.3, emoji: '🇳🇿', description: '东十二区，UTC+12' },
  // 180° 日期变更线
  { name: '斐济', longitude: 178.0, latitude: -18.1, emoji: '🇫🇯', description: '东十二区，UTC+12' },
  // -165°W
  { name: '檀香山', longitude: -157.9, latitude: 21.3, emoji: '🇺🇸', description: '西十区，UTC-10' },
  // -150°W
  { name: '安克雷奇', longitude: -149.9, latitude: 61.2, emoji: '🇺🇸', description: '西九区，UTC-9' },
  // -135°W (太平洋，无大城市，用温哥华代替)
  // -120°W
  { name: '洛杉矶', longitude: -118.2, latitude: 34.0, emoji: '🇺🇸', description: '西八区，UTC-8' },
  // -105°W
  { name: '丹佛', longitude: -104.9, latitude: 39.7, emoji: '🇺🇸', description: '西七区，UTC-7' },
  // -90°W
  { name: '芝加哥', longitude: -87.6, latitude: 41.9, emoji: '🇺🇸', description: '西六区，UTC-6' },
  // -75°W
  { name: '纽约', longitude: -74.0, latitude: 40.7, emoji: '🇺🇸', description: '西五区，UTC-5' },
  // -60°W
  { name: '布宜诺斯艾利斯', longitude: -58.4, latitude: -34.6, emoji: '🇦🇷', description: '西三区，UTC-3' },
  // -45°W
  { name: '里约', longitude: -43.2, latitude: -22.9, emoji: '🇧🇷', description: '西三区，UTC-3' },
  // -30°W (大西洋，无大城市)
  // -15°W
  { name: '达喀尔', longitude: -17.4, latitude: 14.7, emoji: '🇸🇳', description: '零时区，UTC+0' },
];

// ===================== 3D 组件 =====================

/** 经线标签组件 - 带可见性检测 */
function MeridianLabel({ 
  longitude, 
  color, 
  label,
  radius = 2,
}: { 
  longitude: number; 
  color: string; 
  label: string;
  radius?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { camera } = useThree();
  
  const lonRad = (longitude * Math.PI) / 180;
  const labelRadius = radius + 0.3;
  
  const position: [number, number, number] = [
    Math.cos(lonRad) * labelRadius,
    0,
    -Math.sin(lonRad) * labelRadius,
  ];

  // 检测标签是否面向相机
  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      
      const normal = worldPos.clone().normalize();
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      const dot = normal.dot(toCamera);
      
      setIsVisible(dot > 0);
    }
  });

  if (!isVisible) {
    return <group ref={groupRef} position={position} />;
  }

  return (
    <group ref={groupRef} position={position}>
      <Html center>
        <div style={{
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.85)',
          padding: '3px 8px',
          borderRadius: 4,
          border: `1px solid ${color}`,
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/** 经线组件 */
function MeridianLine({ 
  longitude, 
  color, 
  lineWidth = 1,
  dashed = false,
  showLabel = false,
  label = '',
}: { 
  longitude: number; 
  color: string; 
  lineWidth?: number;
  dashed?: boolean;
  showLabel?: boolean;
  label?: string;
}) {
  const lonRad = (longitude * Math.PI) / 180;
  const radius = 2;

  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    // 从南极到北极画半圆
    // 注意：Z坐标取反，让东经显示在正确的东侧
    for (let i = 0; i <= 64; i++) {
      const latRad = ((i / 64) * Math.PI) - Math.PI / 2; // -90° to 90°
      pts.push([
        Math.cos(latRad) * Math.cos(lonRad) * radius,
        Math.sin(latRad) * radius,
        -Math.cos(latRad) * Math.sin(lonRad) * radius,
      ]);
    }
    return pts;
  }, [lonRad]);

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
        <MeridianLabel 
          longitude={longitude} 
          color={color} 
          label={label || formatLongitude(longitude)} 
          radius={radius}
        />
      )}
    </group>
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
  const radius = 2.02; // 稍微大于地球半径，使标记显示在表面上方
  
  // 城市位置（使用真实经纬度）
  // X = cos(lat) * cos(lon)
  // Y = sin(lat)
  // Z = -cos(lat) * sin(lon) （取反让东经在正确方向）
  const position: [number, number, number] = [
    Math.cos(latRad) * Math.cos(lonRad) * radius,
    Math.sin(latRad) * radius,
    -Math.cos(latRad) * Math.sin(lonRad) * radius,
  ];

  // 检测城市是否面向相机（是否在地球可见的一面）
  useFrame(() => {
    if (groupRef.current) {
      // 获取城市标记的世界坐标
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      
      // 计算从地球中心到城市的方向（法向量）
      const normal = worldPos.clone().normalize();
      
      // 计算从城市到相机的方向
      const toCamera = camera.position.clone().sub(worldPos).normalize();
      
      // 点积：如果 > 0，说明城市面向相机；如果 < 0，说明城市在背面
      const dot = normal.dot(toCamera);
      
      // 使用一个小的阈值来避免边缘闪烁
      setIsVisible(dot > -0.1);
    }
  });

  // 如果城市在地球背面，不渲染（包括被选中的城市）
  if (!isVisible) {
    return <group ref={groupRef} position={position} />;
  }

  // 如果不显示标签且未选中，只显示一个小点
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
      {/* 城市点 */}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.1 : 0.06, 16, 16]} />
        <meshBasicMaterial color={isSelected ? COLORS.selectedMeridian : '#FFFFFF'} />
      </mesh>
      
      {/* 城市标签 */}
      <Html position={[0, 0.2, 0]} center occlude={false}>
        <div 
          onClick={onClick}
          style={{
            cursor: 'pointer',
            color: isSelected ? COLORS.selectedMeridian : '#FFFFFF',
            fontSize: isSelected ? '12px' : '10px',
            fontWeight: isSelected ? 'bold' : 'normal',
            whiteSpace: 'nowrap',
            background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: 4,
            border: isSelected ? '1px solid #10B981' : 'none',
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
  selectedLongitude: number;
  showLabels: boolean;
  autoRotate: boolean;
  showAllMeridians: boolean;
  cities: typeof FAMOUS_CITIES;
  selectedCity: string | null;
  onCityClick: (name: string) => void;
  targetLongitude: number | null; // 目标经度，用于旋转地球
}

function Earth({ 
  selectedLongitude, 
  showLabels, 
  autoRotate,
  showAllMeridians,
  cities,
  selectedCity,
  onCityClick,
  targetLongitude,
}: EarthProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  // 初始旋转角度设置为目标经度对应的角度，这样首次渲染就显示正确位置
  const initialRotation = targetLongitude !== null ? -targetLongitude * Math.PI / 180 : 0;
  const targetRotationRef = useRef<number>(initialRotation);
  const isAnimatingRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  
  // 加载地球纹理
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  // 当目标经度变化时，开始旋转动画
  useMemo(() => {
    if (targetLongitude !== null) {
      // 计算目标旋转角度
      // 要让城市面向相机（默认相机在正前方偏上），需要将城市的经度旋转到 0°
      // 城市在经度 lon 位置，需要旋转 -lon 度让它到正前方
      // 转换为弧度：-lon * PI / 180
      targetRotationRef.current = -targetLongitude * Math.PI / 180;
      // 只有在初始化之后才启动动画，避免首次加载时的动画
      if (hasInitializedRef.current) {
        isAnimatingRef.current = true;
      }
    }
  }, [targetLongitude]);

  // 地球旋转动画
  useFrame(({ clock }) => {
    if (earthGroupRef.current) {
      // 首次渲染时，设置初始旋转角度
      if (!hasInitializedRef.current) {
        earthGroupRef.current.rotation.y = targetRotationRef.current;
        hasInitializedRef.current = true;
        return;
      }
      
      if (autoRotate && !isAnimatingRef.current) {
        // 自动旋转模式
        earthGroupRef.current.rotation.y = clock.elapsedTime * 0.1;
      } else if (isAnimatingRef.current) {
        // 动画旋转到目标位置
        const currentRotation = earthGroupRef.current.rotation.y;
        const targetRotation = targetRotationRef.current;
        
        // 计算最短旋转路径
        let diff = targetRotation - currentRotation;
        // 归一化角度差到 [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        // 使用缓动函数平滑旋转
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

  // 计算地球纹理对齐所需的旋转角度
  // 通过实际测试调整，让城市标记与地球纹理上的地理位置对齐
  const textureRotationOffset = 0; // 不旋转，测试基准位置

  return (
    <group>
      {/* 可旋转的地球组 - 包含纹理、经线、城市标记 */}
      <group ref={earthGroupRef}>
        {/* 地球主体 */}
        <mesh rotation={[0, textureRotationOffset, 0]}>
          <sphereGeometry args={[2, 64, 64]} />
          <meshStandardMaterial
            map={earthMap}
            normalMap={earthNormal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughnessMap={earthSpec}
            roughness={0.4}
            metalness={0.0}
            emissive="#334155"
            emissiveIntensity={0.15}
          />
        </mesh>
        
        {/* 云层 - 也跟随旋转 */}
        <mesh rotation={[0, textureRotationOffset, 0]}>
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

        {/* 北回归线 23.5°N */}
        <LatitudeLine 
          latitude={23.5} 
          radius={2.01} 
          color={COLORS.tropicOfCancer} 
          label="北回归线 23.5°N"
          showLabel={showLabels}
        />

        {/* 南回归线 23.5°S */}
        <LatitudeLine 
          latitude={-23.5} 
          radius={2.01} 
          color={COLORS.tropicOfCapricorn} 
          label="南回归线 23.5°S"
          showLabel={showLabels}
        />

        {/* 北极圈 66.5°N */}
        <LatitudeLine 
          latitude={66.5} 
          radius={2.01} 
          color={COLORS.arcticCircle} 
          label="北极圈 66.5°N"
          showLabel={showLabels}
          dashed
        />

        {/* 南极圈 66.5°S */}
        <LatitudeLine 
          latitude={-66.5} 
          radius={2.01} 
          color={COLORS.antarcticCircle} 
          label="南极圈 66.5°S"
          showLabel={showLabels}
          dashed
        />

        {/* 其他主要纬度线 - 30°N, 60°N, 30°S, 60°S */}
        {[30, 60, -30, -60].map(lat => (
          <LatitudeLine 
            key={lat}
            latitude={lat} 
            radius={2.01} 
            color={COLORS.latitudeLine} 
            label={`${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`}
            showLabel={showLabels}
            dashed
            lineWidth={1}
          />
        ))}

        {/* 本初子午线 (0°) - 始终显示 */}
        <MeridianLine 
          longitude={0} 
          color={COLORS.primeMeridian} 
          lineWidth={3}
          showLabel={showLabels}
          label="0° 本初子午线"
        />

        {/* 国际日期变更线 (180°) - 始终显示 */}
        <MeridianLine 
          longitude={180} 
          color={COLORS.dateLine} 
          lineWidth={2}
          dashed
          showLabel={showLabels}
          label="180° 日期变更线"
        />

        {/* 显示所有主要经线 - 每15度一条 */}
        {showAllMeridians && (
          <>
            {/* 每15度一条经线 */}
            {[-165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map(lon => {
              // 所有经线都显示标签，由 MeridianLabel 组件自己根据可见性决定是否显示
              return (
                <MeridianLine 
                  key={lon}
                  longitude={lon} 
                  color={lon > 0 ? COLORS.eastLongitude : COLORS.westLongitude}
                  lineWidth={1}
                  dashed
                  showLabel={showLabels}
                />
              );
            })}
          </>
        )}

        {/* 选中的经线 */}
        {Math.abs(selectedLongitude) > 0.1 && Math.abs(Math.abs(selectedLongitude) - 180) > 0.1 && (
          <MeridianLine 
            longitude={selectedLongitude} 
            color={COLORS.selectedMeridian} 
            lineWidth={3}
            showLabel={showLabels}
          />
        )}

        {/* 城市标记 - 跟随地球旋转 */}
        {cities.map(city => {
          const isCitySelected = selectedCity === city.name;
          // 所有城市都显示标签（由 CityMarker 组件的可见性检测决定是否隐藏）
          // 被选中的城市或全局开启标签时显示
          const shouldShowLabel = isCitySelected || showLabels;
          
          return (
            <CityMarker
              key={city.name}
              longitude={city.longitude}
              latitude={city.latitude}
              name={city.name}
              emoji={city.emoji}
              isSelected={isCitySelected}
              showLabel={shouldShowLabel}
              onClick={() => onCityClick(city.name)}
            />
          );
        })}
      </group>

      {/* 大气层 - 不跟随旋转 */}
      <mesh>
        <sphereGeometry args={[2.1, 64, 64]} />
        <meshBasicMaterial
          color="#88CCFF"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 地轴 */}
      <Line
        points={[[0, -2.8, 0], [0, 2.8, 0]]}
        color={COLORS.axis}
        lineWidth={2}
      />
      
      {/* 北极点 */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={COLORS.axis} />
      </mesh>

      {/* 标签 */}
      {showLabels && (
        <>
          <Html position={[0, 2.5, 0]} center>
            <div style={{ color: COLORS.axis, fontSize: '11px', fontWeight: 'bold' }}>N</div>
          </Html>
          <Html position={[0, -2.5, 0]} center>
            <div style={{ color: COLORS.axis, fontSize: '11px', fontWeight: 'bold' }}>S</div>
          </Html>
        </>
      )}
    </group>
  );
}

/** 场景组件 */
interface SceneProps {
  selectedLongitude: number;
  showLabels: boolean;
  autoRotate: boolean;
  showAllMeridians: boolean;
  cities: typeof FAMOUS_CITIES;
  selectedCity: string | null;
  onCityClick: (name: string) => void;
  cameraRef: React.RefObject<CameraControllerHandle>;
  targetLongitude: number | null;
}

function Scene({ 
  selectedLongitude, 
  showLabels, 
  autoRotate,
  showAllMeridians,
  cities,
  selectedCity,
  onCityClick,
  cameraRef,
  targetLongitude,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <directionalLight position={[-3, 2, -3]} intensity={0.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      {/* 地球 */}
      <Suspense fallback={null}>
        <Earth 
          selectedLongitude={selectedLongitude}
          showLabels={showLabels}
          autoRotate={autoRotate}
          showAllMeridians={showAllMeridians}
          cities={cities}
          selectedCity={selectedCity}
          onCityClick={onCityClick}
          targetLongitude={targetLongitude}
        />
      </Suspense>
      
      {/* 相机控制 */}
      <CameraController ref={cameraRef} defaultPosition={[8, 2, 0]} />
    </>
  );
}

// ===================== 2D 视图 =====================

function TwoDView({ 
  selectedLongitude,
  cities,
  selectedCity,
  onCityClick,
}: { 
  selectedLongitude: number;
  cities: typeof FAMOUS_CITIES;
  selectedCity: string | null;
  onCityClick: (name: string) => void;
}) {
  const width = 400;
  const height = 200;
  const padding = 20;
  
  // 经度转换为x坐标 (-180 到 180 映射到 padding 到 width-padding)
  const lonToX = (lon: number) => {
    return padding + ((lon + 180) / 360) * (width - 2 * padding);
  };

  return (
    <svg width={width} height={height} style={{ background: 'rgba(15, 23, 42, 0.9)', borderRadius: 8 }}>
      {/* 背景网格 */}
      {[-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].map(lon => (
        <g key={lon}>
          <line
            x1={lonToX(lon)}
            y1={padding}
            x2={lonToX(lon)}
            y2={height - padding}
            stroke={lon === 0 ? COLORS.primeMeridian : lon === 180 || lon === -180 ? COLORS.dateLine : '#374151'}
            strokeWidth={lon === 0 ? 2 : 1}
            strokeDasharray={lon !== 0 ? '4,4' : undefined}
          />
          <text
            x={lonToX(lon)}
            y={height - 5}
            fill={lon === 0 ? COLORS.primeMeridian : lon > 0 ? COLORS.eastLongitude : COLORS.westLongitude}
            fontSize="10"
            textAnchor="middle"
          >
            {lon === 0 ? '0°' : lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`}
          </text>
        </g>
      ))}

      {/* 赤道线 */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke={COLORS.equator}
        strokeWidth={2}
      />

      {/* 选中的经线 */}
      <line
        x1={lonToX(selectedLongitude)}
        y1={padding}
        x2={lonToX(selectedLongitude)}
        y2={height - padding}
        stroke={COLORS.selectedMeridian}
        strokeWidth={3}
      />

      {/* 城市标记 */}
      {cities.map(city => {
        const x = lonToX(city.longitude);
        const isSelected = selectedCity === city.name;
        return (
          <g 
            key={city.name} 
            onClick={() => onCityClick(city.name)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={x}
              cy={height / 2}
              r={isSelected ? 8 : 5}
              fill={isSelected ? COLORS.selectedMeridian : '#FFFFFF'}
              stroke={isSelected ? '#FFFFFF' : 'none'}
              strokeWidth={2}
            />
            <text
              x={x}
              y={height / 2 - 15}
              fill={isSelected ? COLORS.selectedMeridian : '#FFFFFF'}
              fontSize={isSelected ? '11' : '9'}
              fontWeight={isSelected ? 'bold' : 'normal'}
              textAnchor="middle"
            >
              {city.emoji}
            </text>
          </g>
        );
      })}

      {/* 图例 */}
      <g transform={`translate(${padding}, ${padding})`}>
        <rect x={0} y={0} width={80} height={50} fill="rgba(0,0,0,0.5)" rx={4} />
        <circle cx={10} cy={12} r={4} fill={COLORS.primeMeridian} />
        <text x={20} y={16} fill="#FFFFFF" fontSize="9">本初子午线</text>
        <circle cx={10} cy={28} r={4} fill={COLORS.eastLongitude} />
        <text x={20} y={32} fill="#FFFFFF" fontSize="9">东经</text>
        <circle cx={10} cy={44} r={4} fill={COLORS.westLongitude} />
        <text x={20} y={48} fill="#FFFFFF" fontSize="9">西经</text>
      </g>
    </svg>
  );
}

// ===================== 控制面板 =====================

/** 自定义城市类型 */
interface CustomCity {
  name: string;
  longitude: number;
  latitude: number;
  emoji: string;
  description: string;
  isCustom: true;
}

interface ControlPanelProps {
  selectedLongitude: number;
  setSelectedLongitude: (value: number) => void;
  cities: typeof FAMOUS_CITIES;
  selectedCity: string | null;
  onCityClick: (name: string) => void;
  customCities: CustomCity[];
  onSearchCity: (cityName: string) => Promise<void>;
  isSearching: boolean;
}

function ControlPanel({
  selectedLongitude,
  setSelectedLongitude,
  cities,
  selectedCity,
  onCityClick,
  customCities,
  onSearchCity,
  isSearching,
}: ControlPanelProps) {
  const [searchInput, setSearchInput] = useState('');
  const selectedCityData = cities.find(c => c.name === selectedCity) || customCities.find(c => c.name === selectedCity);

  const handleSearch = async () => {
    if (searchInput.trim()) {
      await onSearchCity(searchInput.trim());
      setSearchInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
          background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}>
          🌍 经度探索
        </Typography>

        {/* 城市搜索输入框 */}
        <div style={{ marginBottom: 16 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="输入城市名搜索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSearching}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: isSearching ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : searchInput ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleSearch}>
                    <SearchIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                background: 'rgba(59, 130, 246, 0.05)',
                '&:hover': {
                  background: 'rgba(59, 130, 246, 0.08)',
                },
                '&.Mui-focused': {
                  background: 'white',
                },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            输入任意城市名，按回车搜索
          </Typography>
        </div>

        {/* 当前经度显示 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <Typography variant="caption" color="text.secondary">当前选择经度</Typography>
          <Typography variant="h4" sx={{ 
            fontWeight: 700,
            color: selectedLongitude > 0 ? COLORS.eastLongitude : selectedLongitude < 0 ? COLORS.westLongitude : COLORS.primeMeridian,
          }}>
            {formatLongitude(selectedLongitude)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {selectedLongitude > 0 ? '东经：在本初子午线以东' : selectedLongitude < 0 ? '西经：在本初子午线以西' : '本初子午线：0°经线'}
          </Typography>
        </div>

        {/* 经度滑块 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            调整经度 (-180° ~ 180°)
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography variant="caption" sx={{ color: COLORS.westLongitude }}>180°W</Typography>
            <Slider
              value={selectedLongitude}
              onChange={(_, v) => setSelectedLongitude(v as number)}
              min={-180}
              max={180}
              step={1}
              sx={{
                color: selectedLongitude > 0 ? COLORS.eastLongitude : selectedLongitude < 0 ? COLORS.westLongitude : COLORS.primeMeridian,
                '& .MuiSlider-thumb': {
                  width: 20,
                  height: 20,
                },
              }}
            />
            <Typography variant="caption" sx={{ color: COLORS.eastLongitude }}>180°E</Typography>
          </div>
        </div>

        {/* 自定义城市（用户搜索添加的） */}
        {customCities.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
              📍 搜索的城市
            </Typography>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {customCities.map(city => (
                <Chip
                  key={city.name}
                  label={`${city.emoji} ${city.name}`}
                  size="small"
                  onClick={() => onCityClick(city.name)}
                  sx={{
                    background: selectedCity === city.name 
                      ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' 
                      : 'rgba(139, 92, 246, 0.1)',
                    color: selectedCity === city.name ? 'white' : '#8B5CF6',
                    fontWeight: selectedCity === city.name ? 600 : 400,
                    '&:hover': {
                      background: selectedCity === city.name 
                        ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' 
                        : 'rgba(139, 92, 246, 0.2)',
                    },
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 城市选择 */}
        <div style={{ marginBottom: 16 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
            🏙️ 常见城市
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cities.map(city => (
              <Chip
                key={city.name}
                label={`${city.emoji} ${city.name}`}
                size="small"
                onClick={() => onCityClick(city.name)}
                sx={{
                  background: selectedCity === city.name 
                    ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' 
                    : 'rgba(59, 130, 246, 0.1)',
                  color: selectedCity === city.name ? 'white' : '#3B82F6',
                  fontWeight: selectedCity === city.name ? 600 : 400,
                  '&:hover': {
                    background: selectedCity === city.name 
                      ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' 
                      : 'rgba(59, 130, 246, 0.2)',
                  },
                }}
              />
            ))}
          </div>
        </div>

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
            <Typography variant="caption" color="text.secondary">
              {selectedCityData.description}
            </Typography>
          </div>
        )}

        {/* 东经城市参考 */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          borderLeft: `3px solid ${COLORS.eastLongitude}`,
        }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: COLORS.eastLongitude,
            mb: 1,
          }}>
            🌏 东经城市参考
          </Typography>
          <Typography variant="caption" component="div" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {cities
              .filter(c => c.longitude > 0)
              .slice(0, 6)
              .map(city => (
                <span 
                  key={city.name}
                  onClick={() => onCityClick(city.name)}
                  style={{ 
                    display: 'inline-block',
                    marginRight: 6,
                    marginBottom: 4,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    background: selectedCity === city.name ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 4,
                    border: selectedCity === city.name ? '1px solid #3B82F6' : 'none',
                  }}
                >
                  {city.emoji} {city.name}
                </span>
              ))}
          </Typography>
        </div>

        {/* 西经城市参考 */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          borderLeft: `3px solid ${COLORS.westLongitude}`,
        }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: COLORS.westLongitude,
            mb: 1,
          }}>
            🌎 西经城市参考
          </Typography>
          <Typography variant="caption" component="div" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {cities
              .filter(c => c.longitude < 0)
              .slice(0, 6)
              .map(city => (
                <span 
                  key={city.name}
                  onClick={() => onCityClick(city.name)}
                  style={{ 
                    display: 'inline-block',
                    marginRight: 6,
                    marginBottom: 4,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    background: selectedCity === city.name ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 4,
                    border: selectedCity === city.name ? '1px solid #F59E0B' : 'none',
                  }}
                >
                  {city.emoji} {city.name}
                </span>
              ))}
          </Typography>
        </div>

        {/* 知识卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
          borderRadius: 8,
          padding: 12,
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6', mb: 1 }}>
            📚 经度知识点
          </Typography>
          <Typography variant="caption" component="div" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            • <span style={{ color: COLORS.primeMeridian }}>本初子午线（0°）</span>：穿过英国格林尼治天文台<br/>
            • <span style={{ color: COLORS.eastLongitude }}>东经（E）</span>：本初子午线以东，0°~180°<br/>
            • <span style={{ color: COLORS.westLongitude }}>西经（W）</span>：本初子午线以西，0°~180°<br/>
            • <span style={{ color: COLORS.dateLine }}>国际日期变更线</span>：大致沿180°经线<br/>
            • 每15°经度 = 1小时时差
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== 移动端控制面板 =====================

interface MobileControlPanelProps {
  selectedLongitude: number;
  setSelectedLongitude: (value: number) => void;
  cities: typeof FAMOUS_CITIES;
  selectedCity: string | null;
  onCityClick: (name: string) => void;
  customCities: CustomCity[];
  onSearchCity: (cityName: string) => Promise<void>;
  isSearching: boolean;
}

function MobileControlPanel({
  selectedLongitude,
  setSelectedLongitude,
  cities,
  selectedCity,
  onCityClick,
  customCities,
  onSearchCity,
  isSearching,
}: MobileControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const selectedCityData = cities.find(c => c.name === selectedCity) || customCities.find(c => c.name === selectedCity);

  const handleSearch = async () => {
    if (searchInput.trim()) {
      await onSearchCity(searchInput.trim());
      setSearchInput('');
    }
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
          background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
          borderRadius: 20,
          padding: '4px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
        }}>
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
            {isExpanded ? '收起' : '控制面板'}
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
              {/* 城市搜索 */}
              <div style={{ marginBottom: 16 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="输入城市名搜索..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={isSearching}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#9CA3AF', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: isSearching ? (
                      <InputAdornment position="end">
                        <CircularProgress size={18} />
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      background: 'rgba(59, 130, 246, 0.05)',
                    },
                  }}
                />
              </div>

              {/* 当前经度 */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Typography variant="h5" sx={{ 
                  fontWeight: 700,
                  color: selectedLongitude > 0 ? COLORS.eastLongitude : selectedLongitude < 0 ? COLORS.westLongitude : COLORS.primeMeridian,
                }}>
                  {formatLongitude(selectedLongitude)}
                </Typography>
              </div>

              {/* 经度滑块 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography variant="caption" sx={{ color: COLORS.westLongitude }}>W</Typography>
                  <Slider
                    value={selectedLongitude}
                    onChange={(_, v) => setSelectedLongitude(v as number)}
                    min={-180}
                    max={180}
                    step={1}
                    sx={{
                      color: selectedLongitude > 0 ? COLORS.eastLongitude : selectedLongitude < 0 ? COLORS.westLongitude : COLORS.primeMeridian,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: COLORS.eastLongitude }}>E</Typography>
                </div>
              </div>

              {/* 搜索的城市 */}
              {customCities.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    📍 搜索的城市
                  </Typography>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {customCities.map(city => (
                      <Chip
                        key={city.name}
                        label={`${city.emoji} ${city.name}`}
                        size="small"
                        onClick={() => onCityClick(city.name)}
                        sx={{
                          background: selectedCity === city.name 
                            ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' 
                            : 'rgba(139, 92, 246, 0.1)',
                          color: selectedCity === city.name ? 'white' : '#8B5CF6',
                          fontWeight: selectedCity === city.name ? 600 : 400,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 城市选择 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cities.map(city => (
                  <Chip
                    key={city.name}
                    label={`${city.emoji} ${city.name}`}
                    size="small"
                    onClick={() => onCityClick(city.name)}
                    sx={{
                      background: selectedCity === city.name 
                        ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' 
                        : 'rgba(59, 130, 246, 0.1)',
                      color: selectedCity === city.name ? 'white' : '#3B82F6',
                      fontWeight: selectedCity === city.name ? 600 : 400,
                    }}
                  />
                ))}
              </div>

              {/* 选中城市信息 */}
              {selectedCityData && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 12,
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981' }}>
                    {selectedCityData.emoji} {selectedCityData.name}：{formatLongitude(selectedCityData.longitude)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedCityData.description}
                  </Typography>
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

export default function LongitudeDemo3D({
  initialLongitude = 116.4, // 默认北京经度
}: LongitudeDemo3DProps) {
  const [selectedLongitude, setSelectedLongitude] = useState(initialLongitude);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showAllMeridians] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>('北京');
  const [targetLongitude, setTargetLongitude] = useState<number | null>(initialLongitude);
  const [customCities, setCustomCities] = useState<CustomCity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  // 合并预设城市和自定义城市
  const allCities = useMemo(() => {
    return [...FAMOUS_CITIES, ...customCities];
  }, [customCities]);

  const handleCityClick = useCallback((name: string) => {
    const city = allCities.find(c => c.name === name);
    if (city) {
      setSelectedCity(name);
      setSelectedLongitude(city.longitude);
      setTargetLongitude(city.longitude);
      // 重置相机位置，确保城市显示在画面中心
      cameraControllerRef.current?.reset();
    }
  }, [allCities]);

  // 搜索城市经纬度
  const handleSearchCity = useCallback(async (cityName: string) => {
    // 先检查是否已存在于预设城市或自定义城市中
    const existingCity = allCities.find(c => c.name === cityName || c.name.includes(cityName) || cityName.includes(c.name));
    if (existingCity) {
      handleCityClick(existingCity.name);
      return;
    }

    setIsSearching(true);
    try {
      // 使用 Nominatim API 搜索城市
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1&accept-language=zh`,
        {
          headers: {
            'User-Agent': 'GeographyStudyApp/1.0',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('搜索失败');
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const longitude = parseFloat(result.lon);
        const latitude = parseFloat(result.lat);
        
        // 检查是否已添加过
        const alreadyAdded = customCities.find(c => c.name === cityName);
        if (!alreadyAdded) {
          const newCity: CustomCity = {
            name: cityName,
            longitude,
            latitude,
            emoji: '📍',
            description: `经度 ${formatLongitude(longitude)}，纬度 ${latitude.toFixed(2)}°`,
            isCustom: true,
          };
          setCustomCities(prev => [...prev, newCity]);
        }
        
        // 选中这个城市
        setSelectedCity(cityName);
        setSelectedLongitude(longitude);
        setTargetLongitude(longitude);
        cameraControllerRef.current?.reset();
      } else {
        alert(`未找到城市 "${cityName}"，请尝试其他名称`);
      }
    } catch (error) {
      console.error('搜索城市失败:', error);
      alert('搜索失败，请稍后重试');
    } finally {
      setIsSearching(false);
    }
  }, [allCities, customCities, handleCityClick]);

  // 知识点信息内容
  const infoContent = (
    <>
      <Typography variant="h6" gutterBottom sx={{ color: '#3B82F6' }}>
        📚 经度知识点
      </Typography>
      <Typography variant="body2" component="div" sx={{ lineHeight: 2 }}>
        <b>1. 经度定义</b><br/>
        经度是地球上某点与本初子午线（0°经线）之间的角度距离。<br/><br/>
        
        <b>2. 本初子午线</b><br/>
        经过英国伦敦格林尼治天文台的经线，被定义为0°经线。<br/><br/>
        
        <b>3. 东经与西经</b><br/>
        • 东经(E)：本初子午线以东，0°~180°<br/>
        • 西经(W)：本初子午线以西，0°~180°<br/><br/>
        
        <b>4. 国际日期变更线</b><br/>
        大致沿180°经线，跨越此线日期加减一天。<br/><br/>
        
        <b>5. 经度与时区</b><br/>
        地球自转一周360°需24小时，每15°经度对应1小时时差。
      </Typography>
    </>
  );

  return (
    <AnimationPageLayout
      scene3D={
        <Suspense fallback={<SceneLoading />}>
          <Canvas camera={{ position: [8, 2, 0], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <Scene
              selectedLongitude={selectedLongitude}
              showLabels={showLabels}
              autoRotate={autoRotate}
              showAllMeridians={showAllMeridians}
              cities={allCities}
              selectedCity={selectedCity}
              onCityClick={handleCityClick}
              cameraRef={cameraControllerRef}
              targetLongitude={targetLongitude}
            />
          </Canvas>
        </Suspense>
      }
      scene2D={
        <TwoDView
          selectedLongitude={selectedLongitude}
          cities={allCities}
          selectedCity={selectedCity}
          onCityClick={handleCityClick}
        />
      }
      controlPanel={
        <ControlPanel
          selectedLongitude={selectedLongitude}
          setSelectedLongitude={setSelectedLongitude}
          cities={FAMOUS_CITIES}
          selectedCity={selectedCity}
          onCityClick={handleCityClick}
          customCities={customCities}
          onSearchCity={handleSearchCity}
          isSearching={isSearching}
        />
      }
      mobileControlPanel={
        <MobileControlPanel
          selectedLongitude={selectedLongitude}
          setSelectedLongitude={setSelectedLongitude}
          cities={FAMOUS_CITIES}
          selectedCity={selectedCity}
          onCityClick={handleCityClick}
          customCities={customCities}
          onSearchCity={handleSearchCity}
          isSearching={isSearching}
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
              <Tooltip title={showLabels ? '隐藏地球上的标签' : '显示地球上的标签'}>
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
