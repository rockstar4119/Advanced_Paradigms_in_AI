import { useEffect, useState, type ReactNode } from 'react'

export interface SectionSpec {
  id: string
  stage: string
  title: string
}

/** A numbered movement of the pipeline. */
export function Section({
  id,
  stage,
  title,
  lede,
  children,
}: {
  id: string
  stage: string
  title: string
  lede?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="m-section" id={id}>
      <header className="m-section-head">
        <span className="m-stage">{stage}</span>
        <h2>{title}</h2>
      </header>
      {lede && <p className="m-lede">{lede}</p>}
      {children}
    </section>
  )
}

/** Traceability chip: which file in this repo implements the maths above it. */
export function Source({ path, symbol }: { path: string; symbol: string }) {
  return (
    <p className="m-source">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M6 3.5 2.5 8 6 12.5M10 3.5 13.5 8 10 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="m-source-symbol">{symbol}</span>
      <span className="m-source-path">{path}</span>
    </p>
  )
}

/** Ties a block of maths back to the control that drives it in the Studio. */
export function InApp({ control, children }: { control: string; children: ReactNode }) {
  return (
    <aside className="m-inapp">
      <span className="m-inapp-tag">In the app</span>
      <p>
        <strong>{control}</strong> {children}
      </p>
    </aside>
  )
}

/** Honest limitations. Rendered as a first-class element, not a footnote. */
export function Caveat({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="m-caveat">
      <span className="m-caveat-tag">{title}</span>
      <p>{children}</p>
    </aside>
  )
}

/** Sticky contents rail with scroll-spy. */
export function Contents({ sections }: { sections: SectionSpec[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav className="m-toc" aria-label="Contents">
      <p className="m-toc-title">The pipeline</p>
      <ol>
        {sections.map((section) => (
          <li key={section.id}>
            {/*
              href stays on the route hash rather than "#<section-id>" — the
              router reads the first hash segment, so a bare fragment would
              navigate back to the studio. Scrolling is handled directly.
            */}
            <a
              href="#/method"
              className={section.id === active ? 'active' : undefined}
              onClick={(event) => {
                event.preventDefault()
                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <span className="m-toc-stage">{section.stage}</span>
              <span className="m-toc-label">{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
