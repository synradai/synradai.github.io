# De-identification workflow

How SafeIntel keeps sensitive company data out of the cloud, per the data
strategy in [SAFEINTEL-BRIEF.md](SAFEINTEL-BRIEF.md).

## Principle
Keep the **safety content** (what happened, the hazard, the lesson). Strip the
**who / where / which company**. Everything sensitive is removed on the device
before it leaves it.

## What gets stripped

| Data | How it's handled | Where |
|---|---|---|
| **Photos / scans** | Re-encoded through a canvas, which drops ALL EXIF/GPS/device metadata | `compressPhoto()` (storage.js), doc scanner (docScan.js) |
| **Company name** | Replaced with `[COMPANY]` | `deident.js` → user-set term |
| **Site / location names** | Replaced with `[SITE]` | `deident.js` → user-set terms |
| **People** | Replaced with `[NAME]` | `deident.js` → user-set terms |
| **Emails** | Replaced with `[EMAIL]` | `deident.js` → regex |
| **Phone numbers** | Replaced with `[PHONE]` | `deident.js` → regex |

The user enters their company / sites / people in **Settings → Privacy**, with
a live preview showing the redaction.

## Where redaction is applied (current decision)
- **The user's own cloud backup stays FULL** — it's fenced to only them by
  row-level security (verified: an unauthenticated query returns nothing). Their
  records must be fully recoverable, so we don't strip their own backup.
- **De-identification applies at the boundary** — when data leaves the user's
  control: shared externally, or fed into the aggregate insights layer.
- Photo metadata is *always* stripped (no downside).

## What still needs building
- **Aggregate insights layer** — a pooled, de-identified dataset (no user/company
  identity) that becomes the sellable "safety intelligence" moat. De-identify on
  the way into this pool using `deidentifyDeep()`.
- **Optional "Share clean version"** — a one-tap redacted export for when a report
  is sent outside the company.
- **Free-text names beyond the term list** — current redaction relies on the user
  listing names. A future pass could use AI/NER to catch un-listed names (with the
  tradeoff that detection is never perfect — the term list is the reliable floor).

## Key files
- `src/utils/deident.js` — `deidentifyText`, `deidentifyDeep`, term storage
- `src/components/Settings.jsx` — Privacy card + live preview
- `src/utils/storage.js`, `src/utils/docScan.js` — canvas re-encode (EXIF strip)
