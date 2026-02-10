import { InstanceStatus } from '@companion-module/base'
import got, { Options } from 'got'
import WebSocket from 'ws'

export default {
	initAPI: function () {
		if (this.socket) {
			this.socket.close()
			delete this.socket
		}
		if (this.pollApi) {
			clearInterval(this.pollApi)
			delete this.pollApi
		}

		const retrySocket = () => {
			const ws = this.socket

			// ping server every 15 seconds to keep connection open
			try {
				// readyState 2 = CLOSING, readyState 3 = CLOSED
				if (!ws || ws.readyState == 2 || ws.readyState == 3) {
					if (this.config.host && this.config.host !== '') {
						startSocket()
					}
				}
				// readyState 1 = OPEN
				else if (ws.readyState == 1) {
					ws.send('keep alive')
				}
			} catch (err) {
				this.log('debug', `Error with handling socket ${JSON.stringify(err)}`)
			}
		}

		/**
		 * Create a WebSocket connection
		 */
		const startSocket = () => {
			const url = 'ws://' + this.config.host + ':' + this.port + '/api/v1/socket'
			this.log('debug', `Connecting to server ${url}`)
			this.log('debug', 'New websocket')
			this.socket = new WebSocket(url)

			this.socket.on('open', () => {
				this.updateStatus(InstanceStatus.Ok, 'Connected')
				this.log('debug', 'Connection to websocket established')
				this.sendGetRequest('documents')
			})

			this.socket.on('message', (msg) => {
				const message = JSON.parse(msg)
				// this.log('debug', `Message received: ${message.type} ${message.event}`)
				let parentDocument

				switch (message.type) {
					case 'documents':
						// this.debug('Document:', message)
						const docIndex = this.documents.findIndex((doc) => doc.id === message.id)
						switch (message.event) {
							case 'added':
								this.log('debug', 'Document added:' + message.data.attributes.name)
								// Check the document doesn't already exist
								if (!this.documents.find((element) => element.id === message.id)) {
									this.documents.push({
										id: message.id,
										label: message.data.attributes.name,
										liveState: message.data.attributes['live-state'],
										layers: [],
										layerSets: [],
										outputs: [],
									})
									this.sendGetRequest(`documents/${message.id}/layers`)
								}
								this.updateVariableDefinitions()
								break
							case 'changed':
								// this.log('debug', 'Document changed: ' + message.data.attributes.name)

								if (docIndex >= 0) {
									this.documents[docIndex].label = message.data.attributes.name
									this.documents[docIndex].liveState = message.data.attributes['live-state']

									// this.debug('Changed document:', this.documents[docIndex])
									this.updateStatusVariables(docIndex)
									this.checkFeedbacks('documentStatus')
								}
								break
							case 'removed':
								this.log('debug', 'Document removed')
								this.clearLayerVariables(docIndex) // Clear out variables before we remove them
								this.documents.splice(docIndex, 1)
								this.updateVariableDefinitions()
								this.checkFeedbacks('documentStatus')
								break
						}
						break

					case 'layers':
						// console.log('Message payload:', message)
						let layerIndex
						switch (message.event) {
							case 'added':
							case 'changed':
								let parentDocument = this.documents.find(
									(element) => element.id === message.data.relationships.document.data.id
								)
								layerIndex = message.data.attributes.index
								if (parentDocument.layers[layerIndex] == undefined) {
									parentDocument.layers[layerIndex] = {
										id: message.id,
										label: message.data.attributes.name,
										document: parentDocument.id,
										variants: [],
										activeVariant: message.data.relationships['active-variant'].data.id,
										liveState: message.data.attributes['live-state'],
										volume: message.data.attributes['volume'],
										index: message.data.attributes.index,
									}
								} else {
									parentDocument.layers[layerIndex].id = message.id
									parentDocument.layers[layerIndex].label = message.data.attributes.name
									parentDocument.layers[layerIndex].activeVariant = message.data.relationships['active-variant'].data.id
									parentDocument.layers[layerIndex].liveState = message.data.attributes['live-state']
									parentDocument.layers[layerIndex].volume = message.data.attributes['volume']
									parentDocument.layers[layerIndex].index = message.data.attributes.index
								}
								this.log('debug', `Layer: ${message.data.attributes.name} is ${message.data.attributes['live-state']}`)
								this.updateLayerVariables()
								this.checkFeedbacks('layerStatus')
								break
							case 'removed':
								let doc
								for (doc in this.documents) {
									this.log('debug', `doc: ${doc} ${typeof doc}`)
									let layerIndex = this.documents[doc].layers.findIndex((element) => element.id === message.id)
									if (layerIndex >= 0) {
										this.clearLayerVariables(parseInt(doc), layerIndex) // Clear out variable before we remove them
										this.documents[doc].layers.splice(layerIndex, 1)
										this.checkFeedbacks('layerStatus')
										this.updateVariableDefinitions()
									}
								}
								break
						}
						break

					case 'variants':
						console.log('Message payload:', message)
						switch (message.event) {
							case 'added':
								try {
									let layer = this.getLayer(message.data.relationships.layer.links.related)
									if (layer) {
										layer.variants.push({
											id: message.id,
											label: message.data.attributes.name,
											liveState: message.data.attributes['live-state'],
										})
									}
								} catch (err) {
									this.log('error', 'Error adding variant' + JSON.stringify(err))
								}
								break
							case 'changed':
								try {
									let layer = this.getLayer(message.data.relationships.layer.links.related)
									let variant = layer.variants.find((element) => element.id === message.data.id)
									if (variant) {
										variant.label = message.data.attributes.name
										variant.liveState = message.data.attributes['live-state']
										this.checkFeedbacks('variantStatus')
									}
								} catch (err) {
									this.log('error', 'Error changing variant' + JSON.stringify(err))
								}
								break
							case 'removed':
								try {
									let doc
									for (doc in this.documents) {
										let layer
										for (layer in this.documents[doc].layers) {
											let variantIndex = this.documents[doc].layers[layer].variants.findIndex(
												(v) => v.id === message.id
											)
											if (variantIndex >= 0) {
												this.documents[doc].layers[layer].variants.splice(variantIndex, 1)
												this.checkFeedbacks('variantStatus')
											}
										}
									}
								} catch (err) {
									this.log('error', 'Error removing variant' + JSON.stringify(err))
								}
								break
						}
						break

					case 'layer-sets':
						// this.debug('Message payload:', message)
						switch (message.event) {
							case 'added':
							case 'changed':
								let parentDocument = this.documents.find(
									(element) => element.id === message.data.relationships.document.data.id
								)
								if (parentDocument == undefined) {
									break
								}
								let setIndex = parentDocument.layerSets.findIndex((e) => e.id === message.id)
								if (setIndex >= 0) {
									parentDocument.layerSets.splice(setIndex, 1)
								}
								parentDocument.layerSets.push({
									id: message.id,
									label: message.data.attributes.name,
									active: message.data.attributes.active,
								})
								this.checkFeedbacks('layerSetStatus')
								break
							case 'removed':
								let doc
								for (doc in this.documents) {
									let setIndex = this.documents[doc].layerSets.findIndex((element) => element.id === message.id)
									if (setIndex >= 0) {
										this.documents[doc].layers.splice(setIndex, 1)
										this.checkFeedbacks('layerSetStatus')
									}
								}
								break
						}
						break

					case 'output-destinations':
						// this.debug('Message payload:', message)
						switch (message.event) {
							case 'added':
							case 'changed':
								const parentDocument = this.documents.find(
									(element) => element.id === message.data.relationships.document.data.id
								)
								if (parentDocument == undefined) {
									break
								}
								this.log('debug', `parentDocument: ${parentDocument}`)
								let outputIndex = parentDocument.outputs.findIndex((output) => output.id === message.id)
								// this.debug('OutputIndex:', outputIndex)
								if (outputIndex >= 0) {
									parentDocument.outputs.splice(outputIndex, 1)
								}
								parentDocument.outputs.push({
									id: message.id,
									label: message.data.attributes.title,
									ready: message.data.attributes['ready-to-go-live'],
									liveState: message.data.attributes['live-state'],
								})
								this.checkFeedbacks('outputStatus')
								break
							case 'removed':
								let doc
								for (doc in this.documents) {
									this.log('debug', `doc: ${doc} ${typeof doc}`)
									let outputIndex = this.documents[doc].outputs.findIndex((element) => element.id === message.id)
									if (outputIndex >= 0) {
										this.documents[doc].layers.splice(outputIndex, 1)
										this.checkFeedbacks('outputStatus')
									}
								}
								break
						}
						break
				}
			})

			this.socket.on('close', () => {
				this.log('debug', 'Connection to websocket closed')
				this.updateStatus(InstanceStatus.Disconnected, 'Waiting')
			})

			this.socket.on('error', (err) => {
				this.updateStatus(InstanceStatus.UnknownError, err)
				this.log('error', 'Schedule Websocket API err:' + JSON.stringify(err))
			})
		}

		this.pollApi = setInterval(retrySocket, 15000)
		retrySocket()
	},

	/**
	 * Updte the Options for Got
	 */
	updateGotOptions: function () {
		// Define the got default options
		this.gotOptions = new Options({
			prefixUrl: `http://${this.config.host}:${this.port}`,
			responseType: 'json',
			throwHttpErrors: false,
		})
		//	this.log('debug', `gotOptions: ${JSON.stringify(this.gotOptions)}`)
	},

	/**
	 * Send a REST GET request to the player and handle errorcodes
	 * @param  {} cmd
	 */
	sendGetRequest: async function (cmd) {
		// Trim off any leading / characters
		while (cmd.startsWith('/')) {
			cmd = cmd.slice(1)
		}
		// Append the API slug if it is not already present
		if (cmd.startsWith(this.apiSlug) == false) {
			cmd = this.apiSlug + cmd
		}
		this.log('debug', `REST GET: ${cmd}`)
		this.gotOptions.method = 'GET'
		let response
		try {
			response = await got(cmd, undefined, this.gotOptions)
		} catch (error) {
			console.log(error.message)
			this.processError(error)
			return
		}
		this.processResult(response)
	},

	/**
	 * Send a REST PUT request to the player and handle errorcodes
	 * @param  {} cmd
	 * @param	{} payload
	 */
	sendPutRequest: async function (cmd, payload) {
		// Trim off any leading / characters
		while (cmd.startsWith('/')) {
			cmd = cmd.slice(1)
		}
		// Append the API slug if it is not already present
		if (cmd.startsWith(this.apiSlug) == false) {
			cmd = this.apiSlug + cmd
		}
		this.log('debug', `REST PUT: ${cmd}`)
		this.gotOptions.method = 'PUT'
		this.gotOptions.json = payload
		let response
		try {
			response = await got(cmd, undefined, this.gotOptions)
		} catch (error) {
			console.log(error.message)
			this.processError(error)
			return
		}
		this.gotOptions.json = undefined
		this.processResult(response)
	},

	/**
	 * Send a GET request with update parameter to update layer input values
	 * @param {string} endpoint - The variant endpoint
	 * @param {string} fieldName - The input-value field name to update
	 * @param {string} value - The value to set
	 */
	sendUpdateRequest: async function (endpoint, fieldName, value) {
		// Trim off any leading / characters
		let cmd = endpoint
		while (cmd.startsWith('/')) {
			cmd = cmd.slice(1)
		}
		// Append the API slug if it is not already present
		if (cmd.startsWith(this.apiSlug) == false) {
			cmd = this.apiSlug + cmd
		}

		// Build the update object and URL-encode it
		const updateObj = { 'input-values': { [fieldName]: value } }
		const updateParam = encodeURIComponent(JSON.stringify(updateObj))

		// Construct the full URL with query parameters
		const url = `${cmd}?include=data.attributes.input-values&fields[input-values]=${fieldName}&update=${updateParam}`

		this.log('debug', `REST GET with update: ${url}`)
		this.gotOptions.method = 'GET'
		let response
		try {
			response = await got(url, undefined, this.gotOptions)
		} catch (error) {
			this.log('error', `Update request failed: ${error.message}`)
			this.processError(error)
			return
		}

		// Check for successful response
		if (response.statusCode === 200) {
			this.updateStatus(InstanceStatus.Ok)
			this.log('debug', `Successfully updated ${fieldName} to: ${value}`)
		} else {
			this.log('warning', `Update request returned status ${response.statusCode}`)
		}
	},

	/**
	 * INTERNAL: Callback for REST calls to process the return
	 *
	 * @param {?boolean} err - null if a normal result, true if there was an error
	 * @param {Object} result - data: & response: if normal; error: if error
	 * @private
	 * @since 1.0.0
	 */
	processResult: function (response) {
		switch (response.statusCode) {
			case 200: // OK
				this.updateStatus(InstanceStatus.Ok)
				const cmd = response.body.links.self.slice(8)
				this.log('debug', `Sent cmd: ${cmd}`)
				this.processData(cmd, response.body.data)
				break
			case 404: // Not found
				this.log('warning', `Not found: ${response.body.error}`)
				break
			default:
				// Unexpenses response
				this.updateStatus(InstanceStatus.UnknownError, `Unexpected HTTP status code: ${response.statusCode}`)
				this.log('error', `Unexpected HTTP status code: ${response.statusCode}`)
				break
		}
	},

	/**
	 * Process incoming data from the websocket connection
	 * @param  {string} cmd - the path passed to the API
	 * @param  {Object} data - response data
	 */
	processData: function (cmd, data) {
		// console.log(`Sent cmd: ${cmd}`)
		// console.log(`Return data: ${JSON.stringify(data)}`);

		if (cmd == 'documents') {
			this.documents = []
			let i
			for (i in data) {
				this.documents.push({
					id: data[i].id,
					label: data[i].attributes.metadata.title,
					liveState: data[i].attributes['live-state'],
					layers: [],
					layerSets: [],
					outputs: [],
				})
				this.sendGetRequest(`documents/${data[i].id}/layers`)
				this.sendGetRequest(`documents/${data[i].id}/layer-sets`)
				this.sendGetRequest(`documents/${data[i].id}/output-destinations`)
				//	 this.updateStatusVariables(data)
				//	 this.debug('Document:', this.documents[i])
				this.initActions()
			}
			this.updateVariableDefinitions()
			this.checkFeedbacks('documentStatus')
			return
		}

		if (cmd.endsWith('/layers')) {
			// console.log(data[3].attributes)
			const parentDocId = RegExp(/^documents\/(\d+)\/layers$/).exec(cmd)[1]
			const parentDoc = this.documents.find((element) => element.id === parentDocId)
			//	 this.debug('Doc ID:', parentDocId)
			//	 this.debug(data)
			let layer
			for (layer in data) {
				this.log('debug', `Building Layer: ${data[layer].attributes.name}`)
				let index = data[layer].attributes.index
				parentDoc.layers[index] = {
					id: data[layer].id,
					label: data[layer].attributes.name,
					document: parentDoc.id,
					variants: [],
					activeVariant: data[layer].relationships['active-variant'].data.id,
					// liveVariant: data[layer].relationships['live-variant'].data.id,
					liveVariant: '',
					liveState: data[layer].attributes['live-state'],
					volume: data[layer].attributes['volume'],
					index: data[layer].attributes.index,
				}
				this.sendGetRequest(`documents/${parentDocId}/layers/${data[layer].id}/variants`)
			}
			// this.debug('Layers:', parentDoc)
			this.updateVariableDefinitions()
			this.checkFeedbacks('layerStatus')
			return
		}

		if (cmd.endsWith('/variants')) {
			//	 console.log(data)
			let allIDs = RegExp(/^documents\/(\d+)\/layers\/([0-9-A-Z]+)\/variants$/).exec(cmd)
			const parentDocId = allIDs[1]
			const layerId = allIDs[2]
			const parentDoc = this.documents.find((element) => element.id === parentDocId)
			const parentLayer = parentDoc.layers.find((element) => element.id === layerId)
			//	 this.debug('Doc ID:', parentDocId)
			//	 this.debug(data)
			let variant
			for (variant in data) {
				this.log('debug', `Variant: ${variant}`)
				parentLayer.variants.push({
					id: data[variant].id,
					label: data[variant].attributes.name,
					liveState: data[variant].attributes['live-state'],
				})
			}
			// this.debug('Layers:', parentDoc)
			this.updateVariableDefinitions()
			this.checkFeedbacks('variantStatus')
			return
		}

		if (cmd.endsWith('/layer-sets')) {
			//	 this.debug('Layers:', data)
			const parentDocId = RegExp(/^documents\/(\d+)\/layer-sets$/).exec(cmd)[1]
			const parentDoc = this.documents.find((element) => element.id === parentDocId)
			// 	this.debug('Doc ID:', parentDocId)
			//	 this.debug(data)
			let layerSet
			for (layerSet in data) {
				// this.debug('Layer Set:', data[layerSet])
				parentDoc.layerSets.push({
					id: data[layerSet].id,
					label: data[layerSet].attributes.name,
					active: data[layerSet].attributes['active'],
				})
			}
			//	 this.debug('Layers:', parentDoc)
			this.checkFeedbacks('layerSetStatus')
			return
		}

		if (cmd.endsWith('/output-destinations')) {
			//	 this.debug('Layers:', data)
			const parentDocId = RegExp(/^documents\/(\d+)\/output-destinations$/).exec(cmd)[1]
			const parentDoc = this.documents.find((element) => element.id === parentDocId)
			//	 this.debug('Doc ID:', parentDocId)
			//	 this.debug(data)
			let output
			for (output in data) {
				// this.debug('Output:', data[output])
				parentDoc.outputs.push({
					id: data[output].id,
					label: data[output].attributes.title,
					ready: data[output].attributes['ready-to-go-live'],
					liveState: data[output].attributes['live-state'],
				})
			}
			// this.debug('Layers:', parentDoc)
			this.checkFeedbacks('outputStatus')
			return
		}
	},

	processError: function (error) {
		// console.log('---------ERROR--------')
		// console.log(error)
		if (error !== null) {
			if (error.code !== undefined) {
				this.log('error', 'Connection failed (' + error.message + ')')
			} else {
				this.log('error', 'general HTTP failure')
			}
			this.updateStatus(InstanceStatus.ConnectionFailure, 'NOT CONNECTED')
			return
		}
	},
}
