import { View, Text, Navigator } from '@tarojs/components'
import './index.scss'

const DEMO_PAGES = [
  {
    url: '/pages/elective1/obliquity/index',
    title: '🌍 黄赤交角',
    desc: '理解地轴倾斜与黄道面、赤道面的关系',
  },
  {
    url: '/pages/elective1/tropics/index',
    title: '🌞 南北回归线',
    desc: '了解太阳直射点的移动规律',
  },
  {
    url: '/pages/elective1/daynight/index',
    title: '🌓 昼夜与晨昏线',
    desc: '理解晨昏线概念和昼夜长短变化',
  },
  {
    url: '/pages/elective1/longitude/index',
    title: '🧭 经度',
    desc: '学习经度的定义与东西半球划分',
  },
  {
    url: '/pages/elective1/timezone/index',
    title: '🕐 时区',
    desc: '理解时区划分与时差计算',
  },
  {
    url: '/pages/elective1/shadow/index',
    title: '👤 影子与太阳方位',
    desc: '探索影子变化与太阳位置的关系',
  },
]

export default function Index() {
  return (
    <View className='index'>
      <View className='header'>
        <Text className='title'>高中地理动画教学</Text>
        <Text className='subtitle'>交互式学习，让地理更生动</Text>
      </View>

      <View className='section'>
        <Text className='section-title'>选修一：自然地理基础</Text>
        
        {DEMO_PAGES.map((page) => (
          <Navigator key={page.url} url={page.url} className='card'>
            <View className='card-content'>
              <Text className='card-title'>{page.title}</Text>
              <Text className='card-desc'>{page.desc}</Text>
            </View>
            <Text className='card-arrow'>→</Text>
          </Navigator>
        ))}
      </View>
    </View>
  )
}
