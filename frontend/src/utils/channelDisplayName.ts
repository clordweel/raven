import { __ } from '@/utils/translations'

/** Default channel name (slug) created by install */
export const DEFAULT_CHANNEL_NAME = 'general'

/**
 * Returns the localized display name for a channel.
 * The default "General" channel is shown as the translated string (e.g. 常规 in zh).
 * Comparison is case-insensitive (General / general).
 */
export function getDisplayChannelName(channelName: string | null | undefined): string {
    if (channelName == null || channelName === '') return ''
    return channelName.toLowerCase() === DEFAULT_CHANNEL_NAME ? __('General') : channelName
}
