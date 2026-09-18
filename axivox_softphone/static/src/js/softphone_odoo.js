/*
 * Wiring the panel into the Odoo backend: click-to-dial, and stowing it away on
 * screens where a floating panel gets in the way.
 */
(function () {
    'use strict';

    /* iOS does not grant the microphone to a third-party iframe: the panel
     * would show up without ever being able to speak. Better to show nothing. */
    function unsupportedDevice() {
        return /iPhone|iPod|iPad/i.test(navigator.userAgent);
    }

    /* The website editor carries its own full-screen iframe; a floating panel
     * overlaps it and gets in the way. We stow it away without destroying the
     * iframe: dropping the SIP registration on every visit would be worse. */
    function unsupportedPage() {
        var h = window.location.hash || '';
        var p = window.location.pathname || '';
        return (
            p.indexOf('/odoo/website') === 0 ||
            p.indexOf('/website/') === 0 ||
            p.indexOf('/@/') === 0 && h.indexOf('website') !== -1 ||
            h.indexOf('website_preview') !== -1 ||
            !!document.querySelector('iframe.o_website_iframe, .o_website_preview')
        );
    }

    /* The number behind a click, if any. Odoo renders phone fields as "tel:"
     * links, which is the most stable hook. */
    function numberFromClick(ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="tel:"]') : null;
        if (a) return decodeURIComponent(a.getAttribute('href').slice(4));

        // Some views show a number without a link, so we also accept an
        // explicitly marked element. That allows adding hooks through
        // customisation without touching this module.
        var m = ev.target && ev.target.closest ? ev.target.closest('[data-axivox-tel]') : null;
        return m ? m.getAttribute('data-axivox-tel') : null;
    }

    /* Odoo is a single-page application: neither "load" nor "navigate" fires
     * everywhere. So we watch URL changes in the most portable way there is —
     * the Navigation API other integrations rely on does not exist in Safari,
     * where their logic is therefore dead. */
    function onUrlChange(fn) {
        var previous = window.location.href;
        var check = function () {
            if (window.location.href === previous) return;
            previous = window.location.href;
            fn();
        };
        window.addEventListener('hashchange', check);
        window.addEventListener('popstate', check);
        // pushState fires no event of its own, so we wrap it.
        ['pushState', 'replaceState'].forEach(function (name) {
            var original = history[name];
            if (typeof original !== 'function' || original.__axivox) return;
            var wrapper = function () {
                var r = original.apply(this, arguments);
                setTimeout(check, 0);
                return r;
            };
            wrapper.__axivox = true;
            history[name] = wrapper;
        });
    }

    function start() {
        if (unsupportedDevice()) {
            console.info('[axivox] softphone not available on this device');
            return;
        }
        if (!window.AxivoxSoftphone) {
            console.error('[axivox] the panel script did not load');
            return;
        }

        var panel = new window.AxivoxSoftphone.Panel().mount().greet();

        // Click-to-dial, in the capture phase so we run before Odoo's own
        // handlers; otherwise the "tel:" navigation wins.
        document.addEventListener('click', function (ev) {
            var number = numberFromClick(ev);
            if (!number) return;
            if (!panel.dial(number)) return;
            ev.preventDefault();
            ev.stopPropagation();
        }, true);

        var adjust = function () { panel.stow(unsupportedPage()); };
        adjust();
        onUrlChange(adjust);

        // Hook for customisation: dial from anywhere else.
        window.AxivoxSoftphone.panel = panel;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
