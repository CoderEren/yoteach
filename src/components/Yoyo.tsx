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
          <stop stopColor="#f3eeff" />
          <stop offset=".42" stopColor="#b9a1ff" />
          <stop offset=".8" stopColor="#8a63f2" />
          <stop offset="1" stopColor="#dccfff" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="25%" cy="20%" r="85%">
          <stop stopColor="#fff" stopOpacity=".8" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#6342c4" stopOpacity=".3" />
        </radialGradient>
        <linearGradient id={`${id}-edge`}>
          <stop stopColor="#e6dcff" />
          <stop offset=".5" stopColor="#6e48d6" />
          <stop offset="1" stopColor="#d2c3ff" />
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
        fill="#6342c4"
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
          stroke="#faf7ff"
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
          stroke="#faf7ff"
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
          stroke="#9c7ef5"
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
            stroke="#9c7ef5"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}
        <g className="yoyo-face" fill="#262a3d">
          {state === 'success' ? (
            <path
              d="M76 124 Q83.5 112 91 124 M120 124 Q127.5 112 135 124"
              fill="none"
              stroke="#262a3d"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          ) : (
            <g className="yoyo-eyes">
              <rect x="78" y="108" width="11" height="24" rx="5.5" />
              <rect x="122" y="108" width="11" height="24" rx="5.5" />
            </g>
          )}
          <path
            className="yoyo-smile"
            d={state === 'error' ? 'M98 150 Q106 144 114 150' : 'M98 146 Q106 153 114 146'}
            stroke="#262a3d"
            strokeWidth="3.6"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse className="yoyo-mouth" cx="106" cy="149" rx="5" ry="5.5" fill="#262a3d" />
        </g>
      </g>
    </svg>
  );
}
