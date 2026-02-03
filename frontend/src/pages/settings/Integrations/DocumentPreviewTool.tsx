import DocumentPreviewToolConfigurator from "@/components/feature/DocumentPreviewToolConfigurator"
import PageContainer from "@/components/layout/Settings/PageContainer"
import SettingsContentContainer from "@/components/layout/Settings/SettingsContentContainer"
import SettingsPageHeader from "@/components/layout/Settings/SettingsPageHeader"
import { __ } from "@/utils/translations"

const DocumentPreviewTool = () => {
    return (
        <PageContainer>
            <SettingsContentContainer>
                <SettingsPageHeader
                    title={__('Document Previews')}
                    description={__('Customise how document links are displayed in the chat. You can add/remove fields to be displayed in the preview.')}
                />
                <DocumentPreviewToolConfigurator />
            </SettingsContentContainer>
        </PageContainer>
    )
}

export const Component = DocumentPreviewTool