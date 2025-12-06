/**
 * 天文学相关工具函数
 */

import { ORBIT_RADIUS } from '../constants';

/**
 * 格式化角度为度分格式
 * @param value 角度值（度）
 * @param includeDirection 是否包含方向（N/S）
 * @returns 格式化后的字符串，如 "23°26′N"
 */
export const formatDegreeMinute = (value: number, includeDirection = true): string => {
  const degrees = Math.floor(Math.abs(value));
  const minutes = Math.round((Math.abs(value) - degrees) * 60);
  
  // 纬度为0时（赤道）不显示N/S
  if (!includeDirection || Math.abs(value) < 0.01) {
    return `${degrees}°${minutes}′`;
  }
  
  const sign = value > 0 ? 'N' : 'S';
  return `${degrees}°${minutes}′${sign}`;
};

/**
 * 根据公转进度计算地球位置
 * 
 * 坐标系说明：
 * - 使用 (cos(angle), 0, -sin(angle)) 使得从北极（+Y方向）俯视时公转为逆时针方向
 * - progress=0 时地球在 +X 方向（冬至）
 * - progress=0.25 时地球在 -Z 方向（春分）
 * - progress=0.5 时地球在 -X 方向（夏至）
 * - progress=0.75 时地球在 +Z 方向（秋分）
 * 
 * @param progress 公转进度 0-1
 * @param radius 轨道半径，默认为 ORBIT_RADIUS
 * @returns [x, y, z] 位置坐标
 */
export const calculateEarthPosition = (
  progress: number,
  radius: number = ORBIT_RADIUS
): [number, number, number] => {
  const angle = progress * Math.PI * 2;
  return [
    Math.cos(angle) * radius,
    0,
    -Math.sin(angle) * radius, // 负号使公转方向为逆时针
  ];
};

/**
 * 根据公转角度计算轨道切线方向（用于公转方向箭头）
 * 
 * 逆时针切线方向 = d/dθ (cos(θ), 0, -sin(θ)) = (-sin(θ), 0, -cos(θ))
 * 
 * @param angle 公转角度（弧度）
 * @returns 切线方向的旋转角度（绕Y轴）
 */
export const calculateOrbitTangentRotation = (angle: number): number => {
  const tangentX = -Math.sin(angle);
  const tangentZ = -Math.cos(angle);
  return Math.atan2(tangentZ, tangentX);
};

/**
 * 根据纬度计算在球面上的位置
 * @param latitude 纬度（度）
 * @param radius 球体半径
 * @returns { y: 高度, circleRadius: 纬线圈半径 }
 */
export const calculateLatitudePosition = (latitude: number, radius: number) => {
  const latRad = (latitude * Math.PI) / 180;
  return {
    y: Math.sin(latRad) * radius,
    circleRadius: Math.cos(latRad) * radius,
  };
};
