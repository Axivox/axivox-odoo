# Axivox Softphone for Odoo

Adds the Axivox softphone to the Odoo interface, in a collapsible panel:
clicking a number dials it, and the panel opens by itself when a call comes in.

## What the module does, and does not

**No server-side code.** `__init__.py` is empty: no model, no field, no table,
no access rule. The module is two JavaScript files and one stylesheet injected
into the interface. It reads none of your data and calls no Odoo service.

The softphone itself is loaded in an iframe from `phone.axivox.com`. The
dialogue between Odoo and that iframe stays inside your browser.

## Installation

The module depends only on `base` and `web`. No configuration: the panel knows
its own origin and announces it to the softphone.

You sign in to your Axivox account **inside the panel**, once.

## Usage

| | |
|---|---|
| round button, bottom right | opens and closes the panel |
| aqua dot on the button | the extension is registered, so reachable |
| click on a number | dials |
| incoming call | two green circles breathe around the button while it rings; the panel opens by itself unless the person turned that off in the softphone menu (« Open on incoming call ») |
| red count on the button | missed calls of the day not yet looked at; it clears once the history is opened in the softphone |

The panel remembers whether it was open from one screen to the next, and is
**never destroyed** while navigating: a call in progress survives a change of
screen.

To make a number clickable where it is displayed without a link, give it a
`data-axivox-tel` attribute carrying the number.

## Deliberate choices

**Written as a classic script, without OWL or Odoo's module system.** The
contact surface with the framework is limited to injecting the files, which
keeps the module portable across Odoo versions. The only difference between the
18.0 and 19.0 branches is the version prefix Odoo requires.

**The panel is hidden, never removed from the DOM.** Removing the iframe would
drop the SIP registration, and the ongoing conversation with it. On the website
editor, where a floating panel would get in the way, it is stowed away in CSS.

**Three checks on every received message**: the source must be our iframe, the
origin must be the softphone's, and the message must carry our mark. Otherwise
any page or iframe could drive the panel. Symmetrically, nothing is ever sent
with `'*'` as the target origin.

**The tray button is a real `<button>`**, reachable by keyboard and announced by
screen readers, with a visible focus ring.

**Navigation is followed without the `navigation` API**, which Safari does not
implement. The module listens to `hashchange` and `popstate`, and wraps
`pushState`.

**Resize requests are clamped.** The softphone asks for 720 px when it switches
to its expanded view; an embedded page must not be free to cover the host
interface as it pleases, so the request is bounded by the window size and any
absurd value is ignored.

## Known limitations

**iOS.** Mobile Safari does not grant the microphone to a third-party iframe.
The panel does not appear on iPhone and iPad rather than appearing without being
able to speak.

**Storage partitioning.** In a third-party iframe the browser storage is
isolated per embedding site, and Safari blocks it without the Storage Access
API. The softphone session is therefore not shared with the standalone tab, and
a sign-in may be requested per site.

## Protocol

Described in `docs/integration-iframe.md` of the `axivox-softphone` repository.
It is public: any page that speaks it can host the softphone.

## Licence

LGPL-3.

## Size of the panel

The panel takes exactly the size the softphone announces: 384 x 720 in its
normal mode, 768 x 720 in reception mode, 384 wide and as tall as its content in
compact mode (the softphone itself bounds that height). The module never
invents a size and never shrinks the panel to the room around the icon: above
the icon when that fits, below it otherwise, beside it when neither does.
While the panel is open, the page keeps at least the room the softphone needs:
a smaller browser window scrolls the page, and the softphone does not change
size, the rule the softphone applies to itself. The page then also takes the
height Odoo's own content lacks, within reason (an apps grid, not an endless
list, which keeps scrolling inside Odoo as it always does), so that nothing
scrolls inside Odoo for nothing: one scrollbar, not two. In that case the block
sits at the top of the page: one scrolls by what the window lacks, never more.
Panel and button live in the page and scroll with it.

The button is one object, the same closed and open: a 48 px round, as tall as a
tab of the softphone. Closed, it sits in the corner of the page; open, the
softphone deploys above and around it and it stays on the softphone's bottom
right corner, in the row of the tabs, in a corner the softphone leaves free when
it is hosted. Nothing changes shape, nothing changes place.

## Navigation

The softphone can ask the panel to show one of Odoo's pages, in place: the
contact it recognised, the ticket or the opportunity it just created. The
module turns that into a client-side navigation (Odoo's router does the work),
so the page keeps the iframe and the call goes on. Only pages of this very Odoo
are accepted; for anything else the softphone opens a new tab itself.
