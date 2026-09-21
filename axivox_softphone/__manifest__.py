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

Where it runs
-------------

Odoo Online, Odoo.sh and Odoo Community.

No server-side code: the module adds no model, no field and no table. It reads
none of your data, and collects nothing.

The panel embeds the Axivox softphone served from https://phone.axivox.com. The
dialogue with it happens inside your browser, and only with that one origin.
Nothing is downloaded into Odoo and no code is installed beside this module.

An Axivox account is required.
    """,
    "author": "Axivox",
    "website": "https://www.axivox.com",
    "category": "Productivity/Voip",
    "version": "1.0.15",
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
    "images": [
        "static/description/banner.png",
        "static/description/main_screenshot.png",
    ],
    "cloc_exclude": ["static/**/*"],
}
