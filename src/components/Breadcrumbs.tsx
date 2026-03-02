import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export default function Breadcrumbs() {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  return (
    <nav className="flex items-center text-sm text-gray-500 mb-6">
      <Link to="/" className="hover:text-[#003366] flex items-center gap-1">
        <Home size={14} /> Home
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
        const isLast = index === pathnames.length - 1
        return (
          <div key={name} className="flex items-center">
            <ChevronRight size={14} className="mx-2 text-gray-400" />
            {isLast ? (
              <span className="font-bold text-[#003366] capitalize">{name.replace('-', ' ')}</span>
            ) : (
              <Link to={routeTo} className="hover:text-[#003366] capitalize">
                {name.replace('-', ' ')}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
