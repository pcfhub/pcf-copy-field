# pcf-copy-field — scaffolded and building

Adopted from `_template` (`node scripts/setup.mjs --yes --control CopyField
--namespace PCFHub --slug pcf-copy-field --category utilities ...`), control
code written on top of the standard-field scaffold, and verified with the real
tooling: `npm run build` succeeds through ESLint, `tsc` and webpack, producing
`out/controls/CopyField/bundle.js` that calls
`window.ComponentFramework.registerControl`.

Built as the subject of PCFHub's P6 exit-criterion walk — `_template` to live on
the hub — so it was deliberately chosen to be small. It also fills `utilities`,
which was a curated category with a description, an icon and zero components.

## Platform behaviour worth knowing

**The clipboard is the host's to grant.** `navigator.clipboard.writeText` needs
a secure context *and* the `clipboard-write` Permissions-Policy on every frame
between the top document and the control. A model-driven form hosts code
components in an iframe the control does not own, so whether the modern API
works is a property of the environment rather than of the code. Read from the
MDN/spec requirements rather than observed on a real form — see "Not verified".

The consequence for any control that writes to the clipboard: a `try/catch`
around `writeText` is not defensive coding, it is the normal path. And the
`catch` cannot be silent, because the user's only evidence that a copy happened
is the confirmation you show them.

**`execCommand('copy')` needs a selection in an element that can hold one.** A
`display: none` textarea cannot be selected, so the scratch element is
positioned off-screen instead. Selecting it also moves focus, which has to be
put back on the button or a keyboard user is dropped onto the document after
pressing a control they were sitting on.

**A live region only announces a change.** Writing the same "Copied" string into
`role="status"` twice announces once. Blanking `textContent` before writing is
what makes a second copy audible — invisible to sighted users, and the whole
feature for everyone else.

**`security.readable` has a second consequence on this control.** The usual rule
is that an unchecked `security` renders "no value" where the truth is "not
allowed to see it". Here the copy button has to go with it, or the control
offers to put a value on the clipboard that the user may not read.

## Looking like the form it is on

The first release did not, and the reason is worth writing down because it is
structural rather than a matter of taste.

A standard control cannot mount a `FluentProvider`: the provider is React, and
this is not. The first pass read that as "Fluent's styling is unavailable to a
standard control" and fell back to `font: inherit`, `background: transparent`
and a 1px `rgba(0, 0, 0, 0.25)` border — which inherits the host's *type* and
nothing else. Next to a real form field that is a white bordered box beside a
grey filled one, and the control reads as pasted on.

The half that was missed: `FluentProvider` is what **emits** the design tokens
as CSS custom properties, and a model-driven form already has one above every
code component on the page. Nothing has to be mounted to *read* them. So the
stylesheet is `var(--colorNeutralBackground3, #f5f5f5)` throughout — the token
where the host publishes it, and Fluent's own light-theme literal where it does
not. The control follows the app's theme and brand colour for free in the first
case, and looks right anyway in the second.

**The shape had to change too, not just the colours.** The input and the button
were two boxes side by side; the platform's own fields with a trailing
affordance — phone, email, lookup — are one filled surface with the button
inside it, and the border, the hover and the focus state belong to that surface.
So `.CopyField-row` became `.CopyField-field`, and it carries all of them.

**The focus underline is a scaled pseudo-element, not a border.** A
`border-bottom` that appears on focus is 2px of height the box did not have a
moment ago, so every field below it on the form nudges down as the user tabs
through. Fluent scales an absolutely-positioned `::after` from `scaleX(0)`
instead, with a `clip-path` trimming a 4px box down to a 2px line — the height
has to clear the corner radius or the line stops short of the rounded ends. The
timing is asymmetric on purpose: fast and accelerating out, slower and
decelerating in, so arriving in a field is what the eye catches.

Every value here was read out of `@fluentui/react-input`'s compiled styles and
`@fluentui/tokens` rather than sampled from a screenshot.

**The new wrapper needed `[hidden] { display: none }`, and that is not
defensive.** `element.hidden` works by way of a UA rule `[hidden] { display:
none }`, which any author `display` declaration outranks — so giving the field
`display: flex` silently broke `field.hidden = true`. The branch it broke is the
field-level-security one: the only branch nobody exercises, and the one where
failing open renders an empty grey box where "you may not see this value" should
be the only thing on the form.

**The dark fallbacks key off `fluentDesignLanguage.isDarkTheme`, not
`prefers-color-scheme`.** A model-driven app carries its own theme and the OS
setting says nothing about it, so the media query would paint `#141414` behind a
light app's white on any OS-dark machine. Absent means absent: no class, light
fallbacks, which is the same guess the host makes when it does not say.

**The button is a glyph now**, Fluent's `Copy16Regular` path data inlined rather
than the word "Copy" — the 16px cut, not the 20px one scaled down, because
Fluent redraws each size and a scaled 20px glyph has strokes a fifth too thin.
It swaps to `Checkmark16Regular` for the three seconds the confirmation stands.
That removed the `CopyField_Copy` resource string, since nothing renders a bare
verb any more, and it makes `CopyField_CopyLabel` the button's tooltip as well
as its accessible name — a glyph has no other way to say what it does.

The failure path deliberately does **not** get an icon. There is no glyph that
reads as "did not happen", and the wrong one read at a glance is worse than
none, given that the whole point of that path is that the user must not walk
away believing they have the value.

**The 44px touch target went.** It was 2.5.5 at AAA and it is now 28px, which
clears 2.5.8's 24px at AA. A 44px control cannot sit inside a 32px field, and a
field that is not 32px tall is not the platform's field.

Verified by serving the built stylesheet against the DOM the control constructs
and reading computed styles: 32px field, `#f5f5f5` fill, transparent borders,
4px radius, a 2px `#0f6cbd` underline that animates on `:focus-within`, a 28px
button holding a 16px glyph that turns `#0e700e` in the copied state, and the
dark class flipping the fill to `#141414` and the brand to `#479ef5`. Also
checked that setting `--colorNeutralBackground3` on the document overrides both
palettes, which is the whole premise of the token-with-fallback approach.

## Demo

`fidelity: "full"`. It shipped as `"limited"` for one release on a piece of
reasoning that turned out to be wrong, and the way it was caught is the useful
part of this section.

The reasoning: PCFHub's harness sandboxes controls to `sandbox="allow-scripts"`
on an opaque origin with no `allow="clipboard-write"`
(`resources/js/features/demo/demo-frame.tsx` in the hub, PLAN §13.3). That is
accurate, and it does deny `navigator.clipboard`. The error was carrying the
conclusion across to the fallback: `document.execCommand('copy')` predates
Permissions-Policy and is not gated by it, so it succeeds in exactly the frame
the modern API is refused in. The control copies in the demo, verified by
pressing the button and pasting the result outside the browser.

So the fallback that exists for hostile hosts is what makes the demo work, and
the manifest claimed the opposite. Two lessons, and the second is the one worth
carrying: a two-path design has to be reasoned about per path, not per API; and
a fidelity claim is a claim about *behaviour*, which means pressing the button
is the only thing that establishes it. `limited` was argued from markup and it
was wrong within one release.

## Not verified

- ~~That the clipboard fails in the harness.~~ **Settled, and settled against
  the guess** — see Demo above. It stayed wrong exactly as long as nobody
  pressed the button, which is the argument for the harness test §Verification
  Plan assigns and P4 and P5 both left open: a test that drives a real control
  inside the demo iframe would have caught this before the release rather than
  after it.
- **Which of the two paths runs, per browser.** Verified only in the browser it
  was tested in. `navigator.clipboard` may well succeed in some hosts where the
  fallback is what carries others; the control reports success either way and
  does not record which path it took.
- **Behaviour on a real model-driven form.** ~~Everything here was built and
  checked against the type definitions and the build, not against a Dataverse
  environment.~~ **Settled for the cases the screenshots cover.**
  `media/at-rest.png` and `media/copied.png` are a Dataverse model-driven form,
  confirmed by the person who took them. They establish:

  - it renders at field height, with the filled surface, the trailing glyph and
    the label alignment of the platform's own fields beside it — which is the
    whole point of the styling rewrite, and the only evidence for it that a
    computed-style read cannot give;
  - the focus underline draws (visible along the bottom of the second shot);
  - **a copy actually succeeded inside a model-driven iframe** — the checkmark
    and "Copied to the clipboard." are written only by
    `confirm('CopyField_Copied')`, reached only after one of the two clipboard
    paths returns true. So the Permissions-Policy question is answered *for this
    tenant*: something works. Which of the two paths did the work is the open
    item above.

  **The pixels were measured rather than eyeballed**, by drawing both PNGs to a
  canvas and reading the histogram back. Every colour is an exact match to the
  value in `@fluentui/tokens` — no drift, no near-miss:

  | Measured | Hex | Token |
  | --- | --- | --- |
  | Field fill (7,162 px) | `#f5f5f5` | `colorNeutralBackground3` |
  | Focus underline (496 px) | `#0f6cbd` | `colorCompoundBrandStroke` |
  | Checkmark | `#0e700e` | `colorPaletteGreenForeground1` |
  | Value text | `#242424` | `colorNeutralForeground1` |
  | Confirmation text (65 px) | `#424242` | `colorNeutralForeground2` |

  That is the styling rewrite verified end to end in the host it was written
  for, which is as far as a screenshot can carry it.

  Still open, and this is the part the measurement specifically *cannot* settle:
  **whether those colours came from the host's tokens or from the literal
  fallbacks.** They are the same values by construction — the fallbacks were
  copied out of Fluent's light theme precisely so that both paths land here — so
  an exact match is consistent with either. The underline being `#0f6cbd` does
  rule out one combination: this is not a custom-branded environment reading
  live tokens, because a branded org would have tinted that line. It cannot
  separate "unbranded org, tokens resolving" from "tokens absent, fallbacks
  doing the work".

  Two shots would separate them, and neither is worth a special trip:

  - the same field in a **dark** model-driven app — if the fill goes `#141414`
    the theming path works, whichever half of it did the work;
  - the same field in a **brand-customised** environment — if the underline
    takes the org's brand colour, the tokens are genuinely resolving.

  Also still unverified: how the truncation on a multiline column looks.
- **The logo.** `media/logo.png` is still the template's placeholder, and
  nothing in CI checks what it looks like. The two screenshots beside it are
  real; the logo is not.
- **That a model-driven form actually publishes the Fluent tokens this control
  reads.** The mechanism is right — `FluentProvider` emits them as custom
  properties and UCI mounts one — and the control now demonstrably renders
  correctly on a real form. But that is not the same claim: as the pixel
  measurement above works through, the token path and the fallback path produce
  identical output in an unbranded light theme, so a correct screenshot is
  evidence for the *outcome* and not for the *mechanism*.

  Worth keeping in that order, because it is the reassuring version that is
  wrong: "it looks right on a form, so the tokens must be resolving" does not
  follow, and the difference matters the first time somebody puts this control
  in a dark or branded app. One line in DevTools on a real form settles it —
  `getComputedStyle(document.documentElement).getPropertyValue('--colorNeutralBackground3')`
  is either a colour or empty.
