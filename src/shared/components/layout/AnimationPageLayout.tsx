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
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
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
} from '@mui/icons-material';
import { TwoDIcon } from '../icons';

// ===================== 类型定义 =====================

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
  /** 信息弹窗内容 */
  infoContent?: ReactNode;
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
        {/* 3D/2D 切换 */}
        {support2DToggle && scene2D && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 100,
          }}>
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
          </div>
        )}

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

        {/* 信息弹窗 */}
        <AnimatePresence>
          {showInfo && infoContent && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'rgba(0,0,0,0.5)',
              }}
              onClick={() => setShowInfo(false)}
            >
              <Card sx={{ maxWidth: 400, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <CardContent>
                  {infoContent}
                </CardContent>
              </Card>
            </motion.div>
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
