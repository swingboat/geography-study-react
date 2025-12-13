/**
 * 位置选择器组件
 * 提供搜索功能和常用城市快捷选择
 */

import { useState, useMemo } from 'react';
import { Typography, Chip } from '@mui/material';
import { FAMOUS_CITIES, type City } from '../constants/cities';

export type { City };

export interface LocationSelectorProps {
  /** 当前选中的城市名称 */
  selectedCity?: string;
  /** 城市选择回调 */
  onCitySelect: (city: City) => void;
  /** 标题，默认为 "📍 选择位置" */
  title?: string;
  /** 是否显示经度信息 */
  showLongitude?: boolean;
  /** 是否显示时区信息 */
  showTimezone?: boolean;
  /** 自定义城市列表（可选，默认使用 FAMOUS_CITIES） */
  cities?: City[];
}

/**
 * 位置选择器
 * 包含搜索框和常用城市快捷按钮
 */
export function LocationSelector({
  selectedCity,
  onCitySelect,
  title = '📍 选择位置',
  showLongitude = false,
  showTimezone = false,
  cities = FAMOUS_CITIES,
}: LocationSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 根据搜索词过滤城市
  const filteredCities = useMemo(() => {
    if (!searchTerm.trim()) return cities;
    return cities.filter(city => 
      city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [cities, searchTerm]);

  // 格式化城市标签
  const formatCityLabel = (city: City): string => {
    const parts = [city.name];
    
    const latStr = `${Math.abs(city.lat).toFixed(0)}°${city.lat >= 0 ? 'N' : 'S'}`;
    parts.push(latStr);
    
    if (showLongitude) {
      const lonStr = `${Math.abs(city.lon).toFixed(0)}°${city.lon >= 0 ? 'E' : 'W'}`;
      parts.push(lonStr);
    }
    
    if (showTimezone) {
      const tzStr = city.timezone >= 0 ? `UTC+${city.timezone}` : `UTC${city.timezone}`;
      parts.push(tzStr);
    }
    
    return parts.join(' ');
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: '#10B981', mb: 0.5, display: 'block' }}>
        {title}
      </Typography>
      
      {/* 搜索框 */}
      <input
        type="text"
        placeholder="🔍 搜索城市..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #E5E7EB',
          marginBottom: 8,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      
      {/* 城市列表 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {filteredCities.map((city) => (
          <Chip
            key={city.name}
            label={formatCityLabel(city)}
            size="small"
            onClick={() => onCitySelect(city)}
            sx={{
              background: selectedCity === city.name
                ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' 
                : 'rgba(16, 185, 129, 0.1)',
              color: selectedCity === city.name ? 'white' : '#10B981',
              fontWeight: selectedCity === city.name ? 600 : 400,
              fontSize: 11,
            }}
          />
        ))}
        {filteredCities.length === 0 && (
          <Typography variant="caption" sx={{ color: '#9CA3AF', py: 1 }}>
            未找到匹配的城市
          </Typography>
        )}
      </div>
    </div>
  );
}
