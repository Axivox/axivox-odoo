# Axivox for Odoo

Two Odoo applications published by [Axivox](https://www.axivox.com), the Belgian
cloud telephony provider.

| Module | What it does |
|---|---|
| **`axivox`** | The call log Odoo Community does not have: every call, with its contact, its recording, and the transcription and analysis when your account has them. |
| **`axivox_softphone`** | A softphone inside Odoo, in a collapsible panel. Click a number to call it; the panel opens by itself on an incoming call. |

Both modules are free and published under the LGPL-3 licence. An Axivox account
is required to use them.

## Which branch to install

One branch per Odoo series. Take the one that matches your server, nothing else.

| Odoo | Branch |
|---|---|
| 19.0 Community or Enterprise | `19.0` |
| 18.0 Community or Enterprise | `18.0` |
| 17.0 Community or Enterprise | `17.0` |

## Installing

Copy the module folder you want into your addons path, restart Odoo, then update
the app list and install it from the Apps menu.

```bash
git clone --branch 18.0 https://github.com/Axivox/axivox-odoo.git
cp -r axivox-odoo/axivox /path/to/your/addons/
```

No external Python dependency: nothing to `pip install`.

## The call log, in short

`axivox` adds a single model, `axivox.call`, and one smart button on contacts.
Odoo's own call log lives in the Phone app, which is Enterprise only and cannot
even be installed on Community. This module gives you the same thing, with the
same field names, so that moving to Enterprise one day changes nothing for you.

Calls are written by the Axivox connector; the module itself never calls out.

## The softphone, in short

`axivox_softphone` adds **no model, no field and no table**, and reads none of
your data. It injects a panel that embeds the Axivox softphone and talks to it
through the browser only, with that one origin. That is also why it is written
as a plain script rather than with the Odoo framework: the contact surface stays
minimal and the module stays portable from one Odoo version to the next.

## Support

Questions about the modules, or about an Axivox account:
[www.axivox.com](https://www.axivox.com).
