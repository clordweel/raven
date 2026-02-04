import { __ } from '@/utils/translations'
import { useFrappeUpdateDoc, useSWRConfig } from 'frappe-react-sdk'
import { ErrorBanner } from '@/components/layout/AlertBanner/ErrorBanner'
import { ChannelListItem } from '@/utils/channel/ChannelListProvider'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { Loader } from '@/components/common/Loader'
import { toast } from 'sonner'

interface ChangeChannelTypeModalProps {
    onClose: () => void
    channelData: ChannelListItem,
    newChannelType: 'Public' | 'Private' | 'Open'
}

export const ChangeChannelTypeModal = ({ onClose, channelData, newChannelType }: ChangeChannelTypeModalProps) => {

    const { mutate } = useSWRConfig()
    const { updateDoc, loading: updatingDoc, error } = useFrappeUpdateDoc()

    const changeChannelType = (newChannelType: 'Public' | 'Private' | 'Open') => {
        updateDoc("Raven Channel", channelData?.name ?? null, {
            type: newChannelType
        }).then(() => {
            mutate(["channel_members", channelData.name])
            toast.success(__("Channel changed to {0}", [newChannelType.toLocaleLowerCase()]))
            onClose()
        })
    }

    return (
        <>
            <Dialog.Title>{__('Change to a {0} channel?', [newChannelType.toLocaleLowerCase()])}</Dialog.Title>

            <Flex gap='2' direction='column' width='100%'>
                <ErrorBanner error={error} />
                {newChannelType === 'Public' && <Flex direction='column' gap='4'>
                    <Text size='2'>{__('Please understand that when you make')} <strong>{channelData?.channel_name}</strong> {__('a public channel:')}</Text>
                    <ul className={'list-inside'}>
                        <li><Text size='1'>{__('Anyone from your organisation can join this channel and view its message history.')}</Text></li>
                        <li><Text size='1'>{__('If you make this channel private, it will be visible to anyone who has joined the channel up until that point.')}</Text></li>
                    </ul>
                </Flex>}
                {newChannelType === 'Private' && <Flex direction='column' gap='4'>
                    <Text size='2'>{__('Please understand that when you make')} <strong>{channelData?.channel_name}</strong> {__('a private channel:')}</Text>
                    <ul className={'list-inside'}>
                        <li><Text size='1'>{__("No changes will be made to the channel's history or members")}</Text></li>
                        <li><Text size='1'>{__('All files shared in this channel will become private and will be accessible only to the channel members')}</Text></li>
                    </ul>
                </Flex>}
                {newChannelType === 'Open' && <Flex direction='column' gap='4'>
                    <Text size='2'>{__('Please understand that when you make')} <strong>{channelData?.channel_name}</strong> {__('an open channel:')}</Text>
                    <ul className={'list-inside'}>
                        <li><Text size='1'>{__('Everyone from your organisation will become a channel member and will be able to view its message history.')}</Text></li>
                        <li><Text size='1'>{__('If you later intend to make this private you will have to manually remove members that should not have access to this channel.')}</Text></li>
                    </ul>
                </Flex>}
            </Flex>

            <Flex gap="3" mt="6" justify="end" align='center'>
                <Dialog.Close disabled={updatingDoc}>
                    <Button variant="soft" color="gray">{__('Cancel')}</Button>
                </Dialog.Close>
                <Button onClick={() => changeChannelType(newChannelType)} disabled={updatingDoc}>
                    {updatingDoc && <Loader className="text-white" />}
                    {updatingDoc ? __("Saving") : __('Change to {0}', [newChannelType.toLocaleLowerCase()])}
                </Button>
            </Flex>
        </>
    )
}