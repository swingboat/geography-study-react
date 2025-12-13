/**
 * 南北回归线演示 - 微信小程序版本
 * 
 * 帮助学生理解：
 * 1. 南北回归线的形成原因（黄赤交角）
 * 2. 太阳直射点的移动规律
 * 3. 回归线与季节的关系
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
  orbit: '#94a3b8',
  equator: '#10b981',
  tropicOfCancer: '#f97316',
  tropicOfCapricorn: '#f97316',
  arcticCircle: '#06b6d4',
  antarcticCircle: '#06b6d4',
  sunRay: '#fbbf24',
  background: '#f1f5f9',
}

// 特殊日期
const SPECIAL_DATES = [
  { name: '春分', dayOfYear: 80, subsolarLat: 0, date: '3月21日' },
  { name: '夏至', dayOfYear: 173, subsolarLat: OBLIQUITY, date: '6月22日' },
  { name: '秋分', dayOfYear: 266, subsolarLat: 0, date: '9月23日' },
  { name: '冬至', dayOfYear: 356, subsolarLat: -OBLIQUITY, date: '12月22日' },
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

export default function TropicsDemo() {
  const [dayOfYear, setDayOfYear] = useState(173) // 默认夏至
  const [isPlaying, setIsPlaying] = useState(true)
  const canvasRef = useRef<any>(null)

  const subsolarLat = getSubsolarLatitude(dayOfYear)

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
    }, 100)

    return () => clearInterval(timer)
  }, [isPlaying])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    const centerX = width * 0.65
    const centerY = height / 2
    const earthRadius = Math.min(width, height) * 0.28

    // 清除画布
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // 绘制太阳（左侧）
    const sunX = width * 0.12
    const sunY = height / 2
    const sunRadius = 22

    ctx.beginPath()
    ctx.arc(sunX, sunY, sunRadius * 1.4, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sunGlow
    ctx.globalAlpha = 0.3
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.beginPath()
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sun
    ctx.fill()

    ctx.fillStyle = '#92400e'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('太阳', sunX, sunY + 4)

    // 绘制地球
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.earth
    ctx.fill()
    ctx.strokeStyle = COLORS.earthDark
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制纬度线
    const latitudes = [
      { lat: 66.56, color: COLORS.arcticCircle, name: '北极圈' },
      { lat: OBLIQUITY, color: COLORS.tropicOfCancer, name: '北回归线' },
      { lat: 0, color: COLORS.equator, name: '赤道' },
      { lat: -OBLIQUITY, color: COLORS.tropicOfCapricorn, name: '南回归线' },
      { lat: -66.56, color: COLORS.antarcticCircle, name: '南极圈' },
    ]

    latitudes.forEach(({ lat, color }) => {
      const y = centerY - (lat / 90) * earthRadius
      const halfWidth = earthRadius * Math.cos(degToRad(lat))
      
      ctx.beginPath()
      ctx.moveTo(centerX - halfWidth, y)
      ctx.lineTo(centerX + halfWidth, y)
      ctx.strokeStyle = color
      ctx.lineWidth = lat === 0 ? 2.5 : 1.5
      ctx.setLineDash(lat === 0 ? [] : [4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    })

    // 绘制太阳光线
    const subsolarY = centerY - (subsolarLat / 90) * earthRadius
    
    ctx.beginPath()
    ctx.moveTo(sunX + sunRadius, sunY)
    ctx.lineTo(centerX - earthRadius + 10, subsolarY)
    ctx.strokeStyle = COLORS.sunRay
    ctx.lineWidth = 3
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // 绘制直射点标记
    ctx.beginPath()
    ctx.arc(centerX - earthRadius + 10, subsolarY, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()

    // 绘制当前直射点纬度指示线
    const halfWidth = earthRadius * Math.cos(degToRad(subsolarLat))
    ctx.beginPath()
    ctx.moveTo(centerX - halfWidth, subsolarY)
    ctx.lineTo(centerX + halfWidth, subsolarY)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.stroke()

  }, [dayOfYear, subsolarLat])

  return (
    <View className='tropics-demo'>
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
          <Text className='status-value highlight'>{formatLatitude(subsolarLat)}</Text>
        </View>
        {isNearSpecialDate && (
          <View className='special-date-hint'>
            <Text>✓ 接近{nearestSpecialDate.name}（{nearestSpecialDate.date}）</Text>
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

      {/* 日期滑块 */}
      <View className='slider-section'>
        <Text className='label'>调节日期</Text>
        <View className='slider-row'>
          <Text className='range'>1月1日</Text>
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
          <Text className='range'>12月31日</Text>
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
        <View className='legend'>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.tropicOfCancer }} />
            <Text>北回归线 (23°26′N)</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.equator }} />
            <Text>赤道 (0°)</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.tropicOfCapricorn }} />
            <Text>南回归线 (23°26′S)</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: '#ef4444' }} />
            <Text>太阳直射点</Text>
          </View>
        </View>

        <View className='concepts'>
          <Text className='section-title'>核心概念</Text>
          <View className='concept-item'>
            <Text className='concept-name'>北回归线</Text>
            <Text className='concept-desc'>太阳直射点能到达的最北纬度，约23°26′N，夏至日太阳直射此处</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>南回归线</Text>
            <Text className='concept-desc'>太阳直射点能到达的最南纬度，约23°26′S，冬至日太阳直射此处</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>太阳直射点</Text>
            <Text className='concept-desc'>太阳光线垂直照射的地点，一年内在南北回归线之间移动</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
