/**
 * 黄赤交角演示 - 微信小程序版本
 * 
 * 注意：微信小程序不支持 SVG，这里使用 Canvas 实现
 */
import { useState, useEffect, useRef } from 'react'
import { View, Text, Slider, Button, Canvas } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import './index.scss'

// 颜色定义
const COLORS = {
  sun: '#fbbf24',
  sunGlow: '#fde68a',
  earth: '#3b82f6',
  earthDark: '#1e40af',
  orbit: '#94a3b8',
  eclipticPlane: '#10b981',
  equatorPlane: '#f59e0b',
  axis: '#ef4444',
  angleArc: '#8b5cf6',
  background: '#f1f5f9',
}

// 角度转弧度
const degToRad = (deg: number) => (deg * Math.PI) / 180

export default function ObliquityDemo() {
  const [obliquity, setObliquity] = useState(23.5)
  const [isPlaying, setIsPlaying] = useState(true)
  const [orbitAngle, setOrbitAngle] = useState(0)
  const canvasRef = useRef<any>(null)

  // 格式化角度
  const formatObliquity = (value: number) => {
    const degrees = Math.floor(value)
    const minutes = Math.round((value - degrees) * 60)
    return `${degrees}°${minutes}′`
  }

  // 绘制动画
  useReady(() => {
    const query = Taro.createSelectorQuery()
    query.select('#canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          
          // 设置 canvas 尺寸
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
      setOrbitAngle(prev => (prev + 0.5) % 360)
    }, 50)

    return () => clearInterval(timer)
  }, [isPlaying])

  // 绘制
  useEffect(() => {
    if (!canvasRef.current) return

    const { ctx, width, height } = canvasRef.current
    const centerX = width / 2
    const centerY = height / 2
    const orbitRadius = width * 0.35
    const sunRadius = 25
    const earthRadius = 18

    // 清除画布
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // 绘制轨道
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, orbitRadius, orbitRadius * 0.35, 0, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.orbit
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // 绘制太阳
    ctx.beginPath()
    ctx.arc(centerX, centerY, sunRadius * 1.3, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sunGlow
    ctx.globalAlpha = 0.3
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.beginPath()
    ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.sun
    ctx.fill()

    ctx.fillStyle = '#92400e'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('太阳', centerX, centerY + 4)

    // 计算地球位置
    const earthX = centerX + orbitRadius * Math.cos(degToRad(orbitAngle))
    const earthY = centerY + orbitRadius * 0.35 * Math.sin(degToRad(orbitAngle))

    // 绘制黄道面线
    ctx.beginPath()
    ctx.moveTo(earthX - earthRadius * 1.5, earthY)
    ctx.lineTo(earthX + earthRadius * 1.5, earthY)
    ctx.strokeStyle = COLORS.eclipticPlane
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制赤道面线
    const obliquityRad = degToRad(obliquity)
    ctx.beginPath()
    ctx.moveTo(earthX - earthRadius * 1.5 * Math.cos(obliquityRad), earthY - earthRadius * 1.5 * Math.sin(obliquityRad))
    ctx.lineTo(earthX + earthRadius * 1.5 * Math.cos(obliquityRad), earthY + earthRadius * 1.5 * Math.sin(obliquityRad))
    ctx.strokeStyle = COLORS.equatorPlane
    ctx.stroke()

    // 绘制地球
    ctx.beginPath()
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.earth
    ctx.fill()
    ctx.strokeStyle = COLORS.earthDark
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 绘制地轴
    const axisLength = earthRadius * 2
    ctx.beginPath()
    ctx.moveTo(earthX - axisLength * Math.sin(obliquityRad), earthY + axisLength * Math.cos(obliquityRad))
    ctx.lineTo(earthX + axisLength * Math.sin(obliquityRad), earthY - axisLength * Math.cos(obliquityRad))
    ctx.strokeStyle = COLORS.axis
    ctx.lineWidth = 2
    ctx.stroke()

    // 绘制角度弧
    ctx.beginPath()
    ctx.arc(earthX, earthY, earthRadius * 1.2, -Math.PI / 2, -Math.PI / 2 + obliquityRad)
    ctx.strokeStyle = COLORS.angleArc
    ctx.lineWidth = 2
    ctx.stroke()

    // 角度文字
    ctx.fillStyle = COLORS.angleArc
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText(`${obliquity.toFixed(1)}°`, earthX + earthRadius * 0.8, earthY - earthRadius * 1.2)

  }, [orbitAngle, obliquity])

  return (
    <View className='obliquity-demo'>
      {/* Canvas 区域 */}
      <View className='canvas-container'>
        <Canvas
          type='2d'
          id='canvas'
          className='canvas'
        />
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

      {/* 说明区域 */}
      <View className='info-panel'>
        <View className='slider-section'>
          <Text className='label'>调节地轴倾角</Text>
          <View className='slider-row'>
            <Text className='range'>0°</Text>
            <Slider
              className='slider'
              min={0}
              max={30}
              step={0.1}
              value={obliquity}
              activeColor='#2563eb'
              onChange={(e) => setObliquity(e.detail.value)}
            />
            <Text className='range'>30°</Text>
          </View>
          <Text className='current-value'>当前倾角：{formatObliquity(obliquity)}</Text>
          {Math.abs(obliquity - 23.5) < 0.5 && (
            <Text className='hint'>✓ 接近实际黄赤交角（约23°26′）</Text>
          )}
        </View>

        <View className='legend'>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.eclipticPlane }} />
            <Text>黄道面</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.equatorPlane }} />
            <Text>赤道面</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.axis }} />
            <Text>地轴</Text>
          </View>
          <View className='legend-item'>
            <View className='color-bar' style={{ backgroundColor: COLORS.angleArc }} />
            <Text>黄赤交角</Text>
          </View>
        </View>

        <View className='concepts'>
          <Text className='section-title'>核心概念</Text>
          <View className='concept-item'>
            <Text className='concept-name'>黄道面</Text>
            <Text className='concept-desc'>地球绕太阳公转的轨道所在平面</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>赤道面</Text>
            <Text className='concept-desc'>过地心且与地轴垂直的平面</Text>
          </View>
          <View className='concept-item'>
            <Text className='concept-name'>黄赤交角</Text>
            <Text className='concept-desc'>黄道面与赤道面的夹角，约23°26′</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
