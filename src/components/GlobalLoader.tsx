import { Loader2 } from 'lucide-react'

export default function GlobalLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#003366]" />
        <p className="text-sm font-semibold text-gray-500 animate-pulse">
          Loading LawCase Pro System...
        </p>
      </div>
    </div>
  )
}
