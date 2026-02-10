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

		actions['layerSet'] = {
			name: 'Layer Set Recall',
			options: [
				{
					type: 'textinput',
					label: 'API Endpoint',
					id: 'endpoint',
					default: '',
					tooltip: 'Enter the API endpoint from the layer to control',
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

		actions['setLayerInputValue'] = {
			name: 'Set Layer Input Value',
			description: 'Update layer input-value fields (e.g., text content) using Companion variables',
			options: [
				{
					type: 'textinput',
					label: 'Variant Endpoint',
					id: 'endpoint',
					default: '',
					tooltip:
						'Full API endpoint to layer variant (copy from mimoLive or use format: /api/v1/documents/{docId}/layers/{layerId}/variants/{variantId})',
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

		return actions
	},
}
