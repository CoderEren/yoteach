import { useId } from 'react';
import type { MascotState } from '../../shared/model';
/** Visual-only mascot. Replace this component without changing companion behavior. */
export function Yoyo({
  state = 'idle',
  className = '',
}: {
  state?: MascotState;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 240 245"
      className={`yoyo yoyo--${state} ${className}`}
      role="img"
      aria-label={`Yoyo, ${state}`}
    >
      <defs>
        <linearGradient
          id={`${id}-body`}
          x1=".15"
          y1="0"
          x2=".85"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#e3e0ff" />
          <stop offset=".43" stopColor="#b8b1f4" />
          <stop offset=".78" stopColor="#b6dcf1" />
          <stop offset="1" stopColor="#d7f7f8" />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="30%" cy="20%" r="80%">
          <stop stopColor="white" stopOpacity=".85" />
          <stop offset=".6" stopColor="white" stopOpacity=".05" />
          <stop offset="1" stopColor="#7a71c9" stopOpacity=".2" />
        </radialGradient>
        <linearGradient id={`${id}-fin`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#efedff" />
          <stop offset="1" stopColor="#a39ae5" />
        </linearGradient>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse
        className="yoyo-shadow"
        cx="120"
        cy="222"
        rx="53"
        ry="8"
        fill="#645b9d"
        opacity=".17"
        filter={`url(#${id}-blur)`}
      />
      <g className="yoyo-float">
        <path
          className="yoyo-ear left"
          d="M72 65 C47 63 47 27 57 22 C72 21 85 45 77 61Z"
          fill={`url(#${id}-fin)`}
          stroke="#ffffff"
          strokeOpacity=".8"
        />
        <path
          className="yoyo-ear right"
          d="M168 65 C193 63 193 27 183 22 C168 21 155 45 163 61Z"
          fill={`url(#${id}-fin)`}
          stroke="#ffffff"
          strokeOpacity=".8"
        />
        <path
          className="yoyo-arm left"
          d="M60 139 C41 137 30 154 38 165 C46 174 57 158 64 155"
          fill={`url(#${id}-body)`}
          stroke="#eef6ff"
          strokeOpacity=".8"
        />
        <path
          className="yoyo-arm right"
          d="M180 139 C199 137 210 154 202 165 C194 174 183 158 176 155"
          fill={`url(#${id}-body)`}
          stroke="#eef6ff"
          strokeOpacity=".8"
        />
        <path
          className="yoyo-body"
          d="M120 49 C155 49 171 69 181 107 C190 140 207 168 188 189 C171 209 69 209 52 189 C33 168 50 140 59 107 C69 69 85 49 120 49Z"
          fill={`url(#${id}-body)`}
          stroke="#fff"
          strokeOpacity=".92"
          strokeWidth="1.6"
        />
        <path
          d="M120 49 C155 49 171 69 181 107 C190 140 207 168 188 189 C171 209 69 209 52 189 C33 168 50 140 59 107 C69 69 85 49 120 49Z"
          fill={`url(#${id}-light)`}
        />
        <path
          d="M72 99 C80 70 97 60 117 60"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          opacity=".4"
          strokeLinecap="round"
        />
        <g className="yoyo-face" fill="#26304c">
          <g className="yoyo-eyes">
            <ellipse cx="94" cy="127" rx="6" ry="10" />
            <ellipse cx="146" cy="127" rx="6" ry="10" />
            <circle cx="96" cy="124" r="1.6" fill="#fff" />
            <circle cx="148" cy="124" r="1.6" fill="#fff" />
          </g>
          <path
            className="yoyo-brows"
            d="M87 109 Q94 105 101 109 M139 109 Q146 105 153 109"
            stroke="#555075"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            className="yoyo-smile"
            d="M113 146 Q120 153 127 146"
            fill="none"
            stroke="#34334f"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse className="yoyo-mouth" cx="120" cy="149" rx="5" ry="6" />
        </g>
        <g className="yoyo-spark" fill="#7668f6">
          <path d="M120 9 L123 17 L131 20 L123 23 L120 31 L117 23 L109 20 L117 17Z" />
        </g>
      </g>
    </svg>
  );
}
