import { Flex, Text } from '@radix-ui/themes'
import { SystemMessage } from '../../../../../../types/Messaging/Message'
import { DateTooltipShort } from './Renderers/DateTooltip'
import { getDisplaySystemMessageText } from '@/utils/systemMessageDisplay'

const SystemMessageBlock = ({ message }: { message: SystemMessage }) => {
  return (
    <Flex align='center' gap='2' id={`message-${message.name}`} className='pl-1 py-2.5'>
      <DateTooltipShort timestamp={message.creation} />
      <Text as='span' color='gray' className='pl-1.5' size='1'>{getDisplaySystemMessageText(message.text)}</Text>
    </Flex>

  )
}

export default SystemMessageBlock