import { runEntrypoint, InstanceBase, InstanceStatus, Regex } from '@companion-module/base'
import api from './api.js'
import actions from './actions.js'
import variables from './variables.js'
import feedbacks from './feedbacks.js'
import presets from './presets.js'
import utils from './utils.js'

let log

/**
 * Companion instance class for Boinx Software mimoLive
 */
class MimoLiveInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...api,
			...actions,
			...variables,
			...feedbacks,
			...presets,
			...utils,
		})

		this.port = 8989 // Default; overridden from config in init()
		this.apiSlug = 'api/v1/' // Needed for all api calls
		this.gotOptions = undefined // Options for got used by API calls

		this.documents = []
		this.layoutUpdateQueue = new Map()
		this.layoutUpdateTimers = new Map()

		this.CHOICES_DOCUMENTACTIONS = [
			{ id: 'setLive', label: 'Set Live' },
			{ id: 'setOff', label: 'Set Off' },
			{ id: 'toggleLive', label: 'Toggle Live' },
		]
		this.CHOICES_LAYERACTIONS = [
			{ id: 'setLive', label: 'Set Live' },
			{ id: 'setOff', label: 'Set Off' },
			{ id: 'toggleLive', label: 'Toggle Live' },
			{ id: 'cycleThroughVariants', label: 'Cycle Through Variants' },
		]
		this.CHOICES_VARIANTACTIONS = [
			{ id: 'setLive', label: 'Set Live' },
			{ id: 'setOff', label: 'Set Off' },
			{ id: 'toggleLive', label: 'Toggle Live' },
		]
		this.CHOICES_OUTPUTACTIONS = [
			{ id: 'setLive', label: 'Set Live' },
			{ id: 'setOff', label: 'Set Off' },
			{ id: 'toggleLive', label: 'Toggle Live' },
		]
		this.CHOICES_AUDIOADJUSTMENT = [
			{ id: 'set', label: 'Set' },
			{ id: 'increase', label: 'Increase' },
			{ id: 'decrease', label: 'Decrease' },
		]

		this.REGEX_DOCUMENT = '(^[0-9]+$)|(/api/v1/documents/([0-9]+))'
		this.REGEX_LAYER = '^([0-9]+,[0-9]+)|(/api/v1/documents/([0-9]+)/layers/([0-9-A-Z]+))$'
		this.REGEX_VARIANT = '^/api/v1/documents/([0-9]+)/layers/([0-9A-Za-z-]+)(?:/variants/([0-9A-Za-z-]+))?$'
		this.REGEX_OUTPUT = '^/api/v1/documents/([0-9]+)/output-destinations/([0-9-A-Z]+)$'
		this.REGEX_LAYERSET = '^/api/v1/documents/([0-9]+)/layer-sets/([0-9-A-Z]+)$'
		this.REGEX_ENDPOINT = '(^[0-9]+$)|(/api/v1/([0-9-A-Z-a-z/_]+))'
	}

	getConfigFields() {
		const getZoomSourceIndicator = (source) => {
			const selectionType = String(source?.zoomUserSelectionType || '').trim()
			if (!selectionType || selectionType === '1') return ''
			switch (selectionType) {
				case '2':
					return 'Automatic'
				case '4':
					return 'Spotlight'
				case '5': {
					const contains = String(source?.zoomUsernameContaining || '').trim()
					return contains ? `Name contains: ${contains}` : 'Name contains'
				}
				case '6':
					return 'Screen share'
				case '7':
					return 'Computer audio'
				default:
					return `Type ${selectionType}`
			}
		}

		const zoomSourceChoices = [{ id: '', label: '— None —' }]
		const zoomSourceEntries = []
		;(this.documents || []).forEach((doc) => {
			(doc.zoomSources || []).forEach((z) => {
				const indicator = getZoomSourceIndicator(z)
				const indicatorSuffix = indicator ? ` [${indicator}]` : ''
				const selectionTypeRaw = String(z?.zoomUserSelectionType || '').trim()
				const selectionTypeNum = Number.parseInt(selectionTypeRaw, 10)
				const selectionTypeSort = Number.isFinite(selectionTypeNum) ? selectionTypeNum : 9999
				zoomSourceEntries.push({
					id: z.uuid,
					label: `${doc.label} › ${z.label}${indicatorSuffix}`,
					docLabel: String(doc.label || ''),
					sourceLabel: String(z.label || ''),
					typeSort: selectionTypeSort,
				})
			})
		})
		zoomSourceEntries.sort((a, b) => {
			const docCmp = a.docLabel.localeCompare(b.docLabel, undefined, { sensitivity: 'base' })
			if (docCmp !== 0) return docCmp
			if (a.typeSort !== b.typeSort) return a.typeSort - b.typeSort
			const sourceCmp = a.sourceLabel.localeCompare(b.sourceLabel, undefined, { sensitivity: 'base' })
			if (sourceCmp !== 0) return sourceCmp
			return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })
		})
		zoomSourceEntries.forEach((entry) => {
			zoomSourceChoices.push({ id: entry.id, label: entry.label })
		})

		const layerSetChoices = [{ id: '', label: '— None —' }]
		;(this.documents || []).forEach((doc) => {
			(doc.layerSets || []).forEach((set) => {
				layerSetChoices.push({
					id: `/api/v1/documents/${doc.id}/layer-sets/${set.id}`,
					label: `${doc.label} › ${set.label}`,
				})
			})
		})

		const splitScreenLayerChoices = [{ id: '', label: '— None —' }]
		;(this.documents || []).forEach((doc) => {
			;(doc.layers || [])
				.filter(Boolean)
				.forEach((layer) => {
					const layerType = String(layer.layerType || '').toLowerCase()
					const compositionId = String(layer.compositionId || '')
					const label = String(layer.label || '')
					const labelLower = label.toLowerCase()
					const typeMatch = layerType.includes('split')
					const labelMatch = labelLower.includes('split screen')
					const compositionIdMatch = compositionId === 'com.boinx.boinxtv.layer.splitscreen'
					const hasCompositionId = compositionId.length > 0
					const isSplitScreen =
						compositionIdMatch || (!hasCompositionId && (typeMatch || labelMatch))
					if (!isSplitScreen) return
					splitScreenLayerChoices.push({
						id: `/api/v1/documents/${doc.id}/layers/${layer.id}`,
						label: `${doc.label} › ${label}`,
					})
				})
		})

		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This will establish a TCP connection to the device',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Port',
				width: 6,
				default: '8989',
				tooltip: 'mimoLive API port (1–65535). Default: 8989.',
			},
			{
				type: 'static-text',
				id: 'raised_hands_heading',
				width: 12,
				label: '',
				value: '<strong>Raised hands integration (Split Screen from raised hands)</strong>',
			},
			{
				type: 'dropdown',
				id: 'variablePrefix',
				label: 'Variable source',
				width: 6,
				choices: [
					{ id: 'mukana', label: 'Mukana' },
					{ id: 'queondeck', label: 'QueOnDeck' },
					{ id: 'custom', label: 'Custom' },
				],
				default: 'mukana',
				required: false,
				tooltip: 'Choose the module that provides hand variables (hand_1_uid, hand_1_name, etc.)',
			},
			{
				type: 'textinput',
				id: 'customVariablePrefix',
				label: 'Custom prefix',
				width: 6,
				default: '',
				required: false,
				tooltip: 'When "Custom" is selected above, enter the instance name (e.g. "MyModule"). Variables will use $(MyModule:hand_1_uid) format.',
				isVisible: (options) => options.variablePrefix === 'custom',
			},
			{
				type: 'dropdown',
				id: 'hostZoomUuid',
				label: 'Host Zoom UUID',
				width: 6,
				choices: zoomSourceChoices,
				default: '',
				required: false,
				allowCustom: true,
				tooltip: 'Zoom source UUID for the fixed Host position (position 1). Leave empty if not used.',
			},
			{
				type: 'dropdown',
				id: 'readerZoomUuid',
				label: 'Reader Zoom UUID',
				width: 6,
				choices: zoomSourceChoices,
				default: '',
				required: false,
				allowCustom: true,
				tooltip: 'Zoom source UUID for the fixed Reader position (position 2). Leave empty if not used.',
			},
			{
				type: 'textinput',
				id: 'panelistToZoomMapping',
				label: 'Panelist mapping (JSON)',
				width: 12,
				default: '{}',
				required: false,
				tooltip:
					'JSON: Hand UID → Zoom UUID, e.g. {"hand-uid-1":"zoom-uuid-aaa","hand-uid-2":"zoom-uuid-bbb"}. Used by "Set split screen from raised hands". Build via Build panel mapping or enter manually.',
			},
			{
				type: 'static-text',
				id: 'mukana_commands_heading',
				width: 12,
				label: '',
				value: '<strong>Test question & layer sets</strong>',
			},
			{
				type: 'textinput',
				id: 'test_question_match_string',
				label: 'Test question match string',
				width: 6,
				default: 'Test',
				required: false,
				tooltip:
					'When the active question text contains this string, you can run Build Panel Mapping (e.g. via a trigger). Use in trigger condition: variable active_question_comment contains this value. Multiple "commands" = create multiple triggers with different match strings and actions.',
			},
			{
				type: 'static-text',
				id: 'layerSetByHandCountHeading',
				label: 'Layer set by hand count',
				width: 12,
				value: 'Pick layer sets for each hand count (1-8). Leave empty for counts you do not use.',
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount1',
				label: 'Hand count 1',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount2',
				label: 'Hand count 2',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount3',
				label: 'Hand count 3',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount4',
				label: 'Hand count 4',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount5',
				label: 'Hand count 5',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount6',
				label: 'Hand count 6',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount7',
				label: 'Hand count 7',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'layerSetForCount8',
				label: 'Hand count 8',
				width: 6,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				id: 'questionLayerSet',
				label: 'Question layer set',
				width: 12,
				choices: layerSetChoices,
				default: '',
				required: false,
				allowCustom: true,
				tooltip:
					'Layer set endpoint recalled for 2 UP + Q mode. You can override manually with a custom endpoint.',
			},
			{
				type: 'dropdown',
				id: 'questionSplitScreenLayer',
				label: 'Question split-screen layer',
				width: 12,
				choices: splitScreenLayerChoices,
				default: '',
				required: false,
				allowCustom: true,
				tooltip:
					'Optional split-screen layer endpoint used during 2 UP + Q mode. Dropdown shows split-screen layers only; manual endpoint override is allowed.',
			},
			{
				type: 'checkbox',
				id: 'autoLiveEnabled',
				label: 'Auto-live',
				width: 6,
				default: true,
				required: false,
				tooltip: 'When enabled, split-screen actions take layers live automatically after updates (unless action override disables it).',
			},
			{
				type: 'number',
				id: 'autoLiveDelayMs',
				label: 'Auto-live delay (ms)',
				width: 6,
				default: 200,
				min: 0,
				max: 5000,
				required: false,
				tooltip: 'Delay before auto-live to let updates settle. Default: 200ms.',
			},
			{
				type: 'static-text',
				id: 'layout_overrides_heading',
				width: 12,
				label: '',
				value: '<strong>Split Screen layout overrides</strong>',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_1',
				label: 'Layout override: 1 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_2',
				label: 'Layout override: 2 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_3',
				label: 'Layout override: 3 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_4',
				label: 'Layout override: 4 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_5',
				label: 'Layout override: 5 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_6',
				label: 'Layout override: 6 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_7',
				label: 'Layout override: 7 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_8',
				label: 'Layout override: 8 UP',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_1up_s',
				label: 'Layout override: 1 UP + S',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
			{
				type: 'textinput',
				id: 'layoutOverride_2up_q',
				label: 'Layout override: 2 UP + Q',
				width: 12,
				default: '',
				required: false,
				tooltip: '(one line per source, format left,bottom,width,height; use \\n between lines)',
			},
		]
	}

	async destroy() {
		if (this.socket !== undefined) {
			this.socket.destroy()
		}
		if (this.pollApi) {
			clearInterval(this.pollApi)
		}

		this.log('debug', `destroy ${this.id}`)
	}

	async init(config) {
		this.config = config
		log = this.log
		this.port = this.getPortFromConfig(config)

		this.updateStatus(InstanceStatus.Connecting)
		this.updateGotOptions()
		this.initAPI()

		this.initVariables()
		this.initFeedbacks()
		this.initActions()
		this.initPresets()
	}

	/**
	 * INTERNAL: initialize variables.
	 *
	 * @access protected
	 * @since 1.1.0
	 */
	initVariables() {
		this.updateVariableDefinitions()
	}

	/**
	 * Set available feedback choices
	 */
	initFeedbacks() {
		const feedbacks = this.defineFeedbacks()
		this.setFeedbackDefinitions(feedbacks)
	}

	/**
	 * Initialize presets
	 * @param  {} updates
	 */
	initPresets(updates) {
		this.setPresetDefinitions(this.getPresets())
	}

	/**
	 * Set all the actions
	 * @param  {} system
	 */
	initActions(system) {
		this.setActionDefinitions(this.getActions())
	}

	sendCommand(cmd) {
		if (cmd !== undefined && cmd != '') {
			if (this.socket !== undefined && this.socket.connected) {
				this.socket.send(cmd)
			}
		}
	}

	getPortFromConfig(config) {
		const raw = config?.port
		if (raw === undefined || raw === null || raw === '') return 8989
		const p = Number(raw)
		return Number.isFinite(p) && p >= 1 && p <= 65535 ? p : 8989
	}

	async configUpdated(config) {
		let resetConnection = false

		if (this.config.host != config.host || this.getPortFromConfig(this.config) !== this.getPortFromConfig(config)) {
			resetConnection = true
		}

		this.config = config
		this.port = this.getPortFromConfig(config)
		this.updateGotOptions()

		if (resetConnection === true || this.socket === undefined) {
			this.initAPI()
		}
	}
}

runEntrypoint(MimoLiveInstance, [])
