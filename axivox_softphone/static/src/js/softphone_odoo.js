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

    /* What record the user is looking at, read from the URL and nothing else.
     *
     * ⭐ The URL on purpose, not Odoo's internals. This module hooks the page
     * through two things only, "tel:" links and window.location, which is why
     * it runs from 14 to 20 without a single per-version branch. Reaching into
     * the web client for resModel/resId would mean one implementation for
     * odoo.define and another for OWL, to redo at every major version.
     *
     * 🔴 And we never resolve an action path into a model: that would be an RPC
     * against the customer's database, and this module promises it reads none
     * of their data. The mapping belongs in their call event rule, where they
     * already pick the Odoo model.
     *
     * So every name here says exactly what it holds, and nothing is posted
     * unless the URL really carries it:
     *   /odoo/sales/537            -> odoo_source_path  = sales       (an ACTION, not a model)
     *   /odoo/helpdesk/3/tickets/42 -> odoo_source_path = tickets, odoo_source_id = 42
     *   /odoo/m-sale.order/537     -> odoo_source_model = sale.order  (a real model)
     *   /web#id=537&model=sale.order -> odoo_source_model = sale.order
     */
    function odooSource() {
        var out = {};
        var p = window.location.pathname || '';
        var h = window.location.hash || '';

        // Odoo 18+ : /odoo/<action>/<id>. The action may be a path (sales), an
        // action id (action-123), or m-<model> when no action carries the model.
        // 🔴 A record opened from another one adds a pair to the URL:
        // /odoo/helpdesk/3/tickets/42 is ticket 42 opened from team 3. The
        // record on screen is the LAST pair; the first one is only its parent.
        var m = null;
        if (p.indexOf('/odoo/') === 0) {
            var rest = p.slice(5), re = /\/([^\/?#]+)\/(\d+)(?=[\/?#]|$)/g, r;
            while ((r = re.exec(rest)) !== null) m = r;
        }
        if (m) {
            var seg = m[1];
            if (seg.indexOf('m-') === 0 && seg.length > 2) out.odoo_source_model = seg.slice(2);
            else out.odoo_source_path = seg;
            out.odoo_source_id = m[2];
            return out;
        }

        // Odoo <= 16 : the hash carries the real model, so we can say "model".
        var hid = h.match(/[#&]id=(\d+)/);
        var hmo = h.match(/[#&]model=([A-Za-z0-9_.]+)/);
        if (hid) out.odoo_source_id = hid[1];
        if (hmo) out.odoo_source_model = hmo[1];
        return out;
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
            // Le dossier regarde au moment du clic part avec l appel : c est
            // tout l interet du clic-pour-appeler depuis une fiche.
            if (!panel.dial(number, odooSource())) return;
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
