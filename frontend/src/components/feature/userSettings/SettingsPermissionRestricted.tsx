import PageContainer from '@/components/layout/Settings/PageContainer'
import SettingsContentContainer from '@/components/layout/Settings/SettingsContentContainer'
import { __ } from '@/utils/translations'
import { Callout, Text } from '@radix-ui/themes'
import { BiLock } from 'react-icons/bi'

/**
 * 当用户无权限访问当前设置模块时展示的占位页。
 * 与 settingsPermissionManifest 配合使用。
 */
export const SettingsPermissionRestricted = () => {
	return (
		<PageContainer>
			<SettingsContentContainer>
				<Callout.Root color="amber" size="2">
					<Callout.Icon>
						<BiLock size={18} />
					</Callout.Icon>
					<Callout.Text>
						<Text as="span" weight="medium">{__(`You don't have permission to access this settings section.`)}</Text>
						{' '}
						{__(`Only Raven Admin can configure Workspace, Integrations, and AI settings. You can only edit items under My Account.`)}
					</Callout.Text>
				</Callout.Root>
			</SettingsContentContainer>
		</PageContainer>
	)
}
