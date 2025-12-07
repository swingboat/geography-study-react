import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  CardActionArea,
  Breadcrumbs,
  Chip,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import ObliquityOfEclipticDemo3D from './pages/elective1/ObliquityOfEclipticDemo3D';
import TropicsDemo3D from './pages/elective1/TropicsDemo3D';
import LongitudeDemo3D from './pages/elective1/LongitudeDemo3D';

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
    <div 
      style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        paddingTop: 48,
        paddingBottom: 48,
      }}
    >
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
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
          </div>
        </motion.div>

        {/* 选修一：自然地理基础 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div style={{ marginBottom: 32 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
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
                      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌍</div>
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

              {/* 南北回归线 */}
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
                  <CardActionArea component={Link} to="/elective1/tropics" sx={{ height: '100%', p: 1 }}>
                    <CardContent>
                      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌐</div>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                        南北回归线
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        了解回归线的位置与意义，观察太阳直射点的移动规律
                      </Typography>
                      <Chip 
                        label="✨ 3D 互动" 
                        sx={{ 
                          background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
                          color: 'white',
                          fontWeight: 600
                        }} 
                        size="small" 
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </motion.div>

              {/* 经度 */}
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
                  <CardActionArea component={Link} to="/elective1/longitude" sx={{ height: '100%', p: 1 }}>
                    <CardContent>
                      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌍</div>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                        经度
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        理解经度的定义，认识本初子午线与东西半球的划分
                      </Typography>
                      <Chip 
                        label="✨ 3D 互动" 
                        sx={{ 
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
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
                    <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.5 }}>🌞</div>
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
            </div>
          </div>
        </motion.div>
      </Container>
    </div>
  );
}

// 黄赤交角页面
function ObliquityPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingTop: isMobile ? 0 : 32, paddingBottom: isMobile ? 0 : 32 }}>
      {/* 移动端固定返回按钮 */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1001,
          }}
        >
          <IconButton
            onClick={() => navigate('/')}
            sx={{
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5558E3 0%, #9747E8 100%)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </div>
      )}

      <Container maxWidth="xl" sx={{ px: isMobile ? 0 : 3 }}>
        {/* 桌面端面包屑导航 */}
        {!isMobile && (
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
        )}
        
        <ObliquityOfEclipticDemo3D />
      </Container>
    </div>
  );
}

// 南北回归线页面
function TropicsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingTop: isMobile ? 0 : 32, paddingBottom: isMobile ? 0 : 32 }}>
      {/* 移动端固定返回按钮 */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1001,
          }}
        >
          <IconButton
            onClick={() => navigate('/')}
            sx={{
              background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 100%)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </div>
      )}

      <Container maxWidth="xl" sx={{ px: isMobile ? 0 : 3 }}>
        {/* 桌面端面包屑导航 */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Breadcrumbs 
              separator={<NavigateNextIcon fontSize="small" />} 
              sx={{ mb: 3 }}
            >
              <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#EF4444' }}>
                <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                首页
              </Link>
              <Typography color="text.secondary">选修一</Typography>
              <Typography sx={{ 
                background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 600
              }}>南北回归线</Typography>
            </Breadcrumbs>
          </motion.div>
        )}
        
        <TropicsDemo3D />
      </Container>
    </div>
  );
}

// 经度页面
function LongitudePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingTop: isMobile ? 0 : 16, paddingBottom: isMobile ? 0 : 16 }}>
      {/* 移动端固定返回按钮 */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1001,
          }}
        >
          <IconButton
            onClick={() => navigate('/')}
            sx={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </div>
      )}

      <Container maxWidth={false} sx={{ px: isMobile ? 0 : 3, maxWidth: '100%' }}>
        {/* 桌面端面包屑导航 */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Breadcrumbs 
              separator={<NavigateNextIcon fontSize="small" />} 
              sx={{ mb: 2 }}
            >
              <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#10B981' }}>
                <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                首页
              </Link>
              <Typography color="text.secondary">选修一</Typography>
              <Typography sx={{ 
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 600
              }}>经度</Typography>
            </Breadcrumbs>
          </motion.div>
        )}
        
        <LongitudeDemo3D />
      </Container>
    </div>
  );
}

// 主应用组件
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/elective1/obliquity" element={<ObliquityPage />} />
        <Route path="/elective1/tropics" element={<TropicsPage />} />
        <Route path="/elective1/longitude" element={<LongitudePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
