/** 空状态插画：简洁的几何线稿 + 极淡的强调色柔光，随主题变化（替代 antd 默认插画）。 */
import { useId } from 'react'
import { cssVar } from '../theme/compile.ts'

export function EmptyArt(props: { size?: number }) {
  const size = props.size ?? 88
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={cssVar('color-accent')} stopOpacity="0.16" />
          <stop offset="1" stopColor={cssVar('color-accent')} stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${id}-line`}
          x1="20"
          y1="20"
          x2="76"
          y2="76"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={cssVar('color-accent')} />
          <stop offset="1" stopColor={cssVar('color-accent')} />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="44" fill={`url(#${id}-glow)`} />
      <rect
        x="22"
        y="28"
        width="52"
        height="40"
        rx="9"
        stroke={cssVar('color-border-strong')}
        strokeWidth="1.5"
      />
      <rect
        x="28"
        y="22"
        width="40"
        height="40"
        rx="9"
        fill={cssVar('color-bg-elevated')}
        stroke={`url(#${id}-line)`}
        strokeWidth="1.5"
      />
      <circle cx="40" cy="36" r="4" stroke={cssVar('color-text-tertiary')} strokeWidth="1.5" />
      <path
        d="m32 56 10-10 7 7 5-5 10 8"
        stroke={cssVar('color-text-tertiary')}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 18v6M71 21h6"
        stroke={cssVar('color-accent-text')}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
