/**
 * 影子与太阳方位演示 - 微信小程序版本
 * 
 * 帮助学生理解：
 * 1. 影子的方向与太阳方位的关系
 * 2. 影子的长短与太阳高度角的关系
 * 3. 不同时间、不同季节的影子变化
 */
import { useState, useEffect, useRef } from 'react'
import { View, Text, Slider, Button, Canvas, ScrollView } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import { OBLIQUITY } from '../../../constants'
import './index.scss'

// 颜色定义
const COLORS = {
  sun: '#fbbf24',
  sunGlow: '#fde68a',
  shadow: '#475569',
  ground: '#4ade80',
  person: '#60a5fa',
  stick: '#8b4513',
  compass: {
    north: '#ef4444',
    south: '#3b82f6',
    east: '#10b981',
    west: '#f59e0b',
  },
  background: '#87ceeb',
}

// 特殊日期
const SPECIAL_DATES = [
  { name: '春分', dayOfYear: 80, subsolarLat: 0, date: '3月21日' },
  { name: '夏至', dayOfYear: 173, subsolarLat: OBLIQUITY, date: '6月22日' },
  { name: '秋分', dayOfYear: 266, subsolarLat: 0, date: '9月23日' },
  { name: '冬至', dayOfYear: 356, subsolarLat: -OBLIQUITY, date: '12月22日' },
]

// 城市数据
const CITIES = [
  { name: '北京', lat: 39.9, emoji: '🇨🇳' },
  { name: '上海', lat: 31.2, emoji: '🇨🇳' },
  { name: '广州', lat: 23.1, emoji: '🇨🇳' },
  { name: '哈尔滨', lat: 45.8, emoji: '🇨🇳' },
  { name: '新加坡', lat: 1.3, emoji: '🇸🇬' },
  { name: '悉尼', lat: -33.9, emoji: '🇦🇺' },
  { name: '开普敦', lat: -33.9, emoji: '🇿🇦' },
]

// 角度转弧度
const degToRad = (deg: number) => (deg * Math.PI) / 180
const radToDeg = (rad: number) => (rad * 180) / Math.PI

// 根据一年中的天数计算太阳直射点纬度
const getSubsolarLatitude = (dayOfYear: number): number => {
  const angle = ((284 + dayOfYear) * 360 / 365) * Math.PI / 180
  return OBLIQUITY * Math.sin(angle)
}

// 将一年中的第几天转换为月日格式
const dayOfYearToDate = (dayOfYear: number): string => {
  const date = new Date(2025, 0, 1)
  date.setDate(dayOfYear)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 格式化纬度
const formatLatitude = (value: number): string => {
  const absValue = Math.abs(value)
  const degrees = Math.floor(absValue)
  const minutes = Math.round((absValue - degrees) * 60)
  const direction = value >= 0 ? 'N' : 'S'
  if (Math.abs(value) < 0.01) return '0°'
  return `${degrees}°${minutes > 0 ? minutes + "′" : ""}${direction}`
}

// 计算太阳高度角
const getSunAltitude = (lat: number, subsolarLat: number, hourAngle: number): number => {
  const latRad = degToRad(lat)
  const subLatRad = degToRad(subsolarLat)
  const hourRad = degToRad(hourAngle)
  
  const sinH = Math.sin(latRad) * Math.sin(subLatRad) + 
               Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourRad)
  
  const altitude = radToDeg(Math.asin(Math.max(-1, Math.min(1, sinH))))
  return Math.max(0, altitude)
}

// 计算太阳方位角（从正北顺时针）
const getSunAzimuth = (lat: number, subsolarLat: number, hourAngle: number): number => {
  const latRad = degToRad(lat)
  const subLatRad = degToRad(subsolarLat)
  const hourRad = degToRad(hourAngle)
  
  const sinH = Math.sin(latRad) * Math.sin(subLatRad) + 
               Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourRad)
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinH)))
  
  if (Math.cos(altitude) < 0.001) return 0
  
  const cosA = (Math.sin(subLatRad) - Math.sin(latRad) * sinH) / 
               (Math.cos(latRad) * Math.cos(altitude))
  
  let azimuth = radToDeg(Math.acos(Math.max(-1, Math.min(1, cosA))))
  
  if (hourAngle > 0) {
    azimuth = 360 - azimuth
  }
  
  return azimuth
}

// 格式化时间
const formatTime = (hour: number): string => {
  const h = Math.floor(hour)
  const m = Math.round((hour % 1) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default function ShadowDemo() {
  const [dayOfYear, setDayOfYear] = useState(173) // 默认夏至
  const [hour, setHour] = useState(12) // 默认正午
  const [latitude, setLatitude] = useState(39.9) // 默认北京
  const [isPlaying, setIsPlaying] = useState(false)
  const canvasRef = useRef<any>(null)

  const subsolarLat = getSubsolarLatitude(dayOfYear)
  const hourAngle = (hour - 12) * 15 // 时角
  const sunAltitude = getSunAltitude(latitude, subsolarLat, hourAngle)
  const sunAzimuth = getSunAzimuth(latitude, subsolarLat, hourAngle)
  
  // 影子长度（相对值）
  const shadowLength = sunAltitude > 0 ? 1 / Math.tan(degToRad(sunAltitude)) : 0
  // 影子方向（与太阳方位相反）
  const shadowDirection = (sunAzimuth + 180) % 360

  // 判断是否白天
  const isDaytime = sunAltitude > 0

  // 找到最近的城市
  const nearestCity = CITIES.reduce((nearest, city) => {
    const diff = Math.abs(city.lat - latitude)
    const nearestDiff = Math.abs(nearest.lat - latitude)
    return diff < nearestDiff ? city : nearest
  }, CITIES[0])

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

  // 时间流逝动画
  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setHour(prev => {
        const next = prev + 0.1
        return next > 18 ? 6 : next
      })
    }, 100)

    return () => clearInterval(timer)
  }, [isPlaying])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    const centerX = width / 2
    const groundY = height * 0.75

    // 绘制天空渐变
    const skyGradient = ctx.createLinearGradient(0, 0, 0, groundY)
    if (isDaytime) {
      skyGradient.addColorStop(0, '#1e90ff')
      skyGradient.addColorStop(1, '#87ceeb')
    } else {
      skyGradient.addColorStop(0, '#1e3a5a')
      skyGradient.addColorStop(1, '#2d4a6a')
    }
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, width, groundY)

    // 绘制地面
    ctx.fillStyle = COLORS.ground
    ctx.fillRect(0, groundY, width, height - groundY)

    // 绘制太阳（如果在地平线以上）
    if (isDaytime) {
      const sunRadius = 20
      // 太阳位置基于方位角和高度角
      const sunDistance = height * 0.35
      const sunAngleRad = degToRad(sunAzimuth - 180) // 转换为画布坐标
      const sunElevationFactor = sunAltitude / 90
      const sunY = groundY - sunDistance * sunElevationFactor
      const sunX = centerX + Math.sin(degToRad(sunAzimuth)) * sunDistance * 0.5

      // 太阳光晕
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunRadius * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.sunGlow
      ctx.globalAlpha = 0.3
      ctx.fill()
      ctx.globalAlpha = 1

      // 太阳
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.sun
      ctx.fill()
    }

    // 绘制指南针
    const compassX = width - 50
    const compassY = 50
    const compassRadius = 35

    ctx.beginPath()
    ctx.arc(compassX, compassY, compassRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 2
    ctx.stroke()

    // 指南针方向
    const directions = [
      { label: 'N', angle: 0, color: COLORS.compass.north },
      { label: 'E', angle: 90, color: COLORS.compass.east },
      { label: 'S', angle: 180, color: COLORS.compass.south },
      { label: 'W', angle: 270, color: COLORS.compass.west },
    ]

    directions.forEach(({ label, angle, color }) => {
      const rad = degToRad(angle - 90)
      const x = compassX + Math.cos(rad) * (compassRadius - 12)
      const y = compassY + Math.sin(rad) * (compassRadius - 12)
      ctx.fillStyle = color
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x, y)
    })

    // 绘制人物（简化版）
    const personX = centerX
    const personY = groundY
    const personHeight = 40

    // 头
    ctx.beginPath()
    ctx.arc(personX, personY - personHeight + 8, 8, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.person
    ctx.fill()

    // 身体
    ctx.beginPath()
    ctx.moveTo(personX, personY - personHeight + 16)
    ctx.lineTo(personX, personY)
    ctx.strokeStyle = COLORS.person
    ctx.lineWidth = 4
    ctx.stroke()

    // 手臂
    ctx.beginPath()
    ctx.moveTo(personX - 12, personY - personHeight + 25)
    ctx.lineTo(personX + 12, personY - personHeight + 25)
    ctx.stroke()

    // 腿
    ctx.beginPath()
    ctx.moveTo(personX, personY)
    ctx.lineTo(personX - 8, personY + 15)
    ctx.moveTo(personX, personY)
    ctx.lineTo(personX + 8, personY + 15)
    ctx.stroke()

    // 绘制影子（如果白天）
    if (isDaytime && sunAltitude > 0) {
      const shadowLen = Math.min(shadowLength * 30, 100) // 限制最大长度
      const shadowRad = degToRad(shadowDirection - 90)
      const shadowEndX = personX + Math.cos(shadowRad) * shadowLen
      const shadowEndY = personY + Math.sin(shadowRad) * shadowLen * 0.3 // 透视效果

      ctx.beginPath()
      ctx.moveTo(personX, personY + 15)
      ctx.lineTo(shadowEndX, shadowEndY + 15)
      ctx.lineTo(shadowEndX - 5, shadowEndY + 10)
      ctx.lineTo(shadowEndX + 5, shadowEndY + 10)
      ctx.closePath()
      ctx.fillStyle = COLORS.shadow
      ctx.globalAlpha = 0.4
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // 绘制状态信息
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`太阳高度角: ${sunAltitude.toFixed(1)}°`, 10, 20)
    ctx.fillText(`太阳方位角: ${sunAzimuth.toFixed(1)}°`, 10, 38)
    if (isDaytime) {
      ctx.fillText(`影子方向: ${shadowDirection.toFixed(0)}°`, 10, 56)
    }

  }, [dayOfYear, hour, latitude, sunAltitude, sunAzimuth, shadowLength, shadowDirection, isDaytime])

  return (
    <View className='shadow-demo'>
      {/* Canvas 区域 */}
      <View className='canvas-container'>
        <Canvas
          type='2d'
          id='canvas'
          className='canvas'
        />
      </View>

      {/* 状态面板 */}
      <View className='status-panel'>
        <View className='status-row'>
          <Text className='status-label'>日期</Text>
          <Text className='status-value'>{dayOfYearToDate(dayOfYear)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>时间</Text>
          <Text className='status-value'>{formatTime(hour)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>观测地点</Text>
          <Text className='status-value'>{nearestCity.emoji} {formatLatitude(latitude)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>太阳直射点</Text>
          <Text className='status-value'>{formatLatitude(subsolarLat)}</Text>
        </View>
      </View>

      {/* 控制区域 */}
      <View className='controls'>
        <Button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 日出到日落'}
        </Button>
      </View>

      {/* 时间滑块 */}
      <View className='slider-section'>
        <Text className='label'>调节时间</Text>
        <View className='slider-row'>
          <Text className='range'>6:00</Text>
          <Slider
            className='slider'
            min={6}
            max={18}
            step={0.25}
            value={hour}
            activeColor='#f59e0b'
            onChange={(e) => {
              setIsPlaying(false)
              setHour(e.detail.value)
            }}
          />
          <Text className='range'>18:00</Text>
        </View>
      </View>

      {/* 日期滑块 */}
      <View className='slider-section'>
        <Text className='label'>调节日期</Text>
        <View className='slider-row'>
          <Text className='range'>1/1</Text>
          <Slider
            className='slider'
            min={1}
            max={365}
            step={1}
            value={dayOfYear}
            activeColor='#2563eb'
            onChange={(e) => setDayOfYear(e.detail.value)}
          />
          <Text className='range'>12/31</Text>
        </View>
      </View>

      {/* 城市选择 */}
      <View className='cities-section'>
        <Text className='label'>选择观测地点</Text>
        <ScrollView scrollX className='cities-scroll'>
          {CITIES.map((city) => (
            <Button
              key={city.name}
              className={`city-btn ${Math.abs(city.lat - latitude) < 1 ? 'active' : ''}`}
              onClick={() => setLatitude(city.lat)}
            >
              {city.emoji} {city.name}
            </Button>
          ))}
        </ScrollView>
      </View>

      {/* 快捷日期 */}
      <View className='quick-dates'>
        {SPECIAL_DATES.map((date) => (
          <Button
            key={date.name}
            className={`date-btn ${Math.abs(date.dayOfYear - dayOfYear) < 10 ? 'active' : ''}`}
            onClick={() => setDayOfYear(date.dayOfYear)}
          >
            {date.name}
          </Button>
        ))}
      </View>

      {/* 说明区域 */}
      <View className='info-panel'>
        <View className='concepts'>
          <Text className='section-title'>核心概念</Text>
          <View className='concept-item'>
            <Text className='concept-name'>太阳高度角</Text>
            <Text className='concept-desc'>太阳光线与地平面的夹角，正午最大</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>太阳方位角</Text>
            <Text className='concept-desc'>从正北顺时针到太阳投影方向的角度</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>影子方向</Text>
            <Text className='concept-desc'>始终与太阳方位相反，正午时北半球影子朝北</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>影子长度</Text>
            <Text className='concept-desc'>太阳高度角越大，影子越短；正午影子最短</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
