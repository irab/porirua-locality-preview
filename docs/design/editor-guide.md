# Directory editor — one-pager

**Who this is for:** Moana and Kahu.  
**Approved design:** [editor-interface-design.md](./editor-interface-design.md). That document wins.  
**Not this doc:** rebuilds, Kubernetes, or `npm test` — that is the [MVP runbook](../MVP-RUNBOOK.md).

## Two doors, one catalog

On directory-dev you can do Review and Listings from either admin host. They write the same catalog. You do not need Directus Content / collections to maintain listings.

| Host | URL | What it is for |
|------|-----|----------------|
| Payload Directory | [admin-payload-directory-dev.bsky.nz](https://admin-payload-directory-dev.bsky.nz) (local: `http://127.0.0.1:18100/admin`) | Replacement Directory. Sign in as Editor. You land on **Directory**. |
| Directus Directory | [admin-directory-dev.bsky.nz](https://admin-directory-dev.bsky.nz) | The older Directory module. **This host is still the publisher.** |

**Publish today is Directus only.** Payload shows how many saves are waiting and will not put them on the public site (`CATALOG_PUBLISHER=directus`). The waiting control is visible and refused, so the two hosts cannot publish at once. When you mean to update the public directory, publish from Directus.

## Open Directory

Sign in. You land on **Directory**, not a list of collections. Three tabs, in this order: **Needs confirmation**, **Review**, **Listings**. Review opens first if there is active work; Needs confirmation opens if only parked items remain; otherwise Listings.

The status band at the top says how many government updates need a decision, and how many of your saves are waiting to go on the public site. On the publisher host, **Waiting to go on the site** publishes immediately — there is no confirmation dialog. On Payload that control stays visible and disabled, with a note that publish lives on the Directus host.

## Listings — find, then open

1. Type in **Find an organisation**. The list filters as you type and stays A–Z.
2. Open a result to see the organisation, its service lines, and a check of website / phone / address. If a pin exists, a **Now** / **Proposed** placeholder can appear — it is not a map you can drag.
3. **Edit** a line, **Add a service line**, or **Add organisation**. Those open the same form.
4. Tick **Show listings that are not on the site** to restore one with **Put it back on the site**.
5. When you leave **Name**, we look for a similar organisation — including ones not on the site, and names that only share a distinctive word (so **Whanau** warns about **Porirua Whānau Centre**). **Open the existing one** or **Create anyway**.
6. Save writes the listing. It does **not** put a row on Review. The public site updates when you publish (from the publisher host).
7. Fields you already curated show **You set this earlier**. The weekly government feed will not overwrite those unless you accept a later change.
8. The government feed misspells. **Porirua Respiritory Support group - Ora Toa** is how it arrives; you can correct the name (and the rest) yourself. That is why the editor exists.

## Address and pin

The address field is a complete path. Search an address to set the pin, then drag the pin on the map if the place is wrong. You can also click the map to put the pin there, or type an address and save with no pin.

The map draws OpenStreetMap tiles. If those tiles cannot load, the map hides itself and the rest of the form keeps working — you can still save an address without a pin.

On Review, a card shows the pin whenever the update moves it: **Now** is what is on the site and **Proposed** is the update. **I'll move the pin** opens the same form, where the pin is draggable.

## Review — government updates only

Your own creates never appear here.

- **Details changed** — field rows like `Phone: 04 237 7749 → 04 237 9608`. Added and removed values are marked in the line (help types as a set difference). A row is omitted when the government payload has no value for that field. A removal says **is coming off the site**, not `→ —`. When two services sit under one organisation, the card shows the organisation and then the service line.
- **New service**
- **Gone from the government list**
- **Check the map pin** — decide from the address and the Now / Proposed placeholder. **The pin is fine** keeps it. **I'll move the pin** opens the form. There is no Skip — that read as a second way of not deciding.

If you cannot decide yet, **Needs confirmation**. That item moves to the **Needs confirmation** tab (the first tab, always there). It is not a decision, and Review will not open those cards for you. You can come back to them from that tab.

**Recently finished** sits under the Review queue. It is a reference after the Undo window, not the thing you walk through to reach the next card, and it does not appear on Needs confirmation.

If a service has gone from the government list, **Take it off the site** and **Keep it as a community listing** are equal choices. Neither is the default — pick one on purpose.

If a change is almost right, **Accept and edit** opens the form on that card, headed **Correcting {name}**. The field that changed is marked. On Help types and Community groups the mark sits on the option that moved (**Added in this update** / **Removed in this update**), not on the whole group. **Accept** and **Reject** stay short; the toast names what happened and to what.

After every decision: **Undo** on the toast, and the next active card opens on its own. Focus lands on that card’s **heading** (the organisation name), not on **Accept**, so Enter will not accept by accident.

When the last active item is done: **Publish now** puts the work on the public site immediately — on the publisher host. On Payload that finish action is refused for the same reason as the status band. **Undo publish** is on the toast, then **Undo last publish** on the status band, until the next publish or 24 hours. If someone else has published since, undo is refused.

## Take a service off the site from Listings

**Archive this service line.** Confirm in the dialog. If it is the only public line left, we ask whether to take the organisation off too.
