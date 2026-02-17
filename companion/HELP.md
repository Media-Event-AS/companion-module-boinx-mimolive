## Boinx mimoLive

**Professional Live Streaming for Mac**

mimoLive brings powerful tools for professional live streaming to your Mac, iPad, and iPhone.

It is an all-in-one live switcher, video encoder, editor, and streaming software for Mac®. It enables you to switch multiple cameras, insert presentations, add graphics, overlay lower-thirds, social media comments, transparency with green screens, and so much more.

mimoLive records and streams simultaneously to various services and locations.

### Supported commands

- Document Actions (Set Live, Set Off, Toggle Live)
- Layer Actions (Set Live, Set Off, Toggle Live, Cycle Through Variants)
- Output Actions (Set Live, Set Off, Toggle Live)
- Layer Set Recall
- Set Layer Volume
- Set Layer Input Value (update text content and other input fields)
- Trigger a Generic Endpoint

### Supported feedback

- Document Status
- Layer Status
- Output Status
- Layer Set Status
- Variant Status

### Supported button variables

Dynamic variables are generated for all open documents, and can be accessed using a document (layer) indexing scheme. The following variables are available:

- Document name
- Document live status
- Layer name
- Layer active variant name
- Layer volume (when present)

### Zoom sources (module extension planned)

The module will be extended to **fetch** document sources from the mimoLive API (`GET /api/v1/documents/{docId}/sources`) and **filter to Zoom Input sources only**. Zoom participants are identified by the attribute **`source-type`** equal to **`com.boinx.mimoLive.sources.zoomparticipant`** on each source object (drill into the sources response and filter by this node type). Only those sources will be listed so dropdowns and mapping UIs show just Zoom participants (e.g. for Split Screen source selection and Mukana panelist mapping). Optional fallback: if `source-type` is missing, treat as Zoom when name or other attributes contain "zoom" or "meeting". Reference: QueOnDeck-mimoLive `services/mimolive-init.js` (lines 268–310).

### Split Screen + Mukana integration (planned)

To drive Split Screen layers from Mukana raised hands, the mimoLive module will store and use a **panelist mapping** (Mukana UID → Zoom UUID). Panelists should use the same name in Mukana and Zoom.

**Config (mimoLive instance)**:
- **Mukana instance** – Which Mukana instance to read variables from (`hand_1_uid`..`hand_8_uid`, `hand_1_name`..`hand_8_name`, `active_question_comment`)
- **Test question match string** – When the active question text contains this string (e.g. "Test" or "Raise hands"), the system is in **initialization/mapping mode**. Mukana exposes `active_question_comment` for comparison
- **Host Zoom UUID** / **Reader Zoom UUID** – Fixed positions 1 and 2
- **Panelist mapping** – Table of Mukana UID → Zoom UUID; built by fuzzy name matching with manual override

**Build panel mapping** (action, planned):
- **Triggered by**: Stream Deck button, test-question trigger (when question text matches), or on demand
- **Process**: Reads Mukana variables; fetches Zoom sources; fuzzy-matches `hand_X_name` to Zoom source names; suggests mapping; operator confirms/overrides in config and saves
- **Re-runnable anytime** – New panelists arriving, mapping wrong: re-run by button, trigger, or manual edit

**Set Split Screen from Mukana Hands** (action, planned): Reads `hand_1_uid`..`hand_8_uid` and hand count from Mukana; looks up Zoom UUID per position from mapping; selects layer set by hand count; sets each split-screen position to the corresponding Zoom source.

For the full Mukana + mimoLive workflow, see **MUKANA_MIMOLIVE_WORKFLOW.md** in the companion-module-mukana repo.

### Usage

All actions and feedbacks can be targeted using the **API endpoint** provided within mimoLive--see [this page in the manual](https://mimolive.com/manual/5/en/topic/examples-of-api-usage) for details on how to get API endpoints.

Alternatively, **document and layer** actions can be targeted using a document (and layer) index. The first document opened in a session is index 1, the second index 2, and so on. The layer index matches the layer stack within the document, with layer 1 being at the top. For document only actions/feedbacks, just the `<document index>` is needed; for layer actions/feedbacks, the format is `<document index>,<layer index>`

### Set Layer Input Value Action

This action allows you to update layer input-value fields, such as text content in Annotation, Static Text, or News Crawl layers. It supports Companion variables, making it ideal for integration with other modules like Mukana.

**Configuration:**

- **Variant Endpoint**: Full API endpoint to the layer variant (format: `/api/v1/documents/{docId}/layers/{layerId}/variants/{variantId}`)
- **Input Field Name**: The input-value field to update (most common: `tvGroup_Content__Text_TypeMultiline`)
- **Value**: Text or Companion variables to set

**Common Input Field Names:**

- `tvGroup_Content__Text_TypeMultiline` - Text content for most text layers (Annotation, Static Text, News Crawl)
- **Split Screen layer (Zoom sources):** `tvIn_VideoSourceAImage` (Source A), `tvIn_VideoSourceBImage` (Source B), and similarly for C, D, etc. The value is the Zoom Input source UUID.
- Other field names vary by layer type and can be found by inspecting the mimoLive API

**Examples:**

1. **Simple text update:**

   - Variant: `/api/v1/documents/580012725/layers/71979D68-88ED-45A6-B6F6-FD9764FD7764/variants/51D61A68-9434-42AC-ABF7-985F92180CF2`
   - Field: `tvGroup_Content__Text_TypeMultiline`
   - Value: `Breaking News`

2. **Using Mukana variables:**

   - Variant: `/api/v1/documents/580012725/layers/0E37EF43-0BCE-4F27-A657-3A78A1F679ED/variants/EE44A5A8-2EA2-4003-ACE3-D1AAEBBF7211`
   - Field: `tvGroup_Content__Text_TypeMultiline`
   - Value: `$(mukana:active_question_username) - $(mukana:active_question_location)`

3. **News Crawl formatting:**
   - For News Crawl layers, use `|` to separate title from description and `\n` to separate entries:
   - Value: `Breaking News|Live updates from the event\nWeather Update|Sunny skies expected`

4. **Split Screen – set Source A to a Zoom participant (e.g. Anika Patel):**
   - Variant: `/api/v1/documents/1527729864/layers/2F23E1AA-CAAE-484D-997C-3CAFBAAD1D51/variants/64A5A9DE-5B35-48AD-AF94-2DF180360F61`
   - Field: `tvIn_VideoSourceAImage`
   - Value: `2109958B-B7BC-41E3-9F2B-433BE14E04DE` (the Zoom Input source UUID for that participant)
   - Zoom Input source API endpoint for that participant: `/api/v1/documents/1527729864/sources/1527729864-2109958B-B7BC-41E3-9F2B-433BE14E04DE`

5. **Split Screen – set Source B to a Zoom participant (e.g. Louis Rodriguez):**
   - Same variant endpoint as above
   - Field: `tvIn_VideoSourceBImage`
   - Value: `7951F795-37AF-4B12-8C95-25EBB5766304` (the Zoom Input source UUID for that participant)

**Finding Variant Endpoints:**

The easiest way to get the correct variant endpoint is to:

1. Open your document in mimoLive
2. Navigate to the layer and variant you want to control
3. Copy the API endpoint from mimoLive's interface or browser inspector

Alternatively, use the format: `/api/v1/documents/{docId}/layers/{layerId}/variants/{variantId}` where you can find the IDs from the mimoLive API at `http://{mimoLive-IP}:8989/api/v1/documents/{docId}/layers/`

### Limitations

Currently, authenticated connections are not supported, so you will need to have the Remote Control options set to no password.
