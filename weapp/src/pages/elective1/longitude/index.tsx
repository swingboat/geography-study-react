/**
 * 经度演示 - 微信小程序版本
 * 
 * 帮助学生理解：
 * 1. 经度的定义（本初子午线为0°）
 * 2. 东经和西经的概念
 * 3. 不同地区的经度位置
 */
import { useState, useEffect, useRef } from 'react'
import { View, Text, Slider, Button, Canvas, ScrollView } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import './index.scss'

// 颜色定义
const COLORS = {
  earth: '#3b82f6',
  earthDark: '#1e40af',
  primeMeridian: '#ef4444',
  eastLongitude: '#3b82f6',
  westLongitude: '#f59e0b',
  selectedMeridian: '#10b981',
  dateLine: '#8b5cf6',
  equator: '#10b981',
  background: '#0f172a',
}

// 著名城市
const FAMOUS_CITIES = [
  { name: '伦敦', longitude: 0, emoji: '🇬🇧', description: '本初子午线' },
  { name: '巴黎', longitude: 2.3, emoji: '🇫🇷', description: '东经约2°' },
  { name: '开罗', longitude: 31.2, emoji: '🇪🇬', description: '东经约31°' },
  { name: '莫斯科', longitude: 37.6, emoji: '🇷🇺', description: '东经约38°' },
  { name: '迪拜', longitude: 55.3, emoji: '🇦🇪', description: '东经约55°' },
  { name: '新德里', longitude: 77.2, emoji: '🇮🇳', description: '东经约77°' },
  { name: '曼谷', longitude: 100.5, emoji: '🇹🇭', description: '东经约101°' },
  { name: '北京', longitude: 116.4, emoji: '🇨🇳', description: '东经约116°' },
  { name: '东京', longitude: 139.7, emoji: '🇯🇵', description: '东经约140°' },
  { name: '悉尼', longitude: 151.2, emoji: '🇦🇺', description: '东经约151°' },
  { name: '奥克兰', longitude: 174.8, emoji: '🇳🇿', description: '东经约175°' },
  { name: '纽约', longitude: -74.0, emoji: '🇺🇸', description: '西经约74°' },
  { name: '洛杉矶', longitude: -118.2, emoji: '🇺🇸', description: '西经约118°' },
  { name: '檀香山', longitude: -157.9, emoji: '🇺🇸', description: '西经约158°' },
]

// 角度转弧度
const degToRad = (deg: number) => (deg * Math.PI) / 180

// 格式化经度
const formatLongitude = (value: number): string => {
  const absValue = Math.abs(value)
  const degrees = Math.floor(absValue)
  const minutes = Math.round((absValue - degrees) * 60)
  
  if (Math.abs(value) < 0.01) return '0°（本初子午线）'
  if (Math.abs(Math.abs(value) - 180) < 0.01) return '180°（国际日期变更线）'
  
  const direction = value > 0 ? 'E' : 'W'
  return `${degrees}°${minutes > 0 ? minutes + "′" : ""}${direction}`
}

export default function LongitudeDemo() {
  const [longitude, setLongitude] = useState(116.4) // 默认北京经度
  const [isRotating, setIsRotating] = useState(false)
  const [rotationAngle, setRotationAngle] = useState(0)
  const canvasRef = useRef<any>(null)

  // 找到最近的城市
  const nearestCity = FAMOUS_CITIES.reduce((nearest, city) => {
    const diff = Math.abs(city.longitude - longitude)
    const nearestDiff = Math.abs(nearest.longitude - longitude)
    return diff < nearestDiff ? city : nearest
  }, FAMOUS_CITIES[0])

  const isNearCity = Math.abs(nearestCity.longitude - longitude) < 5

  // 初始化 Canvas
  useReady(() => {
    const query = Taro.createSelectorQuery()
    query.select('#canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          
          const dpr = Taro.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          
          canvasRef.current = { canvas, ctx, width: res[0].width, height: res[0].height }
        }
      })
  })

  // 旋转动画
  useEffect(() => {
    if (!isRotating) return

    const timer = setInterval(() => {
      setRotationAngle(prev => (prev + 1) % 360)
    }, 50)

    return () => clearInterval(timer)
  }, [isRotating])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    const centerX = width / 2
    const centerY = height / 2
    const earthRadius = Math.min(width, height) * 0.38

    // 清除画布
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // 绘制星星
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = Math.random() * 1.2
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制地球
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.earth
    ctx.fill()
    ctx.strokeStyle = COLORS.earthDark
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制赤道
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, earthRadius, earthRadius * 0.15, 0, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.equator
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制经线（每30度一条）
    for (let lon = -150; lon <= 180; lon += 30) {
      const adjustedLon = lon + rotationAngle
      const x = Math.sin(degToRad(adjustedLon)) * earthRadius
      const visible = Math.cos(degToRad(adjustedLon)) > 0
      
      if (!visible && lon !== 0 && lon !== 180) continue
      
      ctx.beginPath()
      ctx.ellipse(centerX + x * 0.1, centerY, Math.abs(Math.cos(degToRad(adjustedLon))) * earthRadius, earthRadius, 0, 0, Math.PI * 2)
      
      let color = '#64748b'
      let lineWidth = 1
      
      if (lon === 0) {
        color = COLORS.primeMeridian
        lineWidth = 2.5
      } else if (lon === 180 || lon === -180) {
        color = COLORS.dateLine
        lineWidth = 2.5
      }
      
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.globalAlpha = visible ? 1 : 0.3
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // 绘制选中的经线
    const selectedLonAdjusted = longitude + rotationAngle
    const selectedX = Math.sin(degToRad(selectedLonAdjusted)) * earthRadius
    const selectedVisible = Math.cos(degToRad(selectedLonAdjusted)) > -0.3
    
    if (selectedVisible) {
      ctx.beginPath()
      ctx.ellipse(centerX + selectedX * 0.1, centerY, Math.abs(Math.cos(degToRad(selectedLonAdjusted))) * earthRadius, earthRadius, 0, 0, Math.PI * 2)
      ctx.strokeStyle = COLORS.selectedMeridian
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // 绘制标注
    ctx.fillStyle = '#fff'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    
    // 本初子午线标注
    ctx.fillStyle = COLORS.primeMeridian
    ctx.fillText('0°', centerX, centerY - earthRadius - 8)
    
    // 日期变更线标注
    ctx.fillStyle = COLORS.dateLine
    ctx.fillText('180°', centerX, centerY + earthRadius + 16)

    // 东西经标注
    ctx.fillStyle = COLORS.eastLongitude
    ctx.fillText('东经', centerX - earthRadius - 20, centerY)
    ctx.fillStyle = COLORS.westLongitude
    ctx.fillText('西经', centerX + earthRadius + 20, centerY)

  }, [longitude, rotationAngle])

  return (
    <View className='longitude-demo'>
      {/* Canvas 区域 */}
      <View className='canvas-container'>
        <Canvas
          type='2d'
          id='canvas'
          className='canvas'
        />
      </View>

      {/* 当前状态显示 */}
      <View className='status-panel'>
        <View className='status-row'>
          <Text className='status-label'>当前经度</Text>
          <Text className='status-value highlight'>{formatLongitude(longitude)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>半球</Text>
          <Text className='status-value'>
            {longitude >= -20 && longitude <= 160 ? '东半球' : '西半球'}
          </Text>
        </View>
        {isNearCity && (
          <View className='city-hint'>
            <Text>{nearestCity.emoji} 接近{nearestCity.name} ({nearestCity.description})</Text>
          </View>
        )}
      </View>

      {/* 控制区域 */}
      <View className='controls'>
        <Button 
          className={`play-btn ${isRotating ? 'playing' : ''}`}
          onClick={() => setIsRotating(!isRotating)}
        >
          {isRotating ? '⏸ 停止旋转' : '🔄 旋转地球'}
        </Button>
      </View>

      {/* 经度滑块 */}
      <View className='slider-section'>
        <Text className='label'>调节经度</Text>
        <View className='slider-row'>
          <Text className='range west'>180°W</Text>
          <Slider
            className='slider'
            min={-180}
            max={180}
            step={1}
            value={longitude}
            activeColor='#10b981'
            onChange={(e) => setLongitude(e.detail.value)}
          />
          <Text className='range east'>180°E</Text>
        </View>
      </View>

      {/* 城市快捷按钮 */}
      <View className='cities-section'>
        <Text className='label'>快捷定位城市</Text>
        <ScrollView scrollX className='cities-scroll'>
          {FAMOUS_CITIES.map((city) => (
            <Button
              key={city.name}
              className={`city-btn ${Math.abs(city.longitude - longitude) < 5 ? 'active' : ''}`}
              onClick={() => setLongitude(city.longitude)}
            >
              {city.emoji} {city.name}
            </Button>
          ))}
        </ScrollView>
      </View>

      {/* 说明区域 */}
      <View className='info-panel'>
        <View className='legend'>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.primeMeridian }} />
            <Text>本初子午线 (0°)</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.dateLine }} />
            <Text>国际日期变更线 (180°)</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.selectedMeridian }} />
            <Text>选中经度</Text>
          </View>
        </View>

        <View className='concepts'>
          <Text className='section-title'>核心概念</Text>
          <View className='concept-item'>
            <Text className='concept-name'>本初子午线</Text>
            <Text className='concept-desc'>经过英国格林尼治天文台的经线，为0°经线</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>东经与西经</Text>
            <Text className='concept-desc'>本初子午线以东为东经(E)，以西为西经(W)</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>东西半球</Text>
            <Text className='concept-desc'>20°W~160°E为东半球，160°E~20°W为西半球</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
