import type { ReactNode } from 'react'
import ExpandableSidebar, { type SidebarItem } from './ExpandableSidebar'

type Props = {
  items: SidebarItem[]
  activeId: string
  onNavigate: (id: string) => void
  children: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
}

export default function AppShell({ items, activeId, onNavigate, children, headerExtra, footer }: Props) {
  return (
    <div className="app-shell">
      <ExpandableSidebar items={items} activeId={activeId} onSelect={onNavigate} footer={footer} />
      <div className="app-shell__main">
        {headerExtra ? <div className="app-shell__header-extra">{headerExtra}</div> : null}
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
