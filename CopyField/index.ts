import { IInputs, IOutputs } from './generated/ManifestTypes';

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

        const row = document.createElement('div');
        row.className = 'CopyField-row';
        row.append(this.input, this.button);

        this.container.classList.add('CopyField');
        this.container.append(row, this.status, this.message);

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
            this.input.hidden = true;
            this.button.hidden = true;
            this.message.hidden = false;
            this.message.textContent = this.resources.getString('CopyField_NoAccess');

            return;
        }

        this.input.hidden = false;
        this.button.hidden = false;

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
        this.button.setAttribute(
            'aria-label',
            this.resources.getString('CopyField_CopyLabel').replace('{0}', label),
        );
        this.button.textContent = this.resources.getString('CopyField_Copy');

        this.container.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';
        this.container.classList.toggle('CopyField--invalid', parameter.error);
        this.input.setAttribute('aria-invalid', String(parameter.error));

        this.message.hidden = !parameter.error;
        this.message.textContent = parameter.error ? parameter.errorMessage : '';
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

        this.container.classList.toggle('CopyField--failed', key === 'CopyField_CopyFailed');

        this.confirmationTimer = window.setTimeout(() => {
            this.status.textContent = '';
            this.container.classList.remove('CopyField--failed');
            this.confirmationTimer = undefined;
        }, 3000);
    }
}
