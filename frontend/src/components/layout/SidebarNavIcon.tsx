type NavIconId =
  | 'painel'
  | 'produtos'
  | 'temperatura'
  | 'ocupacao'
  | 'seguranca'
  | 'enderecamento'
  | 'inventarios'
  | 'contagem'
  | 'estoque'
  | 'permissoes'

type Props = {
  id: NavIconId | string
}

export function SidebarNavIcon({ id }: Props) {
  return (
    <span className="app-sidebar__nav-icon" aria-hidden>
      <NavSvg id={id} />
    </span>
  )
}

function NavSvg({ id }: { id: string }) {
  switch (id) {
    case 'painel':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 19V5M4 19h16M8 19V11M12 19V8M16 19V13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'produtos':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 8h14v11H5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M8 8V6h8v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'temperatura':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M14 14.76V5a2 2 0 00-4 0v9.76a4 4 0 104 0z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M10 14h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'ocupacao':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 19h16M7 19V13M12 19V9M17 19V15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'seguranca':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      )
    case 'enderecamento':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      )
    case 'inventarios':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M9 5H5v14h14V9h-4M9 5l6 6M9 5v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      )
    case 'contagem':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M8 4h8v16H8z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M10 8h4M10 12h4M10 16h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'estoque':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M4 12l8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      )
    case 'permissoes':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      )
  }
}
