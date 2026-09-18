# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AxivoxCall(models.Model):
    """The call log, for an Odoo that cannot have Odoo's own.

    Odoo's call log lives in the `voip` module, which is Enterprise: in
    Community it is not merely absent, it is `uninstallable`, the code is not
    on the disk and no API call can install it. This model is what the Axivox
    connector writes to there.

    Two rules were followed without exception.

     * **The field names are Odoo's.** Measured on a real Odoo 19 Enterprise on
       14/09/2026, `voip.call` carries `phone_number`, `direction`, `state`,
       `start_date`, `end_date`, `partner_id`, `user_id`, `summary`,
       `transcript` and `transcription_status`, with these exact selection
       values. The connector therefore writes the same names whichever edition
       it faces, and a customer who moves to Enterprise finds the same shape.
     * **The model name is ours.** Declaring `voip.call` here would mean owning
       a name that belongs to Odoo: the day such a customer installs the real
       app, two modules would define the same model and uninstalling either
       could drop columns the other needs.

     * **What Odoo does not have carries our own names.** Odoo's call log knows
       nothing of a sentiment, of an escalation or of the number that was
       dialled. Those fields are ours, and the connector only writes them where
       the target model accepts them, so an Enterprise keeps working untouched.

    `duration` is in HOURS, which is Odoo's convention for a float time and
    what its own field does: measured on a real instance, `duration * 3600`
    gives the seconds. Unlike Odoo's, ours is **stored**, so that it can be
    summed and grouped in the graph and pivot views. A field that cannot be
    measured is of little use in a call log.
    """

    _name = "axivox.call"
    _description = "Call"
    _inherit = ["mail.thread"]
    _order = "start_date desc, id desc"
    _rec_name = "phone_number"

    phone_number = fields.Char(string="Phone Number", required=True, index=True)
    direction = fields.Selection(
        [("incoming", "Incoming"), ("outgoing", "Outgoing")],
        string="Direction", index=True,
    )
    state = fields.Selection(
        [
            ("aborted", "Aborted"),
            ("calling", "Calling"),
            ("missed", "Missed"),
            ("ongoing", "Ongoing"),
            ("rejected", "Rejected"),
            ("terminated", "Terminated"),
        ],
        string="State", index=True,
    )
    start_date = fields.Datetime(string="Start Date", index=True)
    end_date = fields.Datetime(string="End Date")
    duration = fields.Float(
        string="Duration (hours)", compute="_compute_duration", store=True,
        help="Length of the call, in hours. Odoo's own call log uses this unit; "
             "it is kept so that both sides mean the same thing.",
    )
    duration_s = fields.Integer(
        string="Duration", compute="_compute_duration", store=True,
        help="Length of the call, in seconds.",
    )
    partner_id = fields.Many2one(
        "res.partner", string="Contact", ondelete="set null", index=True,
    )
    # No default: an unattributed call must stay visibly unattributed rather
    # than be credited to whichever account happened to write it.
    user_id = fields.Many2one(
        "res.users", string="Responsible", ondelete="set null", index=True,
    )
    summary = fields.Char(string="Summary")
    transcript = fields.Text(string="Transcript")
    transcription_status = fields.Selection(
        [
            ("pending", "Pending"),
            ("queued", "Queued"),
            ("done", "Done"),
            ("error", "Error"),
            ("too_big_to_process", "Too big to process"),
            ("no_audio", "No audio"),
        ],
        string="Transcription Status",
    )

    # -- What the call was about ------------------------------------------
    # Written from the analysis our own chain produces, which is free-form
    # JSON: every field below is optional, and none is ever required for a
    # call to be complete.
    sentiment = fields.Selection(
        [("positive", "Positive"), ("neutral", "Neutral"), ("negative", "Negative")],
        string="Sentiment", index=True,
        help="How the conversation felt, as analysed from its transcript.",
    )
    escalation = fields.Boolean(
        string="Escalation Suggested", index=True,
        help="The analysis found the call worth a follow-up by someone else.",
    )
    themes = fields.Char(
        string="Themes",
        help="What the call talked about, as the analysis named it.",
    )

    # -- The number of ours that was involved, and the second length ------
    did = fields.Char(
        string="Axivox Number", index=True,
        help="Your own number involved in the call: the one that was dialled "
             "on an incoming call, the one that was presented on an outgoing one.",
    )
    talk_duration_s = fields.Integer(
        string="Talk Duration",
        help="Time actually spent talking, in seconds, ringing excluded. "
             "Zero on a call that was never answered.",
    )

    @api.depends("start_date", "end_date")
    def _compute_duration(self):
        """Two units for one length, and both earn their place.

        `duration` is in hours because that is what Odoo's own field means, and
        keeping the same meaning is the point of using the same names.

        But hours are unreadable for a phone: Odoo shows that field with a
        widget that renders hours and minutes, so every call under a minute
        displays as 00:00. Measured on real calls of 6, 14 and 20 seconds: all
        three showed 00:00, in Odoo's own list as in ours. `duration_s` is
        therefore what the views show, and it is stored so that it can be summed
        and grouped.
        """
        for call in self:
            secondes = 0
            if call.start_date and call.end_date:
                secondes = int(round((call.end_date - call.start_date).total_seconds()))
            call.duration_s = secondes
            call.duration = secondes / 3600.0
