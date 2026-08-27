---
title: Limitations
description: When the clipboard is unreachable, and what the control does about it.
order: 7
---

# Limitations

- **The clipboard is the host's to grant, not this control's.**
  `navigator.clipboard.writeText` needs a secure context *and* the
  `clipboard-write` Permissions-Policy on every frame between the top document
  and this control. A model-driven form hosts code components in an iframe that
  this control does not own and cannot configure, so whether the modern API
  works is a property of the environment. There is a fallback —
  `document.execCommand('copy')`, which predates Permissions-Policy — and when
  both fail the control says **"Could not copy. Select the text and copy it
  manually."** rather than pretending. This is a constraint, not a bug, and
  there is nothing to lift: the decision belongs to whoever configures the host.

- **The demo on this page copies for real** — press **Copy** and the value is
  on your clipboard. Worth saying because it was predicted not to: PCFHub's
  harness runs controls in an iframe sandboxed to `allow-scripts` on an opaque
  origin with no clipboard permission, which does deny
  `navigator.clipboard`. The `execCommand` fallback is not gated by
  Permissions-Policy, so it succeeds where the modern API is refused — which is
  the whole reason it is there, demonstrated rather than argued.

- **Single-line only.** The control renders an `<input type="text">`. Bind it to
  a multiline column and the display truncates to one line, though a copy still
  carries the entire value. Use the platform's own multiline control, or
  [open an issue](https://github.com/pcfhub/pcf-copy-field/issues) if a
  multiline variant would be useful.

- **No formatting on the way out.** Whatever is in the column is what lands on
  the clipboard — no trimming, no case change, no stripping of a prefix. That is
  deliberate for the reference-number case, where a transformation nobody asked
  for is a support ticket, but it does mean the control is not the place to
  build "copy just the id out of this URL".

- **The confirmation is not configurable.** It shows for three seconds and
  clears. There is no property to change the wording; translate it by shipping
  another `.resx`, which is the mechanism the platform already has for this.
