import { Suspense, lazy } from 'react'
import { useGraphStore } from './hooks/useGraphStore'
import { useHashRoute, type Route } from './hooks/useHashRoute'
import { StudioPage } from './pages/StudioPage'

// KaTeX and its fonts are a large payload that only the method page needs.
const MethodPage = lazy(() => import('./pages/MethodPage').then((m) => ({ default: m.MethodPage })))

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <line x1="10" y1="12" x2="28" y2="10" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="10" y1="12" x2="14" y2="30" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="28" y1="10" x2="14" y2="30" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="14" y1="30" x2="30" y2="28" stroke="#d95926" strokeWidth="2" />
      <circle cx="10" cy="12" r="4" fill="#3987e5" />
      <circle cx="28" cy="10" r="4" fill="#3987e5" />
      <circle cx="14" cy="30" r="4" fill="#5B6472" />
      <circle cx="30" cy="28" r="4" fill="#d95926" />
    </svg>
  )
}

function PhaseTrack({ phase }: { phase: 1 | 2 | 3 }) {
  const steps: [1 | 2 | 3, string][] = [
    [1, 'Dataset'],
    [2, 'Graph'],
    [3, 'Propagate'],
  ]
  return (
    <div className="phase-track">
      {steps.map(([n, label]) => (
        <span key={n} className={`phase-pill${n === phase ? ' active' : ''}${n < phase ? ' done' : ''}`}>
          <span className="num">{n}</span>
          {label}
        </span>
      ))}
    </div>
  )
}

const TAGLINES: Record<Route, string> = {
  studio: 'Graph-based semi-supervised learning, live',
  method: 'The mathematics behind the canvas',
}

function RouteTabs({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  const tabs: [Route, string][] = [
    ['studio', 'Studio'],
    ['method', 'Method'],
  ]
  return (
    <nav className="route-tabs" aria-label="Primary">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={`route-tab${route === value ? ' active' : ''}`}
          aria-current={route === value ? 'page' : undefined}
          onClick={() => onNavigate(value)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const sessionId = useGraphStore((state) => state.sessionId)
  const graphReady = useGraphStore((state) => state.graphReady)

  const phase: 1 | 2 | 3 = !sessionId ? 1 : !graphReady ? 2 : 3

  return (
    <div className="page">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div className="brand-text">
            <h1>Propagation Studio</h1>
            <p className="tagline">{TAGLINES[route]}</p>
          </div>
        </div>

        <div className="header-right">
          {route === 'studio' && <PhaseTrack phase={phase} />}
          <RouteTabs route={route} onNavigate={navigate} />
        </div>
      </header>

      {/*
        The studio stays mounted so a running session survives a trip to the method
        page. It is hidden with visibility rather than display:none — Cytoscape
        measures its container, and a zero-sized one comes back blank.
      */}
      <div
        className={route === 'studio' ? 'route-slot' : 'route-slot hidden'}
        aria-hidden={route !== 'studio'}
      >
        <StudioPage />
      </div>
      {route === 'method' && (
        <Suspense fallback={<div className="route-loading">Loading the method…</div>}>
          <MethodPage />
        </Suspense>
      )}
    </div>
  )
}
