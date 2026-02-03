import { AlertContent } from "@/components/feature/settings/common/DeleteAlert"
import { RavenSchedulerEvent } from "@/types/RavenIntegrations/RavenSchedulerEvent"
import { DateMonthYear } from "@/utils/dateConversions"
import { DIALOG_CONTENT_CLASS } from "@/utils/layout/dialog"
import { Flex, Badge, IconButton, AlertDialog, Text } from "@radix-ui/themes"
import { useState } from "react"
import { BiTrash } from "react-icons/bi"
import { AiOutlineEdit } from "react-icons/ai"
import { Link, useNavigate } from "react-router-dom"
import { __ } from "@/utils/translations"

export const List = ({ data }: { data: RavenSchedulerEvent[] }) => {

    return (
        <Flex direction='column' gap='4' width='100%' className="animate-fadein">
            {data?.map((item, index) => (
                <ScheduledMessageItem item={item} key={index} />
            ))}
        </Flex>
    )
}


const ScheduledMessageItem = ({ item }: { item: RavenSchedulerEvent }) => {

    const [open, setOpen] = useState(false)
    const onClose = () => {
        setOpen(false)
    }

    return (
        <Flex direction='column' gap='2' width='100%' justify={'between'} className="border border-gray-4 dark:border-gray-6 rounded-radius2 p-3">
            <Flex direction='row' align='center' justify='between'>
                <Flex direction='column' gap='1'>
                    <Flex direction={'row'} gap={'2'}>
                        <Text size={'2'} weight={'bold'}>{item.name}</Text>
                        <Badge color={item.disabled ? 'gray' : 'green'}>{item.disabled ? __('Disabled') : __('Enabled')}</Badge>
                    </Flex>
                    <Text size='1' style={{
                        fontStyle: 'italic',
                        color: 'gray'
                    }}>{__('Created by')} {item.owner} {__('on')} <DateMonthYear date={item.creation} /></Text>
                </Flex>
                <Flex direction={'row'} gap={'2'} align={'center'}>
                    <IconButton
                        variant="ghost"
                        color="gray"
                        aria-label={__('Click to edit')}
                        title={__('Edit')}
                        asChild
                        style={{
                            // @ts-ignore
                            '--icon-button-ghost-padding': '0',
                            height: 'var(--base-button-height)',
                            width: 'var(--base-button-height)',
                        }}>
                        <Link to={`./${item.name}`}>
                            <AiOutlineEdit size='16' />
                        </Link>
                    </IconButton>
                    <AlertDialog.Root open={open} onOpenChange={setOpen}>
                        <AlertDialog.Trigger>
                            <IconButton
                                variant="ghost"
                                color="red"
                                aria-label={__('Click to delete')}
                                title={__('Delete')}
                                onClick={() => { }}
                                style={{
                                    // @ts-ignore
                                    '--icon-button-ghost-padding': '0',
                                    height: 'var(--base-button-height)',
                                    width: 'var(--base-button-height)',
                                }}>
                                <BiTrash size='16' />
                            </IconButton>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content className={DIALOG_CONTENT_CLASS}>
                            <AlertContent doctype="Raven Scheduler Event" docname={item.name} onClose={onClose} />
                        </AlertDialog.Content>
                    </AlertDialog.Root>
                </Flex>
            </Flex>
        </Flex>
    )
}