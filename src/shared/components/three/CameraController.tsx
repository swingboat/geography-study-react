/**
 * 相机控制器组件
 * 
 * 封装 OrbitControls，提供重置视角功能
 */

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export interface CameraControllerHandle {
  /** 重置相机到默认位置 */
  reset: () => void;
  /** 让相机转动到查看指定经纬度位置 */
  lookAtLongLat: (longitude: number, latitude: number, animate?: boolean) => void;
}

interface CameraControllerProps {
  /** 默认相机位置，默认 [12, 10, 12] */
  defaultPosition?: [number, number, number];
  /** 最小缩放距离，默认 5 */
  minDistance?: number;
  /** 最大缩放距离，默认 30 */
  maxDistance?: number;
  /** 是否允许平移，默认 false */
  enablePan?: boolean;
}

export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  (
    {
      defaultPosition = [12, 10, 12],
      minDistance = 5,
      maxDistance = 30,
      enablePan = false,
    },
    ref
  ) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        camera.position.set(...defaultPosition);
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.reset();
        }
      },
      lookAtLongLat: (longitude: number, latitude: number, animate = true) => {
        // 将经纬度转换为弧度
        const lonRad = (longitude * Math.PI) / 180;
        const latRad = (latitude * Math.PI) / 180;
        
        // 计算相机目标位置
        // 使用与城市标记相同的坐标系统：
        // X = cos(lat) * cos(lon)
        // Y = sin(lat)  
        // Z = -cos(lat) * sin(lon)
        const distance = camera.position.length(); // 保持当前距离
        
        // 相机位置在城市方向的延长线上，从地球中心向外
        // 这样相机正好对着城市
        const targetX = Math.cos(latRad) * Math.cos(lonRad) * distance;
        const targetY = Math.sin(latRad) * distance;
        const targetZ = -Math.cos(latRad) * Math.sin(lonRad) * distance;
        
        if (animate) {
          // 使用动画过渡
          const startPos = camera.position.clone();
          const endPos = new THREE.Vector3(targetX, targetY, targetZ);
          const duration = 800; // 毫秒
          const startTime = Date.now();
          
          const animateCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用 easeInOutCubic 缓动函数
            const eased = progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            camera.position.lerpVectors(startPos, endPos, eased);
            camera.lookAt(0, 0, 0);
            
            if (controlsRef.current) {
              controlsRef.current.update();
            }
            
            if (progress < 1) {
              requestAnimationFrame(animateCamera);
            }
          };
          
          animateCamera();
        } else {
          camera.position.set(targetX, targetY, targetZ);
          camera.lookAt(0, 0, 0);
          if (controlsRef.current) {
            controlsRef.current.update();
          }
        }
      },
    }));

    return (
      <OrbitControls
        ref={controlsRef}
        enablePan={enablePan}
        minDistance={minDistance}
        maxDistance={maxDistance}
      />
    );
  }
);

CameraController.displayName = 'CameraController';
