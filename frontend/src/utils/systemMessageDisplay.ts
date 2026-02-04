import { __ } from '@/utils/translations'

/**
 * Known system message patterns from backend (raven_channel_member.py).
 * Backend writes English text to DB; we re-format with translation template for display.
 */
const PATTERNS: Array<{ pattern: RegExp; template: string }> = [
	{ pattern: /^(.+?) joined\.$/, template: '{0} joined.' },
	{ pattern: /^(.+?) added (.+?)\.$/, template: '{0} added {1}.' },
	{ pattern: /^(.+?) is now an admin\.$/, template: '{0} is now an admin.' },
	{ pattern: /^(.+?) is no longer an admin\.$/, template: '{0} is no longer an admin.' },
]

/**
 * Returns translated display text for system messages.
 * If text matches a known pattern (e.g. "Administrator joined."), uses __(template, [names]).
 * Otherwise returns __(text) as-is.
 */
export function getDisplaySystemMessageText(text: string): string {
	if (!text || typeof text !== 'string') return text
	const trimmed = text.trim()
	for (const { pattern, template } of PATTERNS) {
		const m = trimmed.match(pattern)
		if (m) {
			const args = m.slice(1)
			return __(template, args)
		}
	}
	return __(trimmed)
}
