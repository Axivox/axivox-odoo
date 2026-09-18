# -*- coding: utf-8 -*-
{
    "name": "Axivox Softphone",
    "summary": "Make and receive your Axivox calls without leaving Odoo",
    "description": """
Axivox softphone inside Odoo
============================

Adds a softphone to your Odoo interface, in a collapsible panel.

- Click any phone number in Odoo to call it.
- The panel opens by itself when a call comes in.
- The softphone stays registered while you navigate: moving to another screen
  does not drop the call in progress.

No server-side code: the module adds no model, no field and no table. It reads
none of your data. The dialogue with the softphone happens inside your browser,
and only with the softphone's own origin.

An Axivox account is required.
    """,
    "author": "Axivox",
    "website": "https://www.axivox.com",
    "category": "Productivity/Voip",
    "version": "19.0.1.0.14",
    "license": "LGPL-3",
    "application": True,
    "installable": True,
    "auto_install": False,
    # Deliberately minimal: no model, so nothing else is required.
    "depends": ["base", "web"],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "axivox_softphone/static/src/scss/softphone.scss",
            "axivox_softphone/static/src/js/softphone_panel.js",
            "axivox_softphone/static/src/js/softphone_odoo.js",
        ],
    },
    "images": ["static/description/icon.png"],
    "cloc_exclude": ["static/**/*"],
}
