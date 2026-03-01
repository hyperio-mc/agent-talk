---
id: task-160
created: 2026-02-27
priority: high
assignee: agent
status: todo
project: agent-talk
depends_on: []
---

# Phase 1: Create HYPR App Scaffold

Set up the agent-talk SPA to work as a HYPR-native app on onhyper.io.

## Context
Agent-talk needs to be converted from a standalone Railway deployment to a HYPR app that can be deployed at talk.onhyper.io.

## Acceptance Criteria
- [ ] Create HYPR app configuration file (`hypr-app.json`)
- [ ] Verify `vite.config.ts` is compatible with HYPR build
- [ ] Ensure `index.html` has correct structure for HYPR
- [ ] Keep frontend code in `src/` directory unchanged
- [ ] Make sure `public/` static assets are preserved
- [ ] Create `src/lib/hypr.ts` for HYPR client SDK wrapper

## Files to Create/Modify
- `hypr-app.json` - NEW (HYPR app configuration)
- `src/lib/hypr.ts` - NEW (HYPR SDK wrapper)
- `src/lib/api.ts` - Update to use HYPR endpoints

## hypr-app.json Structure
```json
{
  "name": "Agent Talk",
  "slug": "talk",
  "version": "1.0.0",
  "description": "Voice memo and TTS application",
  "proxies": {
    "elevenlabs": {
      "baseUrl": "https://api.elevenlabs.io",
      "secretKey": "ELEVENLABS_API_KEY"
    }
  }
}
```

## Notes
- This is the foundation task for HYPR-native refactoring
- Other tasks depend on this scaffold being in place
- Test by building: `npm run build`