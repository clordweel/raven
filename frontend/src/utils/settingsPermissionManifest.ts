/**
 * Settings 权限 manifest：按「设置页第一段路径」映射到所需角色。
 * - requiredRole: 'Raven Admin' 表示仅 Raven Admin 可访问；null 表示不限制。
 * - 与后端 DocType/API 的 Raven Admin 要求保持一致，便于扩展为「模块+操作」粒度。
 */

export const RAVEN_ADMIN_ROLE = 'Raven Admin' as const

export type SettingsPermissionRole = typeof RAVEN_ADMIN_ROLE | null

/** 设置页路径第一段 -> 所需角色（null = 不限制） */
export const SETTINGS_PATH_PERMISSION: Record<string, SettingsPermissionRole> = {
	// My Account — 所有用户
	profile: null,
	appearance: null,
	preferences: null,

	// Workspace — Raven Admin
	workspaces: RAVEN_ADMIN_ROLE,
	users: RAVEN_ADMIN_ROLE,
	emojis: RAVEN_ADMIN_ROLE,

	// Integrations — Raven Admin
	hr: RAVEN_ADMIN_ROLE,
	'document-notifications': RAVEN_ADMIN_ROLE,
	'document-previews': RAVEN_ADMIN_ROLE,
	'message-actions': RAVEN_ADMIN_ROLE,
	'scheduled-messages': RAVEN_ADMIN_ROLE,
	webhooks: RAVEN_ADMIN_ROLE,

	// AI — Raven Admin
	bots: RAVEN_ADMIN_ROLE,
	functions: RAVEN_ADMIN_ROLE,
	'file-sources': RAVEN_ADMIN_ROLE,
	instructions: RAVEN_ADMIN_ROLE,
	'document-processors': RAVEN_ADMIN_ROLE,
	commands: RAVEN_ADMIN_ROLE,
	'ai-settings': RAVEN_ADMIN_ROLE,
	'openai-settings': RAVEN_ADMIN_ROLE,

	// 独立项 — 所有用户
	'mobile-app': null,
	'push-notifications': null,
	help: null,
}

/**
 * 从 /settings/... 的 pathname 中取出第一段路径（如 profile、webhooks）。
 * 例如：/settings/profile -> profile，/settings/webhooks/create -> webhooks
 */
export function getSettingsPathSegment(pathname: string): string | null {
	const normalized = pathname.replace(/^#/, '')
	const match = normalized.match(/\/settings\/?([^/]*)/)
	const segment = match?.[1]?.trim() || null
	return segment || null
}

/**
 * 根据路径第一段获取所需角色。
 * 未在 manifest 中声明的路径默认按 Raven Admin 限制（安全侧）。
 */
export function getRequiredRoleForSettingsPath(pathname: string): SettingsPermissionRole {
	const segment = getSettingsPathSegment(pathname)
	if (!segment) return null
	if (segment in SETTINGS_PATH_PERMISSION) {
		return SETTINGS_PATH_PERMISSION[segment]
	}
	return RAVEN_ADMIN_ROLE
}
