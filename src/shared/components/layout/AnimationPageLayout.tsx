/**
 * 动画页面通用布局组件
 * 
 * 提供统一的响应式布局，包括：
 * - 3D/2D 场景区域
 * - 可折叠的右侧控制面板
 * - 底部控制按钮栏
 * - 移动端适配
 */

import { ReactNode, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Card,
  Typography,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material';
import {
  Info as InfoIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  ThreeDRotation as ThreeDIcon,
  Home as HomeIcon,
  Close as CloseIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
} from '@mui/icons-material';
import { TwoDIcon } from '../icons';

// ===================== 类型定义 =====================

/** 知识卡片类型 */
export interface InfoCard {
  /** 卡片标题 */
  title: string;
  /** 卡片图标 emoji */
  icon?: string;
  /** 卡片内容 */
  content: ReactNode;
  /** 重要程度星级 1-3 */
  stars?: number;
}

export interface AnimationPageLayoutProps {
  /** 3D 场景内容 - 接收 is3D 参数 */
  scene3D: ReactNode;
  /** 2D 视图内容 */
  scene2D?: ReactNode;
  /** 控制面板内容 */
  controlPanel: ReactNode;
  /** 移动端控制面板内容 */
  mobileControlPanel?: ReactNode;
  /** 底部控制按钮 - 接收 is3D 参数的渲染函数 */
  bottomControls?: (is3D: boolean) => ReactNode;
  /** 信息弹窗内容 - 支持单个 ReactNode 或知识卡片数组 */
  infoContent?: ReactNode | InfoCard[];
  /** 操作提示文本 - 可以是函数，接收 isMobile 参数 */
  controlHint?: string | ((isMobile: boolean) => string);
  /** 是否支持 2D/3D 切换，默认 true */
  support2DToggle?: boolean;
  /** 控制面板宽度，默认 340 */
  panelWidth?: number;
  /** 背景色，默认深色渐变 */
  sceneBackground?: string;
  /** 页面背景色 */
  pageBackground?: string;
  /** 外部控制的 is3D 状态 */
  is3D?: boolean;
  /** is3D 状态变化回调 */
  onIs3DChange?: (is3D: boolean) => void;
  /** 外部控制的面板展开状态 */
  isPanelOpen?: boolean;
  /** 面板展开状态变化回调 */
  onPanelOpenChange?: (isOpen: boolean) => void;
  /** 返回按钮回调（移动端显示在顶部工具栏） */
  onBack?: () => void;
  /** 页面标题（用于无障碍访问） */
  pageTitle?: string;
  /** 返回按钮颜色 */
  backButtonColor?: string;
  /** 信息卡片主题色 */
  infoAccentColor?: string;
}

// ===================== Hook: 用于提取布局状态 =====================

export function useAnimationPageLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isSmallScreen = useMediaQuery('(max-width: 600px)');
  
  const shouldShowLandscapePrompt = isSmallScreen && isPortrait;
  
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [dismissedLandscapePrompt, setDismissedLandscapePrompt] = useState(false);

  return {
    isMobile,
    isPortrait,
    isSmallScreen,
    shouldShowLandscapePrompt,
    isPanelOpen,
    setIsPanelOpen,
    is3D,
    setIs3D,
    dismissedLandscapePrompt,
    setDismissedLandscapePrompt,
  };
}

// ===================== 玻璃质感知识卡片轮播组件 =====================

interface InfoCarouselProps {
  cards: InfoCard[];
  onClose: () => void;
  accentColor?: string;
}

function InfoCarousel({ cards, onClose, accentColor = '#3B82F6' }: InfoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  
  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    const newIndex = currentIndex + newDirection;
    if (newIndex >= 0 && newIndex < cards.length) {
      setDirection(newDirection);
      setCurrentIndex(newIndex);
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeConfidenceThreshold) {
      paginate(1);
    } else if (swipe > swipeConfidenceThreshold) {
      paginate(-1);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const card = cards[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647, // Maximum z-index to ensure it's above drei Html components
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          background: 'rgba(255,255,255,0.1)',
          '&:hover': { background: 'rgba(255,255,255,0.2)' },
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* 卡片容器 */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          height: '70vh',
          maxHeight: 500,
          position: 'relative',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              cursor: 'grab',
            }}
          >
            {/* 玻璃质感卡片 */}
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* 卡片头部 */}
              <div
                style={{
                  padding: 20,
                  background: `linear-gradient(135deg, ${accentColor}40 0%, ${accentColor}20 100%)`,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {card.icon && (
                    <span style={{ fontSize: 28 }}>{card.icon}</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {card.title}
                    </div>
                    {card.stars && (
                      <div style={{ color: '#FCD34D', fontSize: 14, marginTop: 4 }}>
                        {'⭐'.repeat(card.stars)} 高考重点
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 卡片内容 */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: 20,
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 14,
                    lineHeight: 1.8,
                  }}
                >
                  {card.content}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部导航 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左箭头 */}
        <IconButton
          onClick={() => paginate(-1)}
          disabled={currentIndex === 0}
          sx={{
            color: 'white',
            background: 'rgba(255,255,255,0.1)',
            '&:hover': { background: 'rgba(255,255,255,0.2)' },
            '&:disabled': { opacity: 0.3 },
          }}
        >
          <ArrowLeftIcon />
        </IconButton>

        {/* 分页指示器 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {cards.map((_, index) => (
            <div
              key={index}
              onClick={() => {
                setDirection(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              style={{
                width: index === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: index === currentIndex ? accentColor : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* 右箭头 */}
        <IconButton
          onClick={() => paginate(1)}
          disabled={currentIndex === cards.length - 1}
          sx={{
            color: 'white',
            background: 'rgba(255,255,255,0.1)',
            '&:hover': { background: 'rgba(255,255,255,0.2)' },
            '&:disabled': { opacity: 0.3 },
          }}
        >
          <ArrowRightIcon />
        </IconButton>
      </div>

      {/* 滑动提示 */}
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12,
          mt: 2,
        }}
      >
        👆 左右滑动切换卡片 · {currentIndex + 1} / {cards.length}
      </Typography>
    </motion.div>
  );
}

// ===================== 主组件 =====================

export function AnimationPageLayout({
  scene3D,
  scene2D,
  controlPanel,
  mobileControlPanel,
  bottomControls,
  infoContent,
  controlHint,
  support2DToggle = true,
  panelWidth: basePanelWidth = 340,
  sceneBackground = 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  pageBackground = '#0F172A',
  is3D: externalIs3D,
  onIs3DChange,
  isPanelOpen: externalIsPanelOpen,
  onPanelOpenChange,
  onBack,
  pageTitle,
  backButtonColor = '#3B82F6',
  infoAccentColor,
}: AnimationPageLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isSmallScreen = useMediaQuery('(max-width: 600px)');
  
  const shouldShowLandscapePrompt = isSmallScreen && isPortrait;
  
  // 内部状态（当外部没有提供时使用）
  const [internalIsPanelOpen, setInternalIsPanelOpen] = useState(true);
  const [internalIs3D, setInternalIs3D] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [dismissedLandscapePrompt, setDismissedLandscapePrompt] = useState(false);
  
  // 判断 infoContent 是否为卡片数组
  const isCardArray = Array.isArray(infoContent);
  const infoCards = isCardArray ? infoContent as InfoCard[] : null;
  const accentColor = infoAccentColor || backButtonColor;

  // 使用外部状态或内部状态
  const isPanelOpen = externalIsPanelOpen ?? internalIsPanelOpen;
  const setIsPanelOpen = useCallback((value: boolean) => {
    if (onPanelOpenChange) {
      onPanelOpenChange(value);
    } else {
      setInternalIsPanelOpen(value);
    }
  }, [onPanelOpenChange]);

  const is3D = externalIs3D ?? internalIs3D;
  const setIs3D = useCallback((value: boolean) => {
    if (onIs3DChange) {
      onIs3DChange(value);
    } else {
      setInternalIs3D(value);
    }
  }, [onIs3DChange]);

  const panelWidth = isPanelOpen ? basePanelWidth : 0;

  // 计算提示文本
  const hintText = typeof controlHint === 'function' ? controlHint(isMobile) : controlHint;

  // 横屏提示
  if (shouldShowLandscapePrompt && !dismissedLandscapePrompt) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: sceneBackground,
        padding: 24,
        textAlign: 'center',
      }}>
        <motion.div
          animate={{ rotate: [0, 90, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 64, marginBottom: 24 }}
        >
          📱
        </motion.div>
        <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
          建议横屏查看
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
          横屏模式下可以获得更好的3D交互体验
        </Typography>
        <Chip
          label="继续竖屏查看"
          onClick={() => setDismissedLandscapePrompt(true)}
          sx={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
            color: 'white',
          }}
        />
      </div>
    );
  }

  // 移动端布局
  if (isMobile) {
    return (
      <div style={{ height: '100vh', position: 'relative', background: pageBackground }}>
        {/* 顶部工具栏：返回按钮 + 3D/2D 切换 */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* 返回首页按钮 */}
          {onBack && (
            <IconButton
              onClick={onBack}
              aria-label={pageTitle ? `返回，当前页面: ${pageTitle}` : '返回首页'}
              sx={{
                background: 'rgba(255,255,255,0.9)',
                width: 36,
                height: 36,
                '&:hover': { background: 'rgba(255,255,255,1)' },
              }}
            >
              <HomeIcon sx={{ fontSize: 20, color: backButtonColor }} />
            </IconButton>
          )}
          
          {/* 3D/2D 切换 */}
          {support2DToggle && scene2D && (
            <ToggleButtonGroup
              value={is3D ? '3d' : '2d'}
              exclusive
              onChange={(_, value) => value && setIs3D(value === '3d')}
              size="small"
              sx={{
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 2,
              }}
            >
              <ToggleButton value="3d">
                <ThreeDIcon sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="2d">
                <TwoDIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </div>

        {/* 控制按钮 */}
        {infoContent && (
          <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 100,
            display: 'flex',
            gap: 8,
          }}>
            <IconButton
              onClick={() => setShowInfo(!showInfo)}
              sx={{
                background: 'rgba(255,255,255,0.9)',
                '&:hover': { background: 'rgba(255,255,255,1)' },
              }}
            >
              <InfoIcon />
            </IconButton>
          </div>
        )}

        {/* 主视图 */}
        <div style={{ height: '100%', paddingBottom: mobileControlPanel ? 60 : 0 }}>
          {is3D ? scene3D : (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}>
              {scene2D}
            </div>
          )}
        </div>

        {/* 移动端控制面板 */}
        {mobileControlPanel}

        {/* 信息弹窗 - 使用新的玻璃质感卡片轮播 */}
        <AnimatePresence>
          {showInfo && infoContent && (
            infoCards ? (
              <InfoCarousel
                cards={infoCards}
                onClose={() => setShowInfo(false)}
                accentColor={accentColor}
              />
            ) : (
              // 兼容旧的 ReactNode 格式
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(8px)',
                }}
                onClick={() => setShowInfo(false)}
              >
                <IconButton
                  onClick={() => setShowInfo(false)}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    color: 'white',
                    background: 'rgba(255,255,255,0.1)',
                    '&:hover': { background: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <CloseIcon />
                </IconButton>
                <div
                  style={{
                    maxWidth: 400,
                    maxHeight: '80vh',
                    overflow: 'auto',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    padding: 24,
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  {infoContent as ReactNode}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 桌面端布局
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    height: 'calc(100vh - 100px)',
    minHeight: '400px',
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  };

  const sceneContainerStyle: React.CSSProperties = {
    flex: 1,
    height: '100%',
    marginRight: isPanelOpen ? `${panelWidth + 16}px` : '48px',
    transition: 'margin-right 0.3s ease',
  };

  return (
    <div style={containerStyle}>
      {/* 左侧 3D/2D 视图区域 */}
      <div key={`scene-container-${isPanelOpen}`} style={sceneContainerStyle}>
        <Card
          component={motion.div}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          sx={{
            height: '100%',
            background: sceneBackground,
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {is3D ? (
            <div style={{ width: '100%', height: '100%' }}>
              {scene3D}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              {scene2D}
            </div>
          )}

          {/* 底部控制按钮 */}
          {(bottomControls || (support2DToggle && scene2D)) && (
            <div style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 8,
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: 8,
            }}>
              {bottomControls && bottomControls(is3D)}
              
              {/* 2D/3D 切换按钮 */}
              {support2DToggle && scene2D && (
                <Tooltip title={is3D ? '切换到2D视图' : '切换到3D视图'}>
                  <IconButton
                    onClick={() => setIs3D(!is3D)}
                    sx={{ color: '#3B82F6', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                  >
                    {is3D ? <TwoDIcon /> : <ThreeDIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </div>
          )}

          {/* 操作提示 */}
          {hintText && (
            <Typography sx={{ position: 'absolute', top: 16, left: 16, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
              {hintText}
            </Typography>
          )}
        </Card>
      </div>

      {/* 分隔条 */}
      <div
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        style={{
          position: 'absolute',
          right: isPanelOpen ? panelWidth : 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '32px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isPanelOpen 
            ? 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)'
            : 'linear-gradient(180deg, #3B82F6 0%, #10B981 100%)',
          borderRadius: 8,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          transition: 'right 0.3s ease, background 0.2s ease',
        }}
      >
        <div style={{ color: isPanelOpen ? '#64748B' : 'white', display: 'flex', alignItems: 'center', transition: 'color 0.2s ease' }}>
          {isPanelOpen ? <CollapseIcon /> : <ExpandIcon />}
        </div>
      </div>

      {/* 右侧控制面板 */}
      <div style={{ 
        position: 'absolute', 
        right: 0, 
        top: 0, 
        bottom: 0, 
        width: panelWidth, 
        overflow: 'hidden', 
        transition: 'width 0.3s ease' 
      }}>
        <Card sx={{
          height: '100%',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderRadius: 4,
          overflow: 'auto',
          width: basePanelWidth,
          opacity: isPanelOpen ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}>
          {controlPanel}
        </Card>
      </div>
    </div>
  );
}

// ===================== 辅助组件 =====================

/** 加载占位符 */
export function SceneLoading({ text = '🚀 加载 3D 场景中...' }: { text?: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      flexDirection: 'column', 
      gap: 16 
    }}>
      <Typography color="white">{text}</Typography>
      <LinearProgress sx={{ width: '50%' }} />
    </div>
  );
}
