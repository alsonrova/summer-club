import { requireAdmin } from '@/server/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-sand">
      <nav className="border-b border-taupe/40 bg-shell px-6 py-4">
        <span className="font-display text-lg font-light text-bark">
          Summer Club — administration
        </span>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
