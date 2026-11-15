import { useEffect, useId, useRef, useState } from 'react';
import type { MascotState } from '../../shared/model';
import './Yoyo.css';

/** Geometry stays inside the transparent companion window. Gestures do not interrupt speech. */
export function Yoyo({
  state = 'idle',
  className = '',
  direction = null,
}: {
  state?: MascotState;
  className?: string;
  direction?: 'left' | 'right' | null;
}) {
  const id = useId().replace(/:/g, '');
  const root = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let intersecting = true;
    const sync = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  const accent = state === 'error' ? '#ffc59f' : '#b9c5ff';
  return (
    <svg
      ref={root}
      viewBox="0 0 240 245"
      className={`yoyo yoyo-v2 yoyo--${state} yoyo-v2--${state} ${direction ? 'yoyo-pointing yoyo-v2-gesture--pointing' : ''} ${className}`}
      data-motion={visible ? 'running' : 'paused'}
      role="img"
      aria-label={`Yoyo, ${state}${direction ? `, pointing ${direction}` : ''}`}
    >
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4f5ff" />
          <stop offset=".32" stopColor="#c7c7ee" />
          <stop offset=".61" stopColor="#8b8dbb" />
          <stop offset=".82" stopColor="#d7edfa" />
          <stop offset="1" stopColor="#9598ca" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2=".6">
          <stop stopColor="#575b83" />
          <stop offset=".48" stopColor="#252d49" />
          <stop offset="1" stopColor="#aabfe1" />
        </linearGradient>
        <radialGradient id={`${id}-glass`} cx="30%" cy="15%" r="100%">
          <stop stopColor="#434c70" />
          <stop offset=".55" stopColor="#202941" />
          <stop offset="1" stopColor="#111b2d" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-150%" width="200%" height="400%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <ellipse
        className="yoyo-v2-shadow"
        cx="122"
        cy="219"
        rx="47"
        ry="5"
        fill="#26324b"
        opacity=".2"
        filter={`url(#${id}-shadow)`}
      />
      <g className="yoyo-v2-arrival">
        <g className="yoyo-float yoyo-v2-float">
          <g
            className="yoyo-v2-tether"
            fill="none"
            stroke="#000000"
            strokeWidth="3.4"
            strokeLinecap="round"
          >
            <g transform={direction === 'left' ? 'translate(240 0) scale(-1 1)' : undefined}>
              <path
                className="yoyo-v2-string-rest"
                d="M141 159 C172 179 184 183 188 168 C194 145 209 150 202 133 C198 123 195 116 201 107"
              />
              <g className="yoyo-v2-string-point" key={direction ?? state}>
                <path
                  pathLength="1"
                  d="M139 158 C169 184 191 178 191 154 C191 130 207 120 225 117"
                />
                <path d="m218 112 8 5-6 7" />
              </g>
            </g>
          </g>
          <g className="yoyo-v2-disc" key={direction ?? state}>
            <ellipse
              cx="126"
              cy="122"
              rx="68"
              ry="72"
              fill={`url(#${id}-edge)`}
              stroke="#b9cce4"
              strokeWidth="1.2"
            />
            <ellipse
              className="yoyo-v2-body"
              cx="114"
              cy="120"
              rx="67"
              ry="72"
              fill={`url(#${id}-shell)`}
              stroke="#e6efff"
              strokeWidth="1.3"
            />
            <ellipse
              cx="114"
              cy="120"
              rx="58"
              ry="63"
              fill="none"
              stroke="#555e8b"
              strokeOpacity=".55"
              strokeWidth="1"
            />
            <path
              d="M64 92 C72 66 98 54 119 58"
              stroke="#fff"
              strokeOpacity=".8"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse
              cx="114"
              cy="120"
              rx="50"
              ry="55"
              fill={`url(#${id}-glass)`}
              stroke="#dde6ff"
              strokeOpacity=".6"
            />
            <path
              d="M78 94 Q99 69 130 78"
              stroke="#a9b8e0"
              strokeOpacity=".25"
              fill="none"
              strokeLinecap="round"
            />
            <g
              className="yoyo-v2-track"
              fill="none"
              stroke={accent}
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path className="yoyo-v2-signal" d="M88 170 Q114 185 141 168" />
              <path className="yoyo-v2-scan" d="M62 121 C62 89 85 63 114 63" />
            </g>
            <g className="yoyo-v2-face" fill={accent} stroke={accent}>
              <g className="yoyo-v2-eyes" stroke="none">
                <rect x="92" y="110" width="7" height="14" rx="3.5" />
                <rect x="130" y="110" width="7" height="14" rx="3.5" />
              </g>
              <path
                className="yoyo-v2-smile"
                d="M108 138 Q114 142 120 138"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <g className="yoyo-v2-voice" strokeWidth="2.7" strokeLinecap="round">
                {[104, 111, 118, 125].map((x, i) => (
                  <path key={x} className={`yoyo-v2-voice-bar bar-${i}`} d={`M${x} 134 v9`} />
                ))}
              </g>
              <path
                className="yoyo-v2-check"
                d="m105 138 6 6 13-14"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
            <circle cx="114" cy="159" r="1.5" fill={accent} opacity=".65" />
          </g>
        </g>
      </g>
    </svg>
  );
}
