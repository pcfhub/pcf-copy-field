---
title: Examples
description: Three configurations, and what each one is for.
order: 6
---

# Examples

## A read-only reference number

The case the control exists for. A generated identifier nobody may edit, which
everybody needs to paste into an email.

Model-driven: add the component to the column, and leave the field locked as it
already is. Nothing else to configure — the button stays because the value is
readable, and the input is disabled because the column is not editable.

Canvas:

```powerfx
CopyField1.Value: ThisItem.'Case number'
CopyField1.DisplayMode: DisplayMode.View
```

## An editable field that is also worth copying

An API key or a webhook URL a user both maintains and hands to somebody else.
Nothing special is required: the control is editable by default, and the copy
button works the same whether or not the field is.

```powerfx
CopyField1.Value: ThisItem.'Webhook URL'
CopyField1.Placeholder: "https://…"
```

## A value assembled from other fields

Copying something the column does not itself contain — a full reference built
out of two columns, say. Bind the display to the composed string rather than to
a stored column:

```powerfx
CopyField1.Value: ThisItem.Prefix & "-" & Text(ThisItem.Number, "0000")
```

:::callout{type=warning}
Do this only where nothing writes back. The control raises its output on every
keystroke, so a user who edits a composed value produces a string your `Patch`
has no way to split apart again. Set `DisplayMode.View` and the question does
not arise.
:::
