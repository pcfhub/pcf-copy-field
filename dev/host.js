/*
 * The platform, stood in for: everything this control reads off `context`,
 * plus the two clipboard mechanisms it chooses between.
 *
 * ---
 *
 * **Why this exists when `npm start` already hosts a field control.**
 *
 * The clipboard is the one browser API a code component cannot simply call.
 * `navigator.clipboard.writeText` needs a secure context *and* the
 * `clipboard-write` Permissions-Policy on every frame down to this one — and a
 * model-driven form is an iframe this control does not own. So whether the
 * modern API works is a property of the *host*, which means the fallback is not
 * defensive coding: it is the path a real customer takes, and no local harness
 * puts you on it.
 *
 * The three states that matter are all here as switches: the API present and
 * working, absent entirely, and present but rejecting — which is what a denied
 * permission and a document that lost focus between the click and the await
 * both look like.
 *
 * ---
 *
 * **A stub must never be more capable than the thing it stands in for.**
 * `security` is `undefined` on a column with no FLS profile. `execCommand` is
 * deprecated and returns a boolean rather than throwing, which is why the
 * control reads its return value — so this returns one too, including `false`,
 * rather than only ever succeeding.
 */

(function (root, factory) {
    'use strict';

    var api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.__pcfHost = api;
    }
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    var STRINGS = {
        CopyField_Name: 'Copy Field',
        CopyField_NoAccess: 'You do not have access to this value.',
        CopyField_CopyLabel: 'Copy {0}',
        CopyField_Copied: 'Copied',
        CopyField_CopyFailed: 'Could not copy',
    };

    var SECURITY = {
        none: undefined,
        'read-only': { editable: false, readable: true, secured: true },
        'no-access': { editable: false, readable: false, secured: true },
    };

    var HOSTS = {
        'model-driven': { label: 'model-driven form', publishesTheme: true, publishesMetadata: true },
        canvas: { label: 'canvas app', publishesTheme: false, publishesMetadata: false },
    };

    var DEFAULTS = {
        host: 'model-driven',
        value: 'INV-2026-00417',
        placeholder: 'Nothing to copy',
        label: 'Invoice number',
        visible: true,
        disabled: false,
        security: 'none',
        error: false,
        errorMessage: 'This value is not in the expected format.',
        dark: undefined,
        rtl: false,
        maxLength: 100,
    };

    function createContext(options) {
        var o = Object.assign({}, DEFAULTS, options || {});
        var host = HOSTS[o.host] || HOSTS['model-driven'];
        var security = SECURITY[o.security];

        var getString =
            o.getString
            || function (key) {
                return STRINGS[key] !== undefined ? STRINGS[key] : key;
            };

        return {
            parameters: {
                value: {
                    raw: o.value,
                    attributes: host.publishesMetadata
                        ? { MaxLength: o.maxLength, LogicalName: 'invoicenumber', DisplayName: o.label }
                        : undefined,
                    security: security,
                    error: o.error,
                    errorMessage: o.error ? o.errorMessage : undefined,
                    type: 'SingleLine.Text',
                },
                placeholder: { raw: o.placeholder, type: 'SingleLine.Text' },
            },

            mode: {
                isVisible: o.visible,
                isControlDisabled: o.disabled,
                label: o.label,
            },

            resources: { getString: getString },

            fluentDesignLanguage: host.publishesTheme ? { isDarkTheme: Boolean(o.dark) } : undefined,

            userSettings: { isRTL: o.rtl, languageId: 1033 },
        };
    }

    /**
     * The two clipboard mechanisms, installed on the globals the control uses.
     *
     * `clipboard`:
     *   'works'    — the modern API resolves, and the text is recorded
     *   'absent'   — `navigator.clipboard` is undefined, which is a real host
     *                rather than a hypothetical: an insecure context, or a
     *                frame without the clipboard-write Permissions-Policy
     *   'rejects'  — present and refusing, which is a denied permission or a
     *                document that lost focus between the click and the await
     *
     * `execCommand`: whether the deprecated fallback reports success. It
     * returns a boolean rather than throwing, so this returns one too.
     */
    function installClipboard(global, options) {
        var settings = options || {};
        var written = [];

        /*
         * `navigator` has been a getter-only global in Node since v21, so a
         * plain assignment throws "Cannot set property navigator of #<Object>
         * which has only a getter" — which reads as a bug in the control rather
         * than as this file colliding with the runtime. `dev/dom.js` documents
         * the same trap for the same reason. Node's own navigator is real and
         * carries no `clipboard`, so it is replaced wholesale here rather than
         * extended.
         */
        var replacement = { userAgent: 'dev/host.js', language: 'en-US' };

        try {
            global.navigator = replacement;
        } catch (error) {
            Object.defineProperty(global, 'navigator', {
                value: replacement,
                configurable: true,
                writable: true,
            });
        }

        if (settings.clipboard === 'absent') {
            global.navigator.clipboard = undefined;
        } else {
            global.navigator.clipboard = {
                writeText: function (text) {
                    if (settings.clipboard === 'rejects') {
                        return Promise.reject(new Error('NotAllowedError'));
                    }

                    written.push({ via: 'clipboard', text: text });

                    return Promise.resolve();
                },
            };
        }

        global.document.execCommand = function (command) {
            if (command !== 'copy') {
                return false;
            }

            if (settings.execCommand === false) {
                return false;
            }

            // Copies **the selection**, which is why the control puts an
            // off-screen textarea in the DOM and selects it — a display:none
            // element cannot hold one. Reading dev/dom.js's recorded
            // selection rather than the element means a control that appends
            // the textarea and forgets to select it fails here.
            written.push({ via: 'execCommand', text: global.document.selection });

            return true;
        };

        return written;
    }

    function captureRegistration(global) {
        var box = { name: null, ctor: null };

        global.ComponentFramework = global.ComponentFramework || {};
        global.ComponentFramework.registerControl = function (fullName, ctor) {
            box.name = fullName;
            box.ctor = ctor;
        };

        return box;
    }

    return {
        STRINGS: STRINGS,
        SECURITY: SECURITY,
        HOSTS: HOSTS,
        DEFAULTS: DEFAULTS,
        createContext: createContext,
        installClipboard: installClipboard,
        captureRegistration: captureRegistration,
    };
});
