/**
 * 南北回归线 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 面向高中生的现代化、活泼的教学动画
 */

import { useRef, useState, useMemo, Suspense, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Stars, 
  Line,
  Html,
  useTexture
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  CardContent,
  Typography,
  Slider,
  Chip,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  RestartAlt as ResetIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Label as LabelIcon,
  LabelOff as LabelOffIcon,
  SlowMotionVideo as AnimationIcon,
} from '@mui/icons-material';

// 导入公共组件和工具
import {
  OBLIQUITY,
  ORBIT_RADIUS,
  ASTRONOMY_COLORS,
  SEASONS,
  SEASON_PROGRESS_MAP,
  type SeasonType,
} from '../../shared/constants';
import { formatDegreeMinute } from '../../shared/utils';
import {
  Sun,
  OrbitPath,
  SeasonMarkers,
  LatitudeLine,
  CameraController,
  AnimationPageLayout,
  SceneLoading,
  type CameraControllerHandle,
} from '../../shared/components';

// ===================== 类型定义 =====================

interface TropicsDemo3DProps {
  initialObliquity?: number;
  onBack?: () => void;
}

// ===================== 本地常量（特定于此组件） =====================

const COLORS = {
  ...ASTRONOMY_COLORS,
  // 可以在这里覆盖或添加特定颜色
};

// ===================== 本地 3D 组件（特定于此演示） =====================

/** 太阳光线组件 - 从太阳射向地球 */
function SunRays({ earthPosition }: { earthPosition: [number, number, number] }) {
  // 计算从太阳到地球的方向
  const sunPos = [0, 0, 0];
  const direction = [
    earthPosition[0] - sunPos[0],
    earthPosition[1] - sunPos[1],
    earthPosition[2] - sunPos[2],
  ];
  const length = Math.sqrt(direction[0]**2 + direction[1]**2 + direction[2]**2);
  const normalized = direction.map(d => d / length);
  
  // 光线从太阳表面开始，到地球表面结束
  const rayStart: [number, number, number] = [
    sunPos[0] + normalized[0] * 1.5, // 从太阳表面开始
    sunPos[1] + normalized[1] * 1.5,
    sunPos[2] + normalized[2] * 1.5,
  ];
  
  // 直射点位置（地球表面）
  const directPoint: [number, number, number] = [
    earthPosition[0] - normalized[0] * 2, // 地球表面
    earthPosition[1] - normalized[1] * 2,
    earthPosition[2] - normalized[2] * 2,
  ];

  // 计算垂直于光线方向的向量（用于垂直虚线）
  // 在水平面上与光线方向垂直的向量
  const perpHorizontal: [number, number, number] = [
    -normalized[2],
    0,
    normalized[0],
  ];
  const perpHLen = Math.sqrt(perpHorizontal[0]**2 + perpHorizontal[2]**2);
  const perpHNorm: [number, number, number] = [
    perpHorizontal[0] / (perpHLen || 1),
    0,
    perpHorizontal[2] / (perpHLen || 1),
  ];
  
  // 垂直虚线的两端
  const perpLineLength = 1.5;
  const perpStart: [number, number, number] = [
    directPoint[0] + perpHNorm[0] * perpLineLength,
    directPoint[1] + perpHNorm[1] * perpLineLength,
    directPoint[2] + perpHNorm[2] * perpLineLength,
  ];
  const perpEnd: [number, number, number] = [
    directPoint[0] - perpHNorm[0] * perpLineLength,
    directPoint[1] - perpHNorm[1] * perpLineLength,
    directPoint[2] - perpHNorm[2] * perpLineLength,
  ];
  
  return (
    <group>
      {/* 太阳直射线 - 一条粗线 */}
      <Line
        points={[rayStart, directPoint]}
        color={COLORS.sunRay}
        lineWidth={4}
      />
      
      {/* 直射点高亮标识 - 发光球体 */}
      <mesh position={directPoint}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color="#FBBF24" transparent opacity={0.6} />
      </mesh>
      <mesh position={directPoint}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      
      {/* 直射点处的垂直虚线 - 显示这是直射点 */}
      <Line
        points={[perpStart, perpEnd]}
        color="#FFFFFF"
        lineWidth={2}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />
      
      {/* 垂直虚线端点小球 */}
      <mesh position={perpStart}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={perpEnd}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

/** 地球组件 - 带纬线（特定于此演示，使用本地 LatitudeLine 组件） */
interface EarthProps {
  sunLatitude: number;
  showLabels: boolean;
  autoRotate: boolean;
  isYearAnimating: boolean;
}

function Earth({ sunLatitude, showLabels, autoRotate, isYearAnimating }: EarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // 正确的物理模型：
  // 1. 地轴始终倾斜约23.26°，指向北极星方向（右上方，+X方向）
  // 2. rotation Z轴负值表示向右倾斜（北极指向+X方向）
  // 3. 夏至时地球在太阳左上方(-X)，北极朝向太阳(+X方向)，直射北回归线
  // 4. 冬至时地球在太阳右下方(+X)，北极背离太阳，直射南回归线
  const fixedTiltAngleRad = (OBLIQUITY * Math.PI) / 180; // 固定倾斜角（黄赤交角）

  // 加载地球纹理
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  // 地球自转 + 动画时光晕脉冲效果
  useFrame(({ clock }) => {
    if (earthRef.current && autoRotate) {
      earthRef.current.rotation.y = clock.elapsedTime * 0.2;
    }
    // 年循环动画时，直射点光晕脉冲
    if (glowRef.current && isYearAnimating) {
      const scale = 1 + Math.sin(clock.elapsedTime * 5) * 0.4;
      glowRef.current.scale.setScalar(scale);
    } else if (glowRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.2;
      glowRef.current.scale.setScalar(scale);
    }
  });

  // 地轴方向
  const axisLength = 3;
  const axisTop: [number, number, number] = [0, axisLength, 0];
  const axisBottom: [number, number, number] = [0, -axisLength, 0];

  return (
    <group rotation={[0, 0, -fixedTiltAngleRad]}>
      {/* 地球主体 - 地轴固定倾斜约23.26°，北极向右（+X方向/北极星方向）倾斜 */}
      {/* 夏至时地球在太阳左上(-X)，北极朝向太阳，直射点在北回归线 */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={earthMap}
          normalMap={earthNormal}
          normalScale={new THREE.Vector2(0.5, 0.5)}
          roughnessMap={earthSpec}
          roughness={0.4}
          metalness={0.0}
          emissive="#4a6080"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* 云层 */}
      <mesh>
        <sphereGeometry args={[2.05, 64, 64]} />
        <meshBasicMaterial
          map={cloudsMap}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>

      {/* 大气层 */}
      <mesh>
        <sphereGeometry args={[2.15, 64, 64]} />
        <meshBasicMaterial
          color="#88CCFF"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 地轴 */}
      <Line
        points={[axisBottom, axisTop]}
        color={COLORS.axis}
        lineWidth={2}
      />
      <mesh position={axisTop}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={COLORS.axis} />
      </mesh>

      {/* 赤道 */}
      <LatitudeLine 
        latitude={0} 
        radius={2.02} 
        color={COLORS.equator} 
        label="赤道 0°"
        showLabel={showLabels}
      />

      {/* 北回归线 */}
      <LatitudeLine 
        latitude={OBLIQUITY} 
        radius={2.02} 
        color={COLORS.tropicOfCancer} 
        label={`北回归线 ${formatDegreeMinute(OBLIQUITY)}`}
        showLabel={showLabels}
      />

      {/* 南回归线 */}
      <LatitudeLine 
        latitude={-OBLIQUITY} 
        radius={2.02} 
        color={COLORS.tropicOfCapricorn} 
        label={`南回归线 ${formatDegreeMinute(-OBLIQUITY)}`}
        showLabel={showLabels}
      />

      {/* 北极圈 */}
      <LatitudeLine 
        latitude={90 - OBLIQUITY} 
        radius={2.02} 
        color={COLORS.arcticCircle} 
        label={`北极圈 ${formatDegreeMinute(90 - OBLIQUITY)}`}
        showLabel={showLabels}
        dashed
      />

      {/* 南极圈 */}
      <LatitudeLine 
        latitude={-(90 - OBLIQUITY)} 
        radius={2.02} 
        color={COLORS.antarcticCircle} 
        label={`南极圈 ${formatDegreeMinute(-(90 - OBLIQUITY))}`}
        showLabel={showLabels}
        dashed
      />

      {/* 太阳直射点标记 - 增强版 */}
      {(() => {
        const latRad = (sunLatitude * Math.PI) / 180;
        const y = Math.sin(latRad) * 2.15;
        const x = Math.cos(latRad) * 2.15;
        return (
          <group>
            {/* 直射点光晕（脉冲效果） */}
            <mesh ref={glowRef} position={[x, y, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial color="#FBBF24" transparent opacity={0.25} />
            </mesh>
            
            {/* 直射点核心 */}
            <mesh position={[x, y, 0]}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial color="#FBBF24" />
            </mesh>
            
            {/* 直射点标记环 */}
            <mesh position={[x, y, 0.01]} rotation={[0, 0, 0]}>
              <ringGeometry args={[0.22, 0.28, 32]} />
              <meshBasicMaterial color="#FFF" transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
            {/* 直射点纬度标签已移至右侧信息栏显示，避免随地球自转 */}
          </group>
        );
      })()}

      {/* N极标签 */}
      {showLabels && (
        <Html position={[0, axisLength + 0.3, 0]} center zIndexRange={[100, 0]}>
          <div style={{ color: COLORS.axis, fontSize: '12px', fontWeight: 'bold' }}>N</div>
        </Html>
      )}
      
      {/* 自转方向指示器 */}
      <RotationIndicator showLabels={showLabels} />
    </group>
  );
}

/** 自转方向指示器 - 在地球旁边显示 */
function RotationIndicator({ showLabels }: { showLabels: boolean }) {
  if (!showLabels) return null;
  
  return (
    <Html position={[2.5, 1.5, 0]} center zIndexRange={[100, 0]}>
      <div style={{
        color: '#60A5FA',
        fontSize: '10px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        background: 'rgba(0,0,0,0.5)',
        padding: '2px 6px',
        borderRadius: 4,
      }}>
        ↺ 自转（西→东）
      </div>
    </Html>
  );
}

/** 场景组件 */
interface SceneProps {
  sunLatitude: number;
  orbitProgress: number; // 0-1，直接用于计算轨道角度
  showLabels: boolean;
  autoRotate: boolean;
  isYearAnimating: boolean;
  cameraRef: React.RefObject<CameraControllerHandle>;
}

function Scene({ sunLatitude, orbitProgress, showLabels, autoRotate, isYearAnimating, cameraRef }: SceneProps) {
  // 直接使用orbitProgress计算轨道角度
  // orbitProgress: 0=冬至, 0.25=春分, 0.5=夏至, 0.75=秋分, 1=冬至
  // 
  // 物理模型（地轴指向+X/北极星）：
  // - 冬至: 地球在+X位置(右下)，北极背离太阳 → 直射南回归线
  // - 春分: 地球在-Z位置(右上)，北极侧向 → 直射赤道
  // - 夏至: 地球在-X位置(左上)，北极朝向太阳 → 直射北回归线
  // - 秋分: 地球在+Z位置(左下)，北极侧向 → 直射赤道
  //
  // 公转是逆时针（从北极俯视），即 冬至→春分→夏至→秋分
  // 从视角看：右下→右上→左上→左下 = 逆时针
  // 
  // 位置: (cos(angle), 0, -sin(angle))
  // 在XZ平面，从+Y俯视，角度增加的方向：
  // θ=0: (+X, -Z方向)=(+1,0,0) 右下
  // θ=π/2: (0,0,-1) 右上（-Z方向）
  // θ=π: (-1,0,0) 左上
  // θ=3π/2: (0,0,+1) 左下
  // 这正是视觉上的逆时针方向
  const orbitAngle = orbitProgress * Math.PI * 2;
  
  // 地球在轨道上的位置
  // 使用 -sin 使得从北极（+Y方向）俯视时公转为逆时针方向
  const earthPosition: [number, number, number] = useMemo(() => {
    return [
      Math.cos(orbitAngle) * ORBIT_RADIUS,
      0,
      -Math.sin(orbitAngle) * ORBIT_RADIUS
    ];
  }, [orbitAngle]);

  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight position={[0, 10, 5]} intensity={1.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      {/* 太阳在中心 */}
      <Sun />
      
      {/* 公转轨道 */}
      <OrbitPath />
      
      {/* 季节位置标记 */}
      <SeasonMarkers />
      
      {/* 太阳光线 - 从太阳射向地球 */}
      <SunRays earthPosition={earthPosition} />
      
      {/* 地球 - 在轨道上公转 */}
      <group position={earthPosition}>
        <Earth 
          sunLatitude={sunLatitude} 
          showLabels={showLabels} 
          autoRotate={autoRotate} 
          isYearAnimating={isYearAnimating}
        />
      </group>
      
      <CameraController ref={cameraRef} />
    </>
  );
}

// ===================== 2D 视图组件 =====================

function TwoDView({ sunLatitude }: { sunLatitude: number }) {
  const cx = 200;
  const cy = 200;
  const earthRadius = 120;
  
  // 纬度转Y坐标
  const latToY = (lat: number) => cy - (lat / 90) * earthRadius;
  
  const equatorY = latToY(0);
  const tropicCancerY = latToY(OBLIQUITY);
  const tropicCapricornY = latToY(-OBLIQUITY);
  const arcticY = latToY(90 - OBLIQUITY);
  const antarcticY = latToY(-(90 - OBLIQUITY));
  const sunY = latToY(sunLatitude);

  return (
    <svg width="400" height="400" viewBox="0 0 400 400" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      <rect width="400" height="400" fill="transparent" />
      
      {/* 地球圆 */}
      <circle cx={cx} cy={cy} r={earthRadius} fill={COLORS.earth} opacity={0.3} />
      <circle cx={cx} cy={cy} r={earthRadius} fill="none" stroke={COLORS.earth} strokeWidth="2" />
      
      {/* 赤道 */}
      <line x1={cx - earthRadius} y1={equatorY} x2={cx + earthRadius} y2={equatorY} 
        stroke={COLORS.equator} strokeWidth="2" />
      <text x={cx + earthRadius + 5} y={equatorY + 4} fill={COLORS.equator} fontSize="11">赤道 0°</text>
      
      {/* 北回归线 */}
      <line x1={cx - earthRadius * Math.cos(Math.asin(OBLIQUITY/90))} y1={tropicCancerY} 
        x2={cx + earthRadius * Math.cos(Math.asin(OBLIQUITY/90))} y2={tropicCancerY} 
        stroke={COLORS.tropicOfCancer} strokeWidth="2" />
      <text x={cx + earthRadius + 5} y={tropicCancerY + 4} fill={COLORS.tropicOfCancer} fontSize="11">北回归线</text>
      
      {/* 南回归线 */}
      <line x1={cx - earthRadius * Math.cos(Math.asin(OBLIQUITY/90))} y1={tropicCapricornY} 
        x2={cx + earthRadius * Math.cos(Math.asin(OBLIQUITY/90))} y2={tropicCapricornY} 
        stroke={COLORS.tropicOfCapricorn} strokeWidth="2" />
      <text x={cx + earthRadius + 5} y={tropicCapricornY + 4} fill={COLORS.tropicOfCapricorn} fontSize="11">南回归线</text>
      
      {/* 北极圈 */}
      <line x1={cx - earthRadius * Math.cos(Math.asin((90-OBLIQUITY)/90))} y1={arcticY} 
        x2={cx + earthRadius * Math.cos(Math.asin((90-OBLIQUITY)/90))} y2={arcticY} 
        stroke={COLORS.arcticCircle} strokeWidth="2" strokeDasharray="5,3" />
      <text x={cx + earthRadius + 5} y={arcticY + 4} fill={COLORS.arcticCircle} fontSize="11">北极圈</text>
      
      {/* 南极圈 */}
      <line x1={cx - earthRadius * Math.cos(Math.asin((90-OBLIQUITY)/90))} y1={antarcticY} 
        x2={cx + earthRadius * Math.cos(Math.asin((90-OBLIQUITY)/90))} y2={antarcticY} 
        stroke={COLORS.antarcticCircle} strokeWidth="2" strokeDasharray="5,3" />
      <text x={cx + earthRadius + 5} y={antarcticY + 4} fill={COLORS.antarcticCircle} fontSize="11">南极圈</text>
      
      {/* 太阳直射点 */}
      <circle cx={cx} cy={sunY} r="8" fill={COLORS.sunRay} />
      <line x1={20} y1={sunY} x2={cx - 15} y2={sunY} stroke={COLORS.sunRay} strokeWidth="2" strokeDasharray="8,4" />
      <text x={30} y={sunY - 10} fill={COLORS.sunRay} fontSize="12" fontWeight="bold">
        ☀️ 直射点 {formatDegreeMinute(sunLatitude)}
      </text>
      
      {/* 地轴 */}
      <line x1={cx} y1={cy - earthRadius - 20} x2={cx} y2={cy + earthRadius + 20} 
        stroke={COLORS.axis} strokeWidth="2" />
      <text x={cx + 5} y={cy - earthRadius - 25} fill={COLORS.axis} fontSize="12" fontWeight="bold">N</text>
      <text x={cx + 5} y={cy + earthRadius + 35} fill={COLORS.axis} fontSize="12" fontWeight="bold">S</text>
    </svg>
  );
}

// ===================== 主组件 =====================

export default function TropicsDemo3D({ onBack }: TropicsDemo3DProps) {
  const [currentSeason, setCurrentSeason] = useState<SeasonType>('winter');
  const [sunLatitude, setSunLatitude] = useState(SEASONS.winter.sunLatitude);
  const [orbitProgress, setOrbitProgress] = useState(0); // 0-1，表示公转进度，0=冬至
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isYearAnimating, setIsYearAnimating] = useState(false);
  const cameraControllerRef = useRef<CameraControllerHandle>(null);
  const animationRef = useRef<number | null>(null);

  // 当季节变化时更新直射点纬度和公转进度
  const handleSeasonChange = (season: SeasonType) => {
    setCurrentSeason(season);
    setSunLatitude(SEASONS[season].sunLatitude);
    // 使用公共常量设置对应的公转进度
    setOrbitProgress(SEASON_PROGRESS_MAP[season]);
    setIsYearAnimating(false); // 停止年循环动画
  };

  // 年循环动画 - 太阳直射点在南北回归线之间移动
  useEffect(() => {
    if (!isYearAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const startTime = Date.now();
    const duration = 8000; // 8秒完成一个年周期

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration; // 0 to 1 循环
      
      // 设置公转进度
      setOrbitProgress(progress);
      
      // 使用负余弦函数模拟太阳直射点的年变化
      // progress: 0=冬至, 0.25=春分, 0.5=夏至, 0.75=秋分, 1=冬至
      // 冬至时纬度最南(-OBLIQUITY)，夏至时纬度最北(+OBLIQUITY)
      const latitude = -OBLIQUITY * Math.cos(progress * 2 * Math.PI);
      
      setSunLatitude(latitude);
      
      // 更新当前季节显示（基于progress而非latitude，更准确）
      if (progress < 0.125 || progress >= 0.875) {
        setCurrentSeason('winter');  // 冬至附近
      } else if (progress >= 0.125 && progress < 0.375) {
        setCurrentSeason('spring');  // 春分附近
      } else if (progress >= 0.375 && progress < 0.625) {
        setCurrentSeason('summer');  // 夏至附近
      } else {
        setCurrentSeason('autumn');  // 秋分附近
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isYearAnimating]);

  // 切换年循环动画
  const toggleYearAnimation = useCallback(() => {
    setIsYearAnimating(prev => !prev);
  }, []);

  // 处理滑块变化
  const handleSunLatitudeChange = (_: unknown, v: number | number[]) => {
    const lat = v as number;
    setSunLatitude(lat);
    // 根据纬度同步更新季节和公转位置
    const normalizedLat = Math.max(-1, Math.min(1, -lat / OBLIQUITY));
    const angle = Math.acos(normalizedLat); // 0 到 π
    const progress = angle / (2 * Math.PI);
    setOrbitProgress(progress);
    // 更新季节
    if (lat > OBLIQUITY * 0.9) {
      setCurrentSeason('summer');
    } else if (lat < -OBLIQUITY * 0.9) {
      setCurrentSeason('winter');
    } else if (Math.abs(lat) < OBLIQUITY * 0.1) {
      setCurrentSeason('spring');
    } else if (lat > 0) {
      setCurrentSeason('spring');
    } else {
      setCurrentSeason('autumn');
    }
    setIsYearAnimating(false);
  };

  // 3D 场景
  const scene3D = (
    <Suspense fallback={<SceneLoading />}>
      <Canvas camera={{ position: [15, 12, 15], fov: 50 }} style={{ width: '100%', height: '100%' }}>
        <Scene 
          sunLatitude={sunLatitude} 
          orbitProgress={orbitProgress}
          showLabels={showLabels} 
          autoRotate={autoRotate} 
          isYearAnimating={isYearAnimating}
          cameraRef={cameraControllerRef} 
        />
      </Canvas>
    </Suspense>
  );

  // 2D 视图
  const scene2D = (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <TwoDView sunLatitude={sunLatitude} />
    </div>
  );

  // 底部控制按钮
  const bottomControls = (is3D: boolean) => (
    <>
      {/* 年循环动画按钮 */}
      <Tooltip title={isYearAnimating ? '⏸️ 暂停公转动画' : '▶️ 播放公转动画（观察直射点移动）'}>
        <IconButton
          onClick={toggleYearAnimation}
          sx={{ 
            color: isYearAnimating ? '#FBBF24' : 'white', 
            '&:hover': { background: 'rgba(255,255,255,0.2)' },
            animation: isYearAnimating ? 'pulse 1s infinite' : 'none',
          }}
        >
          <AnimationIcon />
        </IconButton>
      </Tooltip>
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
  );

  // 控制面板
  const controlPanel = (
    <CardContent sx={{ p: 2 }}>
      {/* 标题 */}
      <div style={{ 
        marginBottom: 20,
        padding: 16,
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <Typography variant="h5" sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 0.5,
        }}>
          🌍 南北回归线
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tropic of Cancer & Capricorn
        </Typography>
      </div>

      {/* 季节选择 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.08) 100%)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#EF4444' }}>
          🗓️ 选择节气
        </Typography>
        
        <ToggleButtonGroup
          value={currentSeason}
          exclusive
          onChange={(_, value) => value && handleSeasonChange(value)}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {(Object.keys(SEASONS) as SeasonType[]).map(season => (
            <ToggleButton 
              key={season} 
              value={season}
              sx={{
                flex: '1 1 45%',
                borderRadius: '8px !important',
                border: '1px solid rgba(239, 68, 68, 0.3) !important',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 100%)',
                  },
                },
              }}
            >
              {SEASONS[season].emoji} {SEASONS[season].name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.5)', borderRadius: 8 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#EF4444' }}>
            {SEASONS[currentSeason].emoji} {SEASONS[currentSeason].name} · {SEASONS[currentSeason].date}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {SEASONS[currentSeason].description}
          </Typography>
        </div>
      </div>

      {/* 直射点控制 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(249, 115, 22, 0.08) 100%)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        border: '1px solid rgba(251, 191, 36, 0.2)',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#FBBF24' }}>
          ☀️ 太阳直射点纬度
        </Typography>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography variant="caption" color="text.secondary">23°S</Typography>
          <Slider
            value={sunLatitude}
            onChange={handleSunLatitudeChange}
            min={-OBLIQUITY}
            max={OBLIQUITY}
            step={0.5}
            marks={[
              { value: -OBLIQUITY, label: '' },
              { value: 0, label: '' },
              { value: OBLIQUITY, label: '' },
            ]}
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': {
                background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)',
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 50%, #EF4444 100%)',
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">23°N</Typography>
        </div>

        <Typography variant="h4" sx={{
          textAlign: 'center',
          mt: 2,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {formatDegreeMinute(sunLatitude)}
        </Typography>
      </div>

      {/* 图例 */}
      <div style={{ 
        marginBottom: 16,
        padding: 16,
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(16, 185, 129, 0.2)',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#10B981' }}>
          📊 图例
        </Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { color: COLORS.tropicOfCancer, label: '北回归线' },
            { color: COLORS.tropicOfCapricorn, label: '南回归线' },
            { color: COLORS.equator, label: '赤道' },
            { color: COLORS.arcticCircle, label: '北极圈' },
            { color: COLORS.antarcticCircle, label: '南极圈' },
            { color: COLORS.sunRay, label: '太阳直射' },
          ].map(item => (
            <Chip
              key={item.label}
              label={item.label}
              size="small"
              sx={{
                background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}25 100%)`,
                border: `1px solid ${item.color}40`,
                color: item.color,
                fontWeight: 500,
              }}
            />
          ))}
        </div>
      </div>

      {/* 知识点 */}
      <div style={{
        padding: 16,
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(245, 158, 11, 0.2)',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B' }}>
            💡 知识点
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setShowInfo(!showInfo)}
            sx={{ color: '#F59E0B', '&:hover': { background: 'rgba(245, 158, 11, 0.1)' } }}
          >
            <InfoIcon fontSize="small" />
          </IconButton>
        </div>

        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.6)', borderRadius: 8, padding: 12, fontSize: '13px', lineHeight: 1.8 }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: COLORS.tropicOfCancer }}>北回归线</strong>：23°26′N，夏至日太阳直射最北界线
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: COLORS.tropicOfCapricorn }}>南回归线</strong>：23°26′S，冬至日太阳直射最南界线
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: COLORS.equator }}>热带</strong>：南北回归线之间，太阳可以直射的区域
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: '#4ADE80' }}>🔄 公转方向</strong>：从北极上空俯视，地球绕太阳逆时针公转
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: '#F59E0B' }}>回归线的意义</strong>：是热带与温带的分界线
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showInfo && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, fontSize: '13px' }}>
            南北回归线是太阳直射的南北界限，纬度为 <strong style={{ color: '#F59E0B' }}>23°26′</strong>，与黄赤交角相等。
          </Typography>
        )}
      </div>

      {/* 高考知识点 */}
      <div style={{
        padding: 16,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
        borderRadius: 12,
        marginBottom: 16,
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6366F1', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          📚 高考知识点
        </Typography>
        <Typography variant="body2" component="div" sx={{ lineHeight: 1.9, fontSize: '12px' }}>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#EF4444' }}>1. 回归线 ⭐⭐⭐</b><br/>
            • 北回归线：<b>23°26′N</b><br/>
            • 南回归线：<b>23°26′S</b><br/>
            • 回归线纬度 = 黄赤交角
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#F59E0B' }}>2. 太阳直射点 ⭐⭐⭐</b><br/>
            • 范围：南北回归线之间<br/>
            • 夏至：直射<b>北回归线</b><br/>
            • 冬至：直射<b>南回归线</b><br/>
            • 春/秋分：直射<b>赤道</b>
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#10B981' }}>3. 五带划分 ⭐⭐</b><br/>
            • 热带：回归线之间<br/>
            • 温带：回归线～极圈<br/>
            • 寒带：极圈以内
          </div>
          <div>
            <b style={{ color: '#3B82F6' }}>4. 公转方向 ⭐</b><br/>
            • 自西向东（逆时针）
          </div>
        </Typography>
      </div>

      {/* 试试看 */}
      <div style={{
        padding: 16,
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 114, 182, 0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(236, 72, 153, 0.2)',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#EC4899' }}>
          🎯 试试看
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary', lineHeight: 1.8 }}>
          • 切换到<strong style={{ color: '#EC4899' }}>夏至</strong>，观察直射点位置
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary', lineHeight: 1.8 }}>
          • 滑动调节直射点，观察它只能在回归线之间移动
        </Typography>
      </div>
    </CardContent>
  );

  // 移动端控制面板
  const mobileControlPanel = (
    <div style={{ padding: 16, maxHeight: '50vh', overflowY: 'auto' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography variant="h6" sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          🌍 南北回归线
        </Typography>
        <Typography variant="h6" sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {SEASONS[currentSeason].emoji} {SEASONS[currentSeason].name}
        </Typography>
      </div>

      {/* 季节选择 */}
      <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>选择节气</Typography>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(SEASONS) as SeasonType[]).map(season => (
            <Chip
              key={season}
              label={`${SEASONS[season].emoji} ${SEASONS[season].name}`}
              onClick={() => handleSeasonChange(season)}
              sx={{
                background: currentSeason === season 
                  ? 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)' 
                  : 'rgba(239, 68, 68, 0.1)',
                color: currentSeason === season ? 'white' : '#EF4444',
                fontWeight: 600,
              }}
            />
          ))}
        </div>
      </div>

      {/* 直射点滑块 */}
      <div style={{ background: 'rgba(251, 191, 36, 0.08)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Typography variant="caption" color="text.secondary">太阳直射点纬度</Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography variant="caption">23°S</Typography>
          <Slider
            value={sunLatitude}
            onChange={handleSunLatitudeChange}
            min={-OBLIQUITY}
            max={OBLIQUITY}
            step={0.5}
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': { background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)' },
              '& .MuiSlider-track': { background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 50%, #EF4444 100%)' },
            }}
          />
          <Typography variant="caption">23°N</Typography>
        </div>
        <Typography variant="body2" sx={{ textAlign: 'center', mt: 1, fontWeight: 700, color: '#FBBF24' }}>
          {formatDegreeMinute(sunLatitude)}
        </Typography>
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {[
          { color: COLORS.tropicOfCancer, label: '北回归线' },
          { color: COLORS.tropicOfCapricorn, label: '南回归线' },
          { color: COLORS.equator, label: '赤道' },
        ].map(item => (
          <Chip
            key={item.label}
            label={item.label}
            size="small"
            sx={{
              background: `${item.color}20`,
              border: `1px solid ${item.color}40`,
              color: item.color,
              fontWeight: 500,
              fontSize: '11px',
            }}
          />
        ))}
      </div>

      {/* 知识点 */}
      <div
        onClick={() => setShowInfo(!showInfo)}
        style={{ background: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, padding: 12, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B' }}>💡 知识点</Typography>
          <motion.div animate={{ rotate: showInfo ? 180 : 0 }}>
            <ExpandMoreIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
          </motion.div>
        </div>
        
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div style={{ paddingTop: 8, fontSize: 13, lineHeight: 1.8 }}>
                <p style={{ margin: '0 0 4px' }}>
                  <strong style={{ color: COLORS.tropicOfCancer }}>北回归线</strong>：23°26′N，夏至日太阳直射
                </p>
                <p style={{ margin: '0 0 4px' }}>
                  <strong style={{ color: COLORS.tropicOfCapricorn }}>南回归线</strong>：23°26′S，冬至日太阳直射
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: COLORS.equator }}>热带</strong>：南北回归线之间，太阳可直射区域
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <AnimationPageLayout
      onBack={onBack}
      pageTitle="南北回归线"
      backButtonColor="#EF4444"
      scene3D={scene3D}
      scene2D={scene2D}
      controlPanel={controlPanel}
      mobileControlPanel={mobileControlPanel}
      bottomControls={bottomControls}
      controlHint={(isMobile) => isMobile ? '👆 拖拽旋转 | 双指缩放' : '🖱️ 拖拽旋转 | 滚轮缩放'}
      panelWidth={320}
    />
  );
}
