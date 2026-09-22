# -*- coding: utf-8 -*-
from odoo import fields, models


class ResPartner(models.Model):
    """The calls of a contact, reachable from the contact.

    A count and a button, nothing more. `search_count` on the displayed record
    rather than a grouped read: the grouping API changed between Odoo 17 and
    18, and a smart button reads one record at a time anyway.
    """

    _inherit = "res.partner"

    axivox_call_count = fields.Integer(
        string="Calls", compute="_compute_axivox_call_count",
    )

    def _compute_axivox_call_count(self):
        Call = self.env["axivox.call"]
        for partner in self:
            # a record being created has no identity yet, and nothing to count
            pid = partner.id if isinstance(partner.id, int) else False
            partner.axivox_call_count = Call.search_count([("partner_id", "=", pid)]) if pid else 0

    def action_axivox_calls(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Calls",
            "res_model": "axivox.call",
            "view_mode": "tree,form",
            "domain": [("partner_id", "=", self.id)],
            "context": {"default_partner_id": self.id},
        }
