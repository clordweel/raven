import { useFrappeCreateDoc } from 'frappe-react-sdk'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@radix-ui/themes'
import { ErrorBanner } from '@/components/layout/AlertBanner/ErrorBanner'
import { WebhookForm } from '../../../components/feature/integrations/webhooks/WebhookForm'
import { RavenWebhook } from '@/types/RavenIntegrations/RavenWebhook'
import { toast } from 'sonner'
import PageContainer from '@/components/layout/Settings/PageContainer'
import SettingsContentContainer from '@/components/layout/Settings/SettingsContentContainer'
import SettingsPageHeader from '@/components/layout/Settings/SettingsPageHeader'
import { Loader } from '@/components/common/Loader'
import { useEffect } from 'react'
import { __ } from '@/utils/translations'

const CreateWebhook = () => {

    const navigate = useNavigate()

    const methods = useForm<RavenWebhook>({
        defaultValues: {
            enabled: 1,
            timeout: 5
        }
    })
    const { createDoc, loading, reset, error } = useFrappeCreateDoc()

    const onSubmit = (data: RavenWebhook) => {
        createDoc('Raven Webhook', data)
            .then((doc) => {
                reset()
                methods.reset()
                toast.success(__("Webhook created"))
                return doc
            }).then((doc) => {
                navigate(`../${doc.name}`)
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

    return (
        <PageContainer>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
                <FormProvider {...methods}>
                    <SettingsContentContainer>
                        <SettingsPageHeader
                            title={__('Create a Webhook')}
                            actions={<Button type='submit' disabled={loading}>
                                {loading && <Loader className="text-white" />}
                                {loading ? __("Creating") : __("Create")}
                            </Button>}
                            breadcrumbs={[{ label: __('Webhooks'), href: '../' }, { label: __('New Webhook'), href: '' }]}
                        />
                        <ErrorBanner error={error} />
                        <WebhookForm />
                    </SettingsContentContainer>
                </FormProvider>
            </form>
        </PageContainer>
    )
}

export const Component = CreateWebhook