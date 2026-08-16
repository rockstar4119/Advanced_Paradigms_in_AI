import { useEffect, useState } from 'react'

export type Route = 'studio' | 'method'

const ROUTES: Route[] = ['studio', 'method']

function readRoute(): Route {
  const segment = window.location.hash.replace(/^#\/?/, '').split('/')[0]
  return (ROUTES as string[]).includes(segment) ? (segment as Route) : 'studio'
}

/** Hash routing — keeps the studio session alive across navigation and stays deep-linkable. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = (next: Route) => {
    window.location.hash = next === 'studio' ? '#/' : `#/${next}`
  }

  return [route, navigate]
}
