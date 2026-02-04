import { ErrorText, Label } from '@/components/common/Form'
import LinkFormField from '@/components/common/LinkField/LinkFormField'
import { Loader } from '@/components/common/Loader'
import { ErrorBanner } from '@/components/layout/AlertBanner/ErrorBanner'
import { useGetUser } from '@/hooks/useGetUser'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useUserData } from '@/hooks/useUserData'
import { UserContext } from '@/utils/auth/UserProvider'
import { ChannelListItem, DMChannelListItem } from '@/utils/channel/ChannelListProvider'
import { getDisplayChannelName } from '@/utils/channelDisplayName'
import { __ } from '@/utils/translations'
import { Box, Button, Dialog, Flex, Link, Select, Text, TextArea } from '@radix-ui/themes'
import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk'
import { useContext } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'

type CreateMeetingFormProps = {
    channelData: ChannelListItem | DMChannelListItem,
    onClose: () => void
}

interface CreateMeetingFormFields {
    channel: string
    subject: string,
    duration: string,
    google_calendar: string,
    description: string,
    // participants: string[]
}

const CreateMeetingForm = ({ onClose, channelData }: CreateMeetingFormProps) => {

    const { currentUser } = useContext(UserContext)
    const currentUserData = useUserData()
    const peerUser = useGetUser((channelData as DMChannelListItem).peer_user_id ?? undefined)

    const defaultSubject = channelData.is_direct_message
        ? __('Meeting between {0} and {1}', [
            peerUser?.full_name ?? (channelData as DMChannelListItem).peer_user_id ?? '',
            currentUserData?.full_name ?? currentUser ?? ''
        ])
        : __('Meeting with #{0}', [getDisplayChannelName(channelData.channel_name)])


    const methods = useForm<CreateMeetingFormFields>({
        defaultValues: {
            channel: channelData.name,
            subject: defaultSubject,
            duration: '60',
        }
    })
    const { control, handleSubmit, register, setValue, formState: { errors } } = methods

    useFrappeGetCall('frappe.client.get_value', {
        doctype: 'Google Calendar',
        fieldname: ['name'],
        filters: {
            user: currentUser,
            enable: 1
        }
    }, undefined, {
        onSuccess: (data) => {
            if (data.message)
                setValue('google_calendar', data.message.name)
        }
    })

    const { call, loading, error } = useFrappePostCall('raven.api.events.create_event')

    const onSubmit = async (data: CreateMeetingFormFields) => {

        return call(data).then((res) => {
            toast.success(__('Meeting created'), {
                description: <Link
                    href={res.message.google_meet_link}
                    underline='always'
                    className='cursor-pointer'
                    target='_blank'
                    rel='noreferrer'>{res.message.google_meet_link}</Link>
            })
            onClose()
        })

    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Dialog.Title>{__('Start a Meeting')}</Dialog.Title>

                <Flex gap='2' direction='column' width='100%'>
                    <ErrorBanner error={error} />
                    <Box width='100%'>
                        <Flex direction='column' gap='2'>
                            <Box>
                                <Label htmlFor='subject' isRequired>{__('Subject')}</Label>
                                <TextArea
                                    {...register('subject', { required: __('Subject is required') })}
                                />
                            </Box>

                            {errors?.subject && <ErrorText>{errors.subject?.message}</ErrorText>}
                        </Flex>
                    </Box>

                    <Flex gap='2'>
                        <Box width='100%'>
                            <Flex direction='column' gap='2'>
                                <Box width='100%'>
                                    <Label htmlFor='duration' isRequired>{__('Duration')}</Label>
                                    <Controller
                                        name="duration"
                                        rules={{
                                            required: __('Duration is required')
                                        }}
                                        control={control}
                                        render={({ field }) => (
                                            <Select.Root value={field.value}
                                                name={field.name}
                                                required
                                                onValueChange={field.onChange}
                                            >
                                                <Select.Trigger onBlur={field.onBlur} className='w-full' />
                                                <Select.Content>
                                                    <Select.Item value="15">{__('15 minutes')}</Select.Item>
                                                    <Select.Item value="30">{__('30 minutes')}</Select.Item>
                                                    <Select.Item value="60">{__('1 hour')}</Select.Item>
                                                    <Select.Item value="120">{__('2 hours')}</Select.Item>
                                                </Select.Content>
                                            </Select.Root>
                                        )}
                                    />
                                </Box>
                                {errors?.duration && <ErrorText>{errors.duration?.message}</ErrorText>}
                            </Flex>
                        </Box>

                        <Box width='100%'>
                            <Flex direction='column' gap='2'>
                                <LinkFormField
                                    name='google_calendar'
                                    label={__('Google Calendar')}
                                    required
                                    dropdownClass='sm:w-[255px] w-[10rem]'
                                    rules={{
                                        required: __('Calendar is required'),
                                    }}
                                    filters={[["enable", "=", 1], ["user", "=", currentUser]]}
                                    doctype="Google Calendar"
                                />
                                <ErrorText>{methods.formState.errors.google_calendar?.message}</ErrorText>
                            </Flex>
                        </Box>
                    </Flex>

                    <Box width='100%'>
                        <Label htmlFor='description'>{__('Description')} <Text as='span' size='1' color='gray'> {__('(Optional)')}</Text></Label>
                        <TextArea
                            {...register('description')}
                        />

                        {errors?.description && <ErrorText>{errors.description?.message}</ErrorText>}
                    </Box>
                </Flex>

                <Flex gap="3" mt="6" justify="end" align='center'>
                    <Dialog.Close disabled={loading}>
                        <Button variant="soft" color="gray">{__('Cancel')}</Button>
                    </Dialog.Close>
                    <Button type='submit' disabled={loading}>
                        {loading && <Loader className="text-white" />}
                        {loading ? __('Creating') : __('Create')}
                    </Button>
                </Flex>
            </form>
        </FormProvider>
    )
}

export default CreateMeetingForm