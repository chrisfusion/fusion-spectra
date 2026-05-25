# fusion-content: Video content type — spectra requirements

**Date**: 2026-05-25  
**Requested by**: fusion-spectra help feature

---

## What spectra needs

A new content type `videos` served by fusion-content.  
Videos are **external links** (YouTube-like service) — no media hosting in fusion-content, just metadata.

---

## Proposed API

### List videos
```
GET /api/v1/videos
```

Query params:
| Param | Type | Description |
|---|---|---|
| `service` | string | Filter by service identifier (e.g. `forge`, `index`, `weave`) |

Response: `200 OK`
```json
[
  {
    "slug":         "forge-overview",
    "service":      "forge",
    "title":        "Fusion Forge overview",
    "summary":      "Short description shown under thumbnail",
    "thumbnailUrl": "https://...",
    "videoUrl":     "https://...",
    "tags":         ["forge", "overview"]
  }
]
```

### Get single video
```
GET /api/v1/videos/:slug
```

Response: same shape as a single item above; `404` if not found.

---

## Source repo layout

```
videos/
  forge/
    forge-overview.md
    forge-git-builds.md
  index/
    index-overview.md
  weave/
    weave-chains.md
```

### Frontmatter fields (per video article)
```yaml
---
title: "Fusion Forge overview"
service: forge           # must match directory name; used as filter key in spectra
summary: "A walkthrough of venv builds and GitOps polling"
thumbnailUrl: "https://img.youtube.com/vi/XXXXXXXXXXX/hqdefault.jpg"
videoUrl: "https://youtube.com/watch?v=XXXXXXXXXXX"
tags: ["forge", "overview"]
---
```

No body text is needed — all data is in frontmatter.  
Service identifier values must match the activity-rail context IDs in spectra: `data`, `weave`, `monitoring`, `forge`, `fusion-index`, `admin`.

---

## Permission

Reuse `content:changelog:read` — no new permission needed.  
BFF route rule: `GET /api/content/api/v1/videos*` → `content:changelog:read`  
(same catch-all already covers changelog; add before the wildcard if a tighter rule is needed)

---

## Notes for implementation

- Follow the same poller pattern as help: `internal/video/`, `internal/videostore/`, `internal/videopoller/`; use `gitutil.EnsureRepo`
- The `thumbnailUrl` can point to an external CDN — fusion-content only stores/proxies the URL, never the image
- No search/full-text index needed for v1 — listing by service is sufficient
- Wire in `router.go` and `main.go` alongside the help handler
