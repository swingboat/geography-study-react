/**
 * 2D 视图切换图标
 * 
 * 模仿 MUI 的 ThreeDRotation 图标样式，但显示 "2D"
 */

export function TwoDIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      {/* 旋转箭头 - 左下 */}
      <path d="M7.52 21.48C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z" />
      {/* 旋转箭头 - 右上 */}
      <path d="M16.48 2.52C19.75 4.06 22.09 7.24 22.45 11h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32z" />
      {/* 2D 文字 */}
      <text x="6" y="16" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">
        2D
      </text>
    </svg>
  );
}
