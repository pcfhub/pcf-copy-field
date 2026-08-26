---
title: Model-driven apps
description: Adding Copy Field to a form.
order: 4
---

# Using it on a model-driven form

:::steps
1. Open the form in the modern form designer.
2. Select the column this control binds to.
3. Under **Components → Add component**, choose **Copy Field**.
4. Enable it for **Web**, **Phone** and **Tablet** as appropriate.
5. Save and publish.
:::

## Column types

Binds to any column the platform presents as `SingleLine.Text` — the **Text**,
**Email**, **URL** and **Phone** formats all qualify. A **Text Area** or
multiline column will bind, and should not: the control renders a single-line
input, so the display truncates while the copy still carries the whole value.

The column's **Maximum length** is honoured on the input, so a user cannot type
past what the column will store.

## Read-only fields

This is what the control is for. A locked or calculated column keeps its copy
button — the value is readable, so it is copyable — while the field itself is
disabled. Nothing needs configuring for this; the control reads the form's
read-only state and the column's own editability separately, and only the second
of those has any bearing on the button.

:::callout{type=info}
Field-level security is a different thing again. A user without **Read** on the
column sees neither the value nor the button, and gets a message saying so —
rather than an empty field, which is what an unchecked control would show and
which reads as "there is nothing here".
:::

## Labels

The button's accessible name is built from the field's label on *this* form, so
a form carrying several of these presents "Copy Case number" and "Copy Account
number" rather than several buttons called "Copy". Rename the field on the form
and the button's name follows; there is nothing to configure.
