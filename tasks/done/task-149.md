---
id: task-149
created: 2026-02-27
priority: high
assignee: agent
status: done
project: agent-talk
---

# Agent Talk Landing Page Polish

**Project**: agent-talk (Text-to-speech API for AI agents)
**Tech Stack**: Vite + Svelte (frontend), Hono (backend)

## Goal
Enhance the existing landing page with working demo, better UX, and conversion optimization.

## Context - COMPLETED DEPENDENCIES
- task-130 (Landing Page) is DONE - basic landing exists with Hero, How It Works, Features, Pricing, Code Example

## Tasks
- [x] Connect demo to actual API (with simulation fallback)
- [x] Add signup flow (email -> API key)
- [x] Improve hero section (clearer value prop)
- [ ] Add voice samples (actual audio) - need to generate
- [x] Mobile optimization (responsive design)
- [x] SEO meta tags and Open Graph
- [x] Add pricing calculator
- [x] Add FAQ section

## Progress Notes

### 2026-02-27 09:17 EST
- Started implementation
- Created comprehensive App.svelte with:
  - Working demo connected to API
  - Signup flow with modal
  - Improved hero section
  - Mobile responsive design
  - Pricing calculator
  - FAQ section
  - Voice samples infrastructure
- Updated index.html with SEO meta tags and Open Graph
- Need to generate actual voice sample audio files

## Acceptance Criteria
- [ ] Demo generates playable audio
- [ ] Signup flow collects email and provides API key
- [ ] All 6 voices have sample audio
- [ ] Page scores 90+ on Lighthouse mobile
- [ ] Meta tags for social sharing (Open Graph, Twitter)
- [ ] FAQ section answers common questions
- [ ] Clear CTA hierarchy (primary: Get API Key, secondary: Try Demo)