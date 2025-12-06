import { View, Text, Navigator } from '@tarojs/components'
import './index.scss'

export default function Index() {
  return (
    <View className='index'>
      <View className='header'>
        <Text className='title'>高中地理动画教学</Text>
        <Text className='subtitle'>交互式学习，让地理更生动</Text>
      </View>

      <View className='section'>
        <Text className='section-title'>选修一：自然地理基础</Text>
        
        <Navigator url='/pages/elective1/obliquity/index' className='card'>
          <View className='card-content'>
            <Text className='card-title'>🌍 黄赤交角</Text>
            <Text className='card-desc'>理解地轴倾斜与黄道面、赤道面的关系</Text>
          </View>
          <Text className='card-arrow'>→</Text>
        </Navigator>

        <View className='card disabled'>
          <View className='card-content'>
            <Text className='card-title'>🌞 四季变化</Text>
            <Text className='card-desc'>敬请期待</Text>
          </View>
        </View>

        <View className='card disabled'>
          <View className='card-content'>
            <Text className='card-title'>📍 太阳直射点</Text>
            <Text className='card-desc'>敬请期待</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
