import { Outlet } from 'react-router-dom'
import { AdminGuard } from './AdminGuard'
import { AdminSidebar } from './AdminSidebar'

export default function AdminLayout() {
  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-[var(--bg-body)]">
        <AdminSidebar />
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  )
}
