import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  CardActionArea,
  Breadcrumbs,
  Chip
} from '@mui/material';
import {
  Home as HomeIcon,
  Public as GlobeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import ObliquityOfEclipticDemo3D from './pages/elective1/ObliquityOfEclipticDemo3D';

// 动画变体
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// 首页组件
function HomePage() {
  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Typography 
              variant="h2" 
              component="h1" 
              gutterBottom
              sx={{ 
                color: 'white',
                fontWeight: 800,
                textShadow: '0 4px 20px rgba(0,0,0,0.2)',
                fontSize: { xs: '2rem', md: '3.5rem' }
              }}
            >
              🌍 高中地理动画教学
            </Typography>
            <Typography 
              variant="h5" 
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 300,
              }}
            >
              交互式 3D 学习，让地理更生动 ✨
            </Typography>
          </Box>
        </motion.div>

        {/* 选修一：自然地理基础 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Box sx={{ mb: 4 }}>
            <motion.div variants={itemVariants}>
              <Typography 
                variant="h5" 
                sx={{ 
                  mb: 3, 
                  pl: 2, 
                  borderLeft: '4px solid white',
                  color: 'white',
                  fontWeight: 600 
                }}
              >
                📚 选修一：自然地理基础
              </Typography>
            </motion.div>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              {/* 黄赤交角 */}
              <motion.div variants={itemVariants}>
                <Card 
                  sx={{ 
                    height: '100%',
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 4,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }
                  }}
                >
                  <CardActionArea component={Link} to="/elective1/obliquity" sx={{ height: '100%', p: 1 }}>
                    <CardContent>
                      <Box sx={{ fontSize: '3rem', mb: 2 }}>🌍</Box>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                        黄赤交角
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        理解地轴倾斜与黄道面、赤道面的关系，探索四季形成的原因
                      </Typography>
                      <Chip 
                        label="✨ 3D 互动" 
                        sx={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          fontWeight: 600
                        }} 
                        size="small" 
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </motion.div>

              {/* 四季变化 - 待开发 */}
              <motion.div variants={itemVariants}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    background: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 4,
                  }}
                >
                  <CardContent>
                    <Box sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }}>🌞</Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                      四季变化
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      了解地球公转过程中四季的形成机制
                    </Typography>
                    <Chip label="🚀 开发中" color="default" size="small" />
                  </CardContent>
                </Card>
              </motion.div>

              {/* 太阳直射点 - 待开发 */}
              <motion.div variants={itemVariants}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    background: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 4,
                  }}
                >
                  <CardContent>
                    <Box sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }}>📍</Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                      太阳直射点移动
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      观察太阳直射点在南北回归线间的移动规律
                    </Typography>
                    <Chip label="🚀 开发中" color="default" size="small" />
                  </CardContent>
                </Card>
              </motion.div>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}

// 黄赤交角页面
function ObliquityPage() {
  return (
    <Box sx={{ minHeight: '100vh', background: '#F8FAFC', py: 4 }}>
      <Container maxWidth="xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Breadcrumbs 
            separator={<NavigateNextIcon fontSize="small" />} 
            sx={{ mb: 3 }}
          >
            <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#667eea' }}>
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              首页
            </Link>
            <Typography color="text.secondary">选修一</Typography>
            <Typography sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 600
            }}>黄赤交角</Typography>
          </Breadcrumbs>
        </motion.div>
        
        <ObliquityOfEclipticDemo3D />
      </Container>
    </Box>
  );
}

// 主应用组件
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/elective1/obliquity" element={<ObliquityPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
