# -*- coding: utf-8 -*-
{
    "name": "Axivox",
    "summary": "Your Axivox call log inside Odoo, with transcription and summary",
    "description": """
Axivox call log
===============

Adds the call log that Odoo Community does not have.

Odoo's own call log lives in its Phone app, which is Enterprise only: in
Community it cannot even be installed. This module provides the same thing,
under our own model name, with the same field names as Odoo's, so that nothing
changes for you if you move to Enterprise one day.

- Every call handled through Axivox, with its contact and the person who took it.
- Transcription and summary of the call, when they are enabled on your account.
- What the call was about: sentiment, themes, and a flag when it looks worth a
  follow-up, as analysed from the transcript.
- Both lengths of a call: the whole thing, and the time actually spent talking.
- Which of your own numbers was involved, so you can group calls by number.
- The recording, attached to the call itself.
- A Calls button on each contact.
- List, calendar, graph and pivot views to look at the whole thing.

Where it runs
-------------

Odoo Community and Odoo.sh. This module adds a model and server-side code, so
it cannot be installed on Odoo Online.

This module only stores what the Axivox connector sends it: it holds no
credential, calls nothing on its own, and collects nothing from your Odoo. An
Axivox account is required.
""",
    "author": "Axivox",
    "website": "https://www.axivox.com",
    "category": "Productivity/Voip",
    "version": "1.0.3",
    "license": "LGPL-3",
    "application": True,
    "installable": True,
    "auto_install": False,
    "depends": ["base", "mail"],
    "data": [
        "security/ir.model.access.csv",
        "security/axivox_call_security.xml",
        "views/axivox_call_views.xml",
        "views/res_partner_views.xml",
    ],
    "images": [
        "static/description/banner.png",
        "static/description/main_screenshot.png",
    ],
}
