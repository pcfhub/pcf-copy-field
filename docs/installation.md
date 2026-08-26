---
title: Installation
description: Import the solution and make the control available.
order: 2
---

# Installation

:::steps
1. Download the **managed** solution for your environment.
2. In the Power Platform admin centre, import the solution.
3. Publish all customizations.
4. Enable **Code components for canvas apps** if this control is used there.
:::

:::callout{type=warning}
Import the managed solution into production. The unmanaged one is for a
development environment where you intend to change the control itself — it
cannot be cleanly uninstalled.
:::

## Requirements

Nothing beyond a current Power Platform environment. The control has no runtime
dependencies — no React, no Fluent, no third-party library — so there is nothing
to install first and nothing to keep in step with a platform upgrade.

It declares `external-service-usage` as disabled, so it is not treated as a
premium component and asks the installing maker for no permissions.

## After importing

The clipboard is worth a moment's thought before this reaches users. The control
prefers `navigator.clipboard`, which a browser grants only to a secure context
that has been given the `clipboard-write` permission — and in a model-driven app
the frame it runs in belongs to the platform, not to the control.

:::callout{type=info}
If your organisation sets a Permissions-Policy that withholds the clipboard, the
control falls back to an older mechanism and, failing that, tells the user to
copy manually. It never fails silently. Worth testing once in your own
environment rather than assuming, since the answer is a property of your setup
and not of the control — see [Limitations](limitations.md).
:::
