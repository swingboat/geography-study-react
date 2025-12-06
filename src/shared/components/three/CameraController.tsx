/**
 * 相机控制器组件
 * 
 * 封装 OrbitControls，提供重置视角功能
 */

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export interface CameraControllerHandle {
  /** 重置相机到默认位置 */
  reset: () => void;
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
