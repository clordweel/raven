import { __ } from '@/utils/translations'
import { Dialog, Flex, IconButton, Text, VisuallyHidden } from '@radix-ui/themes'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { useNavigate, useParams } from 'react-router-dom'
import { Message } from '../../../../../types/Messaging/Message'
import { ErrorBanner } from '@/components/layout/AlertBanner/ErrorBanner'
import { MessageBox } from '../GlobalSearch/MessageBox'
import { IoClose } from 'react-icons/io5'

export const PinnedMessageModalContent = ({ onClose }: { onClose: () => void }) => {

    const { channelID } = useParams<{ channelID: string }>()

    const { data, error } = useFrappeGetCall<{ message: Message[] }>("raven.api.raven_message.get_pinned_messages", { 'channel_id': channelID }, undefined, {
        revalidateOnFocus: false
    })

    const navigate = useNavigate()

    const { workspaceID } = useParams()

    const handleNavigateToChannel = (channelID: string, workspace?: string, baseMessage?: string) => {
        let baseRoute = ''
        if (workspace) {
            baseRoute = `/${workspace}`
        } else {
            baseRoute = `/${workspaceID}`
        }

        navigate({
            pathname: `${baseRoute}/${channelID}`,
            search: `message_id=${baseMessage}`
        })
    }

    const handleScrollToMessage = (messageName: string, channelID: string, workspace?: string) => {
        handleNavigateToChannel(channelID, workspace, messageName)
        onClose()
    }

    return (
        <>
            <Dialog.Title>
                <Flex justify={'between'} align={'center'}>
                    <Text>{__('Pinned Messages')}</Text>
                    <IconButton variant='ghost' color='gray' aria-label={__('Close')} onClick={onClose}>
                        <IoClose size='20' />
                    </IconButton>
                </Flex>
            </Dialog.Title>
            <VisuallyHidden>
                <Dialog.Description>
                    {__('Pinned Messages')}
                </Dialog.Description>
            </VisuallyHidden>
            <ErrorBanner error={error} />
            <Flex direction='column' gap='3' justify='start'>
                {data?.message?.map((message) => {
                    return (
                        <MessageBox key={message.name} message={message} handleScrollToMessage={handleScrollToMessage} />
                    )
                })}
            </Flex>
        </>
    )
}