/**
 * 天文学相关常量
 */

/** 黄赤交角 23°26′ (约 23.4333°) */
export const OBLIQUITY = 23 + 26 / 60; // 23°26′ ≈ 23.4333°

/** 极圈纬度 = 90° - 黄赤交角 */
export const ARCTIC_CIRCLE_LAT = 90 - OBLIQUITY; // 66.74°

/** 公转轨道半径 */
export const ORBIT_RADIUS = 8;

/** 通用颜色配置 */
export const ASTRONOMY_COLORS = {
  // 天体颜色
  sun: '#FFD93D',
  sunGlow: '#FFF3B0',
  earth: '#4A90D9',
  earthGreen: '#5CB85C',
  
  // 轨道和平面
  orbit: '#6366F1',
  eclipticPlane: '#10B981',    // 黄道面 - 绿色
  equatorPlane: '#F59E0B',     // 赤道面 - 橙色
  
  // 纬线颜色
  tropicOfCancer: '#EF4444',   // 北回归线 - 红色
  tropicOfCapricorn: '#3B82F6', // 南回归线 - 蓝色
  equator: '#10B981',          // 赤道 - 绿色
  arcticCircle: '#F97316',     // 北极圈 - 橙色
  antarcticCircle: '#8B5CF6',  // 南极圈 - 紫色
  
  // 其他
  sunRay: '#FBBF24',           // 太阳光线
  axis: '#94A3B8',             // 地轴 - 灰色
  angleArc: '#A855F7',         // 角度弧 - 紫色
  space: '#0F172A',            // 太空背景
  
  // 方向指示
  orbitDirection: '#4ADE80',   // 公转方向箭头 - 绿色
  rotationDirection: '#60A5FA', // 自转方向 - 蓝色
};

/** 季节类型 */
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';

/** 季节配置 */
export const SEASONS: Record<SeasonType, {
  name: string;
  date: string;
  sunLatitude: number;
  description: string;
  emoji: string;
}> = {
  spring: {
    name: '春分',
    date: '3月21日前后',
    sunLatitude: 0,
    description: '太阳直射赤道，全球昼夜等长',
    emoji: '🌸',
  },
  summer: {
    name: '夏至',
    date: '6月21日前后',
    sunLatitude: OBLIQUITY,
    description: '太阳直射北回归线，北半球白昼最长',
    emoji: '☀️',
  },
  autumn: {
    name: '秋分',
    date: '9月23日前后',
    sunLatitude: 0,
    description: '太阳直射赤道，全球昼夜等长',
    emoji: '🍂',
  },
  winter: {
    name: '冬至',
    date: '12月22日前后',
    sunLatitude: -OBLIQUITY,
    description: '太阳直射南回归线，北半球白昼最短',
    emoji: '❄️',
  },
};

/**
 * 季节与公转进度的映射
 * 
 * 坐标系：位置 = (cos(angle), 0, -sin(angle))，从北极俯视逆时针
 * 地轴指向+X（北极星方向），决定了季节与位置的对应关系：
 * - 冬至: progress=0 → angle=0 → (+X, 0, 0) 右下 → 北极背离太阳 → 直射南回归线
 * - 春分: progress=0.25 → angle=π/2 → (0, 0, -1) 右上 → 直射赤道
 * - 夏至: progress=0.5 → angle=π → (-X, 0, 0) 左上 → 北极朝向太阳 → 直射北回归线
 * - 秋分: progress=0.75 → angle=3π/2 → (0, 0, +1) 左下 → 直射赤道
 */
export const SEASON_PROGRESS_MAP: Record<SeasonType, number> = {
  winter: 0,
  spring: 0.25,
  summer: 0.5,
  autumn: 0.75,
};
