/**
 * The four roles HomeLink Ethiopia routes and permissions are built around.
 * Keep this the single source of truth — middleware, layouts, and any
 * future permission checks should import from here rather than
 * re-declaring role strings.
 */
export type Role = 'tenant' | 'landlord' | 'admin'

export interface SessionUser {
  id: string
  name: string
  role: Role
  verified: boolean
}

/**
 * The URL prefix each role is confined to, beyond the public routes.
 * `(public)` is a route group (no URL segment); tenant/landlord/admin
 * are real segments so their trees can't collide at the same path.
 */
export const ROLE_HOME: Record<Role, string> = {
  tenant: '/tenant/dashboard',
  landlord: '/landlord/dashboard',
  admin: '/admin/dashboard',
}
