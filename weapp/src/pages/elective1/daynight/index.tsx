/**
 * 昼夜与晨昏线演示 - 微信小程序版本
 * 
 * 帮助学生理解：
 * 1. 晨昏线的概念（晨线与昏线）
 * 2. 晨昏线上的地方时
 * 3. 昼夜长短的变化
 */
import { useState, useEffect, useRef } from 'react'
import { View, Text, Slider, Button, Canvas } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import { OBLIQUITY } from '../../../constants'
import './index.scss'

// 颜色定义
const COLORS = {
  sun: '#fbbf24',
  sunGlow: '#fde68a',
  earth: '#3b82f6',
  earthDark: '#1e40af',
  dayLight: '#87ceeb',
  nightDark: '#1e3a5a',
  terminatorLine: '#f59e0b',
  dawnLine: '#10b981',
  duskLine: '#8b5cf6',
  equator: '#10b981',
  tropicOfCancer: '#f97316',
  tropicOfCapricorn: '#f97316',
  background: '#0f172a',
}

// 特殊日期
const SPECIAL_DATES = [
  { name: '春分', dayOfYear: 80, subsolarLat: 0, date: '3月21日', description: '全球昼夜平分' },
  { name: '夏至', dayOfYear: 173, subsolarLat: OBLIQUITY, date: '6月22日', description: '北半球白昼最长' },
  { name: '秋分', dayOfYear: 266, subsolarLat: 0, date: '9月23日', description: '全球昼夜平分' },
  { name: '冬至', dayOfYear: 356, subsolarLat: -OBLIQUITY, date: '12月22日', description: '北半球白昼最短' },
]

// 角度转弧度
const degToRad = (deg: number) => (deg * Math.PI) / 180

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
  if (Math.abs(value) < 0.01) return '0°（赤道）'
  return `${degrees}°${minutes > 0 ? minutes + "′" : ""}${direction}`
}

// 计算某纬度的昼长（小时）
const getDayLength = (lat: number, subsolarLat: number): number => {
  const latRad = degToRad(lat)
  const subLatRad = degToRad(subsolarLat)
  
  // cos(H) = -tan(φ) * tan(δ)
  const cosH = -Math.tan(latRad) * Math.tan(subLatRad)
  
  if (cosH >= 1) return 0 // 极夜
  if (cosH <= -1) return 24 // 极昼
  
  const H = Math.acos(cosH)
  return (H / Math.PI) * 24
}

export default function DayNightDemo() {
  const [dayOfYear, setDayOfYear] = useState(173) // 默认夏至
  const [selectedLat, setSelectedLat] = useState(40) // 默认北纬40度
  const [isPlaying, setIsPlaying] = useState(false)
  const canvasRef = useRef<any>(null)

  const subsolarLat = getSubsolarLatitude(dayOfYear)
  const dayLength = getDayLength(selectedLat, subsolarLat)
  const nightLength = 24 - dayLength

  // 找到最近的特殊日期
  const nearestSpecialDate = SPECIAL_DATES.reduce((nearest, date) => {
    const diff = Math.abs(date.dayOfYear - dayOfYear)
    const nearestDiff = Math.abs(nearest.dayOfYear - dayOfYear)
    return diff < nearestDiff ? date : nearest
  }, SPECIAL_DATES[0])

  const isNearSpecialDate = Math.abs(nearestSpecialDate.dayOfYear - dayOfYear) < 10

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

  // 动画循环
  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setDayOfYear(prev => (prev % 365) + 1)
    }, 150)

    return () => clearInterval(timer)
  }, [isPlaying])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    const centerX = width / 2
    const centerY = height / 2
    const earthRadius = Math.min(width, height) * 0.35

    // 清除画布 - 深色背景
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // 绘制星星
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = Math.random() * 1.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制太阳光线方向（从左侧来）
    const sunX = 20
    const sunY = height / 2

    // 绘制地球 - 先画夜半球
    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.nightDark
    ctx.fill()
    ctx.restore()

    // 画昼半球（左半边，面向太阳）
    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, -Math.PI / 2, Math.PI / 2)
    ctx.fillStyle = COLORS.dayLight
    ctx.fill()
    ctx.restore()

    // 绘制晨昏线
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - earthRadius)
    ctx.lineTo(centerX, centerY + earthRadius)
    ctx.strokeStyle = COLORS.terminatorLine
    ctx.lineWidth = 3
    ctx.stroke()

    // 绘制纬度线
    const latitudes = [
      { lat: OBLIQUITY, color: COLORS.tropicOfCancer, name: '北回归线' },
      { lat: 0, color: COLORS.equator, name: '赤道' },
      { lat: -OBLIQUITY, color: COLORS.tropicOfCapricorn, name: '南回归线' },
    ]

    latitudes.forEach(({ lat, color }) => {
      const y = centerY - (lat / 90) * earthRadius
      const halfWidth = earthRadius * Math.cos(degToRad(lat))
      
      ctx.beginPath()
      ctx.moveTo(centerX - halfWidth, y)
      ctx.lineTo(centerX + halfWidth, y)
      ctx.strokeStyle = color
      ctx.lineWidth = lat === 0 ? 2 : 1.5
      ctx.setLineDash(lat === 0 ? [] : [4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    })

    // 绘制选中纬度的指示线
    const selectedY = centerY - (selectedLat / 90) * earthRadius
    const selectedHalfWidth = earthRadius * Math.cos(degToRad(selectedLat))
    
    ctx.beginPath()
    ctx.moveTo(centerX - selectedHalfWidth, selectedY)
    ctx.lineTo(centerX + selectedHalfWidth, selectedY)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // 标记昼弧和夜弧
    const dayArcRatio = dayLength / 24
    const dayArcHalf = selectedHalfWidth * dayArcRatio
    
    // 昼弧（红色）
    ctx.beginPath()
    ctx.moveTo(centerX - dayArcHalf, selectedY)
    ctx.lineTo(centerX, selectedY)
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 4
    ctx.stroke()

    // 夜弧（蓝色）
    ctx.beginPath()
    ctx.moveTo(centerX, selectedY)
    ctx.lineTo(centerX + selectedHalfWidth, selectedY)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 4
    ctx.stroke()

    // 绘制太阳直射点
    const subsolarY = centerY - (subsolarLat / 90) * earthRadius
    ctx.beginPath()
    ctx.arc(centerX - earthRadius + 15, subsolarY, 6, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sun
    ctx.fill()

    // 绘制小太阳图标
    ctx.beginPath()
    ctx.arc(sunX + 15, sunY, 12, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sun
    ctx.fill()

    // 标注
    ctx.fillStyle = '#fff'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('晨线', centerX + 5, centerY - earthRadius + 20)
    ctx.fillText('昏线', centerX + 5, centerY + earthRadius - 10)
    
    ctx.textAlign = 'center'
    ctx.fillText('昼', centerX - earthRadius / 2, centerY)
    ctx.fillText('夜', centerX + earthRadius / 2, centerY)

  }, [dayOfYear, selectedLat, subsolarLat])

  return (
    <View className='daynight-demo'>
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
          <Text className='status-label'>日期</Text>
          <Text className='status-value'>{dayOfYearToDate(dayOfYear)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>太阳直射点</Text>
          <Text className='status-value'>{formatLatitude(subsolarLat)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>观测纬度</Text>
          <Text className='status-value highlight'>{formatLatitude(selectedLat)}</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>昼长</Text>
          <Text className='status-value day'>{dayLength.toFixed(1)}小时</Text>
        </View>
        <View className='status-row'>
          <Text className='status-label'>夜长</Text>
          <Text className='status-value night'>{nightLength.toFixed(1)}小时</Text>
        </View>
        {isNearSpecialDate && (
          <View className='special-date-hint'>
            <Text>✓ {nearestSpecialDate.name} - {nearestSpecialDate.description}</Text>
          </View>
        )}
      </View>

      {/* 控制区域 */}
      <View className='controls'>
        <Button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </Button>
      </View>

      {/* 滑块区域 */}
      <View className='slider-section'>
        <Text className='label'>选择日期</Text>
        <View className='slider-row'>
          <Text className='range'>1/1</Text>
          <Slider
            className='slider'
            min={1}
            max={365}
            step={1}
            value={dayOfYear}
            activeColor='#2563eb'
            onChange={(e) => {
              setIsPlaying(false)
              setDayOfYear(e.detail.value)
            }}
          />
          <Text className='range'>12/31</Text>
        </View>
      </View>

      <View className='slider-section'>
        <Text className='label'>选择观测纬度</Text>
        <View className='slider-row'>
          <Text className='range'>90°S</Text>
          <Slider
            className='slider'
            min={-90}
            max={90}
            step={1}
            value={selectedLat}
            activeColor='#ef4444'
            onChange={(e) => setSelectedLat(e.detail.value)}
          />
          <Text className='range'>90°N</Text>
        </View>
      </View>

      {/* 快捷日期按钮 */}
      <View className='quick-dates'>
        {SPECIAL_DATES.map((date) => (
          <Button
            key={date.name}
            className={`date-btn ${Math.abs(date.dayOfYear - dayOfYear) < 10 ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false)
              setDayOfYear(date.dayOfYear)
            }}
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
            <Text className='concept-name'>晨昏线</Text>
            <Text className='concept-desc'>昼夜半球的分界线，由晨线和昏线组成</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>晨线</Text>
            <Text className='concept-desc'>从夜到昼的分界线，线上地方时为6:00</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>昏线</Text>
            <Text className='concept-desc'>从昼到夜的分界线，线上地方时为18:00</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>昼弧与夜弧</Text>
            <Text className='concept-desc'>纬线被晨昏线分成的两段，昼弧长则昼长</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
