import { useId } from 'react';
import type { MascotState } from '../../shared/model';
/** Twin translucent yo-yo discs and an expressive string, based on the supplied reference. */
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
  return (
    <svg
      viewBox="0 0 240 245"
      className={`yoyo yoyo--${state} ${direction ? 'yoyo-pointing' : ''} ${className}`}
      role="img"
      aria-label={`Yoyo, ${state}`}
    >
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2=".9" y2="1">
          <stop stopColor="#f2e8ff" />
          <stop offset=".42" stopColor="#c5b2ed" />
          <stop offset=".8" stopColor="#b6d8f2" />
          <stop offset="1" stopColor="#d9fcfa" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="25%" cy="20%" r="85%">
          <stop stopColor="#fff" stopOpacity=".8" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#aaa0df" stopOpacity=".35" />
        </radialGradient>
        <linearGradient id={`${id}-edge`}>
          <stop stopColor="#e1d5ff" />
          <stop offset=".5" stopColor="#9886ce" />
          <stop offset="1" stopColor="#ceeef9" />
        </linearGradient>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse
        className="yoyo-shadow"
        cx="125"
        cy="222"
        rx="65"
        ry="9"
        fill="#7161a0"
        opacity=".19"
        filter={`url(#${id}-blur)`}
      />
      {/* One state ring, centred on the yo-yo: an arc while thinking, ripples while listening. */}
      <g className="yoyo-ring" aria-hidden="true">
        <circle className="yoyo-ring-track" cx="122" cy="121" r="104" />
        <circle className="yoyo-ring-arc" cx="122" cy="121" r="104" pathLength={100} />
        <circle className="yoyo-ripple" cx="122" cy="121" r="96" />
        <circle className="yoyo-ripple yoyo-ripple-2" cx="122" cy="121" r="96" />
      </g>
      <g className="yoyo-float">
        <ellipse
          cx="143"
          cy="119"
          rx="68"
          ry="84"
          fill={`url(#${id}-glass)`}
          stroke="#e8eeff"
          strokeWidth="3"
        />
        <ellipse cx="132" cy="120" rx="63" ry="80" fill={`url(#${id}-edge)`} />
        <ellipse
          className="yoyo-body"
          cx="108"
          cy="122"
          rx="73"
          ry="85"
          fill={`url(#${id}-glass)`}
          stroke="#f8f5ff"
          strokeWidth="2.5"
        />
        <ellipse cx="108" cy="122" rx="70" ry="82" fill={`url(#${id}-shine)`} />
        <path
          d="M51 100 Q59 59 96 49"
          stroke="white"
          strokeWidth="4"
          opacity=".45"
          fill="none"
          strokeLinecap="round"
        />
        <path
          className="yoyo-string"
          d={
            direction || state === 'pointing'
              ? direction === 'left'
                ? 'M72 173 Q40 176 14 124'
                : 'M163 181 Q190 161 225 123'
              : state === 'success'
                ? 'M171 158 Q177 204 139 210 Q99 218 73 201 Q37 175 23 203'
                : 'M171 158 Q180 205 143 215 Q112 223 74 203 Q38 182 27 200 Q14 224 73 217 Q102 213 90 207'
          }
          fill="none"
          stroke="#b6a0dc"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {(direction || state === 'pointing') && (
          <path
            d={
              direction === 'left'
                ? 'M5 108 l-2 -8 M17 103 l1 -8 M27 109 l5 -5'
                : 'M221 107 l-1 -8 M232 111 l5 -6 M235 123 l5 -1'
            }
            stroke="#9c8bda"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}
        <g className="yoyo-face" fill="#313050">
          {state === 'success' ? (
            <path
              d="M72 122 Q79 108 86 122 M123 122 Q130 108 137 122"
              fill="none"
              stroke="#313050"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ) : (
            <g className="yoyo-eyes">
              <ellipse cx="80" cy="122" rx="7" ry="12" transform="rotate(10 80 122)" />
              <ellipse cx="131" cy="122" rx="7" ry="12" transform="rotate(10 131 122)" />
              <circle cx="82" cy="117" r="2.5" fill="white" />
              <circle cx="133" cy="117" r="2.5" fill="white" />
            </g>
          )}
          <path
            className="yoyo-smile"
            d={state === 'error' ? 'M98 150 Q107 141 116 150' : 'M98 147 Q107 160 116 147'}
            stroke="#bd719f"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse className="yoyo-mouth" cx="107" cy="150" rx="7" ry="8" fill="#9a557e" />
          {state === 'error' && (
            <path d="M73 103 L86 108 M125 108 L138 103" stroke="#655b8a" strokeWidth="2.5" />
          )}
        </g>
      </g>
    </svg>
  );
}
