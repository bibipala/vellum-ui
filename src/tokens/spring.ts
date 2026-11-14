/**
 * 弹簧动效：用阻尼弹簧的物理参数描述动画，编译为 CSS 的 `linear()` 缓动与它的时长。
 *
 * 弹簧从静止出发、逐渐加速、再柔和地落定（阻尼小时略微越过终点再回来），比固定的贝塞尔曲线更接近真实物体的运动。
 * 主题只给出两个参数：response（无阻尼时摆动一周的时间，越小越快）与 damping（阻尼比，1 不回弹，越小回弹越明显）。
 * 时长是弹簧落定（与终点相差不到 0.2%）的时间，由参数算出，不另外指定。
 */

/**
 * A spring for motion: how fast it moves (`response`) and how much it bounces (`damping`). Compiled to a CSS
 * `linear()` easing and a duration (the time the spring takes to settle) by springEasing.
 * @zh 动效用的弹簧：快慢（`response`）与回弹程度（`damping`）。由 springEasing 编译为 CSS 的 `linear()` 缓动与时长
 * （弹簧落定所需的时间）。
 */
export interface MotionSpring {
  /**
   * Time of one swing of the spring without damping, in milliseconds: smaller is faster. The duration of the
   * motion is about 1.3–1.6 times this.
   * @zh 无阻尼时弹簧摆动一周的时间（毫秒），越小越快。动效的时长约为它的 1.3–1.6 倍。
   */
  readonly response: number
  /**
   * Damping ratio, greater than 0 and at most 1: `1` settles without overshooting, smaller values overshoot the
   * target and come back (0.9 by about 0.2 %, 0.7 by about 5 %).
   * @zh 阻尼比，大于 0、不大于 1：`1` 不越过终点，越小越会越过终点再回来（0.9 约越过 0.2%，0.7 约 5%）。
   */
  readonly damping: number
}

/**
 * The CSS form of a spring: an easing function and the duration that goes with it.
 * @zh 弹簧的 CSS 形式：缓动函数与配套的时长。
 */
export interface SpringEasing {
  /**
   * A CSS `linear()` easing that follows the spring, such as `linear(0, 0.08 6%, …, 1)`.
   * @zh 沿弹簧运动的 CSS `linear()` 缓动，如 `linear(0, 0.08 6%, …, 1)`。
   */
  readonly easing: string
  /**
   * Time for the spring to settle, in whole milliseconds; use it as the duration of the transition.
   * @zh 弹簧落定的时间（整数毫秒），作为过渡的时长。
   */
  readonly duration: number
}

/** 与终点相差不到这个比例就算落定：0.2%，16px 的位移只差 0.03px */
const SETTLE = 0.002
/** 采样后简化折线时允许的最大偏差（进度的比例） */
const TOLERANCE = 0.0015

/** 弹簧在时刻 t（秒）的进度，从 0 出发、初速度为 0，终点为 1 */
function position(spring: MotionSpring): (t: number) => number {
  const w = (2 * Math.PI) / (spring.response / 1000)
  const z = spring.damping
  if (z >= 1) return (t) => 1 - Math.exp(-w * t) * (1 + w * t)
  const wd = w * Math.sqrt(1 - z * z)
  return (t) => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
}

/** 折线简化（Ramer–Douglas–Peucker）：只保留偏离相邻两点连线超过容差的点 */
function simplify(points: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [a, b] = stack.pop() as [number, number]
    const [x1, y1] = points[a] as readonly [number, number]
    const [x2, y2] = points[b] as readonly [number, number]
    let worst = -1
    let dist = 0
    for (let i = a + 1; i < b; i++) {
      const [x, y] = points[i] as readonly [number, number]
      // 纵向偏差：同一时刻折线与真实进度之差
      const d = Math.abs(y - (y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)))
      if (d > dist) {
        dist = d
        worst = i
      }
    }
    if (worst >= 0 && dist > TOLERANCE) {
      keep[worst] = true
      stack.push([a, worst], [worst, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

const round = (n: number, digits: number) => {
  const fixed = n.toFixed(digits)
  const s = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
  return s === '-0' ? '0' : s
}

/**
 * Compiles a spring to a CSS `linear()` easing and the duration it takes to settle. Use it for your own animations
 * with the same feel as the components, such as with the Web Animations API; in CSS, use the compiled tokens
 * `--vl-motion-ease-spring` and `--vl-motion-duration-spring` instead.
 * @zh 把弹簧编译为 CSS 的 `linear()` 缓动与落定所需的时长。用于手感与组件一致的自定义动画，如配合 Web Animations
 * API；在 CSS 中直接使用编译后的令牌 `--vl-motion-ease-spring` 与 `--vl-motion-duration-spring`。
 * @group Theme
 * @example
 * ```ts
 * const { easing, duration } = springEasing({ response: 260, damping: 0.9 })
 * el.animate([{ transform: 'scale(0.95)' }, { transform: 'none' }], { duration, easing })
 * ```
 */
export function springEasing(spring: MotionSpring): SpringEasing {
  if (!(spring.response > 0) || !(spring.damping > 0)) {
    throw new RangeError('springEasing: response and damping must be greater than 0')
  }
  const s = { response: spring.response, damping: Math.min(spring.damping, 1) }
  const x = position(s)
  // 落定时刻：之后进度与终点之差始终小于 SETTLE（按 1ms 的步长从后往前找最后一个超出的时刻）
  const horizon = (s.response / 1000) * 6
  let settle = 0
  for (let t = horizon; t > 0; t -= 0.001) {
    if (Math.abs(x(t) - 1) > SETTLE) {
      settle = t
      break
    }
  }
  const duration = Math.max(1, Math.ceil(settle * 1000))
  const samples = 200
  const points: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const p = i / samples
    // 最后一个点固定为终点：剩余不到 0.2% 的差距在最后一帧补齐
    points.push([p, i === samples ? 1 : x((p * duration) / 1000)])
  }
  const kept = simplify(points)
  const stops = kept.map(([p, y], i) =>
    i === 0 || i === kept.length - 1 ? round(y, 0) : `${round(y, 4)} ${round(p * 100, 2)}%`,
  )
  return { easing: `linear(${stops.join(', ')})`, duration }
}
