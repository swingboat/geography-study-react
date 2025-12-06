export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/elective1/obliquity/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2563eb',
    navigationBarTitleText: '高中地理动画教学',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#666666',
    selectedColor: '#2563eb',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/elective1/obliquity/index',
        text: '选修一'
      }
    ]
  }
})
