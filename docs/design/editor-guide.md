# Directory editor — one-pager

**Who this is for:** Moana and Kahu. On directory-dev the door is still Data Studio → Directory on `admin-directory-dev.bsky.nz` — that host is the one that publishes. Payload (`admin-payload-directory-dev.bsky.nz`) is the replacement path for the same jobs; it shows the waiting count but does not publish while Directus is the publisher.  
**Approved design:** [editor-interface-design.md](./editor-interface-design.md). That document wins.  
**Not this doc:** rebuilds, Kubernetes, or `npm test` — that is the [MVP runbook](../MVP-RUNBOOK.md).

## Open Directory

Sign in. You land on **Directory**. Three tabs: **Needs confirmation**, **Review**, **Listings**. Review opens first if there is active work; Needs confirmation opens if only parked items remain.

The status band at the top says how many government updates need a decision, and how many of your saves are waiting to go on the public site. **Waiting to go on the site** publishes immediately — there is no confirmation dialog.

## Listings — find, then open

1. Type in **Find an organisation**. The list filters as you type and stays A–Z.
2. Open a result to see the organisation, its service lines, and a check of website / phone / map.
3. **Edit** a line, **Add a service line**, or **Add organisation**. Those open the same form.
4. Tick **Show listings that are not on the site** to restore one with **Put it back on the site**.
5. When you leave **Name**, we look for a similar organisation — including ones not on the site, and names that only share a distinctive word (so **Whanau** warns about **Porirua Whānau Centre**). **Open the existing one** or **Create anyway**.
6. Save writes the listing. It does **not** put a row on Review. The public site updates when you publish.
7. Fields you already curated show **You set this earlier**. The weekly government feed will not overwrite those unless you accept a later change.
8. The government feed misspells. **Porirua Respiritory Support group - Ora Toa** is how it arrives; you can correct the name (and the rest) yourself. That is why the editor exists.

## Review — government updates only

Your own creates never appear here.

- **Details changed** — field rows like `Phone: 04 237 7749 → 04 237 9608`. Added and removed values are marked in the line (help types as a set difference). A row is omitted when the government payload has no value for that field. A removal says **is coming off the site**, not `→ —`. When two services sit under one organisation, the card shows the organisation and then the service line.
- **New service**
- **Gone from the government list**
- **Check the map pin** — the map is the whole card. There is no field list. **The pin is fine** keeps it. **I'll move the pin** opens the form. There is no Skip — that read as a second way of not deciding.

If you cannot decide yet, **Needs confirmation**. That item moves to the **Needs confirmation** tab. It is not a decision. You can come back to it from that tab.

**Recently finished** sits under the Review queue. It is a reference after the Undo window, not the thing you walk through to reach the next card, and it does not appear on Needs confirmation.

If a service has gone from the government list, **Take it off the site** and **Keep it as a community listing** are equal choices. Neither is the default.

If a change is almost right, **Accept and edit** opens the form on that card, headed **Correcting {name}**. The field that changed is marked. On Help types and Community groups the mark sits on the option that moved (**Added in this update** / **Removed in this update**), not on the whole group. **Accept** and **Reject** stay short; the toast names what happened and to what.

After every decision: **Undo** on the toast, and the next active card opens on its own.

When the last active item is done: **Publish now** puts the work on the public site immediately. **Undo publish** is on the toast, then **Undo last publish** on the status band, until the next publish or 24 hours. If someone else has published since, undo is refused.

## Take a service off the site from Listings

**Archive this service line.** Confirm in the dialog. If it is the only public line left, we ask whether to take the organisation off too.
