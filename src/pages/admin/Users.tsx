import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdmin } from '../../hooks/useAdmin'

interface User {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  imageUrl: string
  createdAt: number
  plan: string
}

interface UsersResponse {
  users: User[]
  totalCount: number
}

const PAGE_SIZE = 20

export default function AdminUsers() {
  const { fetchAdmin, postAdmin } = useAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(
    async (query: string, page: number) => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAdmin<UsersResponse>(
          `/api/admin/users?search=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${page}`
        )
        setUsers(data.users)
        setTotalCount(data.totalCount)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [fetchAdmin]
  )

  useEffect(() => {
    load(debouncedSearch, offset)
  }, [load, debouncedSearch, offset])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setOffset(0)
    }, 400)
  }

  const togglePlan = async (user: User) => {
    const newPlan = user.plan === 'pro' ? 'free' : 'pro'
    setToggling(user.id)
    try {
      await postAdmin('/api/admin/users', { userId: user.id, plan: newPlan })
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, plan: newPlan } : u))
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setToggling(null)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">Users</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="input-field pl-9 w-full"
        />
      </div>

      {error && (
        <div className="glass-card p-4 mb-4 text-red-500 text-sm">{error}</div>
      )}

      {/* User table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-card)]">
                <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">User</th>
                <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Email</th>
                <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Plan</th>
                <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">Joined</th>
                <th className="text-right py-3 px-4 text-[var(--text-muted)] font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--border-card)] last:border-0 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="text-[var(--text-heading)] font-medium">
                          {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-body)]">{user.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.plan === 'pro'
                            ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                            : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                        }`}
                      >
                        {user.plan === 'pro' ? 'Pro' : 'Free'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => togglePlan(user)}
                        disabled={toggling === user.id}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          user.plan === 'pro'
                            ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
                            : 'bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400'
                        }`}
                      >
                        {toggling === user.id
                          ? '...'
                          : user.plan === 'pro'
                            ? 'Revoke Pro'
                            : 'Grant Pro'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-card)]">
            <span className="text-sm text-[var(--text-muted)]">
              {totalCount} users total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="p-1 rounded hover:bg-[var(--bg-input)] disabled:opacity-30 text-[var(--text-muted)]"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-[var(--text-body)]">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-[var(--bg-input)] disabled:opacity-30 text-[var(--text-muted)]"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
