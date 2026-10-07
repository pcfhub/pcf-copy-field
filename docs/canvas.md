---
title: Canvas apps
description: Adding Copy Field to a canvas app or custom page.
order: 3
---

# Using it in a canvas app

:::steps
1. From **Insert → Get more components**, open the **Code** tab and import
   **Copy Field**.
2. Place it from **Insert → Code components**.
3. Bind `Value` to whatever you want copied, and set `Placeholder` if the empty
   state needs a hint.
:::

## Binding

```powerfx
CopyField1.Value: ThisItem.'Case number'
CopyField1.Placeholder: "No reference yet"
```

The control writes back, so `CopyField1.Value` is also the output — the usual
canvas pattern of reading the control's own property applies:

```powerfx
// On a Patch, for example
Patch(Cases, ThisItem, { 'Case number': CopyField1.Value })
```

## What a canvas app does not have

A canvas app does not describe the column behind a binding, even when the
value comes from Dataverse, so two behaviours that appear on a model-driven
form are absent here rather than broken:

- **No maximum length.** A model-driven form takes it from the column. In canvas
  there is nothing to take it from, so the input is unbounded — enforce it in
  your own validation if it matters.
- **No field-level security.** The "you do not have access to this value" state
  cannot occur, because canvas has no per-column permission to report.

Neither needs configuration. The control narrows its behaviour when there is a
column and does without when there is not.

:::callout{type=warning}
**0.2.1 and earlier stopped every canvas field at 100 characters.** A canvas
app reports a maximum length of 100 for any text property, bound to anything,
and those versions believed it: a Dataverse column that takes 850 characters on
a form took 100 here, and a value already longer than 100 could not be typed
into at all. 0.2.2 takes a limit only from a real column.

Importing 0.2.2 does not update an app that already has the control. Open the
app in Studio, accept the update if it is offered, then **save and publish** —
if Save is greyed out, change any formula first.
:::

:::callout{type=info}
`DisplayMode` works as expected: `DisplayMode.View` disables the input and keeps
the copy button, which is usually exactly what a read-only screen wants.
:::
