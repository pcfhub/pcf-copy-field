import { IInputs, IOutputs } from './generated/ManifestTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Fluent's own `Copy16Regular` and `Checkmark16Regular`, as path data.
 *
 * Copied out of `@fluentui/react-icons` rather than drawn, so the glyph on this
 * button is the same shape the platform draws on its own — a hand-made copy
 * mark next to a form full of Fluent icons is visible as wrong long before
 * anybody can say which line of it is off. The 16px cuts, not the 20px ones
 * scaled down: Fluent redraws each size rather than scaling, and a 20px glyph in
 * a 16px box has strokes that are a fifth too thin.
 *
 * They are inlined as data instead of imported because `@fluentui/react-icons`
 * is a React package and this is a standard control, and installing it to reach
 * two paths would put the whole icon set's module graph in the bundle.
 */
const ICON_PATHS = {
    copy:
        'M5 6H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1h1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0' +
        '-1.1.9-2 2-2h1zm7-4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2zM8 3a1 ' +
        '1 0 0 0-1 1v5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z',
    copied:
        'M13.86 3.66a.5.5 0 0 1-.02.7l-7.93 7.48a.6.6 0 0 1-.84-.02L2.4 9.1a.5.5 0 0 1 .72-.7l2.4 ' +
        '2.44 7.65-7.2a.5.5 0 0 1 .7.02',
} as const;

/**
 * A bound text column, plus a button that puts its value on the clipboard.
 *
 * The interesting part of this control is not the copying. It is that the
 * clipboard is the one browser API a code component cannot simply call and
 * assume worked: a model-driven form hosts its controls in an iframe, and
 * `navigator.clipboard` is gated behind both a secure context and a
 * Permissions-Policy the host frame controls rather than this control. So
 * `copy()` below has a fallback and, more importantly, reports failure to the
 * user instead of silently doing nothing — a copy button that does nothing is
 * worse than no copy button, because the user walks away believing they have
 * the value.
 */
export class CopyField implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    /** The filled box the input and the button share. See the stylesheet. */
    private field!: HTMLDivElement;
    private input!: HTMLInputElement;
    private button!: HTMLButtonElement;
    private status!: HTMLParagraphElement;
    private message!: HTMLParagraphElement;
    private notifyOutputChanged!: () => void;
    private value = '';

    /** Cleared on the next copy, so two copies in a row re-announce. */
    private confirmationTimer: number | undefined;

    /**
     * Held rather than passed around, because the confirmation is written from
     * a timer callback that has no `context` of its own.
     */
    private resources!: ComponentFramework.Resources;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;
        this.resources = context.resources;

        this.input = document.createElement('input');
        this.input.className = 'CopyField-input';
        this.input.type = 'text';
        this.input.addEventListener('input', this.onInput);

        this.button = document.createElement('button');
        this.button.className = 'CopyField-button';
        // Explicitly `button`. The default is `submit`, and a code component
        // inside a canvas app can sit in a real form — where a submit button
        // that was only meant to copy a string posts the form instead.
        this.button.type = 'button';
        this.button.addEventListener('click', this.onCopy);

        /*
         * Both glyphs are built once and CSS shows one of them, rather than the
         * path data being swapped on each copy. `updateView` runs on every
         * change to every bound value on the form, so anything rebuilt in it is
         * rebuilt constantly — and this button's contents in particular must
         * survive a render, since the confirmation is on a timer that
         * `updateView` knows nothing about.
         *
         * `aria-hidden` on both: the button's accessible name comes from its
         * `aria-label`, and an unlabelled `<svg>` inside a labelled button is at
         * best noise and at worst a second name.
         */
        this.button.append(
            CopyField.createIcon('copy', 'CopyField-icon CopyField-icon--copy'),
            CopyField.createIcon('copied', 'CopyField-icon CopyField-icon--copied'),
        );

        /*
         * The confirmation is a live region, and it is separate from the
         * validation message on purpose.
         *
         * "Copied" is the entire feedback a sighted user gets, so a screen
         * reader user must get it too — and `aria-live` is the only way, since
         * nothing about a copy moves focus or changes the page. `polite`
         * because it is a courtesy, not an interruption.
         *
         * It cannot share an element with `.CopyField-message`: that one holds
         * the platform's validation text, and a live region that is sometimes a
         * validation error announces the error again every time somebody
         * copies.
         */
        this.status = document.createElement('p');
        this.status.className = 'CopyField-status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');

        // The platform's own validation message. Without somewhere to put it,
        // a failing business rule is silent inside a code component.
        this.message = document.createElement('p');
        this.message.className = 'CopyField-message';

        /*
         * One box holding both, not two boxes beside each other.
         *
         * The platform's own fields with a trailing affordance — phone, email,
         * lookup — are a single filled surface with the button inside it, and
         * the border, the hover and the focus underline belong to that surface
         * rather than to either child. Rendering an input next to a separate
         * button is what makes a code component look pasted onto the form.
         */
        this.field = document.createElement('div');
        this.field.className = 'CopyField-field';
        this.field.append(this.input, this.button);

        this.container.classList.add('CopyField');
        this.container.append(this.field, this.status, this.message);

        this.render(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.resources = context.resources;
        this.render(context);
    }

    public getOutputs(): IOutputs {
        return { value: this.value };
    }

    public destroy(): void {
        this.input.removeEventListener('input', this.onInput);
        this.button.removeEventListener('click', this.onCopy);

        // A control removed from a form mid-confirmation otherwise leaves a
        // timer holding a reference to a detached element. The platform does
        // not clean that up — from its side the control simply stopped being.
        if (this.confirmationTimer !== undefined) {
            window.clearTimeout(this.confirmationTimer);
        }
    }

    private render(context: ComponentFramework.Context<IInputs>): void {
        const parameter = context.parameters.value;

        // Before the visibility guard, so the no-access message is themed too.
        this.applyTheme(context);

        // Canvas relies on this; a model-driven form hides the section itself.
        // Honouring it costs one class and covers both hosts.
        this.container.classList.toggle('CopyField--hidden', !context.mode.isVisible);

        if (!context.mode.isVisible) {
            return;
        }

        // Field-level security is NOT the same as the form's read-only state,
        // and conflating them is a real information bug. A user denied read
        // access gets `raw === null` — indistinguishable from "empty" unless
        // `security.readable` is checked, so an unchecked control renders
        // "no value" where the truth is "not allowed to see it".
        //
        // For this control there is a second consequence: the copy button has
        // to go too. Leaving it would offer to put a value on the clipboard
        // that the user is not permitted to read.
        const security = parameter.security;

        if (security !== undefined && !security.readable) {
            // The whole surface goes, not the two children inside it. Hiding
            // only the input and the button would leave the field's own filled
            // box on the form as an empty grey bar with a message under it.
            this.field.hidden = true;
            this.message.hidden = false;
            this.message.textContent = this.resources.getString('CopyField_NoAccess');

            return;
        }

        this.field.hidden = false;

        const incoming = parameter.raw ?? '';

        // Guarded, not assigned unconditionally: writing `value` while the user
        // is typing moves the caret to the end of the field on every keystroke.
        if (incoming !== this.value) {
            this.value = incoming;
            this.input.value = incoming;
        }

        this.input.placeholder = context.parameters.placeholder.raw ?? '';

        // Two independent reasons to be read-only. `isControlDisabled` is the
        // form's; `security.editable` is the column's.
        //
        // Note what is *not* disabled here: the copy button. A read-only field
        // is exactly the case where copying is most useful — a system-generated
        // reference number nobody may edit is the canonical example — so the
        // button follows the value's readability, not its editability.
        this.input.disabled =
            context.mode.isControlDisabled || (security !== undefined && !security.editable);

        // The class is what the fill, the border and the underline key off:
        // Fluent's disabled field is a different surface, not a dimmer one, and
        // `:disabled` on the input alone cannot reach the box around it.
        this.container.classList.toggle('CopyField--disabled', this.input.disabled);

        // Nothing to copy is a real state, and a button that copies an empty
        // string is a button that lies about having done something.
        this.button.disabled = this.value === '';

        // `attributes` is optional because a canvas app has no column metadata
        // at all. That single `?` is the whole canvas/model-driven difference:
        // narrow behaviour when it is present, do not require it.
        const maxLength = parameter.attributes?.MaxLength;

        if (maxLength !== undefined) {
            this.input.maxLength = maxLength;
        }

        // `mode.label` is the label the maker gave the field on this form,
        // which is a better accessible name than anything shipped in the .resx.
        // The resource string is the fallback, not the default.
        const label = context.mode.label || this.resources.getString('CopyField_Name');

        this.input.setAttribute('aria-label', label);

        // The button's name names the *field*, not the action alone. A form
        // with four of these on it otherwise presents four buttons called
        // "Copy" in a screen reader's element list, which is four ways to
        // describe nothing.
        const buttonLabel = this.resources.getString('CopyField_CopyLabel').replace('{0}', label);

        this.button.setAttribute('aria-label', buttonLabel);

        // The same string as a tooltip, because the button is now a glyph. A
        // sighted user who does not recognise the copy mark has no other way to
        // find out what it does, and `title` is the affordance the platform's
        // own icon-only field buttons use.
        //
        // Not a replacement for the `aria-label` — a screen reader may be
        // configured to ignore `title`, and a touch user has no hover.
        this.button.title = buttonLabel;

        this.container.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';
        this.container.classList.toggle('CopyField--invalid', parameter.error);
        this.input.setAttribute('aria-invalid', String(parameter.error));

        this.message.hidden = !parameter.error;
        this.message.textContent = parameter.error ? parameter.errorMessage : '';
    }

    /**
     * The stylesheet reads Fluent's design tokens with a literal fallback, and
     * this decides which set of fallbacks is in play.
     *
     * Only the fallbacks — a host that emits the tokens is already handing over
     * its own dark values through the `var()`, and the class changes nothing
     * there. It matters for the hosts that emit nothing, which includes PCFHub's
     * demo harness and any canvas app.
     *
     * `@media (prefers-color-scheme: dark)` is the obvious hook and it is the
     * wrong question: a model-driven app carries its own theme and the operating
     * system's setting says nothing about it, so an OS-dark machine on a light
     * app would paint #141414 behind the form's white. Absent means absent —
     * writing no class leaves the light fallbacks, which is the same guess the
     * host itself makes when it does not say.
     */
    private applyTheme(context: ComponentFramework.Context<IInputs>): void {
        const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

        if (isDarkTheme === undefined) {
            return;
        }

        this.container.classList.toggle('CopyField--dark', isDarkTheme);
    }

    /**
     * `createElementNS`, not `innerHTML`.
     *
     * `document.createElement('svg')` produces an HTMLUnknownElement that
     * renders nothing at all and reports no error, because SVG lives in its own
     * namespace and the HTML factory does not know it. The string form would
     * work, but a control that assigns `innerHTML` anywhere has to be read
     * carefully forever after by anyone auditing it for injection — and there is
     * no reason to spend that here for two static paths.
     */
    private static createIcon(name: keyof typeof ICON_PATHS, className: string): SVGSVGElement {
        const svg = document.createElementNS(SVG_NS, 'svg');

        svg.setAttribute('class', className);
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('aria-hidden', 'true');
        // Without this, IE-era browsers and some assistive tooling put a
        // focusable `<svg>` in the tab order — inside a button that is already a
        // tab stop, which produces a stop that does nothing.
        svg.setAttribute('focusable', 'false');

        const path = document.createElementNS(SVG_NS, 'path');

        path.setAttribute('d', ICON_PATHS[name]);
        svg.append(path);

        return svg;
    }

    private onInput = (): void => {
        this.value = this.input.value;
        this.notifyOutputChanged();
    };

    private onCopy = (): void => {
        void this.copy();
    };

    /**
     * Two mechanisms, because one of them is not always available.
     *
     * `navigator.clipboard.writeText` needs a secure context *and* the
     * `clipboard-write` Permissions-Policy on every frame down to this one. A
     * model-driven form is an iframe this control does not own, so whether the
     * modern API works is a property of the host rather than of this code —
     * which is why the deprecated `execCommand` path stays. It is synchronous,
     * it predates Permissions-Policy, and it works in some of the cases the
     * good API does not.
     */
    private async copy(): Promise<void> {
        const text = this.value;

        if (text === '') {
            return;
        }

        if (await this.writeViaClipboardApi(text)) {
            this.confirm('CopyField_Copied');

            return;
        }

        this.confirm(this.writeViaExecCommand(text) ? 'CopyField_Copied' : 'CopyField_CopyFailed');
    }

    private async writeViaClipboardApi(text: string): Promise<boolean> {
        if (navigator.clipboard === undefined) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);

            return true;
        } catch {
            // Rejects on a denied permission and on a document that lost focus
            // between the click and the await. Both mean "try the other way",
            // and neither is worth a console error in a customer's form.
            return false;
        }
    }

    /**
     * The `<textarea>` is positioned off-screen rather than hidden, because a
     * `display: none` element cannot hold a selection and
     * `execCommand('copy')` copies the selection.
     */
    private writeViaExecCommand(text: string): boolean {
        const scratch = document.createElement('textarea');

        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.setAttribute('aria-hidden', 'true');
        scratch.tabIndex = -1;
        scratch.className = 'CopyField-scratch';

        this.container.append(scratch);

        try {
            scratch.select();

            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            scratch.remove();
            // Selecting the scratch element took focus off the button. Putting
            // it back matters for a keyboard user, who would otherwise land on
            // the document after activating a control they were sitting on.
            this.button.focus();
        }
    }

    private confirm(key: string): void {
        if (this.confirmationTimer !== undefined) {
            window.clearTimeout(this.confirmationTimer);
        }

        /*
         * Blanked before it is set, so a second copy re-announces.
         *
         * A live region only announces a *change* to its contents. Writing the
         * same "Copied" string again is not a change, so the second copy would
         * be silent to a screen reader while being visibly identical to the
         * first for everyone else.
         */
        this.status.textContent = '';
        this.status.textContent = this.resources.getString(key);

        const failed = key === 'CopyField_CopyFailed';

        this.container.classList.toggle('CopyField--failed', failed);

        /*
         * The glyph turns into a checkmark for as long as the confirmation
         * stands — the same feedback the platform's own copy affordances give,
         * and the only feedback a user gets who is looking at the button rather
         * than at the line of text below it.
         *
         * Success only. A failed copy keeps the copy mark, because there is no
         * icon that reads as "did not happen" and the wrong one read at a glance
         * is worse than none: the whole point of the failure path is that the
         * user must not walk away believing they have the value.
         */
        this.container.classList.toggle('CopyField--copied', !failed);

        this.confirmationTimer = window.setTimeout(() => {
            this.status.textContent = '';
            this.container.classList.remove('CopyField--failed', 'CopyField--copied');
            this.confirmationTimer = undefined;
        }, 3000);
    }
}
