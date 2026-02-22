import { combineRgb } from '@companion-module/base'

export default {
	getPresets: function () {
		const presets = {}
		const whiteColor = combineRgb(255, 255, 255)
		const blackColor = combineRgb(0, 0, 0)
		const previewFgColor = combineRgb(0, 204, 0)
		const previewBgColor = combineRgb(0, 153, 51)
		const startupColor = combineRgb(255, 152, 0)
		const shutdownColor = combineRgb(255, 152, 0)
		const liveColor = combineRgb(255, 0, 0)
		const activeColor = combineRgb(0, 51, 204)
		const offColor = combineRgb(68, 68, 68)

		/**
		 * Document
		 */
		presets['documentToggle'] = {
			type: 'button',
			category: 'Document',
			name: 'Toggle Document',
			style: {
				text: 'Start Show',
				size: '24',
				color: previewFgColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'document',
							options: {
								document: '1',
								action: 'toggleLive',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'documentStatus',
					options: {
						status: 'live',
					},
					style: {
						color: liveColor,
						text: 'Stop Show',
					},
				},
				{
					feedbackId: 'documentStatus',
					options: {
						status: 'shutdown',
					},
					style: {
						color: shutdownColor,
						text: 'Shut Down',
					},
				},
			],
		}

		presets['documentState'] = {
			type: 'button',
			category: 'Document',
			name: 'Document State',
			style: {
				text: `$(${this.shortname}:doc_1_status)`,
				size: '24',
				color: whiteColor,
				bgcolor: offColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'document',
							options: {
								document: '1',
								action: 'toggleLive',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'documentStatus',
					options: {
						status: 'live',
					},
					style: {
						bgcolor: liveColor,
					},
				},
				{
					feedbackId: 'documentStatus',
					options: {
						status: 'shutdown',
					},
					style: {
						bgcolor: shutdownColor,
					},
				},
			],
		}

		/**
		 * Layer presets
		 */
		for (let doc = 1; doc <= 1; doc++) {
			for (let layer = 1; layer <= 20; layer++) {
				presets[`layer_${layer}`] = {
					type: 'button',
					category: `Layers`,
					name: `Layer ${layer}`,
					style: {
						text: `$(${this.shortname}:layer_${doc}_${layer}_name)`,
						size: 'auto',
						color: whiteColor,
						bgcolor: blackColor,
					},
					steps: [
						{
							down: [
								{
									actionId: 'layer',
									options: {
										endpoint: `${doc},${layer}`,
										action: `toggleLive`,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'layerStatus',
							options: {
								layer: `${doc},${layer}`,
								status: 'live',
							},
							style: {
								bgcolor: liveColor,
							},
						},
						/*{
						feedbackId: 'layerStatus',
						options: {
						layer: `${doc},${layer}`,
						status: 'preview'
						},
						style: {
						bgcolor: previewColor
						}
						},*/
						{
							feedbackId: 'layerStatus',
							options: {
								layer: `${doc},${layer}`,
								status: 'shutdown',
							},
							style: {
								bgcolor: shutdownColor,
							},
						},
					],
				}
			}
		}

		/**
		 * Variant presets
		 */
		presets[`variant`] = {
			type: 'button',
			category: `Variants`,
			name: `Variant`,
			style: {
				text: `Variant`,
				size: '18',
				color: whiteColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'variant',
							options: {
								endpoint: ``,
								action: 'toggleLive',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'variantStatus',
					options: {
						endpoint: ``,
						status: 'live',
					},
					style: {
						bgcolor: liveColor,
					},
				},
				{
					feedbackId: 'variantStatus',
					options: {
						endpoint: ``,
						status: 'shutdown',
					},
					style: {
						bgcolor: shutdownColor,
					},
				},
			],
		}

		/**
		 * Layer set presets
		 */
		presets[`layerSet`] = {
			type: 'button',
			category: `Layer Sets`,
			name: `Layer Set`,
			style: {
				text: `Layer Set`,
				size: '24',
				color: whiteColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'layerSet',
							options: {
								endpoint: ``,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'layerSetStatus',
					options: {
						endpoint: ``,
					},
					style: {
						bgcolor: activeColor,
					},
				},
			],
		}

		/**
		 * Mukana integration presets (configure endpoint/variant after adding to a button)
		 */
		presets['mukanaQuestionStarted'] = {
			type: 'button',
			category: 'Mukana',
			name: 'Question started',
			style: {
				text: 'Question started',
				size: '18',
				color: whiteColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{ actionId: 'layerSet', options: { endpoint: '' } },
						{ actionId: 'setHostReader', options: { endpoint: '' } },
					],
					up: [],
				},
			],
		}
		presets['mukanaHandBecameActive'] = {
			type: 'button',
			category: 'Mukana',
			name: 'Hand became active',
			style: {
				text: 'Hand became active',
				size: '18',
				color: whiteColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setSplitScreenFromMukanaHands',
							options: {
								endpoint: '',
								recallLayerSetByHandCount: false,
								handCountVariable: '$(mukana:hand_count_total)',
								hand_1_uid: '$(mukana:hand_1_uid)',
								hand_2_uid: '',
								hand_3_uid: '',
								hand_4_uid: '',
								hand_5_uid: '',
								hand_6_uid: '',
								hand_7_uid: '',
								hand_8_uid: '',
							},
						},
					],
					up: [],
				},
			],
		}
		presets['mukanaBuildMapping'] = {
			type: 'button',
			category: 'Mukana',
			name: 'Build panel mapping',
			style: {
				text: 'Build mapping',
				size: '18',
				color: whiteColor,
				bgcolor: blackColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'buildPanelMapping',
							options: {
								documentId: '',
								hand_1_uid: '$(mukana:hand_1_uid)',
								hand_1_name: '$(mukana:hand_1_name)',
								hand_2_uid: '',
								hand_2_name: '',
								hand_3_uid: '',
								hand_3_name: '',
								hand_4_uid: '',
								hand_4_name: '',
								hand_5_uid: '',
								hand_5_name: '',
								hand_6_uid: '',
								hand_6_name: '',
								hand_7_uid: '',
								hand_7_name: '',
								hand_8_uid: '',
								hand_8_name: '',
							},
						},
					],
					up: [],
				},
			],
		}

		/**
		 * Outputpresets
		 */
		presets[`output`] = {
			type: 'button',
			category: `Outputs`,
			name: `Output`,
			style: {
				text: `Output`,
				size: '18',
				color: whiteColor,
				bgcolor: offColor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'output',
							options: {
								endpoint: ``,
								action: 'toggleLive',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'outputStatus',
					options: {
						endpoint: ``,
						status: 'live',
					},
					style: {
						bgcolor: liveColor,
					},
				},
				{
					feedbackId: 'outputStatus',
					options: {
						endpoint: ``,
						status: 'preview',
					},
					style: {
						bgcolor: previewBgColor,
					},
				},
				{
					feedbackId: 'outputStatus',
					options: {
						endpoint: ``,
						status: 'startup',
					},
					style: {
						bgcolor: startupColor,
					},
				},
			],
		}

		return presets
	},
}
