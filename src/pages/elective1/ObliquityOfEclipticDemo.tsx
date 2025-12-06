/**
 * 黄赤交角（Obliquity of the Ecliptic）交互式动画组件
 * 
 * 帮助学生直观理解：
 * 1. 地轴相对于黄道面的倾角约为 23.5°
 * 2. 地球自转轴始终指向同一方向，公转时保持倾斜方向不变
 * 3. 黄道面与赤道面之间的夹角就是黄赤交角
 * 4. 黄赤交角导致太阳直射点南北移动、四季变化等
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// ===================== 类型定义 =====================

/** 组件 Props 类型 */
interface ObliquityOfEclipticDemoProps {
  /** 初始倾角度数，默认 23.5 */
  initialObliquity?: number;
  /** 最小倾角度数，默认 0 */
  minObliquity?: number;
  /** 最大倾角度数，默认 30 */
  maxObliquity?: number;
  /** 公转动画速度（毫秒/帧），默认 50 */
  animationSpeed?: number;
  /** SVG 画布宽度，默认 500 */
  svgWidth?: number;
  /** SVG 画布高度，默认 500 */
  svgHeight?: number;
}

/** 地球位置状态 */
interface EarthPosition {
  x: number;
  y: number;
  angle: number; // 公转角度（弧度）
}

// ===================== 常量定义 =====================

const DEFAULT_OBLIQUITY = 23.5;
const MIN_OBLIQUITY = 0;
const MAX_OBLIQUITY = 30;
const ANIMATION_SPEED = 50;
const SVG_WIDTH = 500;
const SVG_HEIGHT = 500;

// 颜色定义 - 柔和、高对比度、课堂友好
const COLORS = {
  sun: '#fbbf24',           // 太阳 - 暖黄色
  sunGlow: '#fde68a',       // 太阳光晕
  earth: '#3b82f6',         // 地球 - 蓝色
  earthDark: '#1e40af',     // 地球阴影
  orbit: '#94a3b8',         // 轨道 - 灰色
  eclipticPlane: '#10b981', // 黄道面 - 绿色
  equatorPlane: '#f59e0b',  // 赤道面 - 橙色
  axis: '#ef4444',          // 地轴 - 红色
  angleArc: '#8b5cf6',      // 角度弧线 - 紫色
  background: '#f1f5f9',    // 背景
};

// ===================== 辅助函数 =====================

/** 角度转弧度 */
const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** 生成 SVG 弧形路径 */
const describeArc = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  const start = {
    x: cx + radius * Math.cos(degToRad(startAngle)),
    y: cy + radius * Math.sin(degToRad(startAngle)),
  };
  const end = {
    x: cx + radius * Math.cos(degToRad(endAngle)),
    y: cy + radius * Math.sin(degToRad(endAngle)),
  };
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

// ===================== 子组件 =====================

/** 太阳组件 Props */
interface SunProps {
  cx: number;
  cy: number;
  radius: number;
}

/** 太阳组件 */
function Sun({ cx, cy, radius }: SunProps) {
  return (
  <g aria-label="太阳">
    {/* 太阳光晕 */}
    <circle
      cx={cx}
      cy={cy}
      r={radius * 1.5}
      fill={COLORS.sunGlow}
      opacity={0.3}
    />
    {/* 太阳主体 */}
    <circle cx={cx} cy={cy} r={radius} fill={COLORS.sun} />
    {/* 太阳光芒 */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <line
        key={angle}
        x1={cx + radius * 1.2 * Math.cos(degToRad(angle))}
        y1={cy + radius * 1.2 * Math.sin(degToRad(angle))}
        x2={cx + radius * 1.8 * Math.cos(degToRad(angle))}
        y2={cy + radius * 1.8 * Math.sin(degToRad(angle))}
        stroke={COLORS.sun}
        strokeWidth={3}
        strokeLinecap="round"
      />
    ))}
    <text
      x={cx}
      y={cy + 5}
      textAnchor="middle"
      fill="#92400e"
      fontSize="14"
      fontWeight="bold"
    >
      太阳
    </text>
  </g>
  );
}

/** 轨道组件 Props */
interface OrbitProps {
  cx: number;
  cy: number;
  radius: number;
}

/** 地球轨道组件 */
function Orbit({ cx, cy, radius }: OrbitProps) {
  return (
  <g aria-label="地球公转轨道">
    <ellipse
      cx={cx}
      cy={cy}
      rx={radius}
      ry={radius * 0.35}
      fill="none"
      stroke={COLORS.orbit}
      strokeWidth={2}
      strokeDasharray="8,4"
      opacity={0.7}
    />
  </g>
  );
}

/** 地球组件（带倾斜地轴） */
interface EarthProps {
  position: EarthPosition;
  obliquity: number;
  earthRadius: number;
  onAngleClick?: () => void;
  onAngleHover?: (isHovering: boolean) => void;
  showTooltip: boolean;
}

function Earth({
  position,
  obliquity,
  earthRadius,
  onAngleClick,
  onAngleHover,
  showTooltip,
}: EarthProps) {
  const { x, y } = position;
  const axisLength = earthRadius * 2.5;
  const obliquityRad = degToRad(obliquity);
  
  // 地轴端点计算（倾斜角度，始终指向同一方向）
  const axisTop = {
    x: x + axisLength * Math.sin(obliquityRad),
    y: y - axisLength * Math.cos(obliquityRad),
  };
  const axisBottom = {
    x: x - axisLength * Math.sin(obliquityRad),
    y: y + axisLength * Math.cos(obliquityRad),
  };

  // 赤道面线（与地轴垂直）
  const equatorLength = earthRadius * 1.8;
  const equatorLeft = {
    x: x - equatorLength * Math.cos(obliquityRad),
    y: y - equatorLength * Math.sin(obliquityRad),
  };
  const equatorRight = {
    x: x + equatorLength * Math.cos(obliquityRad),
    y: y + equatorLength * Math.sin(obliquityRad),
  };

  // 黄道面线（水平）
  const eclipticLength = earthRadius * 1.8;

  // 角度弧线参数
  const arcRadius = earthRadius * 1.2;
  const arcPath = describeArc(x, y, arcRadius, -90, -90 + obliquity);

  return (
    <g aria-label={`地球，地轴倾角 ${obliquity.toFixed(1)} 度`}>
      {/* 黄道面指示线 */}
      <line
        x1={x - eclipticLength}
        y1={y}
        x2={x + eclipticLength}
        y2={y}
        stroke={COLORS.eclipticPlane}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.8}
      />
      <text
        x={x + eclipticLength + 5}
        y={y + 5}
        fill={COLORS.eclipticPlane}
        fontSize="12"
        fontWeight="bold"
      >
        黄道面
      </text>

      {/* 赤道面指示线 */}
      <line
        x1={equatorLeft.x}
        y1={equatorLeft.y}
        x2={equatorRight.x}
        y2={equatorRight.y}
        stroke={COLORS.equatorPlane}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.8}
      />
      <text
        x={equatorRight.x + 5}
        y={equatorRight.y + 5}
        fill={COLORS.equatorPlane}
        fontSize="12"
        fontWeight="bold"
      >
        赤道面
      </text>

      {/* 地球主体 */}
      <circle
        cx={x}
        cy={y}
        r={earthRadius}
        fill={COLORS.earth}
        stroke={COLORS.earthDark}
        strokeWidth={2}
      />
      
      {/* 地球简化大陆轮廓 */}
      <ellipse
        cx={x - 3}
        cy={y - 2}
        rx={earthRadius * 0.4}
        ry={earthRadius * 0.3}
        fill="#22c55e"
        opacity={0.6}
      />
      <ellipse
        cx={x + 5}
        cy={y + 5}
        rx={earthRadius * 0.25}
        ry={earthRadius * 0.2}
        fill="#22c55e"
        opacity={0.6}
      />

      {/* 地轴 */}
      <line
        x1={axisBottom.x}
        y1={axisBottom.y}
        x2={axisTop.x}
        y2={axisTop.y}
        stroke={COLORS.axis}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* 地轴端点（北极） */}
      <circle cx={axisTop.x} cy={axisTop.y} r={4} fill={COLORS.axis} />
      <text
        x={axisTop.x + 8}
        y={axisTop.y}
        fill={COLORS.axis}
        fontSize="11"
        fontWeight="bold"
      >
        地轴(N)
      </text>

      {/* 黄赤交角弧线 - 可交互 */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={onAngleClick}
        onMouseEnter={() => onAngleHover?.(true)}
        onMouseLeave={() => onAngleHover?.(false)}
      >
        <path
          d={arcPath}
          fill="none"
          stroke={COLORS.angleArc}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* 角度文字标注 */}
        <text
          x={x + arcRadius * 0.5}
          y={y - arcRadius * 0.7}
          fill={COLORS.angleArc}
          fontSize="14"
          fontWeight="bold"
        >
          {obliquity.toFixed(1)}°
        </text>
        {/* 透明的可点击区域 */}
        <path
          d={arcPath}
          fill="none"
          stroke="transparent"
          strokeWidth={15}
        />
      </g>

      {/* Tooltip 提示框 */}
      {showTooltip && (
        <g>
          <rect
            x={x + arcRadius * 0.3}
            y={y - arcRadius * 1.5}
            width={160}
            height={50}
            rx={6}
            fill="#1e293b"
            opacity={0.95}
          />
          <text
            x={x + arcRadius * 0.3 + 10}
            y={y - arcRadius * 1.5 + 20}
            fill="white"
            fontSize="11"
          >
            黄赤交角 = 地轴与
          </text>
          <text
            x={x + arcRadius * 0.3 + 10}
            y={y - arcRadius * 1.5 + 38}
            fill="white"
            fontSize="11"
          >
            公转轨道面法线的夹角
          </text>
        </g>
      )}

      {/* 地球标签 */}
      <text
        x={x}
        y={y + earthRadius + 20}
        textAnchor="middle"
        fill={COLORS.earthDark}
        fontSize="12"
        fontWeight="bold"
      >
        地球
      </text>
    </g>
  );
}

/** 图例组件 */
function Legend() {
  return (
  <g aria-label="图例" transform="translate(10, 10)">
    <rect
      x={0}
      y={0}
      width={140}
      height={90}
      rx={6}
      fill="white"
      stroke="#e2e8f0"
      strokeWidth={1}
    />
    <text x={10} y={20} fontSize="12" fontWeight="bold" fill="#475569">
      图例
    </text>
    
    {/* 黄道面 */}
    <line x1={10} y1={35} x2={30} y2={35} stroke={COLORS.eclipticPlane} strokeWidth={3} />
    <text x={38} y={39} fontSize="11" fill="#475569">黄道面</text>
    
    {/* 赤道面 */}
    <line x1={10} y1={52} x2={30} y2={52} stroke={COLORS.equatorPlane} strokeWidth={3} />
    <text x={38} y={56} fontSize="11" fill="#475569">赤道面</text>
    
    {/* 地轴 */}
    <line x1={10} y1={69} x2={30} y2={69} stroke={COLORS.axis} strokeWidth={3} />
    <text x={38} y={73} fontSize="11" fill="#475569">地轴</text>
    
    {/* 黄赤交角 */}
    <line x1={10} y1={86} x2={30} y2={86} stroke={COLORS.angleArc} strokeWidth={3} />
    <text x={38} y={90} fontSize="11" fill="#475569">黄赤交角</text>
  </g>
  );
}

// ===================== 主组件 =====================

function ObliquityOfEclipticDemo({
  initialObliquity = DEFAULT_OBLIQUITY,
  minObliquity = MIN_OBLIQUITY,
  maxObliquity = MAX_OBLIQUITY,
  animationSpeed = ANIMATION_SPEED,
  svgWidth = SVG_WIDTH,
  svgHeight = SVG_HEIGHT,
}: ObliquityOfEclipticDemoProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 状态
  const [obliquity, setObliquity] = useState<number>(initialObliquity);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [orbitAngle, setOrbitAngle] = useState<number>(0);
  const [showAngleTooltip, setShowAngleTooltip] = useState<boolean>(false);

  // 计算地球位置
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const orbitRadius = svgWidth * 0.35;
  const sunRadius = 35;
  const earthRadius = 25;

  const earthPosition = useMemo<EarthPosition>(() => {
    const angleRad = degToRad(orbitAngle);
    return {
      x: centerX + orbitRadius * Math.cos(angleRad),
      y: centerY + orbitRadius * 0.35 * Math.sin(angleRad),
      angle: angleRad,
    };
  }, [orbitAngle, centerX, centerY, orbitRadius]);

  // 公转动画
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(() => {
      setOrbitAngle((prev) => (prev + 0.5) % 360);
    }, animationSpeed);

    return () => clearInterval(intervalId);
  }, [isPlaying, animationSpeed]);

  // 事件处理
  const handleObliquityChange = useCallback(
    (_event: Event, value: number | number[]) => {
      setObliquity(value as number);
    },
    []
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleAngleClick = useCallback(() => {
    setShowAngleTooltip((prev) => !prev);
  }, []);

  const handleAngleHover = useCallback((isHovering: boolean) => {
    setShowAngleTooltip(isHovering);
  }, []);

  // 格式化角度显示
  const formatObliquity = (value: number): string => {
    const degrees = Math.floor(value);
    const minutes = Math.round((value - degrees) * 60);
    return `${degrees}°${minutes}′`;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 3,
        alignItems: 'stretch',
      }}
      role="region"
      aria-label="黄赤交角交互式演示"
    >
      {/* 左侧：SVG 动画区域 */}
      <Card
        sx={{
          flex: isMobile ? 'none' : 1,
          minHeight: isMobile ? 400 : 'auto',
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: 'primary.main', textAlign: 'center' }}
          >
            太阳-地球系统示意图
          </Typography>
          
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: COLORS.background,
              borderRadius: 2,
              p: 1,
            }}
          >
            <svg
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              aria-label="黄赤交角动画演示图"
              role="img"
            >
              <title>太阳-地球系统与黄赤交角示意图</title>
              <desc>
                展示地球绕太阳公转的动画，地轴保持约{obliquity.toFixed(1)}度的倾斜，
                黄道面（绿色）和赤道面（橙色）之间的夹角即为黄赤交角。
              </desc>

              {/* 背景 */}
              <rect
                x={0}
                y={0}
                width={svgWidth}
                height={svgHeight}
                fill={COLORS.background}
              />

              {/* 轨道（黄道面投影） */}
              <Orbit cx={centerX} cy={centerY} radius={orbitRadius} />

              {/* 太阳 */}
              <Sun cx={centerX} cy={centerY} radius={sunRadius} />

              {/* 地球 */}
              <Earth
                position={earthPosition}
                obliquity={obliquity}
                earthRadius={earthRadius}
                onAngleClick={handleAngleClick}
                onAngleHover={handleAngleHover}
                showTooltip={showAngleTooltip}
              />

              {/* 图例 */}
              <Legend />

              {/* 公转方向指示 */}
              <g transform={`translate(${svgWidth - 80}, ${svgHeight - 40})`}>
                <text fontSize="11" fill="#64748b">
                  公转方向 →
                </text>
              </g>
            </svg>
          </Box>

          {/* 控制按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isPlaying ? <PauseIcon /> : <PlayIcon />}
              onClick={handlePlayPause}
              aria-label={isPlaying ? '暂停动画' : '播放动画'}
              sx={{ minWidth: 140 }}
            >
              {isPlaying ? '暂停' : '播放'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 右侧：说明区域 */}
      <Card sx={{ flex: isMobile ? 'none' : 1 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: 'primary.main', mb: 2 }}
          >
            黄赤交角（Obliquity of the Ecliptic）
          </Typography>

          {/* 倾角控制滑块 */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              bgcolor: 'grey.50',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              调节地轴倾角
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {minObliquity}°
              </Typography>
              <Slider
                value={obliquity}
                onChange={handleObliquityChange}
                min={minObliquity}
                max={maxObliquity}
                step={0.1}
                aria-label="地轴倾角"
                aria-valuetext={`当前倾角 ${formatObliquity(obliquity)}`}
                sx={{ flex: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {maxObliquity}°
              </Typography>
            </Box>
            <Typography
              variant="h6"
              sx={{
                textAlign: 'center',
                mt: 1,
                color: 'primary.main',
                fontWeight: 700,
              }}
            >
              当前倾角：{formatObliquity(obliquity)}
            </Typography>
            {Math.abs(obliquity - 23.5) < 0.5 && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  color: 'success.main',
                  mt: 0.5,
                }}
              >
                ✓ 接近实际黄赤交角（约23°26′）
              </Typography>
            )}
          </Paper>

          <Divider sx={{ my: 2 }} />

          {/* 概念说明 */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            核心概念
          </Typography>

          <List dense>
            <ListItem alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 4,
                    bgcolor: COLORS.eclipticPlane,
                    borderRadius: 1,
                    mt: 1,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    黄道面
                  </Typography>
                }
                secondary="地球绕太阳公转的轨道所在平面。地球一年内在这个平面上绕太阳运行一周。"
              />
            </ListItem>

            <ListItem alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 4,
                    bgcolor: COLORS.equatorPlane,
                    borderRadius: 1,
                    mt: 1,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    赤道面
                  </Typography>
                }
                secondary="过地心且与地轴垂直的平面，是地球自转形成的基准面。"
              />
            </ListItem>

            <ListItem alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 4,
                    bgcolor: COLORS.angleArc,
                    borderRadius: 1,
                    mt: 1,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    黄赤交角
                  </Typography>
                }
                secondary={
                  <>
                    黄道面与赤道面之间的夹角，目前约为 <strong>23°26′</strong>（约23.5°）。
                    这个角度决定了太阳直射点的南北移动范围。
                  </>
                }
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          {/* 重要提示 */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'primary.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'primary.200',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <InfoIcon sx={{ color: 'primary.main', mt: 0.3 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  关键特征
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  地球公转过程中，地轴始终指向同一方向（接近北极星方向），
                  保持约 23.5° 的倾斜不变。这导致了太阳直射点在南北回归线之间移动，
                  形成四季变化。
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* 交互提示 */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 2,
              color: 'text.secondary',
            }}
          >
            💡 提示：点击或悬停左侧图中的紫色弧线可查看黄赤交角的定义
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ObliquityOfEclipticDemo;
