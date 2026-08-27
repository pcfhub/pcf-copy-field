---
title: FAQ
description: Questions that come up more than once.
order: 8
---

# FAQ

## Why did pressing Copy say it could not copy?

The clipboard was not available to the control. That is an environment
permission rather than a fault in the control, and
[Limitations](limitations.md) explains who grants it. The message is deliberate:
the alternative is a button that appears to work and does not, which is the
failure mode this control was written to avoid.

Not something you will see in the demo on this site: the harness denies
`navigator.clipboard`, but the control's fallback copies anyway, so the demo
shows the working path. The message is for the environments where both are
refused.

## Why is the button greyed out?

The value is empty. Copying an empty string would show a confirmation for
something that did not happen, so the button is disabled until there is
something to copy.

## Can I use it on a multiline column?

It will bind, and it will truncate the display to one line. The copy carries the
whole value, so nothing is lost on the clipboard — but the field will not show
what it holds. Use the platform's multiline control instead, or
[open an issue](https://github.com/pcfhub/pcf-copy-field/issues) if a multiline
variant would be useful.

## Does it work on a phone?

Yes, on both model-driven mobile and canvas phone layouts. The button is 44px
square, which is the touch target size WCAG asks for, and the field shrinks
rather than pushing the button off the screen.

## Does it send the value anywhere?

No. The control declares `external-service-usage` as disabled and makes no
network calls of any kind. The value goes from the column to the clipboard and
nowhere else.

## Can I change the confirmation wording?

Not through a property. Ship another `.resx` alongside the one in
`CopyField/strings/` and list it in the manifest — the same mechanism the
platform uses for any other localisation.
