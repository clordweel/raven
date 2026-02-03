import { useFrappePostCall } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { __ } from '@/utils/translations'
import { QuickActionButton } from './QuickActionButton'
import { BiMessageDetail } from 'react-icons/bi'
import { useNavigate, useParams } from 'react-router-dom'
import { ContextMenu, Flex } from '@radix-ui/themes'

const useCreateThread = (messageID: string) => {
    const navigate = useNavigate()

    const { workspaceID } = useParams()

    const { call } = useFrappePostCall('raven.api.threads.create_thread')
    const handleCreateThread = () => {
        call({ 'message_id': messageID }).then((res) => {
            toast.success(__('Thread created'))
            navigate(`/${workspaceID}/${res.message.channel_id}/thread/${res.message.thread_id}`)
        }).catch(() => {
            toast.error(__('Failed to create thread'))
        })
    }

    return handleCreateThread
}

export const CreateThreadActionButton = ({ messageID }: { messageID: string }) => {

    const handleCreateThread = useCreateThread(messageID)

    return (
        <QuickActionButton
            tooltip={__('Create a thread')}
            aria-label={__('Create a thread')}
            onClick={handleCreateThread}>
            <BiMessageDetail size='16' />
        </QuickActionButton>
    )
}

export const CreateThreadContextItem = ({ messageID }: { messageID: string }) => {

    const handleCreateThread = useCreateThread(messageID)

    return <ContextMenu.Item onSelect={handleCreateThread}>
        <Flex gap='2' align='center' width='100%'>
            <BiMessageDetail size='18' />
            {__('Create Thread')}

        </Flex>
    </ContextMenu.Item>
}