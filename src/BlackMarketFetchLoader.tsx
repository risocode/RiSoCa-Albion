import { useSyncExternalStore } from 'react'
import {
  getBlackMarketFetchState,
  minimizeBlackMarketFetch,
  restoreBlackMarketFetch,
  subscribeBlackMarketFetchState,
} from './blackMarketFetchState'

export function BlackMarketFetchLoader() {
  const state = useSyncExternalStore(subscribeBlackMarketFetchState, getBlackMarketFetchState)

  if (!state.isFetching) return null

  if (state.isMinimized) {
    return (
      <button
        type="button"
        className="black-fetch-restore"
        onClick={() => restoreBlackMarketFetch()}
        aria-label="Restore Black Market fetch popup"
      >
        <span className="black-fetch-restore__dot" aria-hidden />
        {state.phaseText || '0%'}
      </button>
    )
  }

  return (
    <div className="black-fetch-overlay" role="dialog" aria-modal="true" aria-label="Fetching Black Market comparison">
      <section className="black-fetch-modal">
        <button
          type="button"
          className="btn secondary black-fetch-minimize"
          onClick={() => minimizeBlackMarketFetch()}
          aria-label="Minimize fetch popup"
          title="Minimize"
        >
          —
        </button>

        <div className="black-fetch-loader">
          <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
              <linearGradient id="blackFetchChipGradient" x1={0} y1={0} x2={0} y2={1}>
                <stop offset="0%" stopColor="#2d2d2d" />
                <stop offset="100%" stopColor="#0f0f0f" />
              </linearGradient>
              <linearGradient id="blackFetchTextGradient" x1={0} y1={0} x2={0} y2={1}>
                <stop offset="0%" stopColor="#eeeeee" />
                <stop offset="100%" stopColor="#888888" />
              </linearGradient>
              <linearGradient id="blackFetchPinGradient" x1={1} y1={0} x2={0} y2={0}>
                <stop offset="0%" stopColor="#bbbbbb" />
                <stop offset="50%" stopColor="#888888" />
                <stop offset="100%" stopColor="#555555" />
              </linearGradient>
            </defs>
            <g>
              <path d="M100 100 H200 V210 H326" className="black-fetch-trace-bg" />
              <path d="M100 100 H200 V210 H326" className="black-fetch-trace-flow black-fetch-purple" />
              <path d="M80 180 H180 V230 H326" className="black-fetch-trace-bg" />
              <path d="M80 180 H180 V230 H326" className="black-fetch-trace-flow black-fetch-blue" />
              <path d="M60 260 H150 V250 H326" className="black-fetch-trace-bg" />
              <path d="M60 260 H150 V250 H326" className="black-fetch-trace-flow black-fetch-yellow" />
              <path d="M100 350 H200 V270 H326" className="black-fetch-trace-bg" />
              <path d="M100 350 H200 V270 H326" className="black-fetch-trace-flow black-fetch-green" />
              <path d="M700 90 H560 V210 H474" className="black-fetch-trace-bg" />
              <path d="M700 90 H560 V210 H474" className="black-fetch-trace-flow black-fetch-blue" />
              <path d="M740 160 H580 V230 H474" className="black-fetch-trace-bg" />
              <path d="M740 160 H580 V230 H474" className="black-fetch-trace-flow black-fetch-green" />
              <path d="M720 250 H590 V250 H474" className="black-fetch-trace-bg" />
              <path d="M720 250 H590 V250 H474" className="black-fetch-trace-flow black-fetch-red" />
              <path d="M680 340 H570 V270 H474" className="black-fetch-trace-bg" />
              <path d="M680 340 H570 V270 H474" className="black-fetch-trace-flow black-fetch-yellow" />
            </g>
            <rect
              x={330}
              y={190}
              width={140}
              height={100}
              rx={20}
              ry={20}
              fill="url(#blackFetchChipGradient)"
              stroke="#222"
              strokeWidth={3}
              filter="drop-shadow(0 0 6px rgba(0,0,0,0.8))"
            />
            <g>
              <rect x={322} y={205} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={322} y={225} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={322} y={245} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={322} y={265} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
            </g>
            <g>
              <rect x={470} y={205} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={470} y={225} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={470} y={245} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
              <rect x={470} y={265} width={8} height={10} fill="url(#blackFetchPinGradient)" rx={2} />
            </g>
            <text
              x={400}
              y={240}
              fontFamily="Arial, sans-serif"
              fontSize={20}
              fill="url(#blackFetchTextGradient)"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {state.phaseText || '0%'}
            </text>
            <circle cx={100} cy={100} r={5} fill="black" />
            <circle cx={80} cy={180} r={5} fill="black" />
            <circle cx={60} cy={260} r={5} fill="black" />
            <circle cx={100} cy={350} r={5} fill="black" />
            <circle cx={700} cy={90} r={5} fill="black" />
            <circle cx={740} cy={160} r={5} fill="black" />
            <circle cx={720} cy={250} r={5} fill="black" />
            <circle cx={680} cy={340} r={5} fill="black" />
          </svg>
        </div>
      </section>
    </div>
  )
}
