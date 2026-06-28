import type { ReactNode } from 'react'

export type SidebarItem = {
  id: string
  label: string
  icon: ReactNode
  accent?: string
}

type Props = {
  items: SidebarItem[]
  activeId: string
  onSelect: (id: string) => void
  footer?: ReactNode
}

export default function ExpandableSidebar({ items, activeId, onSelect, footer }: Props) {
  return (
    <aside className="app-sidebar" aria-label="Menu principal">
      <div className="app-sidebar__brand" title="DIS Logística Inteligente">
        <span className="app-sidebar__brand-icon" aria-hidden>
          DIS
        </span>
        <span className="app-sidebar__brand-text">Logística</span>
      </div>
      <nav className="app-sidebar__nav">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              className={`app-sidebar__item${active ? ' app-sidebar__item--active' : ''}`}
              onClick={() => onSelect(item.id)}
              title={item.label}
              style={
                active && item.accent
                  ? ({ '--sidebar-accent': item.accent } as React.CSSProperties)
                  : undefined
              }
            >
              <span className="app-sidebar__item-icon">{item.icon}</span>
              <span className="app-sidebar__item-label">{item.label}</span>
            </button>
          )
        })}
      </nav>
      {footer ? <div className="app-sidebar__footer">{footer}</div> : null}
    </aside>
  )
}
