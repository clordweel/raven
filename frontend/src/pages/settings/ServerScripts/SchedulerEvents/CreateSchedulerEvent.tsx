import { Loader } from "@/components/common/Loader"
import { SchedulerEventForm, SchedulerEventsForm } from "@/components/feature/settings/scheduler-events/SchedulerEventsForm"
import { ErrorBanner } from "@/components/layout/AlertBanner/ErrorBanner"
import PageContainer from "@/components/layout/Settings/PageContainer"
import SettingsContentContainer from "@/components/layout/Settings/SettingsContentContainer"
import SettingsPageHeader from "@/components/layout/Settings/SettingsPageHeader"
import { Button } from "@radix-ui/themes"
import { useFrappeCreateDoc } from "frappe-react-sdk"
import { useEffect } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { __ } from "@/utils/translations"

const CreateSchedulerEvent = () => {

    const navigate = useNavigate()

    const methods = useForm({
        defaultValues: {
            day: "1"
        }
    })

    const { createDoc, error, loading } = useFrappeCreateDoc()

    const onSubmit = (data: Partial<SchedulerEventForm>) => {
        let cron_expression = ''
        if (data.event_frequency === 'Every Day') {
            cron_expression = `${data.minute} ${data.hour} * * *`
        }
        if (data.event_frequency === 'Every Day of the week') {
            cron_expression = `${data.minute} ${data.hour} * * ${data.day}`
        }
        if (data.event_frequency === 'Date of the month') {
            cron_expression = `${data.minute} ${data.hour} ${data.date} * *`
        }
        if (data.event_frequency === 'Cron') {
            cron_expression = `${data.minute} ${data.hour} ${data.date} ${data.month} ${data.day}`
        }
        createDoc('Raven Scheduler Event', {
            event_name: data.event_name,
            disabled: 0,
            send_to: data.send_to,
            channel: data.channel ?? '',
            dm: data.dm ? data.dm : '',
            bot: data.bot,
            event_frequency: data.event_frequency,
            cron_expression: cron_expression,
            content: data.content,
        })
            .then((doc) => {
                if (doc) {
                    navigate(`../${doc?.name}`)
                }
                toast.success(__("Scheduled Message created"))
            })
    }

    useEffect(() => {

        const down = (e: KeyboardEvent) => {
            if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                methods.handleSubmit(onSubmit)()
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])
    //TODO: Figure out a way to show _server_messages in the UI (especially the script editor might have some errors that we need to show to the user)
    return (
        <PageContainer>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
                <FormProvider {...methods}>
                    <SettingsContentContainer>
                        <SettingsPageHeader
                            title={__('Create a Scheduled Message')}
                            // description='Bots can be used to send reminders, run AI assistants, and more.'
                            actions={<Button type='submit' disabled={loading}>
                                {loading && <Loader className="text-white" />}
                                {loading ? __("Creating") : __("Create")}
                            </Button>}
                            breadcrumbs={[{ label: __('Scheduled Message'), href: '../' }, { label: __('New Scheduled Message'), href: '' }]}
                        />
                        <ErrorBanner error={error} />
                        <SchedulerEventsForm />
                    </SettingsContentContainer>
                </FormProvider>
            </form>
        </PageContainer>
    )
}

export const Component = CreateSchedulerEvent