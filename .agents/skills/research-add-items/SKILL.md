---
name: research-add-items
user-invocable: true
description: Add items (research objects) to existing research outline.
---

# Research Add Items - Supplement Research Objects

## Trigger
`/research-add-items`

## Workflow

### Step 1: Auto-locate Outline
Find `*/outline.yaml` file in current working directory, auto-read.

### Step 2: Get Supplement Sources
- **A. Ask user**: What items to supplement? Any specific names?
- **B. Ask if Web Search needed**: Search for more items in the current session. Use a delegated search agent only if the user explicitly asks for delegated or parallel agent work.

### Step 3: Merge and Update
- Append new items to outline.yaml
- Display to user for confirmation
- Avoid duplicates
- Save updated outline

## Output
Updated `{topic}/outline.yaml` file (in-place modification)
