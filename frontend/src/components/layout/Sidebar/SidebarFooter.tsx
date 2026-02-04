import { useContext, useState } from 'react'
import { UserContext } from '../../../utils/auth/UserProvider'
import { useUserData } from '@/hooks/useUserData'
import { Box, DropdownMenu, IconButton, Separator, Tooltip } from '@radix-ui/themes'
import { UserAvatar } from '@/components/common/UserAvatar'
import { BsEmojiSmile } from 'react-icons/bs'
import useCurrentRavenUser from '@/hooks/useCurrentRavenUser'
import { useIsUserActive } from '@/hooks/useIsUserActive'
import { MdOutlineExitToApp } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { SetUserAvailabilityMenu } from '@/components/feature/userSettings/AvailabilityStatus/SetUserAvailabilityMenu'
import { SetCustomStatusModal } from '@/components/feature/userSettings/CustomStatus/SetCustomStatusModal'
import PushNotificationToggle from '@/components/feature/userSettings/PushNotifications/PushNotificationToggle'
import { __ } from '@/utils/translations'
import { Stack } from '../Stack'
import { LuNavigation, LuSettings, LuMonitor } from 'react-icons/lu'
import { BiSun, BiMoon } from 'react-icons/bi'
import { useTheme } from '@/ThemeProvider'
import { RxCheck } from 'react-icons/rx'

export const SidebarFooter = () => {

    const userData = useUserData()
    const { logout } = useContext(UserContext)
    const { appearance, setAppearance } = useTheme()

    const [isUserStatusModalOpen, setUserStatusModalOpen] = useState(false)

    const { myProfile } = useCurrentRavenUser()
    const isActive = useIsUserActive(userData.name)

    const navigate = useNavigate()

    const ThemeIcon = () => {
        if (appearance === 'light') return <BiSun size='18' />
        if (appearance === 'dark') return <BiMoon size='18' />
        return <LuMonitor size='18' />
    }

    return <Stack className='mx-auto py-0' align='center' gap='2'>
        <Box>
            <Tooltip content={__("Workspace Explorer")} side='right'>
                <IconButton aria-label={__('Workspace Explorer')} size='3' color='gray' variant='ghost' onClick={() => navigate('/workspace-explorer')}>
                    <LuNavigation size='18' />
                </IconButton>
            </Tooltip>
        </Box>
        <Box>
            <Tooltip content={__("Settings")} side='right'>
                <IconButton aria-label={__('Settings')} size='3' color='gray' variant='ghost' onClick={() => navigate('/settings/profile')}>
                    <LuSettings size='18' />
                </IconButton>
            </Tooltip>
        </Box>
        <Box>
            <DropdownMenu.Root>
                <Tooltip content={__("Theme")} side='right'>
                    <DropdownMenu.Trigger>
                        <IconButton aria-label={__('Theme')} size='3' color='gray' variant='ghost'>
                            <ThemeIcon />
                        </IconButton>
                    </DropdownMenu.Trigger>
                </Tooltip>
                <DropdownMenu.Content variant='soft' side='right' align='end'>
                    <DropdownMenu.Item
                        className='flex justify-normal gap-2'
                        onClick={() => setAppearance('light')}
                    >
                        <BiSun size='14' />
                        {__('Light')}
                        {appearance === 'light' && <RxCheck className='ml-auto' size='16' />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className='flex justify-normal gap-2'
                        onClick={() => setAppearance('dark')}
                    >
                        <BiMoon size='14' />
                        {__('Dark')}
                        {appearance === 'dark' && <RxCheck className='ml-auto' size='16' />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className='flex justify-normal gap-2'
                        onClick={() => setAppearance('inherit')}
                    >
                        <LuMonitor size='14' />
                        {__('System')}
                        {appearance === 'inherit' && <RxCheck className='ml-auto' size='16' />}
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </Box>
        <Separator size='4' className={`bg-gray-4 dark:bg-gray-6`} />
        <Box className='pb-4 sm:pb-0 pt-2'>
            <DropdownMenu.Root>
                <Tooltip content={__("Options")} side='right'>
                    <DropdownMenu.Trigger>
                        <IconButton aria-label={__('Options')} color='gray' variant='ghost' className='p-0 bg-transparent hover:bg-transparent'>
                            <UserAvatar
                                src={myProfile?.user_image}
                                alt={myProfile?.full_name}
                                size='2'
                                className='hover:shadow-sm transition-all duration-200'
                                availabilityStatus={myProfile?.availability_status}
                                isActive={isActive} />

                        </IconButton>
                    </DropdownMenu.Trigger>
                </Tooltip>
                <DropdownMenu.Content variant='soft'>
                    <SetUserAvailabilityMenu />
                    <DropdownMenu.Item color='gray' className={'flex justify-normal gap-2'} onClick={() => setUserStatusModalOpen(true)}>
                        <BsEmojiSmile size='14' /> {__("Set custom status")}
                    </DropdownMenu.Item>
                    <PushNotificationToggle />
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item color='red' className={'flex justify-normal gap-2'} onClick={logout}>
                        <MdOutlineExitToApp size='14' /> {__("Log Out")}
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>

        </Box>
        <SetCustomStatusModal isOpen={isUserStatusModalOpen} onOpenChange={setUserStatusModalOpen} />
    </Stack>
}