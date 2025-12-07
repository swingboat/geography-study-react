/**
 * 黄赤交角 3D 交互式动画组件
 * 使用 Three.js + React Three Fiber 实现真 3D 效果
 * 
 * 面向高中生的现代化、活泼的教学动画
 */

import { useRef, useState, Suspense } from 'react';
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
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  RestartAlt as ResetIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

// 导入公共组件和工具
import {
  OBLIQUITY,
  ASTRONOMY_COLORS,
} from '../../shared/constants';
import { formatDegreeMinute } from '../../shared/utils';
import {
  Sun,
  OrbitPath,
  CameraController,
  AnimationPageLayout,
  SceneLoading,
  type CameraControllerHandle,
} from '../../shared/components';

// ===================== 类型定义 =====================

interface ObliquityDemo3DProps {
  initialObliquity?: number;
  minObliquity?: number;
  maxObliquity?: number;
}

// ===================== 本地常量 =====================

const COLORS = {
  ...ASTRONOMY_COLORS,
  // 特定于此组件的颜色覆盖
  axis: '#EF4444',  // 此演示中地轴使用红色以强调倾斜
};

// ===================== 本地 3D 组件（特定于此演示） =====================

/** 地球组件 - 带真实地图纹理（特定于黄赤交角演示） */
interface EarthProps {
  position: [number, number, number];
  obliquity: number;
  showLabels: boolean;
}

function Earth({ position, obliquity, showLabels }: EarthProps) {
  const earthRef = useRef<THREE.Group>(null);
  const earthMeshRef = useRef<THREE.Mesh>(null);
  const obliquityRad = (obliquity * Math.PI) / 180;

  // 加载地球纹理 - 使用本地文件
  const [earthMap, earthNormal, earthSpec, cloudsMap] = useTexture([
    '/textures/earth.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.png',
  ]);

  // 地球自转
  useFrame(({ clock }) => {
    if (earthMeshRef.current) {
      earthMeshRef.current.rotation.y = clock.elapsedTime * 0.3;
    }
  });

  // 地轴方向（保持倾斜）
  const axisTop = new THREE.Vector3(
    Math.sin(obliquityRad) * 2,
    Math.cos(obliquityRad) * 2,
    0
  );
  const axisBottom = new THREE.Vector3(
    -Math.sin(obliquityRad) * 2,
    -Math.cos(obliquityRad) * 2,
    0
  );

  return (
    <group position={position} ref={earthRef}>
      {/* 地球主体 - 带真实纹理 */}
      <group rotation={[0, 0, obliquityRad]}>
        <mesh ref={earthMeshRef}>
          <sphereGeometry args={[0.8, 64, 64]} />
          <meshStandardMaterial
            map={earthMap}
            normalMap={earthNormal}
            normalScale={new THREE.Vector2(0.5, 0.5)}
            roughnessMap={earthSpec}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
        
        {/* 云层 */}
        <mesh>
          <sphereGeometry args={[0.82, 64, 64]} />
          <meshBasicMaterial
            map={cloudsMap}
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>

        {/* 大气层光晕 */}
        <mesh>
          <sphereGeometry args={[0.88, 64, 64]} />
          <meshBasicMaterial
            color="#88CCFF"
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* 地轴 */}
      <Line
        points={[axisBottom.toArray(), axisTop.toArray()]}
        color={COLORS.axis}
        lineWidth={3}
      />
      
      {/* 北极点 */}
      <mesh position={axisTop.toArray()}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={COLORS.axis} />
      </mesh>

      {/* 黄道面（水平圆盘） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 64]} />
        <meshBasicMaterial 
          color={COLORS.eclipticPlane} 
          transparent 
          opacity={0.25} 
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 黄道面边缘线 */}
      <Line
        points={Array.from({ length: 65 }, (_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          return [Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8];
        })}
        color={COLORS.eclipticPlane}
        lineWidth={2}
      />

      {/* 赤道面（倾斜圆盘） - 与地轴垂直 */}
      {/* 地轴向右上倾斜，赤道面应向右下倾斜 */}
      <mesh rotation={[-Math.PI / 2, 0, -obliquityRad]}>
        <circleGeometry args={[1.5, 64]} />
        <meshBasicMaterial 
          color={COLORS.equatorPlane} 
          transparent 
          opacity={0.25} 
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 赤道面边缘线 - 与地轴垂直的圆 */}
      <Line
        points={Array.from({ length: 65 }, (_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          // 先在XZ平面画圆，然后绕Z轴旋转-obliquityRad（向右下倾斜）
          const x0 = Math.cos(angle) * 1.5;
          const y0 = 0;
          const z0 = Math.sin(angle) * 1.5;
          // 绕Z轴旋转（负角度，向右下倾斜）
          const x = x0 * Math.cos(-obliquityRad) - y0 * Math.sin(-obliquityRad);
          const y = x0 * Math.sin(-obliquityRad) + y0 * Math.cos(-obliquityRad);
          const z = z0;
          return [x, y, z];
        })}
        color={COLORS.equatorPlane}
        lineWidth={2}
      />

      {/* 标签 */}
      {showLabels && (
        <>
          <Html position={[2.2, 0, 0]} center>
            <div style={{ color: COLORS.eclipticPlane, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              黄道面
            </div>
          </Html>
          <Html position={[2.2 * Math.cos(obliquityRad), 2.2 * Math.sin(obliquityRad), 0]} center>
            <div style={{ color: COLORS.equatorPlane, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              赤道面
            </div>
          </Html>
          <Html position={[axisTop.x + 0.3, axisTop.y + 0.3, 0]} center>
            <div style={{ color: COLORS.axis, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              N极
            </div>
          </Html>
          <Html position={[1.3, -0.8, 0]} center>
            <div style={{ 
              color: COLORS.angleArc, 
              fontSize: '14px', 
              fontWeight: 'bold',
              background: 'rgba(168, 85, 247, 0.2)',
              padding: '2px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap'
            }}>
              {formatDegreeMinute(obliquity)}
            </div>
          </Html>
        </>
      )}

    </group>
  );
}

/** 场景组件 */
interface SceneProps {
  obliquity: number;
  isPlaying: boolean;
  showLabels: boolean;
  cameraRef: React.RefObject<CameraControllerHandle>;
}

function Scene({ obliquity, isPlaying, showLabels, cameraRef }: SceneProps) {
  const orbitRadius = 8;
  const [orbitAngle, setOrbitAngle] = useState(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      // 地球公转方向：从北极上方俯视为逆时针（自西向东）
      // 在 Three.js 坐标系中，使用负 sin 使运动方向变为逆时针
      setOrbitAngle(prev => (prev + delta * 0.3) % (Math.PI * 2));
    }
  });

  const earthPosition: [number, number, number] = [
    Math.cos(orbitAngle) * orbitRadius,
    0,
    -Math.sin(orbitAngle) * orbitRadius  // 负号使公转方向为逆时针
  ];

  return (
    <>
      {/* 环境 */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      
      {/* 太阳 */}
      <Sun />
      
      {/* 轨道 - 使用公共组件 */}
      <OrbitPath radius={orbitRadius} />
      
      {/* 黄道面可视化（半透明圆盘） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[3, orbitRadius + 2, 64]} />
        <meshBasicMaterial 
          color={COLORS.eclipticPlane} 
          transparent 
          opacity={0.05} 
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* 地球 */}
      <Earth position={earthPosition} obliquity={obliquity} showLabels={showLabels} />
      
      {/* 相机控制 - 使用公共组件 */}
      <CameraController ref={cameraRef} defaultPosition={[15, 10, 15]} />
    </>
  );
}

// ===================== 2D 视图组件 =====================

/** 2D SVG 视图 */
function TwoDView({ obliquity }: { obliquity: number }) {
  const obliquityRad = (obliquity * Math.PI) / 180;
  const cx = 200; // 中心 x
  const cy = 200; // 中心 y
  const earthRadius = 60;
  const axisLength = 100;
  
  // 地轴端点
  const axisTopX = cx + Math.sin(obliquityRad) * axisLength;
  const axisTopY = cy - Math.cos(obliquityRad) * axisLength;
  const axisBottomX = cx - Math.sin(obliquityRad) * axisLength;
  const axisBottomY = cy + Math.cos(obliquityRad) * axisLength;
  
  // 赤道线端点（与地轴垂直）
  const equatorHalfLen = 80;
  const equatorX1 = cx + Math.cos(obliquityRad) * equatorHalfLen;
  const equatorY1 = cy + Math.sin(obliquityRad) * equatorHalfLen;
  const equatorX2 = cx - Math.cos(obliquityRad) * equatorHalfLen;
  const equatorY2 = cy - Math.sin(obliquityRad) * equatorHalfLen;

  // 角度弧线路径
  const arcRadius = 40;
  const arcPath = `M ${cx} ${cy - arcRadius} A ${arcRadius} ${arcRadius} 0 0 1 ${cx + Math.sin(obliquityRad) * arcRadius} ${cy - Math.cos(obliquityRad) * arcRadius}`;

  return (
    <svg width="400" height="400" viewBox="0 0 400 400" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* 背景 */}
      <rect width="400" height="400" fill="transparent" />
      
      {/* 黄道面（水平线） */}
      <line 
        x1="50" y1={cy} 
        x2="350" y2={cy} 
        stroke={COLORS.eclipticPlane} 
        strokeWidth="3" 
        strokeDasharray="10,5"
      />
      <text x="355" y={cy + 5} fill={COLORS.eclipticPlane} fontSize="14" fontWeight="bold">黄道面</text>
      
      {/* 赤道面（倾斜线） */}
      <line 
        x1={equatorX2} y1={equatorY2} 
        x2={equatorX1} y2={equatorY1} 
        stroke={COLORS.equatorPlane} 
        strokeWidth="3" 
        strokeDasharray="10,5"
      />
      <text x={equatorX1 + 10} y={equatorY1} fill={COLORS.equatorPlane} fontSize="14" fontWeight="bold">赤道面</text>
      
      {/* 地球 */}
      <circle cx={cx} cy={cy} r={earthRadius} fill={COLORS.earth} />
      <ellipse 
        cx={cx} cy={cy} 
        rx={earthRadius} ry={earthRadius * 0.3} 
        fill="none" 
        stroke="rgba(255,255,255,0.3)" 
        strokeWidth="1"
        transform={`rotate(${obliquity}, ${cx}, ${cy})`}
      />
      
      {/* 地轴 */}
      <line 
        x1={axisBottomX} y1={axisBottomY} 
        x2={axisTopX} y2={axisTopY} 
        stroke={COLORS.axis} 
        strokeWidth="3"
      />
      {/* 北极点 */}
      <circle cx={axisTopX} cy={axisTopY} r="6" fill={COLORS.axis} />
      <text x={axisTopX + 10} y={axisTopY} fill={COLORS.axis} fontSize="14" fontWeight="bold">N</text>
      
      {/* 黄赤交角弧线 */}
      <path 
        d={arcPath} 
        fill="none" 
        stroke={COLORS.angleArc} 
        strokeWidth="3"
      />
      
      {/* 角度标注 */}
      <text 
        x={cx + 50} 
        y={cy - 50} 
        fill={COLORS.angleArc} 
        fontSize="18" 
        fontWeight="bold"
      >
        {formatDegreeMinute(obliquity)}
      </text>
      
      {/* 垂直参考线（虚线） */}
      <line 
        x1={cx} y1={cy - 120} 
        x2={cx} y2={cy + 120} 
        stroke="rgba(255,255,255,0.2)" 
        strokeWidth="1" 
        strokeDasharray="5,5"
      />
      
      {/* 图例 */}
      <g transform="translate(20, 320)">
        <rect x="0" y="0" width="20" height="3" fill={COLORS.eclipticPlane} />
        <text x="25" y="5" fill="white" fontSize="12">黄道面</text>
        
        <rect x="0" y="20" width="20" height="3" fill={COLORS.equatorPlane} />
        <text x="25" y="25" fill="white" fontSize="12">赤道面</text>
        
        <rect x="0" y="40" width="20" height="3" fill={COLORS.axis} />
        <text x="25" y="45" fill="white" fontSize="12">地轴</text>
        
        <rect x="0" y="60" width="20" height="3" fill={COLORS.angleArc} />
        <text x="25" y="65" fill="white" fontSize="12">黄赤交角</text>
      </g>
    </svg>
  );
}

// ===================== 主组件 =====================

export default function ObliquityOfEclipticDemo3D({
  initialObliquity = OBLIQUITY,  // 使用公共常量 23°26′
  minObliquity = 0,
  maxObliquity = 30,
}: ObliquityDemo3DProps) {
  const [obliquity, setObliquity] = useState(initialObliquity);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showLabels] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  // 3D 场景
  const scene3D = (
    <Suspense fallback={<SceneLoading />}>
      <Canvas
        camera={{ position: [15, 10, 15], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene obliquity={obliquity} isPlaying={isPlaying} showLabels={showLabels} cameraRef={cameraControllerRef} />
      </Canvas>
    </Suspense>
  );

  // 2D 视图
  const scene2D = (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <TwoDView obliquity={obliquity} />
    </div>
  );

  // 底部控制按钮
  const bottomControls = (is3D: boolean) => (
    <>
      {is3D && (
        <>
          <Tooltip title={isPlaying ? '暂停' : '播放'}>
            <IconButton
              onClick={() => setIsPlaying(!isPlaying)}
              sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
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
      {!is3D && (
        <Tooltip title="重置角度">
          <IconButton
            onClick={() => setObliquity(initialObliquity)}
            sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
          >
            <ResetIcon />
          </IconButton>
        </Tooltip>
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
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(99, 102, 241, 0.2)',
      }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5,
          }}
        >
          🌍 黄赤交角
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Obliquity of the Ecliptic
        </Typography>
      </div>

      {/* 倾角控制 */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          border: '1px solid rgba(14, 165, 233, 0.2)',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.1)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#0EA5E9' }}>
          🎮 调节地轴倾角
        </Typography>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography variant="caption" color="text.secondary">{minObliquity}°</Typography>
          <Slider
            value={obliquity}
            onChange={(_, v) => setObliquity(v as number)}
            min={minObliquity}
            max={maxObliquity}
            step={0.1}
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': {
                background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)',
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">{maxObliquity}°</Typography>
          <Tooltip title="重置为 23°26′">
            <IconButton
              size="small"
              onClick={() => setObliquity(23 + 26/60)}
              sx={{
                color: '#6366F1',
                '&:hover': { background: 'rgba(99, 102, 241, 0.1)' },
              }}
            >
              <ResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>

        <Typography
          variant="h4"
          sx={{
            textAlign: 'center',
            mt: 2,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {formatDegreeMinute(obliquity)}
        </Typography>

        {Math.abs(obliquity - (23 + 26/60)) < 0.5 && (
          <Chip
            label="✨ 接近真实值！(约23°26′)"
            size="small"
            sx={{ 
              mt: 1, 
              width: '100%',
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              color: 'white',
              fontWeight: 500,
            }}
          />
        )}
      </div>

      {/* 图例 */}
      <div style={{ 
        marginBottom: 16,
        padding: 16,
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(16, 185, 129, 0.2)',
        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#10B981' }}>
          📊 图例
        </Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { color: COLORS.eclipticPlane, label: '黄道面' },
            { color: COLORS.equatorPlane, label: '赤道面' },
            { color: COLORS.axis, label: '地轴' },
            { color: COLORS.angleArc, label: '黄赤交角' },
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
                '& .MuiChip-label': {
                  textShadow: `0 0 20px ${item.color}`,
                },
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
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B' }}>
            💡 知识点
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setShowInfo(!showInfo)}
            sx={{ 
              color: '#F59E0B',
              '&:hover': { background: 'rgba(245, 158, 11, 0.1)' },
            }}
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
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.6)', 
                borderRadius: 8, 
                padding: 12,
                fontSize: '13px',
                lineHeight: 1.8,
                backdropFilter: 'blur(10px)',
              }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: COLORS.eclipticPlane }}>黄道面</strong>：地球绕太阳公转的轨道平面
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong style={{ color: COLORS.equatorPlane }}>赤道面</strong>：与地轴垂直，过地心的平面
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: COLORS.angleArc }}>黄赤交角</strong>：约 23°26′，决定了四季变化
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showInfo && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, fontSize: '13px' }}>
            地轴倾斜约 <strong style={{ color: '#F59E0B' }}>23°26′</strong>，使太阳直射点在南北回归线之间移动，形成四季。
          </Typography>
        )}
      </div>

      {/* 观察视角说明 */}
      <div
        style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(139, 92, 246, 0.2)',
          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.1)',
          marginBottom: 16,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#8B5CF6' }}>
          👁️ 观察视角
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.8, fontSize: '13px', color: 'text.secondary' }}>
          我们从太阳系的<strong style={{ color: '#8B5CF6' }}>右上方斜上方</strong>俯视整个场景，可以同时看到太阳、地球公转轨道、地轴倾斜以及黄道面与赤道面的夹角。
        </Typography>
      </div>

      {/* 操作提示 */}
      <div
        style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 114, 182, 0.08) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(236, 72, 153, 0.2)',
          boxShadow: '0 2px 8px rgba(236, 72, 153, 0.1)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#EC4899' }}>
          🎯 试试看
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary', lineHeight: 1.8 }}>
          • 把倾角调到 <strong style={{ color: '#EC4899' }}>0°</strong>，看看会怎样？
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary', lineHeight: 1.8 }}>
          • 真实地球倾角是 <strong style={{ color: '#EC4899' }}>23°26′</strong>
        </Typography>
      </div>
    </CardContent>
  );

  // 移动端控制面板
  const mobileControlPanel = (
    <div style={{ padding: 16, maxHeight: '50vh', overflowY: 'auto' }}>
      {/* 标题 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          🌍 黄赤交角
        </Typography>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {formatDegreeMinute(obliquity)}
        </Typography>
      </div>

      {/* 滑块 */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.08)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography variant="caption" color="text.secondary">{minObliquity}°</Typography>
          <Slider
            value={obliquity}
            onChange={(_, v) => setObliquity(v as number)}
            min={minObliquity}
            max={maxObliquity}
            step={0.1}
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': {
                background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                width: 24,
                height: 24,
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)',
                height: 6,
              },
              '& .MuiSlider-rail': {
                height: 6,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">{maxObliquity}°</Typography>
          <IconButton
            size="small"
            onClick={() => setObliquity(initialObliquity)}
            sx={{ color: '#6366F1' }}
          >
            <ResetIcon fontSize="small" />
          </IconButton>
        </div>
        
        {Math.abs(obliquity - initialObliquity) < 0.5 && (
          <Chip
            label="✨ 接近真实值！(约23°26′)"
            size="small"
            sx={{
              mt: 1,
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              color: 'white',
              fontWeight: 500,
            }}
          />
        )}
      </div>

      {/* 图例 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
      }}>
        {[
          { color: COLORS.eclipticPlane, label: '黄道面' },
          { color: COLORS.equatorPlane, label: '赤道面' },
          { color: COLORS.axis, label: '地轴' },
          { color: COLORS.angleArc, label: '黄赤交角' },
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

      {/* 知识点（可展开） */}
      <div
        onClick={() => setShowInfo(!showInfo)}
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          borderRadius: 12,
          padding: 12,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F59E0B' }}>
            💡 知识点
          </Typography>
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
                  <strong style={{ color: COLORS.eclipticPlane }}>黄道面</strong>：地球绕太阳公转的轨道平面
                </p>
                <p style={{ margin: '0 0 4px' }}>
                  <strong style={{ color: COLORS.equatorPlane }}>赤道面</strong>：与地轴垂直，过地心的平面
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: COLORS.angleArc }}>黄赤交角</strong>：约 23°26′，决定了四季变化
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
