import katex from 'katex'
import { useMemo } from 'react'

/**
 * No custom macros on purpose: shorthands like \R and \vx collide with KaTeX
 * built-ins (\R self-references; \v is the caron accent), and with
 * throwOnError off the collision renders as red error text rather than
 * failing loudly. Every expression is written in literal TeX instead.
 */
function render(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: false,
    trust: false,
  })
}

/** Inline math. */
export function M({ children }: { children: string }) {
  const html = useMemo(() => render(children, false), [children])
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Display equation. `label` prints a tag in the gutter so prose can refer back
 * to it; `note` is the one-line reading of the formula for anyone skimming.
 */
export function Eq({
  children,
  label,
  note,
}: {
  children: string
  label?: string
  note?: string
}) {
  const html = useMemo(() => render(children, true), [children])

  return (
    <figure className="eq">
      {label && <span className="eq-tag">{label}</span>}
      <div className="eq-body" dangerouslySetInnerHTML={{ __html: html }} />
      {note && <figcaption className="eq-note">{note}</figcaption>}
    </figure>
  )
}
