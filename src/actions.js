const SPLIT_SCREEN_FIELD_NAMES = [
	'tvIn_VideoSourceAImage',
	'tvIn_VideoSourceBImage',
	'tvIn_VideoSourceCImage',
	'tvIn_VideoSourceDImage',
	'tvIn_VideoSourceEImage',
	'tvIn_VideoSourceFImage',
	'tvIn_VideoSourceGImage',
	'tvIn_VideoSourceHImage',
]

function getVariablePrefix(instance) {
	const prefixChoice = (instance.config && instance.config.variablePrefix) || 'mukana'
	switch (prefixChoice) {
		case 'mukana':
			return 'mukana'
		case 'queondeck':
			return 'QueOnDeck'
		case 'custom':
			return (instance.config && instance.config.customVariablePrefix) || 'mukana'
		default:
			return 'mukana'
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseJsonConfig(instance, key, fallback = {}) {
	try {
		const raw = (instance.config && instance.config[key]) || ''
		if (!raw || String(raw).trim() === '') return fallback
		return JSON.parse(String(raw).trim())
	} catch (e) {
		return fallback
	}
}

function getLayerSetByHandCountConfig(instance) {
	const fromJson = parseJsonConfig(instance, 'layerSetByHandCount', {})
	const merged = { ...fromJson }
	for (let i = 1; i <= 8; i++) {
		const value = String(instance.config?.[`layerSetForCount${i}`] || '').trim()
		if (value) {
			merged[String(i)] = value
		}
	}
	return merged
}

async function performPanelMapping(instance, documentId, handVariables, actionName = 'Panel Mapping') {
	// Validate document
	if (!documentId) {
		instance.log('warning', `${actionName}: No document selected`)
		return { success: false, error: 'No document selected' }
	}
	
	const doc = (instance.documents || []).find((d) => d.id === documentId)
	const zoomSources = (doc && doc.zoomSources) || []
	if (zoomSources.length === 0) {
		instance.log('warning', `${actionName}: No Zoom sources for this document. Connect mimoLive and ensure Zoom Input sources exist.`)
		return { success: false, error: 'No Zoom sources available' }
	}

	// Parse hand variables
	const normalize = (s) => String(s || '').trim().toLowerCase()
	const hands = []
	for (let pos = 1; pos <= 8; pos++) {
		const uidVar = handVariables[`hand_${pos}_uid`] || ''
		const nameVar = handVariables[`hand_${pos}_name`] || ''
		if (!uidVar) continue
		
		const uidRaw = await instance.parseVariablesInString(uidVar)
		const nameRaw = await instance.parseVariablesInString(nameVar)
		const uid = typeof uidRaw === 'string' ? uidRaw.trim() : String(uidRaw || '').trim()
		const name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw || '').trim()
		if (uid) hands.push({ uid, name })
	}
	
	if (hands.length === 0) {
		const variablePrefix = getVariablePrefix(instance)
		instance.log('warning', `${actionName}: No hand UIDs resolved. Check variable references (e.g. $(${variablePrefix}:hand_1_uid)).`)
		return { success: false, error: 'No hand UIDs resolved' }
	}

	// Load existing mapping so we keep manual overrides
	let mapping = {}
	try {
		const raw = (instance.config && instance.config.panelistToZoomMapping) || '{}'
		if (raw && String(raw).trim() !== '') {
			mapping = JSON.parse(String(raw).trim())
		}
	} catch (e) {
		// ignore invalid existing JSON
	}

	// Perform fuzzy matching
	const usedZoomUuids = new Set()
	const mappedUsers = []
	const unmatchedUsers = []
	for (const hand of hands) {
		const nName = normalize(hand.name)
		if (!nName) continue
		// Exact match first
		let match = zoomSources.find((z) => normalize(z.label) === nName && !usedZoomUuids.has(z.uuid))
		if (!match) {
			// Contains (hand name in Zoom label or Zoom label in hand name)
			match = zoomSources.find(
				(z) =>
					!usedZoomUuids.has(z.uuid) &&
					(normalize(z.label).includes(nName) || nName.includes(normalize(z.label)))
			)
		}
		if (match) {
			mapping[hand.uid] = match.uuid
			usedZoomUuids.add(match.uuid)
			mappedUsers.push({ handName: hand.name, handUid: hand.uid, zoomName: match.label, zoomUuid: match.uuid })
			instance.log('debug', `${actionName}: ${hand.name} (${hand.uid}) → ${match.label} (${match.uuid})`)
		} else {
			unmatchedUsers.push({ handName: hand.name, handUid: hand.uid })
			instance.log('debug', `${actionName}: No Zoom match for hand "${hand.name}" (${hand.uid})`)
		}
	}

	// Host = first hand, Reader = second hand (initialization order)
	let newConfig = { ...instance.config, panelistToZoomMapping: JSON.stringify(mapping, null, 2) }
	if (hands.length >= 1 && mapping[hands[0].uid]) {
		newConfig = { ...newConfig, hostZoomUuid: mapping[hands[0].uid] }
		instance.log('debug', `${actionName}: Host (position 1) = ${hands[0].name}`)
	}
	if (hands.length >= 2 && mapping[hands[1].uid]) {
		newConfig = { ...newConfig, readerZoomUuid: mapping[hands[1].uid] }
		instance.log('debug', `${actionName}: Reader (position 2) = ${hands[1].name}`)
	}

	// Save config
	if (typeof instance.saveConfig === 'function') {
		instance.saveConfig(newConfig)
		instance.config = newConfig
		instance.log('info', `${actionName}: Saved ${Object.keys(mapping).length} mappings; Host & Reader set from first two hands.`)
	} else {
		instance.log('info', `${actionName} (copy to config): ${newConfig.panelistToZoomMapping}`)
	}

	return { 
		success: true, 
		mappingCount: Object.keys(mapping).length,
		handsProcessed: hands.length,
		mapping: mapping,
		mappedUsers: mappedUsers,
		unmatchedUsers: unmatchedUsers
	}
}

function coordsLine(left, bottom, width, height) {
	return `${Math.round(left)},${Math.round(bottom)},${Math.round(width)},${Math.round(height)}`
}

function defaultLayoutByKey(key) {
	switch (key) {
		case '1':
			return [coordsLine(960, 540, 1920, 1080)].join('\n')
		case '2':
			return [coordsLine(480, 540, 960, 1080), coordsLine(1440, 540, 960, 1080)].join('\n')
		case '3':
			return [coordsLine(320, 540, 640, 1080), coordsLine(960, 540, 640, 1080), coordsLine(1600, 540, 640, 1080)].join('\n')
		case '4':
			return [
				coordsLine(480, 810, 960, 540),
				coordsLine(1440, 810, 960, 540),
				coordsLine(480, 270, 960, 540),
				coordsLine(1440, 270, 960, 540),
			].join('\n')
		case '5':
			return [
				coordsLine(480, 540, 960, 1080),
				coordsLine(1200, 810, 480, 540),
				coordsLine(1680, 810, 480, 540),
				coordsLine(1200, 270, 480, 540),
				coordsLine(1680, 270, 480, 540),
			].join('\n')
		case '6':
			return [
				coordsLine(320, 810, 640, 540),
				coordsLine(960, 810, 640, 540),
				coordsLine(1600, 810, 640, 540),
				coordsLine(320, 270, 640, 540),
				coordsLine(960, 270, 640, 540),
				coordsLine(1600, 270, 640, 540),
			].join('\n')
		case '7':
			return [
				coordsLine(384, 540, 768, 1080),
				coordsLine(960, 810, 384, 540),
				coordsLine(1344, 810, 384, 540),
				coordsLine(1728, 810, 384, 540),
				coordsLine(960, 270, 384, 540),
				coordsLine(1344, 270, 384, 540),
				coordsLine(1728, 270, 384, 540),
			].join('\n')
		case '8':
			return [
				coordsLine(240, 810, 480, 540),
				coordsLine(720, 810, 480, 540),
				coordsLine(1200, 810, 480, 540),
				coordsLine(1680, 810, 480, 540),
				coordsLine(240, 270, 480, 540),
				coordsLine(720, 270, 480, 540),
				coordsLine(1200, 270, 480, 540),
				coordsLine(1680, 270, 480, 540),
			].join('\n')
		case '1up_s':
			return [coordsLine(430, 540, 810, 1080), coordsLine(1390, 540, 1060, 596)].join('\n')
		case '2up_q':
			return [coordsLine(480, 720, 900, 506), coordsLine(1440, 720, 900, 506)].join('\n')
		default:
			return defaultLayoutByKey('1')
	}
}

function overrideFieldForLayoutKey(layoutKey) {
	if (layoutKey === '1up_s') return 'layoutOverride_1up_s'
	if (layoutKey === '2up_q') return 'layoutOverride_2up_q'
	return `layoutOverride_${layoutKey}`
}

function parseLayoutOverride(raw) {
	const value = String(raw || '').trim()
	if (!value) return ''
	return value.replace(/\\n/g, '\n')
}

function documentIdFromEndpoint(endpoint) {
	const match = /^\/?api\/v1\/documents\/(\d+)\//.exec(String(endpoint || ''))
	return match ? match[1] : ''
}

export default {
	/**
	 * INTERNAL: Get the available actions.
	 */
	getActions: function () {
		let actions = {}

		actions['document'] = {
			name: 'Document Actions',
			description: `Control a Document's live status`,
			options: [
				{
					type: 'textinput',
					label: 'Document (index or API endpoint)',
					id: 'document',
					tooltip: 'Enter an index number, document ID or API endpoint',
					default: '1',
					regex: `/${this.REGEX_DOCUMENT}/`,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'action',
					choices: this.CHOICES_DOCUMENTACTIONS,
					default: 'setLive',
				},
			],
			callback: async (action) => {
				const opt = action.options
				//this.debug('Action options', opt)
				const doc = this.getDocument(opt.document)
				this.sendGetRequest('documents/' + doc.id + '/' + opt.action)
			},
		}

		actions['layer'] = {
			name: 'Layer Actions',
			description: `Control a Layer's live status, cycle through Variants`,
			options: [
				{
					type: 'textinput',
					label: 'Layer (documentIndex,layerIndex or API endpoint)',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the doc,layer index or API endpoint from the layer to control',
					regex: `/${this.REGEX_LAYER}/`,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'action',
					choices: this.CHOICES_LAYERACTIONS,
					default: 'setLive',
				},
			],
			callback: async (action) => {
				let opt = action.options
				//this.debug('Action options', opt)
				const layer = this.getLayer(opt.endpoint)
				this.sendGetRequest(`documents/${layer.document}/layers/${layer.id}/${opt.action}`)
			},
		}

		actions['variant'] = {
			name: 'Variant Actions',
			description: `Control a Variant's live status`,
			options: [
				{
					type: 'textinput',
					label: 'API Endpoint',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the API endpoint from the variant to control',
					regex: `/${this.REGEX_VARIANT}/`,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'action',
					choices: this.CHOICES_VARIANTACTIONS,
					default: 'setLive',
				},
			],
			callback: async (action) => {
				let opt = action.options
				//this.debug('Action options', opt)
				this.sendGetRequest(opt.endpoint + '/' + opt.action)
			},
		}

		// Build layer set dropdown choices: document › layer set name
		const layerSetChoices = []
		;(this.documents || []).forEach((doc) => {
			(doc.layerSets || []).forEach((set) => {
				layerSetChoices.push({
					id: `/api/v1/documents/${doc.id}/layer-sets/${set.id}`,
					label: `${doc.label} › ${set.label}`,
				})
			})
		})
		if (layerSetChoices.length === 0) {
			layerSetChoices.push({ id: '', label: '(Connect to mimoLive to see layer sets)' })
		}

		actions['layerSet'] = {
			name: 'Layer Set Recall',
			options: [
				{
					type: 'dropdown',
					label: 'Layer Set',
					id: 'endpoint',
					choices: layerSetChoices,
					default: layerSetChoices[0]?.id ?? '',
					tooltip: 'Select a layer set to recall',
					allowCustom: true,
					regex: `/${this.REGEX_LAYERSET}/`,
				},
			],
			callback: async (action) => {
				this.sendGetRequest(action.options.endpoint + '/recall')
			},
		}

		actions['output'] = {
			name: 'Output Actions',
			description: `Control an Output's live status`,
			options: [
				{
					type: 'textinput',
					label: 'API Endpoint',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the API endpoint from the layer to control',
					regex: `/${this.REGEX_OUTPUT}/`,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'action',
					choices: this.CHOICES_OUTPUTACTIONS,
					default: 'setLive',
				},
			],
			callback: async (action) => {
				const opt = action.options
				if (opt.action == 'toggleLive') {
					output = this.getOutput(opt.endpoint)
					switch (output.liveState) {
						case 'live':
							this.sendGetRequest(opt.endpoint + '/setOff')
							break
						case 'preview':
							this.sendGetRequest(opt.endpoint + '/setLive')
							break
					}
					return
				}

				this.sendGetRequest(opt.endpoint + '/' + opt.action)
			},
		}

		actions['audioLayer'] = {
			name: 'Audio - Set Layer Volume',
			description: 'Set or adjust the volume of a layer',
			options: [
				{
					type: 'textinput',
					label: 'Layer (documentIndex,layerIndex or API endpoint)',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the doc,layer index or API endpoint from the layer to control',
					regex: `/${this.REGEX_LAYER}/`,
				},
				{
					type: 'dropdown',
					label: 'Adjustment',
					id: 'adjustment',
					choices: this.CHOICES_AUDIOADJUSTMENT,
					default: 'set',
				},
				{
					type: 'textinput',
					label: 'Volume',
					id: 'volume',
					default: '100',
					tooltip: 'Volume range is 0-100. Enter a number of variable',
				},
			],
			callback: async (action) => {
				const opt = action.options
				const layer = this.getLayer(opt.endpoint)
				const vol = await this.parseVariablesInString(opt.volume)
				let newVol
				switch (opt.adjustment) {
					case 'increase':
						newVol = layer.volume + parseFloat(vol) / 100
						break
					case 'decrease':
						newVol = layer.volume - parseFloat(vol) / 100
						break
					default:
						newVol = parseFloat(vol) / 100
						break
				}
				const payload = { volume: newVol }
				this.sendPutRequest(`documents/${layer.document}/layers/${layer.id}`, payload)
				//			layer.volume = newVol
				const parentDoc = this.documents.find((element) => element.id === layer.document)
				parentDoc.layers[layer.index].volume = newVol
			},
		}

		actions['endpoint'] = {
			name: 'Generic Endpoint',
			description: 'Trigger any API endpoint from your document',
			options: [
				{
					type: 'textinput',
					label: 'API Endpoint',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the API endpoint to trigger',
					regex: `/${this.REGEX_ENDPOINT}/`,
				},
			],
			callback: async (action) => {
				const opt = action.options
				this.log('debug', `Endpoint: ${opt.endpoint}`)
				this.sendGetRequest(opt.endpoint)
			},
		}

		// Build variant/layer dropdown choices: layers with 2+ variants show nested variant options;
		// layers with 0 or 1 variant use the layer endpoint directly (mimoLive API returns a default
		// variant for every layer, so length===1 does not mean user-visible variants).
		const variantChoices = []
		;(this.documents || []).forEach((doc) => {
			const layers = (doc.layers || []).filter(Boolean)
			layers
				.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
				.forEach((layer) => {
					const docLayerLabel = `${doc.label} › ${layer.label}`
					if (layer.variants && layer.variants.length > 1) {
						// Layer has multiple variants: only variants are selectable, show nested with indent
						layer.variants.forEach((variant) => {
							variantChoices.push({
								id: `/api/v1/documents/${doc.id}/layers/${layer.id}/variants/${variant.id}`,
								label: `  ${docLayerLabel} › ${variant.label}`,
							})
						})
					} else {
						// Layer has 0 or 1 variant: use layer endpoint (no /variants/ in path)
						variantChoices.push({
							id: `/api/v1/documents/${doc.id}/layers/${layer.id}`,
							label: docLayerLabel,
						})
					}
				})
		})
		if (variantChoices.length === 0) {
			variantChoices.push({ id: '', label: '(Connect to mimoLive to see layers)' })
		}

		actions['setLayerInputValue'] = {
			name: 'Set Layer Input Value',
			description: 'Update layer input-value fields (e.g., text content) using Companion variables',
			options: [
				{
					type: 'dropdown',
					label: 'Variant',
					id: 'endpoint',
					choices: variantChoices,
					default: variantChoices[0]?.id ?? '',
					tooltip:
						'Select a layer (no variants) or layer variant. Layers with variants show their variants indented; only variants are selectable.',
					allowCustom: true,
					regex: `/${this.REGEX_VARIANT}/`,
				},
				{
					type: 'textinput',
					label: 'Input Field Name',
					id: 'fieldName',
					default: 'tvGroup_Content__Text_TypeMultiline',
					tooltip: 'Common fields: tvGroup_Content__Text_TypeMultiline (for most text layers)',
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					default: '$(mukana:active_question_username)',
					tooltip:
						'Text or Companion variables. For News Crawl layers, use | and \\n separators (e.g., "Title 1|Description 1\\nTitle 2|Description 2")',
					useVariables: true,
				},
			],
			callback: async (action) => {
				const opt = action.options

				// Validate variant endpoint
				if (!opt.endpoint || opt.endpoint === '') {
					this.log('warning', 'Set Layer Input Value: No variant endpoint specified')
					return
				}

				// Validate field name
				if (!opt.fieldName || opt.fieldName === '') {
					this.log('warning', 'Set Layer Input Value: No field name specified')
					return
				}

				// Parse variables in the value field
				const resolvedValue = await this.parseVariablesInString(opt.value)

				this.log('debug', `Setting ${opt.fieldName} to: ${resolvedValue}`)

				// Send the update request
				this.sendUpdateRequest(opt.endpoint, opt.fieldName, resolvedValue)
			},
		}

		// Zoom source choices for Set Split Screen Sources (all documents)
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
		const setSplitScreenOptions = [
			{
				type: 'dropdown',
				label: 'Split Screen Variant',
				id: 'endpoint',
				choices: variantChoices,
				default: variantChoices[0]?.id ?? '',
				tooltip: 'Select the split-screen layer variant to update',
				allowCustom: true,
				regex: `/${this.REGEX_VARIANT}/`,
			},
		]
		for (let pos = 1; pos <= 8; pos++) {
			const letter = String.fromCharCode(64 + pos) // A..H
			setSplitScreenOptions.push({
				type: 'dropdown',
				label: `Position ${pos} (${letter})`,
				id: `source${pos}`,
				choices: zoomSourceChoices,
				default: '',
				tooltip: `Zoom source for split-screen position ${pos}`,
			})
		}
		actions['setSplitScreenSources'] = {
			name: 'Set Split Screen Sources',
			description: 'Set Zoom sources for each split-screen position (A–H). Uses Zoom sources from the document.',
			options: setSplitScreenOptions,
			callback: async (action) => {
				const opt = action.options
				if (!opt.endpoint || opt.endpoint === '') {
					this.log('warning', 'Set Split Screen Sources: No variant endpoint specified')
					return
				}

				const applyResolvedUpdate = async () => {
					for (let pos = 1; pos <= 8; pos++) {
						const uuid = opt[`source${pos}`] || ''
						const fieldName = SPLIT_SCREEN_FIELD_NAMES[pos - 1]
						this.log('debug', `Set Split Screen: position ${pos} (${fieldName}) = ${uuid}`)
						await this.sendUpdateRequest(opt.endpoint, fieldName, uuid)
					}

					if (this.config?.autoLiveEnabled !== false) {
						const delay = Number.isFinite(Number(this.config?.autoLiveDelayMs))
							? Math.max(0, Number(this.config.autoLiveDelayMs))
							: 200
						await sleep(delay)
						await this.sendGetRequest(`${opt.endpoint}/setLive`)
					}
				}

				const liveState = await this.getEndpointLiveState(opt.endpoint)
				if (liveState === 'live') {
					this.log('info', `Set Split Screen Sources: target is live, queueing latest update for ${opt.endpoint}`)
					this.queueLatestWhenNotLive(`split:${opt.endpoint}`, opt.endpoint, applyResolvedUpdate)
					return
				}

				await applyResolvedUpdate()
			},
		}

		// Set split screen from raised hands: role-aware source selection + optional layer-set recall + optional custom layout
		const setFromMukanaOptions = [
			{
				type: 'dropdown',
				label: 'Split Screen Variant',
				id: 'endpoint',
				choices: variantChoices,
				default: variantChoices[0]?.id ?? '',
				tooltip: 'Select the split-screen layer variant to update',
				allowCustom: true,
				regex: `/${this.REGEX_VARIANT}/`,
			},
			{
				type: 'dropdown',
				label: 'By hand count mode',
				id: 'byHandCountMode',
				default: 'applyCustomLayout',
				choices: [
					{ id: 'none', label: 'None' },
					{ id: 'recallLayerSet', label: 'Recall layer set by hand count' },
					{ id: 'applyCustomLayout', label: 'Apply custom layout by hand count' },
				],
				tooltip: 'Choose how hand count affects layout before sources are assigned.',
			},
			{
				type: 'dropdown',
				label: 'Layout profile',
				id: 'layoutProfile',
				default: 'auto',
				choices: [
					{ id: 'auto', label: 'Auto (from participant count)' },
					{ id: '1up_s', label: '1 UP + S' },
					{ id: '2up_q', label: '2 UP + Q (question layer-set flow)' },
				],
				tooltip: 'Override layout family. 2 UP + Q recalls question layer set mapping.',
			},
			{
				type: 'checkbox',
				label: 'Include Host (position A)',
				id: 'includeHost',
				default: false,
			},
			{
				type: 'checkbox',
				label: 'Include Reader (position B)',
				id: 'includeReader',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Auto-live',
				id: 'autoLiveMode',
				default: 'useConfig',
				choices: [
					{ id: 'useConfig', label: 'Use config default' },
					{ id: 'forceOn', label: 'Force enabled' },
					{ id: 'forceOff', label: 'Force disabled' },
				],
				tooltip: 'Config default is enabled. You can force on/off per action.',
			},
			{
				type: 'number',
				label: 'Auto-live delay override (ms, optional)',
				id: 'autoLiveDelayMs',
				default: 200,
				min: 0,
				max: 5000,
				tooltip: 'Overrides config delay for this action run.',
			},
			{
				type: 'textinput',
				label: 'Hand count variable',
				id: 'handCountVariable',
				default: `$(${getVariablePrefix(this)}:hand_count_total)`,
				tooltip: 'Variable for current hand count (e.g. hand_count_total). Used only when "Recall layer set by hand count" is enabled.',
				useVariables: true,
			},
		]
		const variablePrefixForHands = getVariablePrefix(this)
		for (let pos = 1; pos <= 8; pos++) {
			setFromMukanaOptions.push({
				type: 'textinput',
				label: `Hand ${pos} UID (variable)`,
				id: `hand_${pos}_uid`,
				default: pos === 1 ? `$(${variablePrefixForHands}:hand_${pos}_uid)` : '',
				tooltip: `Companion variable for hand ${pos} UID, e.g. $(${variablePrefixForHands}:hand_${pos}_uid)`,
				useVariables: true,
			})
		}
		actions['setSplitScreenFromMukanaHands'] = {
			name: 'Set split screen from raised hands',
			description:
				'Resolve host/reader + panelists from payload variables, optionally recall mapped layer sets, apply split-screen layout, and update sources with live-safe queue + optional auto-live.',
			options: setFromMukanaOptions,
			callback: async (action) => {
				const opt = action.options
				if (!opt.endpoint || opt.endpoint === '') {
					this.log('warning', 'Set split screen from raised hands: No variant endpoint specified')
					return
				}

				const mapping = parseJsonConfig(this, 'panelistToZoomMapping', {})
				const layerSetByHandCount = getLayerSetByHandCountConfig(this)
				const questionLayerSetByDocument = parseJsonConfig(this, 'questionLayerSetByDocument', {})
				const questionSplitScreenLayerByDocument = parseJsonConfig(this, 'questionSplitScreenLayerByDocument', {})

				// Build panelist list from raised hands variables; order is stable by hand slot index.
				const panelistZoomUuids = []
				for (let pos = 1; pos <= 8; pos++) {
					const uidRaw = await this.parseVariablesInString(opt[`hand_${pos}_uid`] || '')
					const uid = typeof uidRaw === 'string' ? uidRaw.trim() : String(uidRaw || '').trim()
					if (!uid) continue
					const zoomUuid = mapping[uid]
					if (!zoomUuid) {
						this.log('debug', `Set Split Screen from Mukana: no mapping for hand ${pos} UID ${uid}`)
						continue
					}
					panelistZoomUuids.push(zoomUuid)
				}

				const hostUuid = opt.includeHost ? String((this.config && this.config.hostZoomUuid) || '').trim() : ''
				const readerUuid = opt.includeReader ? String((this.config && this.config.readerZoomUuid) || '').trim() : ''
				if (opt.includeHost && !hostUuid) {
					this.log('warning', 'Set Split Screen from Mukana: Include Host is enabled but Host Zoom UUID is empty')
				}
				if (opt.includeReader && !readerUuid) {
					this.log('warning', 'Set Split Screen from Mukana: Include Reader is enabled but Reader Zoom UUID is empty')
				}

				const reservedSlots = (hostUuid ? 1 : 0) + (readerUuid ? 1 : 0)
				const panelSlots = Math.max(0, 8 - reservedSlots)
				// Overflow rule: newest_hands_first drop => keep earliest/stable slots first.
				const visiblePanelists = panelistZoomUuids.slice(0, panelSlots)
				const droppedPanelists = Math.max(0, panelistZoomUuids.length - visiblePanelists.length)
				if (droppedPanelists > 0) {
					this.log('info', `Set Split Screen from Mukana: dropped ${droppedPanelists} newest panelist(s) to stay within 8 sources`)
				}

				let orderedSources = []
				if (hostUuid) orderedSources.push(hostUuid)
				if (readerUuid) orderedSources.push(readerUuid)
				orderedSources = orderedSources.concat(visiblePanelists)

				// Special profile: 2 UP + Q uses explicit question layer-set mapping.
				let effectiveEndpoint = opt.endpoint
				const profile = String(opt.layoutProfile || 'auto')
				const docId = documentIdFromEndpoint(opt.endpoint)
				const questionLayerSetEndpoint = (docId && questionLayerSetByDocument[docId]) || String(this.config?.questionLayerSet || '').trim()
				if (profile === '2up_q') {
					if (!docId) {
						this.log('warning', 'Set Split Screen from Mukana: Cannot resolve document ID from endpoint for 2 UP + Q')
						return
					}
					if (!questionLayerSetEndpoint) {
						this.log('warning', `Set Split Screen from Mukana: No question layer-set mapping for document ${docId}`)
						return
					}
					const mappedSplitEndpoint =
						(docId && questionSplitScreenLayerByDocument[docId]) || String(this.config?.questionSplitScreenLayer || '').trim()
					if (mappedSplitEndpoint) {
						effectiveEndpoint = mappedSplitEndpoint
					}
					// 2 UP + Q split-screen should show the two people only; question graphics are separate layers.
					orderedSources = orderedSources.slice(0, 2)
				}

				if (orderedSources.length === 0) {
					this.log('warning', 'Set Split Screen from Mukana: No sources resolved (host/reader/panelists)')
					return
				}

				let layoutKey = String(Math.max(1, Math.min(8, orderedSources.length)))
				if (profile === '1up_s' || profile === '2up_q') {
					layoutKey = profile
				}

				const byHandCountMode = String(opt.byHandCountMode || 'none')
				const countRaw = await this.parseVariablesInString(opt.handCountVariable || '')
				const handCount = Math.max(0, parseInt(String(countRaw || '0').trim(), 10) || 0)

				// Auto-live: default enabled from config, with action-level override.
				let autoLiveEnabled = this.config?.autoLiveEnabled !== false
				const autoLiveMode = String(opt.autoLiveMode || 'useConfig')
				if (autoLiveMode === 'forceOn') autoLiveEnabled = true
				if (autoLiveMode === 'forceOff') autoLiveEnabled = false
				const delayOverride = Number(opt.autoLiveDelayMs)
				const configDelay = Number(this.config?.autoLiveDelayMs)
				const autoLiveDelayMs = Number.isFinite(delayOverride)
					? Math.max(0, delayOverride)
					: Number.isFinite(configDelay)
						? Math.max(0, configDelay)
						: 200

				const applyResolvedUpdate = async () => {
					// Optional: recall question layer set first
					if (profile === '2up_q' && questionLayerSetEndpoint) {
						this.log('info', `Set Split Screen from Mukana: recalling question layer set for doc ${docId}`)
						await this.sendGetRequest(`${questionLayerSetEndpoint}/recall`)
					}

					// Optional: recall generic layer set by hand count
					if (byHandCountMode === 'recallLayerSet') {
						let chosenEndpoint = layerSetByHandCount[String(handCount)]
						if (!chosenEndpoint && handCount > 0) {
							const counts = Object.keys(layerSetByHandCount)
								.map((k) => parseInt(k, 10))
								.filter((n) => !Number.isNaN(n) && n <= handCount)
								.sort((a, b) => b - a)
							if (counts.length > 0) {
								chosenEndpoint = layerSetByHandCount[String(counts[0])]
							}
						}
						if (chosenEndpoint) {
							this.log('info', `Set Split Screen from Mukana: recalling layer set for hand count ${handCount}`)
							await this.sendGetRequest(`${chosenEndpoint}/recall`)
						}
					}

					// Apply custom layout suggestion/override
					if (byHandCountMode === 'applyCustomLayout' || profile === '1up_s' || profile === '2up_q') {
						const overrideField = overrideFieldForLayoutKey(layoutKey)
						const overrideLayout = parseLayoutOverride(this.config?.[overrideField])
						const layoutString = overrideLayout || defaultLayoutByKey(layoutKey)
						const sourceCount = Math.max(1, Math.min(8, orderedSources.length))
						await this.sendUpdateRequest(effectiveEndpoint, 'tvGroup_Control__Layout', 0)
						await this.sendUpdateRequest(effectiveEndpoint, 'tvGroup_Control__Source_Count', String(sourceCount))
						await this.sendUpdateRequest(effectiveEndpoint, 'tvGroup_Control__Layout_Data_TypeMultiline', layoutString)
					}

					for (let pos = 1; pos <= 8; pos++) {
						const fieldName = SPLIT_SCREEN_FIELD_NAMES[pos - 1]
						const value = orderedSources[pos - 1] || ''
						await this.sendUpdateRequest(effectiveEndpoint, fieldName, value)
					}

					if (autoLiveEnabled) {
						await sleep(autoLiveDelayMs)
						await this.sendGetRequest(`${effectiveEndpoint}/setLive`)
					}
				}

				const liveState = await this.getEndpointLiveState(effectiveEndpoint)
				if (liveState === 'live') {
					this.log('info', `Set Split Screen from Mukana: target is live, queueing latest update for ${effectiveEndpoint}`)
					this.queueLatestWhenNotLive(`split:${effectiveEndpoint}`, effectiveEndpoint, applyResolvedUpdate)
					return
				}

				await applyResolvedUpdate()
			},
		}

		// Build panel mapping: read hand UID/name from variables, fuzzy-match to Zoom sources, save mapping to config
		const documentChoices = (this.documents || []).map((doc) => ({ id: doc.id, label: doc.label }))
		if (documentChoices.length === 0) {
			documentChoices.push({ id: '', label: '(Connect to mimoLive to see documents)' })
		}
		const buildMappingOptions = [
			{
				type: 'dropdown',
				label: 'Document (Zoom sources from)',
				id: 'documentId',
				choices: documentChoices,
				default: documentChoices[0]?.id ?? '',
				tooltip: 'Use Zoom sources from this document for name matching',
			},
		]
		const variablePrefixForMapping = getVariablePrefix(this)
		for (let pos = 1; pos <= 8; pos++) {
			buildMappingOptions.push(
				{
					type: 'textinput',
					label: `Hand ${pos} UID`,
					id: `hand_${pos}_uid`,
					default: pos === 1 ? `$(${variablePrefixForMapping}:hand_${pos}_uid)` : '',
					tooltip: `Variable for hand ${pos} UID, e.g. $(${variablePrefixForMapping}:hand_${pos}_uid)`,
					useVariables: true,
				},
				{
					type: 'textinput',
					label: `Hand ${pos} Name`,
					id: `hand_${pos}_name`,
					default: pos === 1 ? `$(${variablePrefixForMapping}:hand_${pos}_name)` : '',
					tooltip: `Variable for hand ${pos} name (used for fuzzy match), e.g. $(${variablePrefixForMapping}:hand_${pos}_name)`,
					useVariables: true,
				}
			)
		}
		actions['buildPanelMapping'] = {
			name: 'Build Panel Mapping',
			description:
				'Read hand UIDs and names from variables, fuzzy-match to Zoom sources, and save hand UID → Zoom UUID mapping to config. Re-run when panelists change.',
			options: buildMappingOptions,
			callback: async (action) => {
				const opt = action.options
				const handVariables = {}
				for (let pos = 1; pos <= 8; pos++) {
					handVariables[`hand_${pos}_uid`] = opt[`hand_${pos}_uid`] || ''
					handVariables[`hand_${pos}_name`] = opt[`hand_${pos}_name`] || ''
				}
				const result = await performPanelMapping(this, opt.documentId, handVariables, 'Build Panel Mapping')
				
				// Log mapped users for regular Build Panel Mapping too
				if (result && result.success) {
					if (result.mappedUsers && result.mappedUsers.length > 0) {
						this.log('info', `Build Panel Mapping: Mapped users:`)
						result.mappedUsers.forEach((user, index) => {
							const role = index === 0 ? ' (Host)' : index === 1 ? ' (Reader)' : ''
							this.log('info', `  ${index + 1}. ${user.handName} → ${user.zoomName}${role}`)
						})
					}
					
					if (result.unmatchedUsers && result.unmatchedUsers.length > 0) {
						this.log('warning', `Build Panel Mapping: Unmatched users:`)
						result.unmatchedUsers.forEach((user, index) => {
							this.log('warning', `  ${index + 1}. ${user.handName} (no Zoom match found)`)
						})
					}
				}
			},
		}

		// Set Host+Reader: set split-screen positions 1 and 2 from config (Host Zoom UUID, Reader Zoom UUID)
		actions['setHostReader'] = {
			name: 'Set Split Screen Host+Reader',
			description: 'Set split-screen positions 1 and 2 to Host and Reader Zoom UUIDs from config. Use after Layer Set Recall for Host+Reader layout.',
			options: [
				{
					type: 'dropdown',
					label: 'Split Screen Variant',
					id: 'endpoint',
					choices: variantChoices,
					default: variantChoices[0]?.id ?? '',
					tooltip: 'Select the split-screen layer variant',
					allowCustom: true,
					regex: `/${this.REGEX_VARIANT}/`,
				},
			],
			callback: async (action) => {
				const opt = action.options
				if (!opt.endpoint || opt.endpoint === '') {
					this.log('warning', 'Set Split Screen Host+Reader: No variant endpoint specified')
					return
				}
				const hostUuid = (this.config && this.config.hostZoomUuid) || ''
				const readerUuid = (this.config && this.config.readerZoomUuid) || ''

				const applyResolvedUpdate = async () => {
					if (hostUuid) {
						await this.sendUpdateRequest(opt.endpoint, SPLIT_SCREEN_FIELD_NAMES[0], hostUuid)
					}
					if (readerUuid) {
						await this.sendUpdateRequest(opt.endpoint, SPLIT_SCREEN_FIELD_NAMES[1], readerUuid)
					}
					if (this.config?.autoLiveEnabled !== false) {
						const delay = Number.isFinite(Number(this.config?.autoLiveDelayMs))
							? Math.max(0, Number(this.config.autoLiveDelayMs))
							: 200
						await sleep(delay)
						await this.sendGetRequest(`${opt.endpoint}/setLive`)
					}
				}

				if (!hostUuid && !readerUuid) {
					this.log(
						'warning',
						'Set Split Screen Host+Reader: No Host or Reader Zoom UUID in config. Run Build Panel Mapping first (first two hands = Host, Reader).'
					)
					return
				}

				const liveState = await this.getEndpointLiveState(opt.endpoint)
				if (liveState === 'live') {
					this.log('info', `Set Split Screen Host+Reader: target is live, queueing latest update for ${opt.endpoint}`)
					this.queueLatestWhenNotLive(`split:${opt.endpoint}`, opt.endpoint, applyResolvedUpdate)
					return
				}

				await applyResolvedUpdate()
			},
		}

		// Auto Build Panel Mapping: read active question and automatically build mapping
		const autoBuildMappingOptions = [
			{
				type: 'dropdown',
				label: 'Document (Zoom sources from)',
				id: 'documentId',
				choices: documentChoices,
				default: documentChoices[0]?.id ?? '',
				tooltip: 'Use Zoom sources from this document for name matching',
			},
			{
				type: 'checkbox',
				label: 'Auto-configure variables',
				id: 'autoConfigureVariables',
				default: true,
				tooltip: 'Automatically use the configured variable prefix for hand variables (recommended)',
			},
		]

		actions['autoBuildPanelMapping'] = {
			name: 'Auto Build Panel Mapping',
			description:
				'Read current active question and automatically build hand-to-Zoom mapping using configured variable source. One-click operation with smart defaults.',
			options: autoBuildMappingOptions,
			callback: async (action) => {
				const opt = action.options
				const variablePrefix = getVariablePrefix(this)
				
				// Read the current active question
				const activeQuestionVar = `$(${variablePrefix}:active_question_comment)`
				let currentQuestion = ''
				try {
					const questionRaw = await this.parseVariablesInString(activeQuestionVar)
					currentQuestion = typeof questionRaw === 'string' ? questionRaw.trim() : String(questionRaw || '').trim()
				} catch (e) {
					this.log('warning', `Auto Build Panel Mapping: Could not read active question variable ${activeQuestionVar}`)
				}

				// Log the current question for reference
				if (currentQuestion) {
					this.log('info', `Auto Build Panel Mapping: Current question: "${currentQuestion}"`)
				} else {
					this.log('info', `Auto Build Panel Mapping: No active question detected (${activeQuestionVar})`)
				}

				// Auto-configure hand variables if enabled
				const handVariables = {}
				if (opt.autoConfigureVariables !== false) {
					for (let pos = 1; pos <= 8; pos++) {
						handVariables[`hand_${pos}_uid`] = `$(${variablePrefix}:hand_${pos}_uid)`
						handVariables[`hand_${pos}_name`] = `$(${variablePrefix}:hand_${pos}_name)`
					}
					this.log('debug', `Auto Build Panel Mapping: Using auto-configured variables with prefix "${variablePrefix}"`)
				} else {
					this.log('warning', 'Auto Build Panel Mapping: Auto-configure variables is disabled, no hand variables configured')
					return
				}

				// Perform the mapping using shared logic
				const result = await performPanelMapping(this, opt.documentId, handVariables, 'Auto Build Panel Mapping')
				
				if (result.success) {
					this.log('info', `Auto Build Panel Mapping: Successfully processed ${result.handsProcessed} hands, created ${result.mappingCount} mappings`)
					
					// Log mapped users
					if (result.mappedUsers && result.mappedUsers.length > 0) {
						this.log('info', `Auto Build Panel Mapping: Mapped users:`)
						result.mappedUsers.forEach((user, index) => {
							const role = index === 0 ? ' (Host)' : index === 1 ? ' (Reader)' : ''
							this.log('info', `  ${index + 1}. ${user.handName} → ${user.zoomName}${role}`)
						})
					}
					
					// Log unmatched users
					if (result.unmatchedUsers && result.unmatchedUsers.length > 0) {
						this.log('warning', `Auto Build Panel Mapping: Unmatched users:`)
						result.unmatchedUsers.forEach((user, index) => {
							this.log('warning', `  ${index + 1}. ${user.handName} (no Zoom match found)`)
						})
					}
					
					if (currentQuestion) {
						this.log('info', `Auto Build Panel Mapping: Triggered by question: "${currentQuestion}"`)
					}
				}
			},
		}

		return actions
	},
}
