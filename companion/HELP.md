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

**Finding Variant Endpoints:**

The easiest way to get the correct variant endpoint is to:

1. Open your document in mimoLive
2. Navigate to the layer and variant you want to control
3. Copy the API endpoint from mimoLive's interface or browser inspector

Alternatively, use the format: `/api/v1/documents/{docId}/layers/{layerId}/variants/{variantId}` where you can find the IDs from the mimoLive API at `http://{mimoLive-IP}:8989/api/v1/documents/{docId}/layers/`

### Limitations

Currently, authenticated connections are not supported, so you will need to have the Remote Control options set to no password.
