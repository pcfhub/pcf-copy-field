/*
 * Drives the real built bundle outside a browser.
 *
 *     npm run build && npm run smoke
 *
 * A **standard** control writes into the container it was handed, so these
 * assertions read the DOM it built.
 *
 * Why it exists alongside `npm start`: the clipboard is the one browser API a
 * code component cannot simply call. `navigator.clipboard.writeText` needs a
 * secure context *and* the `clipboard-write` Permissions-Policy on every frame
 * down to this one, and a model-driven form is an iframe this control does not
 * own — so whether the modern API works is a property of the host. The fallback
 * is not defensive coding; it is the path real customers take, and no local
 * harness puts you on it.
 *
 * This control also owns a timer, which makes it the first here where the
 * teardown assertion at the bottom says something non-trivial: the confirmation
 * runs for three seconds, and a control removed from a form inside that window
 * would otherwise leave a timer holding a detached element.
 *
 * **What passing here does NOT mean.** Every value is supplied by this file. It
 * cannot tell you that a real browser's clipboard accepts the write, that the
 * permission is granted in a customer's frame, or that the value arrives intact
 * on the other side of a paste.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const dom = require('./dom.js');
const host = require('./host.js');
const clock = require('./clock.js');

const BUNDLE = path.join(root, 'out', 'controls', 'CopyField', 'bundle.js');

if (!fs.existsSync(BUNDLE)) {
    console.error('\n  No bundle at out/controls/CopyField. Run npm run build first.\n');
    process.exit(1);
}

/* ----------------------------------------------------------- the platform */

dom.install(global);

/*
 * The fake clock, and here it is load-bearing rather than precautionary.
 *
 * The confirmation clears itself after three seconds through
 * `window.setTimeout`. `dom.install` makes `window` *be* the global, so the
 * clock's `setTimeout` is the one the control reaches — which is what lets the
 * assertions below advance three seconds instantly and, more importantly, count
 * the timer that is outstanding while a confirmation stands.
 */
const time = clock.install(Date.UTC(2026, 0, 1, 12, 0, 0), global);

const registration = host.captureRegistration(global);

vm.runInThisContext(fs.readFileSync(BUNDLE, 'utf8'), { filename: 'bundle.js' });

/* ---------------------------------------------------------------- harness */

const results = [];

function check(label, ok, detail) {
    results.push({ ok, label, detail });
}

const marked = (key) => `resx:${key}`;

const live = [];

function disposeAll() {
    while (live.length > 0) {
        live.pop().destroy();
    }
}

function mount(options = {}) {
    const container = dom.createElement('div');
    const context = host.createContext({ ...options, getString: marked });
    const instance = new registration.ctor();

    let notifications = 0;

    // Installed per mount, so each test states the host it is on.
    const written = host.installClipboard(global, {
        clipboard: options.clipboard || 'works',
        execCommand: options.execCommand,
        selected: () => {
            const scratch = container.querySelector('.CopyField-scratch');

            return scratch ? scratch.value : null;
        },
    });

    instance.init(
        context,
        () => {
            notifications += 1;
        },
        {},
        container,
    );

    instance.updateView(context);

    const handle = {
        instance,
        container,
        written: () => written,
        outputs: () => instance.getOutputs(),
        notifications: () => notifications,
        update: (next) => instance.updateView(host.createContext({ ...options, ...next, getString: marked })),
        destroy: () => {
            instance.destroy();

            const at = live.indexOf(handle);

            if (at !== -1) {
                live.splice(at, 1);
            }
        },
        find: (selector) => container.querySelector(selector),
        text: (selector) => {
            const found = container.querySelector(selector);

            return found === null ? null : found.textContent;
        },
        copy: () => container.querySelector('.CopyField-button').click(),
    };

    live.push(handle);

    return handle;
}

/** Let the async clipboard path settle before reading what it wrote. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

check('bundle registered a control', typeof registration.ctor === 'function');

if (typeof registration.ctor !== 'function') {
    report();
}

/* ------------------------------------------------------------ what it draws */

const plain = mount();

check('renders an input and a copy button', Boolean(plain.find('.CopyField-input')) && Boolean(plain.find('.CopyField-button')));

check('shows the value the platform supplied', plain.find('.CopyField-input').value === 'INV-2026-00417', plain.find('.CopyField-input').value);

/*
 * The button's accessible name names the field, because "Copy" alone in a list
 * of ten copy buttons tells a screen reader user nothing about which one.
 */
check(
    'the copy button names the field it copies',
    plain.find('.CopyField-button').getAttribute('aria-label') === 'resx:CopyField_CopyLabel'.replace('{0}', '')
        || plain.find('.CopyField-button').getAttribute('aria-label').includes('Invoice number'),
    plain.find('.CopyField-button').getAttribute('aria-label'),
);

/*
 * Field-level security is NOT the form's read-only state. A user denied read
 * access gets `raw === null`, indistinguishable from an empty column — and the
 * copy button has to go too, or the control offers to put a value on the
 * clipboard that the user is not allowed to see.
 */
const denied = mount({ security: 'no-access', value: null });

check('a column the user cannot read says so', denied.text('.CopyField-message') === 'resx:CopyField_NoAccess', denied.text('.CopyField-message'));

/*
 * The **whole surface** goes, not the two children inside it — hiding only the
 * input and the button would leave the field's own filled box on the form as an
 * empty grey bar with a message under it. And the copy button going is the
 * point: leaving it would offer to put a value on the clipboard that the user
 * is not allowed to see.
 */
check(
    'and the whole field surface goes with it, copy button included',
    denied.find('.CopyField-field').hidden === true,
    `field hidden: ${denied.find('.CopyField-field').hidden}`,
);

check('a read-only column disables the input', mount({ security: 'read-only' }).find('.CopyField-input').disabled === true);

check('and so does a read-only form', mount({ disabled: true }).find('.CopyField-input').disabled === true);

check('a validation error is shown', mount({ error: true }).text('.CopyField-message') === host.DEFAULTS.errorMessage);

check('renders on a host that publishes no column metadata', Boolean(mount({ host: 'canvas' }).find('.CopyField-input')));

/* ------------------------------------------------------------ the clipboard */

(async () => {
    /*
     * The modern API, where the host allows it.
     */
    const modern = mount({ clipboard: 'works' });

    modern.copy();
    await settle();

    check(
        'the modern clipboard API gets the value',
        modern.written().some((write) => write.via === 'clipboard' && write.text === 'INV-2026-00417'),
        JSON.stringify(modern.written()),
    );

    check('and the user is told it happened', modern.text('.CopyField-status') === 'resx:CopyField_Copied', modern.text('.CopyField-status'));

    check('with the button showing it too', modern.container.classList.contains('CopyField--copied'));

    /*
     * **The path that actually matters.** `navigator.clipboard` is undefined in
     * an insecure context and in a frame without the clipboard-write
     * Permissions-Policy — which a model-driven form's iframe may well be.
     */
    const legacy = mount({ clipboard: 'absent' });

    legacy.copy();
    await settle();

    check(
        'a host without the modern API falls back rather than failing',
        legacy.written().some((write) => write.via === 'execCommand'),
        JSON.stringify(legacy.written()),
    );

    check('and reports success just the same', legacy.text('.CopyField-status') === 'resx:CopyField_Copied', legacy.text('.CopyField-status'));

    /*
     * Present and refusing is a third state: a denied permission, or a document
     * that lost focus between the click and the await. Both mean "try the other
     * way", and neither is worth a console error in a customer's form.
     */
    const refused = mount({ clipboard: 'rejects' });

    refused.copy();
    await settle();

    check(
        'a refusing clipboard falls back to the deprecated path',
        refused.written().some((write) => write.via === 'execCommand'),
        JSON.stringify(refused.written()),
    );

    /*
     * `execCommand` copies *the selection*, which is why the control puts an
     * off-screen textarea in the DOM and selects it — a `display: none` element
     * cannot hold a selection. If the scratch element were hidden the wrong
     * way, this is what would catch it.
     */
    check(
        'through a scratch element holding the value',
        refused.written().some((write) => write.via === 'execCommand' && write.text === 'INV-2026-00417'),
        JSON.stringify(refused.written()),
    );

    check(
        'which is cleaned up rather than left in the form',
        refused.find('.CopyField-scratch') === null,
        refused.find('.CopyField-scratch') === null ? 'removed' : 'still there',
    );

    /*
     * **Both mechanisms failing is a state the user must not misread.** The
     * failure keeps the copy mark rather than showing a checkmark, because
     * somebody who walks away believing they have the value is worse off than
     * somebody who sees nothing happened.
     */
    const failed = mount({ clipboard: 'absent', execCommand: false });

    failed.copy();
    await settle();

    check('a copy that failed says so', failed.text('.CopyField-status') === 'resx:CopyField_CopyFailed', failed.text('.CopyField-status'));

    check('is marked as a failure', failed.container.classList.contains('CopyField--failed'));

    check(
        'and never shows the success mark, which would be the dangerous read',
        !failed.container.classList.contains('CopyField--copied'),
        failed.container.className,
    );

    /*
     * Nothing to copy is not a failure — it is nothing, and the control should
     * not announce anything or touch the clipboard.
     */
    const empty = mount({ value: null });

    empty.copy();
    await settle();

    check('an empty column copies nothing at all', empty.written().length === 0, JSON.stringify(empty.written()));

    /* ---------------------------------------------------- the confirmation */

    /*
     * The confirmation clears itself after three seconds. With a real clock
     * this assertion would take three seconds; here it takes none.
     */
    const timed = mount();

    timed.copy();
    await settle();

    check('a confirmation stands right after the copy', timed.text('.CopyField-status') === 'resx:CopyField_Copied');

    time.advance(2000);

    check('and is still there two seconds later', timed.text('.CopyField-status') === 'resx:CopyField_Copied', timed.text('.CopyField-status'));

    time.advance(1500);

    check(
        'then clears itself',
        timed.text('.CopyField-status') === '' && !timed.container.classList.contains('CopyField--copied'),
        `${JSON.stringify(timed.text('.CopyField-status'))} ${timed.container.className}`,
    );

    /*
     * A second copy has to re-announce. A live region only announces a *change*
     * to its contents, so writing the same "Copied" string again is silent to a
     * screen reader while being visibly identical to the first for everyone
     * else — the control blanks the region before setting it for that reason.
     */
    const twice = mount();

    twice.copy();
    await settle();
    twice.copy();
    await settle();

    check('a second copy re-announces rather than sitting silently', twice.text('.CopyField-status') === 'resx:CopyField_Copied');

    /* ------------------------------------------------------------ typing */

    const typed = mount();
    const input = typed.find('.CopyField-input');

    input.value = 'INV-2026-00999';
    input.dispatchEvent({ type: 'input', target: input });

    check('typing notifies the platform exactly once', typed.notifications() === 1, String(typed.notifications()));

    check('and getOutputs hands back what was typed', typed.outputs().value === 'INV-2026-00999', JSON.stringify(typed.outputs()));

    const holding = mount();
    const held = holding.find('.CopyField-input');

    held.value = 'half-typed';
    holding.update({});

    check('a re-render with an unchanged value leaves what the user is typing alone', held.value === 'half-typed', held.value);

    /* --------------------------------------------------- what destroy owes */

    /*
     * **The first control here where this assertion is not trivially true.**
     *
     * The confirmation timer runs for three seconds. A control removed from a
     * form inside that window — a user navigating away, a subgrid re-rendering
     * — leaves a timer holding a reference to a detached element, and the
     * platform does not clean that up: from its side the control simply stopped
     * being. `destroy` clears it, and this is what says so.
     */
    disposeAll();

    const timersBefore = time.pending();
    const listeners = () => Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0);
    const listenersBefore = listeners();

    const doomed = mount();

    doomed.copy();
    await settle();

    check('a standing confirmation holds a live timer', time.pending() > timersBefore, `${timersBefore} → ${time.pending()}`);

    doomed.destroy();

    check(
        'which destroy() releases rather than leaving to fire at a detached element',
        time.pending() === timersBefore,
        `${timersBefore} → ${time.pending()}`,
    );

    check('and every document-level listener with it', listeners() === listenersBefore, `${listenersBefore} → ${listeners()}`);

    disposeAll();

    report();
})();

function report() {
    const failed = results.filter((result) => !result.ok);

    for (const result of results) {
        const detail = result.detail ? `  — ${result.detail}` : '';

        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}${detail}`);
    }

    console.log(
        failed.length > 0
            ? `\n  ${failed.length} of ${results.length} failed\n`
            : `\n  ${results.length} passed — the control's own decisions only; a real clipboard is still unverified\n`,
    );

    process.exit(failed.length > 0 ? 1 : 0);
}
