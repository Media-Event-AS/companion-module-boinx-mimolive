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
- Set Split Screen Sources (assign Zoom sources to positions A–H on a split-screen layer variant)
- Set split screen from raised hands (role-aware host/reader/panelists, hand-count mode, question mode layer-set mapping, live-safe queue, optional auto-live delay)
- Set Split Screen Host+Reader (set positions 1 and 2 from config Host/Reader Zoom UUIDs)
- Build Panel Mapping (read hand UID/name from variables, fuzzy-match to Zoom sources; first hand = Host, second = Reader; save mapping and Host/Reader to config)
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

### Zoom sources

The module **fetches** document sources from the mimoLive API (`GET /api/v1/documents/{docId}/sources`) when documents are loaded and **filters to Zoom Input sources only**. Zoom participants are identified by the attribute **`source-type`** equal to **`com.boinx.mimoLive.sources.zoomparticipant`**. If `source-type` is missing, sources are treated as Zoom when name or other attributes contain "zoom" or "meeting". Filtered Zoom sources are stored per document in `document.zoomSources` (each entry has `id`, `label`, `uuid`) for use in Host/Reader dropdowns, Set Split Screen actions, and Mukana panelist mapping.

### Split Screen + Raised Hands integration

To drive Split Screen layers from raised hands (Mukana, QueOnDeck, or other modules), the mimoLive module will store and use a **panelist mapping** (hand UID → Zoom UUID). Panelists should use the same name in the source module and Zoom.

**Config (mimoLive instance)**:
- **Variable source** – Choose between Mukana, QueOnDeck, or Custom module for hand variables.
- **Custom prefix** – When "Custom" is selected, specify the instance name for variables like $(MyModule:hand_1_uid).
- **Host Zoom UUID** / **Reader Zoom UUID** – Fixed positions 1 and 2. Set automatically by Build Panel Mapping (first hand = Host, second = Reader) or enter manually.
- **Panelist mapping (JSON)** – Hand UID → Zoom UUID; built by Build Panel Mapping or entered manually.
- **Test question match string** – Use in **triggers**: create a trigger whose condition is “variable `active_question_comment` contains this string”, action = Build Panel Mapping. **Multiple commands**: create multiple triggers with different match strings and different actions (e.g. "Test" → Build Mapping, "Break" → another action).
- **Layer set by hand count (JSON)** – Optional. Map hand count → layer set endpoint, e.g. `{"2":"/api/v1/.../layer-sets/abc","4":"/api/v1/.../def"}`. Used when action mode = “Recall layer set by hand count”.
- **Question layer set by document (JSON)** – For `2 UP + Q` flow. Map document ID → question layer-set endpoint.
- **Question split-screen layer by document (JSON)** – Optional. Map document ID → split-screen layer endpoint inside question mode.
- **Auto-live enabled by default** – Enabled by default, but can be disabled globally in config and overridden per action.
- **Auto-live delay (ms)** – Delay before take-live to allow input updates to settle (default 200 ms).
- **Layout overrides (separate fields)** – Optional per-layout overrides: `1`..`8`, `1up_s`, `2up_q`. Use one line per source in format `left,bottom,width,height`; use `\n` between lines.

**Build panel mapping** (action):
- **Triggered by**: Stream Deck button, test-question trigger, or on demand
- **Process**: Configure the action with variable references for Hand 1–8 UID and Hand 1–8 Name (e.g. `$(Mukana:hand_1_uid)`, `$(QueOnDeck:hand_1_name)`, etc. based on your variable source setting). Select the document whose Zoom sources to use. On run, the action reads current hand UIDs and names, fuzzy-matches names to Zoom source names, and **saves** the resulting mapping to the **Panelist mapping (JSON)** config field (existing entries are preserved; matched hands are updated).
- **Re-runnable anytime** – New panelists or wrong match: run again or edit the JSON in config manually.

**Set split screen from raised hands** (action):
- Configure the eight "Hand N UID" fields with variable references (e.g. `$(Mukana:hand_1_uid)` or `$(QueOnDeck:hand_1_uid)` based on your variable source).
- Choose **By hand count mode**: None / Recall layer set / Apply custom layout.
- Optionally include fixed **Host** and **Reader** from config.
- Overflow rule: split-screen supports max 8 sources; if needed, newest panelists are dropped first.
- If the target split-screen layer is live, updates are queued and applied when the layer is no longer live.
- Auto-live is enabled by default (can be forced on/off per action) with delay support.
- For `2 UP + Q`, the action uses explicit question-layer-set mapping by document and treats question graphics/text/QR as separate layers.

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

2. **Using raised hands variables:**

   - Variant: `/api/v1/documents/580012725/layers/0E37EF43-0BCE-4F27-A657-3A78A1F679ED/variants/EE44A5A8-2EA2-4003-ACE3-D1AAEBBF7211`
   - Field: `tvGroup_Content__Text_TypeMultiline`
   - Value: `$(mukana:active_question_username) - $(mukana:active_question_location)` or `$(queondeck:active_question_username) - $(queondeck:active_question_location)`

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
