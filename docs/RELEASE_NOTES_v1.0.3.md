# House Care v1.0.3

Maintenance release focused on legacy-data resilience and Home layout editing.

## Fixed

- Cloud saves deduplicate all bulk rows before upsert and report the failing table, preventing `21000: ON CONFLICT UPDATE command cannot affect row a second time` from legacy/cached repeated records.
- Polygon bounding-box resize no longer competes with polygon vertex handles.

## Layout improvements

- In-canvas zoom controls: 75% to 250%, with percentage button to reset to 100%.
- Per-placement label font size.
- Optional multi-line labels with `overflow-wrap:anywhere` behavior for long single words.
- Configurable wrapped-label width, including widths larger than the underlying object.

## Infrastructure

- New migration: `20260829183000_v1_0_3_layout_labels.sql`.
- No changes to `send-push`, VAPID/cron secrets, notification scheduler, or Cloudflare build variables.
- Backup schema remains v6; application version is 1.0.3.
