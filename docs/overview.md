---
title: Overview
description: A bound text column with a copy button, a spoken confirmation, and an honest failure state.
order: 1
---

# Copy Field

A text column with a copy-to-clipboard button and a confirmation.

::image{src=media/at-rest.png alt="A form field labelled Account Number holding ABCO9M32, with a copy icon at the right-hand end of the field."}

Pressing the button swaps the icon for a checkmark and writes the confirmation
below the field, where it is also announced to a screen reader:

::image{src=media/copied.png alt="The same field after copying: a green checkmark in place of the copy icon, the blue focus underline along the bottom of the field, and the text Copied to the clipboard beneath it."}

## Why this one

The value people most often need to copy out of a form is the one they are not
allowed to edit — a case reference, a generated account number, an API key, a
correlation id from an integration. On a read-only field the platform gives them
no affordance at all, so they select the text by hand and hope they caught the
whole string.

This control adds the button and, more importantly, tells the truth about
whether it worked:

- **The confirmation is announced, not just shown.** "Copied" is the entire
  feedback a copy gives, so it is written into a `role="status"` live region.
  Nothing about copying moves focus or changes the page, which means a screen
  reader user gets no signal at all unless one is deliberately provided.
- **A failed copy says so.** The clipboard is not always reachable from inside a
  code component (see [Limitations](limitations.md)), and a button that quietly
  does nothing is worse than no button — the user walks away believing they have
  the value.
- **The button follows readability, not editability.** A read-only field keeps
  its copy button, because that is the case the control exists for. A field the
  user is not permitted to *read* loses both the button and the value.
- **It looks like the field beside it.** The input and the button are one filled
  surface with one border and one animated focus underline — the same shape the
  platform draws for its own phone, email and lookup fields. The colours are
  read from Fluent's design tokens where the host publishes them, so the control
  follows the app's theme and brand rather than carrying its own.

## What it works with

:::callout{type=info}
Model-driven forms and canvas apps, including custom pages. Any column that
comes through as `SingleLine.Text` — which includes the text, email, URL and
phone formats.

Not for multiline text: the control renders a single-line `input`, so a
multiline column would be silently truncated in the display even though the copy
itself would carry the whole value.
:::
