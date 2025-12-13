/**
 * 时区演示 - 微信小程序版本
 * 
 * 帮助学生理解：
 * 1. 时区的划分（每15°经度为一个时区）
 * 2. 地方时与区时的区别
 * 3. 时差计算（东加西减）
 * 4. 国际日期变更线
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
  dateLine: '#8b5cf6',
  selectedZone: '#10b981',
  dayArea: '#fef3c7',
  nightArea: '#1e3a5a',
  timeZoneLine: '#6366f1',
  background: '#0f172a',
}

// 时区城市
const TIMEZONE_CITIES = [
  { name: '伦敦', emoji: '🇬🇧', timezone: 0, description: 'UTC+0' },
  { name: '巴黎', emoji: '🇫🇷', timezone: 1, description: 'UTC+1' },
  { name: '开罗', emoji: '🇪🇬', timezone: 2, description: 'UTC+2' },
  { name: '莫斯科', emoji: '🇷🇺', timezone: 3, description: 'UTC+3' },
  { name: '迪拜', emoji: '🇦🇪', timezone: 4, description: 'UTC+4' },
  { name: '新德里', emoji: '🇮🇳', timezone: 5.5, description: 'UTC+5:30' },
  { name: '曼谷', emoji: '🇹🇭', timezone: 7, description: 'UTC+7' },
  { name: '北京', emoji: '🇨🇳', timezone: 8, description: 'UTC+8' },
  { name: '东京', emoji: '🇯🇵', timezone: 9, description: 'UTC+9' },
  { name: '悉尼', emoji: '🇦🇺', timezone: 10, description: 'UTC+10' },
  { name: '惠灵顿', emoji: '🇳🇿', timezone: 12, description: 'UTC+12' },
  { name: '纽约', emoji: '🇺🇸', timezone: -5, description: 'UTC-5' },
  { name: '洛杉矶', emoji: '🇺🇸', timezone: -8, description: 'UTC-8' },
  { name: '檀香山', emoji: '🇺🇸', timezone: -10, description: 'UTC-10' },
]

// 角度转弧度
const degToRad = (deg: number) => (deg * Math.PI) / 180

// 获取时区名称
const getTimeZoneName = (zone: number): string => {
  if (zone === 0) return 'UTC'
  const sign = zone > 0 ? '+' : ''
  if (zone % 1 !== 0) {
    const hours = Math.floor(Math.abs(zone))
    const minutes = (Math.abs(zone) % 1) * 60
    return `UTC${zone > 0 ? '+' : '-'}${hours}:${minutes.toString().padStart(2, '0')}`
  }
  return `UTC${sign}${zone}`
}

// 格式化时间
const formatTime = (hours: number): string => {
  const h = Math.floor(((hours % 24) + 24) % 24)
  const m = Math.round((hours % 1) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default function TimeZoneDemo() {
  const [selectedZone, setSelectedZone] = useState(8) // 默认北京时区
  const [compareZone, setCompareZone] = useState(0) // 对比时区
  const [baseTime, setBaseTime] = useState(12) // 基准时间（小时）
  const [isPlaying, setIsPlaying] = useState(false)
  const canvasRef = useRef<any>(null)

  // 计算两个时区的时间
  const selectedTime = baseTime
  const compareTime = baseTime - selectedZone + compareZone

  // 计算时差
  const timeDiff = compareZone - selectedZone

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
      setBaseTime(prev => (prev + 0.1) % 24)
    }, 100)

    return () => clearInterval(timer)
  }, [isPlaying])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    
    // 清除画布
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // 绘制时区条形图
    const barHeight = height * 0.6
    const barY = height * 0.2
    const barWidth = width - 40
    const barX = 20

    // 绘制24个时区背景
    for (let i = -12; i < 12; i++) {
      const x = barX + ((i + 12) / 24) * barWidth
      const w = barWidth / 24
      
      // 昼夜着色
      const zoneTime = (baseTime - selectedZone + i + 24) % 24
      const isDaytime = zoneTime >= 6 && zoneTime < 18
      
      ctx.fillStyle = isDaytime ? COLORS.dayArea : COLORS.nightArea
      ctx.fillRect(x, barY, w, barHeight)
      
      // 时区分隔线
      ctx.beginPath()
      ctx.moveTo(x, barY)
      ctx.lineTo(x, barY + barHeight)
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 0.5
      ctx.stroke()
      
      // 时区标签
      if (i % 3 === 0) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        const label = i === 0 ? 'UTC' : (i > 0 ? `+${i}` : `${i}`)
        ctx.fillText(label, x + w / 2, barY + barHeight + 14)
      }
    }

    // 绘制本初子午线
    const primeX = barX + (12 / 24) * barWidth
    ctx.beginPath()
    ctx.moveTo(primeX, barY - 10)
    ctx.lineTo(primeX, barY + barHeight + 20)
    ctx.strokeStyle = COLORS.primeMeridian
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制日期变更线
    const dateLineX1 = barX
    const dateLineX2 = barX + barWidth
    ctx.beginPath()
    ctx.moveTo(dateLineX1, barY - 10)
    ctx.lineTo(dateLineX1, barY + barHeight + 20)
    ctx.strokeStyle = COLORS.dateLine
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(dateLineX2, barY - 10)
    ctx.lineTo(dateLineX2, barY + barHeight + 20)
    ctx.stroke()

    // 绘制选中时区标记
    const selectedX = barX + ((selectedZone + 12) / 24) * barWidth
    ctx.beginPath()
    ctx.moveTo(selectedX, barY - 15)
    ctx.lineTo(selectedX - 8, barY - 5)
    ctx.lineTo(selectedX + 8, barY - 5)
    ctx.closePath()
    ctx.fillStyle = COLORS.selectedZone
    ctx.fill()

    // 绘制对比时区标记
    const compareX = barX + ((compareZone + 12) / 24) * barWidth
    ctx.beginPath()
    ctx.moveTo(compareX, barY + barHeight + 25)
    ctx.lineTo(compareX - 8, barY + barHeight + 35)
    ctx.lineTo(compareX + 8, barY + barHeight + 35)
    ctx.closePath()
    ctx.fillStyle = '#f59e0b'
    ctx.fill()

    // 绘制标题
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('世界时区图', 20, 20)

    // 绘制图例
    ctx.fillStyle = COLORS.dayArea
    ctx.fillRect(width - 100, 10, 12, 12)
    ctx.fillStyle = '#fff'
    ctx.font = '10px sans-serif'
    ctx.fillText('白天', width - 84, 20)

    ctx.fillStyle = COLORS.nightArea
    ctx.fillRect(width - 50, 10, 12, 12)
    ctx.fillText('夜晚', width - 34, 20)

  }, [selectedZone, compareZone, baseTime])

  return (
    <View className='timezone-demo'>
      {/* Canvas 区域 */}
      <View className='canvas-container'>
        <Canvas
          type='2d'
          id='canvas'
          className='canvas'
        />
      </View>

      {/* 时间对比面板 */}
      <View className='time-panel'>
        <View className='time-card selected'>
          <Text className='zone-label'>{getTimeZoneName(selectedZone)}</Text>
          <Text className='time-value'>{formatTime(selectedTime)}</Text>
          <Text className='zone-name'>
            {TIMEZONE_CITIES.find(c => c.timezone === selectedZone)?.name || '当前时区'}
          </Text>
        </View>
        <View className='time-diff'>
          <Text className='diff-label'>时差</Text>
          <Text className='diff-value'>{timeDiff > 0 ? '+' : ''}{timeDiff}小时</Text>
        </View>
        <View className='time-card compare'>
          <Text className='zone-label'>{getTimeZoneName(compareZone)}</Text>
          <Text className='time-value'>{formatTime(compareTime)}</Text>
          <Text className='zone-name'>
            {TIMEZONE_CITIES.find(c => c.timezone === compareZone)?.name || '对比时区'}
          </Text>
        </View>
      </View>

      {/* 控制区域 */}
      <View className='controls'>
        <Button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 时间流逝'}
        </Button>
      </View>

      {/* 时间滑块 */}
      <View className='slider-section'>
        <Text className='label'>调节时间 ({formatTime(baseTime)})</Text>
        <View className='slider-row'>
          <Text className='range'>0:00</Text>
          <Slider
            className='slider'
            min={0}
            max={24}
            step={0.5}
            value={baseTime}
            activeColor='#10b981'
            onChange={(e) => {
              setIsPlaying(false)
              setBaseTime(e.detail.value)
            }}
          />
          <Text className='range'>24:00</Text>
        </View>
      </View>

      {/* 城市选择 */}
      <View className='cities-section'>
        <Text className='label'>选择时区（绿色标记）</Text>
        <ScrollView scrollX className='cities-scroll'>
          {TIMEZONE_CITIES.map((city) => (
            <Button
              key={city.name}
              className={`city-btn ${city.timezone === selectedZone ? 'active' : ''}`}
              onClick={() => setSelectedZone(city.timezone)}
            >
              {city.emoji} {city.name}
            </Button>
          ))}
        </ScrollView>
      </View>

      <View className='cities-section'>
        <Text className='label'>对比时区（橙色标记）</Text>
        <ScrollView scrollX className='cities-scroll'>
          {TIMEZONE_CITIES.map((city) => (
            <Button
              key={city.name}
              className={`city-btn compare ${city.timezone === compareZone ? 'active' : ''}`}
              onClick={() => setCompareZone(city.timezone)}
            >
              {city.emoji} {city.name}
            </Button>
          ))}
        </ScrollView>
      </View>

      {/* 说明区域 */}
      <View className='info-panel'>
        <View className='concepts'>
          <Text className='section-title'>核心概念</Text>
          <View className='concept-item'>
            <Text className='concept-name'>时区划分</Text>
            <Text className='concept-desc'>全球划分为24个时区，每个时区跨15°经度</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>区时</Text>
            <Text className='concept-desc'>每个时区以其中央经线的地方时为统一时间</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>时差计算</Text>
            <Text className='concept-desc'>东边时区比西边时区时间早，相差1小时/时区</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>日期变更线</Text>
            <Text className='concept-desc'>180°经线附近，向东跨过减一天，向西跨过加一天</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
