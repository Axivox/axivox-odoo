/*
 * Axivox softphone panel: a collapsible iframe, and the postMessage dialogue
 * with it.
 *
 * Deliberately written as a classic script, without OWL or Odoo's module
 * system: the contact surface with the framework is reduced to injecting the
 * file, which keeps the module portable across Odoo versions.
 *
 * Protocol: see docs/integration-iframe.md in the axivox-softphone repository.
 */
(function () {
    'use strict';

    var BASE = 'https://phone.axivox.com';
    var MARK = 'axivox-softphone';
    var OPEN_KEY = 'axivox_panel_open';
    var POS_KEY = 'axivox_panel_pos';

    var DRAG_MIN = 5;   // px: under this the gesture is still a click
    var MARGIN = 8;     // px kept between the icon and the viewport edge
    var HOME = 16;      // px: the resting corner, matching the stylesheet
    var GAP = 10;       // px between the icon and the panel (kept for the hint)
    var ICON = 48;      // px: the button, as tall as a tab of the softphone
    var INSET_X = 9;    // px from the softphone's right edge to the button's right edge (the tab row's own margin)
    var INSET_Y = 6;    // px from the softphone's bottom edge to the button's bottom edge
    var EXTRA_MAX = 240; // px: how much the page may grow for Odoo's own content (an apps grid, not an endless list)

    /* The softphone origin: the only one allowed to talk to us, and the only
     * one we ever talk to. Derived from BASE, never from a received message. */
    var ORIGIN = new URL(BASE).origin;

    /* The database of this Odoo, read from the web client's own session module.
     * The softphone uses it to know that this page IS its CRM, whatever the host
     * name (a custom domain in front of Odoo is the same Odoo). Empty when the
     * page is not an Odoo web client. Three places are read, because three
     * generations of Odoo keep it in three different ones. */
    function hostDb() {
        try {
            var o = window.odoo;
            var s = o && o.loader && o.loader.modules && o.loader.modules.get('@web/session');
            if (s && s.session && s.session.db) return String(s.session.db);
            if (o && o.info && o.info.db) return String(o.info.db);
            // Odoo 14 ne connait ni le module de session ni odoo.info : il
            // depose la session dans une globale, et rien d'autre ne la porte.
            if (o && o.session_info && o.session_info.db) return String(o.session_info.db);
        } catch (e) { /* not our business */ }
        return '';
    }

    function createButton() {
        // A real <button>: reachable by keyboard and announced by screen
        // readers, which a clickable <div> is not.
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'o_axivox_tray';
        b.setAttribute('aria-label', 'Axivox softphone');
        b.setAttribute('aria-expanded', 'false');
        b.innerHTML =
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
            '<path fill="currentColor" d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>' +
            '</svg><span class="o_axivox_dot" hidden></span><span class="o_axivox_badge" hidden></span>';
        return b;
    }

    function createPanel() {
        var d = document.createElement('div');
        d.className = 'o_axivox_panel';
        d.hidden = true;
        return d;
    }

    function createIframe() {
        var f = document.createElement('iframe');
        // Without "microphone" the browser denies the mic to the iframe and no
        // call can be heard. There is no way around it.
        f.allow = 'microphone; autoplay';
        f.title = 'Axivox softphone';
        // We announce our own origin: the softphone stays silent if it does not
        // match the real parent.
        f.src = BASE + '/?origin=' + encodeURIComponent(window.location.origin);
        return f;
    }

    function Panel() {
        this.listeners = {};
        this.ready = false;

        this.button = createButton();
        this.panel = createPanel();
        this.iframe = createIframe();
        this.panel.appendChild(this.iframe);

        this.root = document.createElement('div');
        this.root.className = 'o_axivox_root';
        this.root.appendChild(this.button);

        // The size the softphone asked for. It is the authority on its own size:
        // 384 x 720 in normal, 768 x 720 in reception, 384 x its content in compact.
        this.size = { w: 384, h: 720 };

        // Where the icon sits, as a distance from the right and bottom edges.
        // Overwritten by mount() with whatever the user last chose.
        this.pos = { right: HOME, bottom: HOME };

        var self = this;
        this.button.addEventListener('click', function () {
            // A drag ends with a click on the icon: it must not toggle.
            if (self.suppressClick) { self.suppressClick = false; return; }
            self.toggle();
        });
        this.enableDrag();

        // addEventListener, not window.onmessage = : an assignment would wipe
        // out the Odoo backend handlers, which rely on postMessage too.
        window.addEventListener('message', function (e) { self.receive(e); });
    }

    Panel.prototype.mount = function (parent) {
        // The icon's block is fixed to the window; the panel lives in the page,
        // so that it scrolls with the page when the page is taller than the window.
        (parent || document.body).appendChild(this.root);
        (parent || document.body).appendChild(this.panel);
        var self = this;
        // Odoo's content changes with navigation and loads after it: the room it
        // needs is measured again then.
        var again = function () { self.layout(); setTimeout(function () { self.layout(); }, 700); };
        window.addEventListener('hashchange', again);
        window.addEventListener('popstate', again);
        // Position first: orienting the panel needs the icon at its final spot.
        this.pos = this.rememberedPosition() || { right: HOME, bottom: HOME };
        this.place();
        // Restore the previous state: reopening the panel on every page load
        // would be tiresome, and forcing it to stay open just as much.
        if (this.rememberedState()) this.show();
        return this;
    };

    Panel.prototype.rememberedState = function () {
        try { return window.localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; }
    };

    Panel.prototype.remember = function (open) {
        try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (e) { /* private mode */ }
    };

    Panel.prototype.isOpen = function () { return !this.panel.hidden; };

    Panel.prototype.show = function () {
        this.panel.hidden = false;
        this.button.setAttribute('aria-expanded', 'true');
        this.layout();
        var self = this;
        setTimeout(function () { self.layout(); }, 700);
        this.remember(true);
    };

    Panel.prototype.hide = function () {
        // Hide, never remove from the DOM: destroying the iframe would drop the
        // SIP registration, and the ongoing call with it.
        this.panel.hidden = true;
        this.button.setAttribute('aria-expanded', 'false');
        this.layout();
        this.place();
        this.remember(false);
    };

    Panel.prototype.toggle = function (force) {
        var open = force === undefined ? !this.isOpen() : !!force;
        if (open) this.show(); else this.hide();
    };

    /* ---- moving the icon --------------------------------------------- */

    /* Positions the block from its distance to the right and bottom edges, the
     * anchoring the stylesheet already used, and keeps it inside the viewport:
     * a position saved on a wide screen must not put the icon out of reach on
     * a laptop. */
    Panel.prototype.place = function (right, bottom) {
        var w = this.button.offsetWidth || 54;
        var h = this.button.offsetHeight || 54;
        var r = right === undefined ? this.pos.right : right;
        var b = bottom === undefined ? this.pos.bottom : bottom;
        // distances from the right and bottom edges of the PAGE: the icon lives in
        // the page like the panel, under the softphone, and scrolls with it when
        // the window is too small for the block
        var d = this.room();
        this.pos = {
            right: Math.min(Math.max(r, MARGIN), Math.max(MARGIN, d.w - w - MARGIN)),
            bottom: Math.min(Math.max(b, MARGIN), Math.max(MARGIN, d.h - h - MARGIN))
        };
        this.root.style.left = Math.round(d.w - this.pos.right - w) + 'px';
        this.root.style.top = Math.round(d.h - this.pos.bottom - h) + 'px';
        this.layout();
    };

    /* The room the page offers: the window, or, while the panel is open, at
     * least what the softphone needs. Below that the browser shows a scrollbar
     * and the page scrolls, the softphone never changes size (the rule of the
     * softphone itself: a smaller tab scrolls the page, not the window). */
    /* The room the block needs: the softphone alone, the button sits on it. */
    Panel.prototype.need = function () {
        return { w: this.size.w + 2 * MARGIN, h: this.size.h + 2 * MARGIN };
    };

    /* The height the softphone may ask for without making this page scroll.
     *
     * The margins are subtracted HERE and not on the other side: need() adds
     * them back, so a softphone that asked for the bare viewport height would
     * push the page 16 px past it and grow a scrollbar for nothing.
     *
     * An iframe cannot read its host's height across origins, so without this
     * message the softphone has no idea and falls back to a fixed figure. */
    Panel.prototype.avail = function () {
        var h = document.documentElement.clientHeight - 2 * MARGIN;
        return Math.max(0, Math.round(h));
    };

    Panel.prototype.tellRoom = function () {
        this.send('room', { maxHeight: this.avail() });
    };

    Panel.prototype.room = function () {
        var open = !this.panel.hidden;
        var html = document.documentElement;
        var min = open ? parseInt(html.style.minHeight, 10) || 0 : 0;
        var need = open ? this.need() : { w: 0, h: 0 };
        // clientWidth/Height: the window less its scrollbars, which the page does not cover
        return { w: Math.max(html.clientWidth, need.w), h: Math.max(html.clientHeight, min, need.h) };
    };

    /* Where the panel goes, at the size the softphone asked for: above and
     * around its button, which sits on its bottom right corner, in the row of
     * the tabs. The panel is never shrunk, scaled or cut, because the softphone
     * has fixed sizes (normal, reception) or its own bounds (compact). Positions
     * are in page coordinates: button and panel scroll with the page when it is
     * larger than the window. */
    Panel.prototype.layout = function () {
        var open = !this.panel.hidden;
        var html = document.documentElement;
        var need = this.need();
        var minW = need.w, minH = need.h;
        var shortY = open && html.clientHeight < minH;
        // the minimum the page must keep while the softphone is shown; the page
        // overflow is opened only on an axis where the window is really short of
        // it, or Odoo's own hidden overflow would show a scrollbar for nothing
        html.style.minWidth = open ? minW + 'px' : '';
        html.style.minHeight = open ? minH + 'px' : '';
        html.classList.toggle('o_axivox_min_x', open && html.clientWidth < minW);
        html.classList.toggle('o_axivox_min_y', shortY);
        // One scrollbar, not two: while the page scrolls for the softphone, it also
        // takes the height Odoo's own content lacks, so nothing scrolls inside Odoo.
        // Measured with the page at the softphone's minimum, then applied.
        if (shortY) {
            var extra = 0;
            var wc = document.querySelector('.o_web_client');
            if (wc) {
                var els = wc.querySelectorAll('.o_home_menu, .o_action_manager, .o_content, .o_list_renderer, .o_kanban_renderer, .o_form_view');
                for (var i = 0; i < els.length; i++) {
                    var cs = window.getComputedStyle(els[i]);
                    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && els[i].scrollHeight > els[i].clientHeight + 1) {
                        extra = Math.max(extra, els[i].scrollHeight - els[i].clientHeight);
                    }
                }
            }
            // capped: a long list scrolls inside Odoo as it always does; growing the page to
            // its full length would push the softphone thousands of pixels down
            extra = Math.min(extra, EXTRA_MAX);
            if (extra) html.style.minHeight = (minH + extra) + 'px';
        }
        if (!open) return;
        var d = this.room();
        var w = this.size.w, h = this.size.h;
        var bw = this.button.offsetWidth || ICON, bh = this.button.offsetHeight || ICON;
        // The block: the softphone, with the button on its bottom right corner, in the
        // row of its tabs (the softphone leaves that corner free when it is hosted).
        // The button is the anchor; the panel is placed from it, kept inside the page;
        // if the page pushed the panel back, the button follows its corner: one object.
        var iconRight = d.w - this.pos.right, iconBottom = d.h - this.pos.bottom;
        var left = iconRight + INSET_X - w, top = iconBottom + INSET_Y - h;
        left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, d.w - w - MARGIN));
        // A window shorter than the softphone: the block sits at the top of the page,
        // whatever the page grew to for Odoo's content. One scrolls by what the window
        // lacks, never more, and the block stops moving from one screen to the next.
        top = shortY ? MARGIN : Math.min(Math.max(top, MARGIN), Math.max(MARGIN, d.h - h - MARGIN));
        var il = left + w - INSET_X - bw, it = top + h - INSET_Y - bh;
        // the button rides on the block; its own resting place is kept while the
        // block is pinned to the top, so that closing puts it back in its corner
        if (!shortY) this.pos = { right: d.w - (il + bw), bottom: d.h - (it + bh) };
        this.root.style.left = Math.round(il) + 'px';
        this.root.style.top = Math.round(it) + 'px';
        this.panel.style.width = w + 'px';
        this.panel.style.height = h + 'px';
        this.panel.style.left = Math.round(left) + 'px';
        this.panel.style.top = Math.round(top) + 'px';
    };

    Panel.prototype.rememberedPosition = function () {
        try {
            var p = JSON.parse(window.localStorage.getItem(POS_KEY));
            // Anything else is a corrupted or older entry: back to the corner.
            if (!p || !isFinite(p.right) || !isFinite(p.bottom)) return null;
            return { right: p.right, bottom: p.bottom };
        } catch (e) { return null; }
    };

    Panel.prototype.rememberPosition = function () {
        try {
            window.localStorage.setItem(POS_KEY, JSON.stringify(this.pos));
        } catch (e) { /* private mode */ }
    };

    /* Pointer events rather than mouse events: one code path for mouse, touch
     * and pen. The icon keeps its usual job, so a short gesture stays a click
     * and only a real move drags. */
    Panel.prototype.enableDrag = function () {
        var self = this;
        var from = null;

        this.button.addEventListener('pointerdown', function (ev) {
            if (ev.button !== 0) return;   // leave the context menu alone
            self.suppressClick = false;
            from = {
                x: ev.clientX, y: ev.clientY,
                right: self.pos.right, bottom: self.pos.bottom,
                moved: false
            };
            self.button.setPointerCapture(ev.pointerId);
        });

        this.button.addEventListener('pointermove', function (ev) {
            if (!from) return;
            var dx = ev.clientX - from.x;
            var dy = ev.clientY - from.y;
            if (!from.moved) {
                if (Math.abs(dx) < DRAG_MIN && Math.abs(dy) < DRAG_MIN) return;
                from.moved = true;
                self.root.classList.add('o_axivox_dragging');
                document.body.classList.add('o_axivox_dragging');
            }
            // Both offsets grow towards the top left, hence the subtraction.
            // Always measured from the start, so clamping never drifts.
            self.place(from.right - dx, from.bottom - dy);
        });

        var stop = function (ev) {
            if (!from) return;
            if (self.button.hasPointerCapture && self.button.hasPointerCapture(ev.pointerId)) {
                self.button.releasePointerCapture(ev.pointerId);
            }
            if (from.moved) {
                self.suppressClick = true;
                self.root.classList.remove('o_axivox_dragging');
                document.body.classList.remove('o_axivox_dragging');
                self.rememberPosition();
            }
            from = null;
        };
        this.button.addEventListener('pointerup', stop);
        this.button.addEventListener('pointercancel', stop);

        // A window made smaller must not leave the icon off screen, and the
        // softphone must learn how much room is left.
        window.addEventListener('resize', function () { self.place(); self.tellRoom(); });
    };

    /* Hides both button and panel without touching the iframe: used on pages
     * where a floating panel gets in the way, such as the website editor. */
    Panel.prototype.stow = function (yes) {
        this.root.classList.toggle('o_axivox_stowed', !!yes);
        this.panel.classList.toggle('o_axivox_stowed', !!yes);
    };

    Panel.prototype.on = function (type, fn) {
        (this.listeners[type] = this.listeners[type] || []).push(fn);
        return this;
    };

    Panel.prototype.fire = function (type, data) {
        var fns = this.listeners[type] || [];
        for (var i = 0; i < fns.length; i++) {
            try { fns[i](data); } catch (e) { console.error('[axivox]', e); }
        }
    };

    Panel.prototype.send = function (type, extra) {
        if (!this.iframe.contentWindow) return;
        var msg = { axivox: MARK, type: type };
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) msg[k] = extra[k];
        // Explicit origin, never '*': the message may carry a phone number.
        this.iframe.contentWindow.postMessage(msg, ORIGIN);
    };

    Panel.prototype.receive = function (e) {
        // All three checks matter: the source rules out the other iframes on
        // the page, the origin rules out other sites, and the mark rules out
        // Odoo's own internal messages.
        if (e.source !== this.iframe.contentWindow) return;
        if (e.origin !== ORIGIN) return;
        var m = e.data;
        if (!m || m.axivox !== MARK || !m.type) return;

        if (m.type === 'ready') { this.ready = true; this.tellRoom(); }
        if (m.type === 'registered') this.dot(m.registered);
        // the softphone says whether the person wants the panel opened for them (a menu choice, default yes)
        if (m.type === 'incomingCall') { if (m.autoOpen !== false) this.show(); this.ring(m.id, true); }
        if (m.type === 'callAnswered' || m.type === 'callEnded') this.ring(m.id, false);
        if (m.type === 'missed') this.badge(m.count);
        if (m.type === 'resize') this.resize(m.width, m.height);
        if (m.type === 'navigate') this.navigate(m.path ? { path: m.path } : { url: m.url });
        this.fire(m.type, m);
    };

    /* Missed calls of the day the person has not looked at: the softphone
     * counts them and says so at each change; the count clears by itself once
     * the history is opened in the softphone. */
    Panel.prototype.badge = function (count) {
        var n = Number(count) || 0;
        var b = this.button.querySelector('.o_axivox_badge');
        b.textContent = n > 99 ? '99+' : String(n);
        b.hidden = n <= 0;
        this.button.setAttribute('aria-label', n > 0 ? 'Axivox softphone, ' + n + ' appel' + (n > 1 ? 's' : '') + ' manqu\u00e9' + (n > 1 ? 's' : '') : 'Axivox softphone');
    };

    /* While a call rings, the button breathes: the panel opens by itself, but
     * a person looking elsewhere on a wide screen sees the movement first.
     * Several calls may ring at once; the movement stops with the last one. */
    Panel.prototype.ring = function (id, on) {
        this.ringing = this.ringing || {};
        var key = id === undefined || id === null ? '*' : String(id);
        if (on) this.ringing[key] = true;
        else if (key === '*') this.ringing = {};
        else delete this.ringing[key];
        this.button.classList.toggle('o_axivox_ringing', Object.keys(this.ringing).length > 0);
    };

    /* The softphone says what size it has: an iframe cannot resize its own
     * frame. We take it as it is; layout() only keeps the frame inside the
     * viewport. */
    Panel.prototype.resize = function (width, height) {
        var w = Number(width), h = Number(height);
        if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return;
        this.size = { w: Math.round(w), h: Math.round(h) };
        this.layout();
    };

    /* The softphone asks for one of Odoo's pages: a contact, a ticket, an
     * opportunity it just created. Odoo's router turns a click on an internal
     * link into a client-side navigation, so the page, and the iframe with it,
     * stay: the call goes on. Only Odoo's own pages on this very origin; anything
     * else is ignored, the softphone opens a tab itself in that case. */
    Panel.prototype.navigate = function (where) {
        var u;
        try {
            // a path is one of OUR pages by construction; a url must be at our origin
            u = where.path ? new URL(String(where.path), window.location.origin) : new URL(String(where.url), window.location.href);
        } catch (e) { return false; }
        if (u.origin !== window.location.origin) return false;
        var odooPage = u.pathname === '/odoo' || u.pathname.indexOf('/odoo/') === 0 || u.pathname === '/web';
        if (!odooPage) return false;
        if (window.location.pathname.indexOf('/odoo') === 0) {
            // Odoo 17.2 and later: the router listens to clicks on internal links
            var a = document.createElement('a');
            a.href = u.href;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
        }
        if (u.hash) {
            // Odoo up to 17.0: routes live in the hash
            window.location.hash = u.hash;
            return true;
        }
        return false;
    };

    Panel.prototype.dot = function (active) {
        this.button.querySelector('.o_axivox_dot').hidden = !active;
    };

    /* Dial. The softphone filters again on its side: this is only a first pass
     * so we do not send it just anything. */
    Panel.prototype.dial = function (number) {
        var n = String(number || '').replace(/^tel:/i, '').replace(/[^0-9+*#]/g, '');
        if (!n) return false;
        this.show();
        this.send('dial', { number: n });
        return true;
    };

    /* The handshake may cross our own setup, so we ask again; the softphone
     * answers "ready" either way. */
    Panel.prototype.greet = function () {
        var self = this;
        this.iframe.addEventListener('load', function () { self.send('hello', { db: hostDb(), maxHeight: self.avail() }); });
        var tries = 0;
        var t = setInterval(function () {
            if (self.ready || ++tries > 10) return clearInterval(t);
            self.send('hello', { db: hostDb(), maxHeight: self.avail() });
        }, 1000);
        return this;
    };

    window.AxivoxSoftphone = { Panel: Panel, ORIGIN: ORIGIN, MARK: MARK };
})();
