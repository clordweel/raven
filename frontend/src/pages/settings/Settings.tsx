import { SettingsPermissionRestricted } from '@/components/feature/userSettings/SettingsPermissionRestricted'
import { SettingsSidebar } from '@/components/feature/userSettings/SettingsSidebar'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { ChannelListProvider } from '@/utils/channel/ChannelListProvider'
import { lastChannelAtom, lastWorkspaceAtom } from '@/utils/lastVisitedAtoms'
import { getRequiredRoleForSettingsPath, RAVEN_ADMIN_ROLE } from '@/utils/settingsPermissionManifest'
import { __ } from '@/utils/translations'
import { UserListProvider } from '@/utils/users/UserListProvider'
import { hasRavenAdminRole } from '@/utils/roles'
import { Box, Flex, Heading } from '@radix-ui/themes'
import { useAtomValue } from 'jotai'
import { BiChevronLeft } from 'react-icons/bi'
import { Link, useLocation } from 'react-router-dom'
import { Outlet } from "react-router-dom"

const Settings = () => {
    const isDesktop = useIsDesktop()
    const location = useLocation()
    const lastWorkspace = useAtomValue(lastWorkspaceAtom)
    const lastChannel = useAtomValue(lastChannelAtom)

    const requiredRole = getRequiredRoleForSettingsPath(location.pathname)
    const isAdmin = hasRavenAdminRole()
    const allowed = requiredRole === null || (requiredRole === RAVEN_ADMIN_ROLE && isAdmin)

    let path = '../'

    if (lastWorkspace && lastChannel && isDesktop) {
        path = `/${lastWorkspace}/${lastChannel}`
    } else if (lastWorkspace) {
        path = `/${lastWorkspace}`
    }


    return (
        <UserListProvider>
            <ChannelListProvider>
                <header className='dark:bg-gray-1 bg-white sticky top-0' style={{ zIndex: 999 }}>
                    <Box
                        py='3'
                        className={'border-gray-4 sm:dark:border-gray-4 border-b px-4 w-screen'}>
                        <Flex justify='between'>
                            <Flex align='center' gap='3' className="h-8">
                                <Link to={path} className="block bg-transparent hover:bg-transparent active:bg-transparent">
                                    <BiChevronLeft size='24' className="block text-gray-12" />
                                </Link>
                                <Heading size='5'>{__("Settings")}</Heading>
                            </Flex>
                        </Flex>
                    </Box>
                </header>
                <Flex className="w-full">
                    {isDesktop && <SettingsSidebar />}
                    <Box className="w-full sm:ml-64 ml-0">
                        {allowed ? <Outlet /> : <SettingsPermissionRestricted />}
                    </Box>
                </Flex>
            </ChannelListProvider>
        </UserListProvider>
    )
}

export const Component = Settings