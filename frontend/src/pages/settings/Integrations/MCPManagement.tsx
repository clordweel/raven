import { HelperText, Label } from '@/components/common/Form'
import { Loader } from '@/components/common/Loader'
import PageContainer from '@/components/layout/Settings/PageContainer'
import SettingsContentContainer from '@/components/layout/Settings/SettingsContentContainer'
import SettingsPageHeader from '@/components/layout/Settings/SettingsPageHeader'
import useRavenSettings from '@/hooks/fetchers/useRavenSettings'
import { RavenSettings } from '@/types/Raven/RavenSettings'
import { hasRavenAdminRole, isSystemManager } from '@/utils/roles'
import { __ } from '@/utils/translations'
import { Box, Button, Checkbox, Flex, Separator, Select, Text } from '@radix-ui/themes'
import { Stack } from '@/components/layout/Stack'
import { useFrappeGetCall, useFrappePostCall, useFrappeUpdateDoc } from 'frappe-react-sdk'
import { useEffect, useRef, useState } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import parse from 'html-react-parser'
import { toast } from 'sonner'

/** Simple markdown-like to HTML (no extra deps): **bold**, `code`, [text](url), newlines. */
function simpleMarkdownToHtml(text: string): string {
	const escape = (s: string) =>
		s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	let out = escape(text)
	out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
	out = out.replace(/\n/g, '<br />')
	return out
}

const MCPManagement = () => {
	const isRavenAdmin = hasRavenAdminRole() || isSystemManager()

	const { ravenSettings, mutate } = useRavenSettings()

	const methods = useForm<RavenSettings>({
		disabled: !isRavenAdmin,
	})

	const { handleSubmit, control, watch, reset } = methods

	useEffect(() => {
		if (ravenSettings) {
			reset({
				...ravenSettings,
				enable_fac_integration: ravenSettings.enable_fac_integration ?? 0,
				fac_integration_mode: ravenSettings.fac_integration_mode ?? 'In-process',
			})
		}
	}, [ravenSettings])

	const { updateDoc, loading: updatingDoc } = useFrappeUpdateDoc<RavenSettings>()

	const onSubmit = (data: RavenSettings) => {
		toast.promise(
			updateDoc('Raven Settings', null, {
				...(ravenSettings ?? {}),
				...data,
			}).then((res) => {
				mutate(res, { revalidate: false })
			}),
			{
				loading: __('Updating...'),
				success: () => __('Settings updated'),
				error: __('There was an error.'),
			}
		)
	}

	const enableFAC = watch('enable_fac_integration')

	return (
		<PageContainer>
			<FormProvider {...methods}>
				<form onSubmit={handleSubmit(onSubmit)}>
					<SettingsContentContainer>
						<SettingsPageHeader
							title={__('MCP Management')}
							description={__('Configure MCP (Model Context Protocol) integrations such as FAC.')}
							actions={
								<Button type="submit" disabled={updatingDoc || !isRavenAdmin}>
									{updatingDoc && <Loader className="text-white" />}
									{updatingDoc ? __('Saving') : __('Save')}
								</Button>
							}
						/>

						<Flex direction="column" gap="4">
							<Text size="3" weight="medium">
								{__('FAC Integration')}
							</Text>
							<Flex direction="column" gap="2">
								<Text as="label" size="2">
									<Flex gap="2">
										<Controller
											control={control}
											name="enable_fac_integration"
											render={({ field }) => (
												<Checkbox
													checked={!!field.value}
													name={field.name}
													disabled={field.disabled}
													onCheckedChange={(v) => field.onChange(v ? 1 : 0)}
												/>
											)}
										/>
										{__('Enable FAC Integration')}
									</Flex>
								</Text>
								<HelperText>
									{__('Use Frappe Assistant Core (FAC) tools in Raven bots. Requires frappe_assistant_core app.')}
								</HelperText>
							</Flex>

							{enableFAC ? (
								<Stack gap="1">
									<Label htmlFor="fac_integration_mode">{__('FAC Integration Mode')}</Label>
									<Controller
										control={control}
										name="fac_integration_mode"
										render={({ field }) => (
											<Select.Root
												value={field.value ?? 'In-process'}
												onValueChange={field.onChange}
											>
												<Select.Trigger placeholder={__('Select mode')} className="w-48 sm:w-96" />
												<Select.Content>
													<Select.Item value="In-process">{__('In-process')}</Select.Item>
													<Select.Item value="HTTP">{__('HTTP')}</Select.Item>
												</Select.Content>
											</Select.Root>
										)}
									/>
									<HelperText>
										{__('In-process: same site, no HTTP. HTTP: call FAC MCP endpoint (requires URL and auth).')}
									</HelperText>
								</Stack>
							) : null}
						</Flex>

						{enableFAC ? (
							<>
								<Separator size="4" />
								<MCPDebugSection />
							</>
						) : null}
					</SettingsContentContainer>
				</form>
			</FormProvider>
		</PageContainer>
	)
}

/** Renders markdown-like description in the detail column (rightmost block). Uses html-react-parser, no extra deps. */
const MarkdownDescription = ({ content }: { content: string }) => (
	<Text
		size="2"
		as="div"
		color="gray"
		style={{
			lineHeight: 1.6,
		}}
		className="mcp-detail-description"
	>
		{parse(simpleMarkdownToHtml(content))}
	</Text>
)

/** Debug section: MCP Inspector-style — list + detail + Run Tool. */
type ToolItem = { name?: string; description?: string; inputSchema?: Record<string, unknown> }

/** Parse JSON Schema inputSchema into a list of param infos (name, type, required, description, default). */
function getParamsFromInputSchema(inputSchema: Record<string, unknown> | undefined): Array<{
	name: string
	type: string
	required: boolean
	description?: string
	default?: unknown
}> {
	if (!inputSchema || typeof inputSchema !== 'object') return []
	const properties = inputSchema.properties as Record<string, Record<string, unknown>> | undefined
	const requiredList = Array.isArray(inputSchema.required) ? (inputSchema.required as string[]) : []
	if (!properties || typeof properties !== 'object') return []
	return Object.entries(properties).map(([name, prop]) => {
		if (!prop || typeof prop !== 'object') return { name, type: 'unknown', required: requiredList.includes(name) }
		const type = (prop.type as string) ?? 'unknown'
		const itemsType = prop.items && typeof prop.items === 'object' && 'type' in prop.items
			? (prop.items as { type: string }).type
			: null
		const typeLabel = type === 'array' && itemsType ? `array<${itemsType}>` : type
		const desc = typeof prop.description === 'string' ? prop.description : undefined
		const def = prop.default
		return {
			name,
			type: typeLabel,
			required: requiredList.includes(name),
			description: desc,
			default: def,
		}
	})
}
type PromptItem = { name?: string; title?: string; description?: string }
type ToolsResponse = { message?: { tools?: Array<ToolItem>; error?: string } }
type PromptsResponse = { message?: { prompts?: Array<PromptItem>; error?: string } }
type CallToolResponse = { message?: { ok?: boolean; result?: unknown; error?: string } }

const MCPDebugSection = () => {
	const [activeTab, setActiveTab] = useState<'tools' | 'prompts'>('tools')
	const [toolsFilter, setToolsFilter] = useState('')
	const [promptsFilter, setPromptsFilter] = useState('')
	const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null)
	const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null)
	const [toolArgs, setToolArgs] = useState('{}')
	const [runResult, setRunResult] = useState<{ ok: boolean; result?: unknown; error?: string } | null>(null)
	const [paramsWidth, setParamsWidth] = useState(320)
	const resizeLastXRef = useRef(0)

	const { data: toolsResponse, isLoading: toolsLoading } = useFrappeGetCall<ToolsResponse>(
		'raven.api.mcp_debug.get_mcp_debug_tools',
		undefined,
		undefined,
		{ revalidateOnFocus: false }
	)
	const { data: promptsResponse, isLoading: promptsLoading } = useFrappeGetCall<PromptsResponse>(
		'raven.api.mcp_debug.get_mcp_debug_prompts',
		undefined,
		undefined,
		{ revalidateOnFocus: false }
	)
	const { call: callTool, loading: runLoading } = useFrappePostCall<CallToolResponse>(
		'raven.api.mcp_debug.call_mcp_debug_tool'
	)

	const rawTools: ToolItem[] = Array.isArray(toolsResponse?.message?.tools)
		? toolsResponse.message.tools
		: Array.isArray((toolsResponse as { tools?: unknown[] })?.tools)
			? (toolsResponse as { tools: ToolItem[] }).tools
			: []
	const toolsError =
		(toolsResponse?.message && typeof toolsResponse.message === 'object' && 'error' in toolsResponse.message
			? (toolsResponse.message as { error?: string }).error
			: undefined) ??
		(typeof (toolsResponse as { error?: string })?.error === 'string'
			? (toolsResponse as { error: string }).error
			: undefined)
	const rawPrompts: PromptItem[] = Array.isArray(promptsResponse?.message?.prompts)
		? promptsResponse.message.prompts
		: Array.isArray((promptsResponse as { prompts?: unknown[] })?.prompts)
			? (promptsResponse as { prompts: PromptItem[] }).prompts
			: []
	const promptsError =
		(promptsResponse?.message && typeof promptsResponse.message === 'object' && 'error' in promptsResponse.message
			? (promptsResponse.message as { error?: string }).error
			: undefined) ??
		(typeof (promptsResponse as { error?: string })?.error === 'string'
			? (promptsResponse as { error: string }).error
			: undefined)

	const tools = toolsFilter
		? rawTools.filter(
				(t) =>
					(t.name ?? '').toLowerCase().includes(toolsFilter.toLowerCase()) ||
					(t.description ?? '').toLowerCase().includes(toolsFilter.toLowerCase())
		  )
		: rawTools
	const prompts = promptsFilter
		? rawPrompts.filter(
				(p) =>
					(p.name ?? '').toLowerCase().includes(promptsFilter.toLowerCase()) ||
					(p.title ?? '').toLowerCase().includes(promptsFilter.toLowerCase()) ||
					(p.description ?? '').toLowerCase().includes(promptsFilter.toLowerCase())
		  )
		: rawPrompts

	const onSelectTool = (t: ToolItem) => {
		setSelectedTool(t)
		setSelectedPrompt(null)
		setRunResult(null)
		// Pre-fill args with defaults from inputSchema so user sees expected shape
		const schema = t.inputSchema
		if (schema && typeof schema === 'object' && schema.properties && typeof schema.properties === 'object') {
			const props = schema.properties as Record<string, Record<string, unknown>>
			const defaults: Record<string, unknown> = {}
			for (const [key, prop] of Object.entries(props)) {
				if (prop && typeof prop === 'object' && 'default' in prop) defaults[key] = prop.default
			}
			setToolArgs(Object.keys(defaults).length > 0 ? JSON.stringify(defaults, null, 2) : '{}')
		} else {
			setToolArgs('{}')
		}
	}
	const onSelectPrompt = (p: PromptItem) => {
		setSelectedPrompt(p)
		setSelectedTool(null)
		setRunResult(null)
	}

	/** Add a parameter key (with default or empty value) to the Arguments JSON. */
	const addParamToArgs = (name: string, type: string, defaultVal: unknown) => {
		let obj: Record<string, unknown> = {}
		try {
			if (toolArgs.trim()) obj = JSON.parse(toolArgs) as Record<string, unknown>
		} catch {
			// keep obj = {}
		}
		if (name in obj) return // already present, avoid overwriting user input
		let value: unknown = defaultVal
		if (value === undefined || value === null) {
			if (type === 'string' || type.startsWith('array')) value = type.startsWith('array') ? [] : ''
			else if (type === 'integer' || type === 'number') value = 0
			else if (type === 'boolean') value = false
			else if (type === 'object') value = {}
			else value = ''
		}
		obj[name] = value
		setToolArgs(JSON.stringify(obj, null, 2))
	}

	const onRunTool = () => {
		if (!selectedTool?.name) return
		setRunResult(null)
		callTool({ tool_name: selectedTool.name, arguments: toolArgs })
			.then((res) => {
				const msg = (res as CallToolResponse)?.message
				if (msg && typeof msg === 'object') {
					setRunResult({
						ok: !!msg.ok,
						result: msg.result,
						error: typeof msg.error === 'string' ? msg.error : undefined,
					})
				} else {
					setRunResult({ ok: false, error: 'Invalid response' })
				}
			})
			.catch(() => setRunResult({ ok: false, error: __('Request failed.') }))
	}

	const renderList = (kind: 'tools' | 'prompts') => {
		if (kind === 'tools') {
			if (toolsLoading) return <Text size="2" color="gray">{__('Loading...')}</Text>
			if (toolsError) return <Text size="2" color="red">{toolsError}</Text>
			if (tools.length === 0) return <Text size="2" color="gray">{__('No tools available.')}</Text>
			return (
				<Box
					style={{
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
						overflowX: 'hidden',
					}}
				>
					<Flex direction="column" gap="0">
						{tools.map((t, i) => (
							<Box
								key={t.name ?? `tool-${i}`}
								p="3"
								onClick={() => onSelectTool(t)}
								style={{
									borderBottom: i < tools.length - 1 ? '1px solid var(--gray-5)' : 'none',
									display: 'flex',
									alignItems: 'flex-start',
									justifyContent: 'space-between',
									gap: 8,
									cursor: 'pointer',
									background: selectedTool?.name === t.name ? 'var(--accent-3)' : undefined,
								}}
							>
								<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
									<Text size="2" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{t.name ?? '-'}
									</Text>
									{t.description && (
										<Text
											size="1"
											color="gray"
											style={{
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
												lineHeight: 1.4,
											}}
										>
											{t.description}
										</Text>
									)}
								</Flex>
								<Text size="2" color="gray" style={{ flexShrink: 0 }}>›</Text>
							</Box>
						))}
					</Flex>
				</Box>
			)
		}
		if (promptsLoading) return <Text size="2" color="gray">{__('Loading...')}</Text>
		if (promptsError) return <Text size="2" color="red">{promptsError}</Text>
		if (prompts.length === 0) return <Text size="2" color="gray">{__('No prompts available.')}</Text>
		return (
			<Box
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					overflowX: 'hidden',
				}}
			>
				<Flex direction="column" gap="0">
					{prompts.map((p, i) => (
						<Box
							key={p.name ?? p.title ?? `prompt-${i}`}
							p="3"
							onClick={() => onSelectPrompt(p)}
							style={{
								borderBottom: i < prompts.length - 1 ? '1px solid var(--gray-5)' : 'none',
								display: 'flex',
								alignItems: 'flex-start',
								justifyContent: 'space-between',
								gap: 8,
								cursor: 'pointer',
								background: selectedPrompt === p ? 'var(--accent-3)' : undefined,
							}}
						>
							<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
								<Text size="2" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{p.name ?? p.title ?? '-'}
								</Text>
								{p.description && (
									<Text
										size="1"
										color="gray"
										style={{
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
											lineHeight: 1.4,
										}}
									>
										{p.description}
									</Text>
								)}
							</Flex>
							<Text size="2" color="gray" style={{ flexShrink: 0 }}>›</Text>
						</Box>
					))}
				</Flex>
			</Box>
		)
	}

	/** Middle column: Parameters block (tools only). */
	const renderParamsColumn = () => {
		if (activeTab !== 'tools' || !selectedTool) {
			return (
				<Flex direction="column" gap="2" style={{ padding: 16 }}>
					<Text size="2" color="gray">{__('Parameters')}</Text>
					<Text size="1" color="gray">
						{activeTab === 'tools' ? __('Select a tool to view parameters.') : __('Parameters are available for tools.')}
					</Text>
				</Flex>
			)
		}
		const params = getParamsFromInputSchema(selectedTool.inputSchema)
		if (params.length === 0) {
			return (
				<Flex direction="column" gap="2" style={{ padding: 16 }}>
					<Text size="2" weight="medium">{__('Parameters')}</Text>
					<Text size="1" color="gray">{__('No parameters defined.')}</Text>
				</Flex>
			)
		}
		return (
			<Flex direction="column" gap="2" style={{ padding: 16, overflow: 'auto', height: '100%' }}>
				<Text size="2" weight="medium">{__('Parameters')}</Text>
				<Box
					style={{
						padding: 12,
						background: 'var(--gray-2)',
						borderRadius: 8,
						border: '1px solid var(--gray-5)',
					}}
				>
					<Flex direction="column" gap="3">
						{params.map((p) => (
							<Box key={p.name}>
								<Flex align="center" gap="2" wrap="wrap">
									<Button
										type="button"
										variant="soft"
										size="1"
										onClick={() => addParamToArgs(p.name, p.type, p.default)}
										title={__('Add to Arguments JSON')}
										style={{ minWidth: 28, padding: '0 6px', flexShrink: 0 }}
									>
										+
									</Button>
									<Text size="2" weight="medium">
										{p.name}
										{p.required && (
											<Text as="span" size="1" color="red" style={{ marginLeft: 4 }}> *</Text>
										)}
									</Text>
								</Flex>
								<Text size="1" color="gray" style={{ marginTop: 2, marginLeft: 36 }}>
									({p.type})
									{p.default !== undefined && p.default !== '' && (
										<>
											{' '}
											{__('default')}: {typeof p.default === 'object' ? JSON.stringify(p.default) : String(p.default)}
										</>
									)}
								</Text>
								{p.description && (
									<Text size="1" color="gray" as="p" style={{ marginTop: 4, marginLeft: 36, lineHeight: 1.4 }}>
										{p.description}
									</Text>
								)}
							</Box>
						))}
					</Flex>
				</Box>
			</Flex>
		)
	}

	const renderDetail = () => {
		if (activeTab === 'tools') {
			if (!selectedTool) {
				return (
					<Flex direction="column" gap="2" style={{ padding: 16 }}>
						<Text size="2" color="gray">{__('Select a tool')}</Text>
						<Text size="1" color="gray">{__('Select a tool from the list to view details and run it.')}</Text>
					</Flex>
				)
			}
			return (
				<Flex direction="column" gap="4" style={{ padding: 16, overflow: 'auto' }}>
					<Text size="3" weight="medium">{selectedTool.name ?? '-'}</Text>
					{selectedTool.description && (
						<MarkdownDescription content={selectedTool.description} />
					)}
					<Flex direction="column" gap="2">
						<Label>{__('Arguments (JSON)')}</Label>
						<textarea
							value={toolArgs}
							onChange={(e) => setToolArgs(e.target.value)}
							placeholder='{"doctype": "Customer", "limit": 20}'
							rows={6}
							className="w-full px-2 py-1.5 text-sm font-mono border border-gray-6 rounded-md resize-y"
							spellCheck={false}
						/>
					</Flex>
					<Flex gap="2" align="center">
						<Button
							type="button"
							onClick={onRunTool}
							disabled={runLoading}
						>
							{runLoading && <Loader className="mr-1 inline" />}
							{runLoading ? __('Running...') : __('Run Tool')}
						</Button>
					</Flex>
					{runResult && (
						<Flex direction="column" gap="2">
							<Text size="2" weight="medium">{runResult.ok ? __('Result') : __('Error')}</Text>
							<Box
								style={{
									padding: 12,
									background: runResult.ok ? 'var(--green-2)' : 'var(--red-2)',
									borderRadius: 8,
									overflow: 'auto',
									maxHeight: 280,
								}}
							>
								<pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
									{runResult.error ?? JSON.stringify(runResult.result, null, 2)}
								</pre>
							</Box>
						</Flex>
					)}
				</Flex>
			)
		}
		if (!selectedPrompt) {
			return (
				<Flex direction="column" gap="2" style={{ padding: 16 }}>
					<Text size="2" color="gray">{__('Select a prompt')}</Text>
					<Text size="1" color="gray">{__('Select a prompt from the list to view and use it.')}</Text>
				</Flex>
			)
		}
		return (
			<Flex direction="column" gap="4" style={{ padding: 16, overflow: 'auto' }}>
				<Text size="3" weight="medium">{selectedPrompt.name ?? selectedPrompt.title ?? '-'}</Text>
				{selectedPrompt.description && (
					<MarkdownDescription content={selectedPrompt.description} />
				)}
			</Flex>
		)
	}

	return (
		<Flex direction="column" gap="4">
			<Text size="3" weight="medium">
				{__('Debug (MCP Inspector)')}
			</Text>
			<HelperText>
				{__('List and run FAC tools, or browse prompts. Useful for verifying MCP integration.')}
			</HelperText>

			<Flex gap="2" style={{ borderBottom: '1px solid var(--gray-6)' }}>
				<Box
					onClick={() => setActiveTab('tools')}
					style={{
						padding: '8px 12px',
						cursor: 'pointer',
						borderBottom: activeTab === 'tools' ? '2px solid var(--accent-9)' : '2px solid transparent',
						marginBottom: -1,
					}}
				>
					<Text size="2" weight={activeTab === 'tools' ? 'medium' : 'regular'}>{__('Tools')}</Text>
				</Box>
				<Box
					onClick={() => setActiveTab('prompts')}
					style={{
						padding: '8px 12px',
						cursor: 'pointer',
						borderBottom: activeTab === 'prompts' ? '2px solid var(--accent-9)' : '2px solid transparent',
						marginBottom: -1,
					}}
				>
					<Text size="2" weight={activeTab === 'prompts' ? 'medium' : 'regular'}>{__('Prompts')}</Text>
				</Box>
			</Flex>

			<Flex gap="2" align="center">
				{activeTab === 'tools' && (
					<>
						<input
							type="text"
							placeholder={__('List Tools')}
							value={toolsFilter}
							onChange={(e) => setToolsFilter(e.target.value)}
							className="w-full max-w-xs px-2 py-1.5 text-sm border border-gray-6 rounded-md"
						/>
						{toolsFilter && (
							<Button type="button" variant="soft" size="1" onClick={() => setToolsFilter('')}>
								{__('Clear')}
							</Button>
						)}
					</>
				)}
				{activeTab === 'prompts' && (
					<>
						<input
							type="text"
							placeholder={__('List Prompts')}
							value={promptsFilter}
							onChange={(e) => setPromptsFilter(e.target.value)}
							className="w-full max-w-xs px-2 py-1.5 text-sm border border-gray-6 rounded-md"
						/>
						{promptsFilter && (
							<Button type="button" variant="soft" size="1" onClick={() => setPromptsFilter('')}>
								{__('Clear')}
							</Button>
						)}
					</>
				)}
			</Flex>

			{/* Columns: list | detail ; when Tools tab: detail | resize | parameters */}
			<Flex
				gap="0"
				style={{
					minHeight: 360,
					maxHeight: 560,
					border: '1px solid var(--gray-6)',
					borderRadius: 8,
					overflow: 'hidden',
				}}
			>
				{/* Column 1: list */}
				<Box
					style={{
						width: 260,
						minWidth: 260,
						borderRight: '1px solid var(--gray-6)',
						display: 'flex',
						flexDirection: 'column',
						minHeight: 0,
					}}
				>
					<Box p="2" style={{ borderBottom: '1px solid var(--gray-6)' }}>
						<Text size="2" weight="medium">{activeTab === 'tools' ? __('Tools') : __('Prompts')}</Text>
					</Box>
					{renderList(activeTab)}
				</Box>
				{/* Column 2: detail (args + run + result) */}
				<Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
					<Box p="2" style={{ borderBottom: '1px solid var(--gray-6)' }}>
						<Text size="2" weight="medium" color="gray">
							{activeTab === 'tools'
								? (selectedTool ? selectedTool.name : __('Select a tool'))
								: (selectedPrompt ? (selectedPrompt.name ?? selectedPrompt.title) : __('Select a prompt'))}
						</Text>
					</Box>
					<Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
						{renderDetail()}
					</Box>
				</Box>
				{/* Only when Tools tab: resize handle + parameters column (rightmost) */}
				{activeTab === 'tools' && (
					<>
						<Box
							role="separator"
							aria-label={__('Resize parameters column')}
							onMouseDown={(e) => {
								e.preventDefault()
								resizeLastXRef.current = e.clientX
								const minW = 200
								const maxW = 560
								const onMove = (e2: MouseEvent) => {
									const delta = e2.clientX - resizeLastXRef.current
									resizeLastXRef.current = e2.clientX
									setParamsWidth((w) => Math.min(maxW, Math.max(minW, w + delta)))
								}
								const onUp = () => {
									document.removeEventListener('mousemove', onMove)
									document.removeEventListener('mouseup', onUp)
									document.body.style.cursor = ''
									document.body.style.userSelect = ''
								}
								document.body.style.cursor = 'col-resize'
								document.body.style.userSelect = 'none'
								document.addEventListener('mousemove', onMove)
								document.addEventListener('mouseup', onUp)
							}}
							style={{
								width: 6,
								flexShrink: 0,
								cursor: 'col-resize',
								background: 'var(--gray-5)',
								borderLeft: '1px solid var(--gray-6)',
								borderRight: '1px solid var(--gray-6)',
								alignSelf: 'stretch',
							}}
						/>
						<Box
							style={{
								width: paramsWidth,
								minWidth: 200,
								maxWidth: 560,
								flexShrink: 0,
								borderLeft: 'none',
								display: 'flex',
								flexDirection: 'column',
								minHeight: 0,
								overflow: 'hidden',
							}}
						>
							<Box p="2" style={{ borderBottom: '1px solid var(--gray-6)' }}>
								<Text size="2" weight="medium" color="gray">{__('Parameters')}</Text>
							</Box>
							<Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
								{renderParamsColumn()}
							</Box>
						</Box>
					</>
				)}
			</Flex>
		</Flex>
	)
}

export const Component = MCPManagement
