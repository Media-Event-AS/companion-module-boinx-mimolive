# Testing Set Layer Input Value Action

This document provides test cases for the new "Set Layer Input Value" action across different mimoLive layer types.

## Prerequisites

1. mimoLive running on `127.0.0.1:8989` with Remote Control enabled (no password)
2. Bitfocus Companion with the mimoLive module installed and connected
3. A mimoLive document open with test layers
4. (Optional) Mukana module configured for variable integration testing

## Test Setup

### 1. Get Variant Endpoints

For each layer type you want to test, get the variant endpoint from mimoLive:

1. Open your browser to `http://127.0.0.1:8989/api/v1/documents/`
2. Find your document ID (e.g., `580012725`)
3. Navigate to `http://127.0.0.1:8989/api/v1/documents/{docId}/layers/`
4. Find the layer you want to test and note its ID
5. Navigate to `http://127.0.0.1:8989/api/v1/documents/{docId}/layers/{layerId}/variants/`
6. Note the variant ID for the variant you want to update

Your full variant endpoint will be:
```
/api/v1/documents/{docId}/layers/{layerId}/variants/{variantId}
```

## Test Cases

### Test 1: Annotation Layer - Simple Text

**Objective:** Verify basic text update functionality

**Setup:**
- Layer Type: Annotation
- Variant Endpoint: `/api/v1/documents/580012725/layers/0E37EF43-0BCE-4F27-A657-3A78A1F679ED/variants/EE44A5A8-2EA2-4003-ACE3-D1AAEBBF7211`
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `Test Annotation Text`

**Steps:**
1. In Companion, create a new button
2. Add action "Set Layer Input Value"
3. Configure with the values above
4. Press the button
5. Check mimoLive - the annotation layer should show "Test Annotation Text"

**Expected Result:** ✅ Layer displays the new text

---

### Test 2: Static Text Layer - Simple Text

**Objective:** Verify static text layer updates

**Setup:**
- Layer Type: Static Text
- Variant Endpoint: `/api/v1/documents/580012725/layers/71979D68-88ED-45A6-B6F6-FD9764FD7764/variants/51D61A68-9434-42AC-ABF7-985F92180CF2`
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `Top 5 National Olympic Committees`

**Steps:**
1. Create a new button
2. Add action "Set Layer Input Value"
3. Configure with the values above
4. Press the button
5. Check mimoLive - the static text should update

**Expected Result:** ✅ Layer displays the new text

---

### Test 3: News Crawl Layer - Formatted Text

**Objective:** Verify News Crawl formatting with | and \n separators

**Setup:**
- Layer Type: News Crawl
- Variant Endpoint: `/api/v1/documents/580012725/layers/7EF77991-2B66-4C31-B35A-CFFAC2C74BED/variants/8C6256DD-0AD9-40EC-902B-334C1E28FE69`
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `Title 1|Description 1 Description 1 Description 1\nTitle 2|Description 2\nTitle 3|Description 3`

**Steps:**
1. Create a new button
2. Add action "Set Layer Input Value"
3. Configure with the values above
4. Press the button
5. Check mimoLive - the news crawl should show three entries with titles and descriptions

**Expected Result:** ✅ News crawl displays three formatted entries

---

### Test 4: Companion Variable Integration

**Objective:** Verify Companion variable resolution works correctly

**Setup:**
- Create a Companion custom variable named `test_var` with value `Hello from Companion`
- OR use a Mukana variable if configured

**Test 4a: Single Variable**
- Variant Endpoint: (any annotation or static text layer)
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `$(internal:custom_test_var)`

**Steps:**
1. Create a new button
2. Add action "Set Layer Input Value"
3. Configure with variable reference
4. Press the button
5. Check mimoLive

**Expected Result:** ✅ Layer shows "Hello from Companion"

---

**Test 4b: Multiple Variables (Mukana Integration)**

If Mukana module is configured:
- Variant Endpoint: (any annotation or static text layer)
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `$(mukana:active_question_username) - $(mukana:active_question_location)`

**Steps:**
1. Ensure Mukana has an active question
2. Create a new button
3. Add action "Set Layer Input Value"
4. Configure with Mukana variables
5. Press the button
6. Check mimoLive

**Expected Result:** ✅ Layer shows resolved variable values (e.g., "John Doe - Oslo")

---

### Test 5: Empty/Clear Text

**Objective:** Verify clearing text works

**Setup:**
- Variant Endpoint: (any layer)
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `` (empty string)

**Steps:**
1. Create a new button
2. Add action "Set Layer Input Value"
3. Configure with empty value
4. Press the button
5. Check mimoLive

**Expected Result:** ✅ Layer text is cleared

---

### Test 6: Special Characters

**Objective:** Verify special characters are properly URL-encoded

**Setup:**
- Variant Endpoint: (any layer)
- Field Name: `tvGroup_Content__Text_TypeMultiline`
- Value: `Test & Special "Characters" <HTML> 100% Complete!`

**Steps:**
1. Create a new button
2. Add action "Set Layer Input Value"
3. Configure with special characters
4. Press the button
5. Check mimoLive

**Expected Result:** ✅ All special characters display correctly

---

## Error Cases to Test

### E1: Invalid Variant Endpoint
- Use a non-existent endpoint
- **Expected:** Warning in Companion log

### E2: Invalid Field Name
- Use a field name that doesn't exist
- **Expected:** No crash, but update may fail silently

### E3: No Endpoint Specified
- Leave endpoint empty
- **Expected:** Warning in Companion log: "No variant endpoint specified"

### E4: No Field Name
- Leave field name empty
- **Expected:** Warning in Companion log: "No field name specified"

---

## Debugging Tips

1. **Enable debug logging** in Companion to see API requests
2. **Check mimoLive API** directly via browser to verify endpoints
3. **Monitor Companion logs** for any errors during action execution
4. **Verify URL encoding** - check that special characters are properly encoded in the update parameter

## Test Results Template

| Test Case | Status | Notes |
|-----------|--------|-------|
| Test 1: Annotation Simple | ⬜ | |
| Test 2: Static Text | ⬜ | |
| Test 3: News Crawl | ⬜ | |
| Test 4a: Single Variable | ⬜ | |
| Test 4b: Mukana Integration | ⬜ | |
| Test 5: Empty Text | ⬜ | |
| Test 6: Special Characters | ⬜ | |
| E1: Invalid Endpoint | ⬜ | |
| E2: Invalid Field | ⬜ | |
| E3: No Endpoint | ⬜ | |
| E4: No Field Name | ⬜ | |

Mark with ✅ for pass, ❌ for fail, ⚠️ for partial/warning
