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
- **Behaviour on a real model-driven form.** Everything here was built and
  checked against the type definitions and the build, not against a Dataverse
  environment. Specifically unverified: whether a given tenant's
  Permissions-Policy grants the clipboard, and how the truncation on a multiline
  column actually looks.
- **The logo.** `media/logo.png` is still the template's placeholder, and
  nothing in CI checks what it looks like.
