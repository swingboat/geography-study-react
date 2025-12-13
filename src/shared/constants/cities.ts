/**
 * 常用城市数据
 * 用于位置选择器组件
 */

export interface City {
  name: string;
  lat: number;      // 纬度
  lon: number;      // 经度
  timezone: number; // 时区
}

/** 常用城市列表 - 覆盖全球主要城市 */
export const FAMOUS_CITIES: City[] = [
  // 中国城市
  { name: '北京', lat: 39.9, lon: 116.4, timezone: 8 },
  { name: '上海', lat: 31.2, lon: 121.5, timezone: 8 },
  { name: '广州', lat: 23.1, lon: 113.3, timezone: 8 },
  { name: '哈尔滨', lat: 45.8, lon: 126.5, timezone: 8 },
  { name: '新加坡', lat: 1.3, lon: 103.8, timezone: 8 },
  // 其他亚洲城市
  { name: '东京', lat: 35.7, lon: 139.7, timezone: 9 },
  { name: '莫斯科', lat: 55.8, lon: 37.6, timezone: 3 },
  // 欧洲城市
  { name: '伦敦', lat: 51.5, lon: 0, timezone: 0 },
  // 美洲城市
  { name: '纽约', lat: 40.7, lon: -74.0, timezone: -5 },
  // 大洋洲城市
  { name: '悉尼', lat: -33.9, lon: 151.2, timezone: 10 },
  // 非洲城市
  { name: '开普敦', lat: -33.9, lon: 18.4, timezone: 2 },
  // 特殊位置
  { name: '赤道', lat: 0, lon: 0, timezone: 0 },
];
