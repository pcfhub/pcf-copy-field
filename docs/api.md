---
title: API reference
description: Properties and outputs, generated from the control manifest.
order: 5
---

# API reference

## Input properties

::props-table{kind=input}

## Bound properties

::props-table{kind=bound}

## Outputs

::props-table{kind=output}

## Notes

- **`Value` is both the bound property and the output.** Typing in the field
  raises `notifyOutputChanged`, so the column updates the way any bound control
  updates it. The copy button never writes — it only reads.
- **`Placeholder` is display only.** It is not a default: an empty column stays
  empty, and the placeholder disappears the moment anything is typed. Copying is
  disabled while the value is empty, so a placeholder is never copyable.
- **There is no property for the button's label.** It is built at runtime from
  the field's label on the current form, which is a better name than anything
  that could be configured here and is one fewer thing to keep translated. To
  change the wording itself, ship an additional `.resx` — see the localisation
  note in `CopyField/strings/`.
