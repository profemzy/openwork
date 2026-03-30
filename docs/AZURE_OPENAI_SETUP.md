# Azure OpenAI Setup Guide for OpenWork/OpenCode

## Problem Statement

When configuring Azure OpenAI in OpenWork Desktop, users encountered the following error:

```
Unknown Error AI_LoadSettingError: Azure OpenAI resource name setting is missing. 
Pass it using the 'resourceName' parameter or the AZURE_RESOURCE_NAME environment variable.
```

Despite adding the `resourceName` to configuration files, the error persisted in the OpenWork Desktop UI.

---

## Root Cause Analysis

### Why the Error Occurred

1. **Azure OpenAI Requires Additional Fields**: Unlike standard OpenAI, Azure OpenAI requires:
   - `resourceName` - Your Azure resource name (e.g., `wackops-resource`)
   - `baseURL` - Azure OpenAI endpoint (e.g., `https://wackops-resource.openai.azure.com/openai/v1`)
   - `apiKey` - Azure OpenAI API key

2. **OpenWork Desktop UI Limitation**: The `submitProviderApiKey()` function in OpenWork Desktop needs to include Azure-specific fields in the auth payload. Sending only `{ type: "api", key }`, or hardcoding the wrong Azure tenant, still breaks Azure provider initialization.

3. **Multiple Config Locations**: OpenWork and OpenCode read from different configuration paths:
   - OpenCode CLI: `~/.config/opencode.json`
   - OpenWork Desktop: `~/.openwork/openwork-orchestrator/opencode-config/config.json`
   - Shared Auth: `~/.local/share/opencode/auth.json`

4. **Config Caching**: OpenWork Desktop caches credentials at startup and doesn't reload them without a full restart.

---

## Solution

### Step 1: Update Auth Credentials

Edit `~/.local/share/opencode/auth.json`:

```json
{
  "azure": {
    "type": "api",
    "key": "YOUR_AZURE_API_KEY",
    "resourceName": "wackops-resource",
    "baseURL": "https://wackops-resource.openai.azure.com/openai/v1"
  }
}
```

### Step 2: Configure OpenCode CLI

Edit `~/.config/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "azure": {
      "npm": "@ai-sdk/openai",
      "name": "Azure OpenAI",
      "options": {
        "resourceName": "wackops-resource",
        "baseURL": "https://wackops-resource.openai.azure.com/openai/v1",
        "apiKey": "$env:AZURE_OPENAI_API_KEY"
      },
      "models": {
        "gpt-5.4": {
          "name": "GPT-5.4",
          "deployment": "gpt-5.4"
        },
        "gpt-5.4-mini": {
          "name": "GPT-5.4 Mini",
          "deployment": "gpt-5.4-mini"
        }
      }
    }
  }
}
```

### Step 3: Configure OpenWork Desktop

Create/Edit `~/.openwork/openwork-orchestrator/opencode-config/config.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "azure": {
      "npm": "@ai-sdk/openai",
      "name": "Azure OpenAI",
      "options": {
        "resourceName": "wackops-resource",
        "baseURL": "https://wackops-resource.openai.azure.com/openai/v1",
        "apiKey": "$env:AZURE_OPENAI_API_KEY"
      },
      "models": {
        "gpt-5.4": {
          "name": "GPT-5.4",
          "deployment": "gpt-5.4"
        },
        "gpt-5.4-mini": {
          "name": "GPT-5.4 Mini",
          "deployment": "gpt-5.4-mini"
        }
      }
    }
  }
}
```

Create/Edit `~/.openwork/openwork-orchestrator/opencode-config/.env`:

```bash
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_RESOURCE_NAME=wackops-resource
```

### Step 4: Fix OpenWork Desktop Source Code

The UI needs to resolve Azure-specific fields from the configured provider when connecting via API key.

**File**: `apps/app/src/app/context/providers/store.ts`

**Before**:
```typescript
async function submitProviderApiKey(providerId: string, apiKey: string) {
  // ...
  await c.auth.set({
    providerID: providerId,
    auth: { type: "api", key: trimmed },
  });
  // ...
}
```

**After**:
```typescript
async function submitProviderApiKey(providerId: string, apiKey: string) {
  // ...
  const authPayload = { type: "api", key: trimmed };

  if (isAzureProvider(providerId)) {
    const { resourceName, baseURL } = await loadAzureAuthSettings(providerId);
    if (!resourceName) {
      throw new Error("Azure OpenAI is missing a resource name in provider config.");
    }
    authPayload.resourceName = resourceName;
    if (baseURL) authPayload.baseURL = baseURL;
  }

  await c.auth.set({
    providerID: providerId,
    auth: authPayload,
  });
  // ...
}
```

The important detail is that OpenWork should reuse Azure metadata from the active OpenCode runtime config, not hardcode a specific `resourceName` or endpoint.

### Step 5: Restart OpenWork Desktop

OpenWork Desktop caches credentials at startup. A full restart is required:

```bash
# Kill all OpenWork processes
killall -9 OpenWork-Dev opencode openwork-orchestrator openwork-server opencode-router

# Wait 2-3 seconds, then reopen OpenWork from Applications
```

---

## Verification

### Test via CLI

```bash
# List Azure models
/Applications/OpenWork.app/Contents/MacOS/opencode models azure

# Expected output:
azure/gpt-5.4
azure/gpt-5.4-mini
azure/gpt-5.4-nano
azure/gpt-5.4-pro
```

### Test API Connection

```bash
curl -X POST "https://wackops-resource.openai.azure.com/openai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "api-key: $AZURE_OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5.4",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_completion_tokens": 10
  }'
```

### Test in OpenWork Desktop UI

1. Open OpenWork Desktop
2. Open the model selector dropdown
3. Select `azure/gpt-5.4` or `azure/gpt-5.4-mini`
4. Send a test message

---

## Configuration Files Reference

| File | Purpose | Required Fields |
|------|---------|-----------------|
| `~/.local/share/opencode/auth.json` | Provider credentials | `type`, `key`, `resourceName`, `baseURL` |
| `~/.config/opencode.json` | OpenCode CLI global config | `provider.azure.options`, `provider.azure.models` |
| `~/.openwork/openwork-orchestrator/opencode-config/config.json` | OpenWork Desktop config | Same as above |
| `~/.openwork/openwork-orchestrator/opencode-config/.env` | Environment variables | `AZURE_OPENAI_API_KEY`, `AZURE_RESOURCE_NAME` |
| `.opencode/config.json` (workspace) | Workspace-specific config | Same as global config |

---

## Troubleshooting

### Error: "Azure OpenAI resource name setting is missing"

**Cause**: `resourceName` not in auth.json or config

**Fix**:
1. Verify `~/.local/share/opencode/auth.json` contains `resourceName`
2. Restart OpenWork Desktop completely

### Error: Models don't appear in UI

**Cause**: OpenWork Desktop cached old config

**Fix**:
1. Kill all OpenWork processes
2. Clear cache: `rm ~/Library/Application\ Support/com.differentai.openwork/openwork-server-state.json`
3. Restart OpenWork

### Error: 401 Unauthorized

**Cause**: Invalid or expired API key

**Fix**:
1. Regenerate API key in Azure Portal
2. Update all config files with new key
3. Restart OpenWork

### CLI Works but UI Doesn't

**Cause**: UI writes Azure auth without resolving the configured `resourceName`, or writes a hardcoded tenant that does not match the user's Azure setup

**Fix**:
1. Apply the source code fix so `submitProviderApiKey()` reads Azure settings from the configured provider
2. Rebuild OpenWork Desktop: `pnpm tauri build`
3. Or manually edit `~/.local/share/opencode/auth.json` after connecting

---

## Environment Variables

```bash
# Required
export AZURE_OPENAI_API_KEY="your-api-key"
export AZURE_RESOURCE_NAME="wackops-resource"

# Optional (if not using default Azure endpoint)
export AZURE_BASE_URL="https://wackops-resource.openai.azure.com/openai/v1"
```

---

## Model Deployment Names

Update the model names in config to match your Azure deployments:

```json
"models": {
  "gpt-5.4": {
    "name": "GPT-5.4",
    "deployment": "your-deployment-name"
  }
}
```

Common deployment names:
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.4-nano`
- `gpt-5.4-pro`

---

## Security Notes

1. **Never commit** `auth.json` or `.env` files to version control
2. Add to `.gitignore`:
   ```
   .env
   .env.local
   auth.json
   ```
3. Store API keys in a secure password manager
4. Rotate API keys periodically

---

## Related Files

- OpenWork Desktop App: `/Applications/OpenWork.app`
- OpenWork Data: `~/.openwork/`
- OpenCode Data: `~/.local/share/opencode/`
- OpenCode Config: `~/.config/opencode.json`
- OpenWork App Support: `~/Library/Application Support/com.differentai.openwork/`

---

## Last Updated

2026-03-29

## Author

OpenWork Team
