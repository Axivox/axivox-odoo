# Axivox for Odoo

Two Odoo applications published by [Axivox](https://www.axivox.com), the Belgian
cloud telephony provider.

| Module | What it does |
|---|---|
| **`axivox`** | The call log Odoo Community does not have: every call, with its contact, its recording, and the transcription and analysis when your account has them. |
| **`axivox_softphone`** | A softphone inside Odoo, in a collapsible panel. Click a number to call it; the panel opens by itself on an incoming call. |

Both modules are free and published under the LGPL-3 licence. An Axivox account
is required to use them.

## Where each one runs

| Module | Odoo Online | Odoo.sh | Community |
|---|:---:|:---:|:---:|
| `axivox` | no | yes | yes |
| `axivox_softphone` | yes | yes | yes |

`axivox` adds a model and server-side code, which Odoo Online does not allow.
`axivox_softphone` adds none: no model, no field, no table, no server-side code.

## Which branch to install

One branch per Odoo series. Take the one that matches your server, nothing else.

| Odoo | Branch |
|---|---|
| 19.0 Community or Enterprise | `19.0` |
| 18.0 Community or Enterprise | `18.0` |
| 17.0 Community or Enterprise | `17.0` |
| 16.0 Community or Enterprise | `16.0` |
| 15.0 Community or Enterprise | `15.0` |
| 14.0 Community or Enterprise | `14.0` |

Odoo's own standard support has ended for 16.0 and below. The branches are here
because Odoo still hosts those series, and because a working phone integration
should not be the reason you have to upgrade. They receive the same code as the
others.

## Installing

No external Python dependency: nothing to `pip install`. The examples below
use `19.0`, the series this branch is for.

### Odoo.sh

Add this repository as a submodule of yours. Odoo.sh detects it and puts it in
the addons path on its own.

```bash
git submodule add -b 19.0 https://github.com/Axivox/axivox-odoo.git axivox-odoo
git commit -m "Add the Axivox modules" && git push
```

### Community, self-hosted

Clone the repository somewhere, then add **that directory** to `addons_path`
in your Odoo configuration: the module folders sit at its root.

```bash
git clone --branch 19.0 https://github.com/Axivox/axivox-odoo.git /opt/axivox-odoo
# odoo.conf:  addons_path = /usr/lib/python3/dist-packages/odoo/addons,/opt/axivox-odoo
```

Restart Odoo, then Apps, Update Apps List, and install the module you want.
Copying the folder into an existing addons directory works too, but cloning is
what makes the updates below a single command.

## Updating

**Odoo never downloads a new version of a third-party module.** The Apps screen
only reads what is already in the addons path, and offers the upgrade once it
finds a version number higher than the one recorded when you installed. So the
files come first, Odoo second.

### Odoo.sh

```bash
git submodule update --remote axivox-odoo
git commit -am "Update the Axivox modules" && git push
```

Odoo.sh rebuilds the branch and applies the upgrade by itself.

### Community, self-hosted

```bash
cd /opt/axivox-odoo && git pull
odoo -c /etc/odoo/odoo.conf -d YOUR_DATABASE -u axivox,axivox_softphone --stop-after-init
```

Or, from the interface: Apps, Update Apps List, then Upgrade on the module.
Take your usual backup first, as for any module upgrade.

### How we number releases

Each manifest carries a plain version number, without the Odoo series in front
of it. Odoo puts the series there itself when it records what you installed, so
the same number reads as a `19.0` release on your server. Only that number
moves between releases, and it always moves up: Odoo compares it with what it
recorded at install time, so a fix shipped without raising it would never be
offered to anyone.

A number written with a series in front of it would pin the module to that one
series, and Odoo would refuse to install it anywhere else.

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
