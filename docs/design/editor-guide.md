# Directory editor — one-pager

**Who this is for:** Moana and Kahu in Data Studio.  
**Design for approval:** [editor-interface-design.md](./editor-interface-design.md) — that document wins where it disagrees with this sketch.  
**Not this doc:** rebuilds, Kubernetes, or `npm test` — that is the [MVP runbook](../MVP-RUNBOOK.md).

## Open Directory

Sign in. You land on **Directory**, not an empty Content screen. Two equal tabs: **Review** and **Listings**. Review opens first if anything is waiting; otherwise Listings.

You will not see raw Organisations, Services, Snapshots, or Review queue collections. You do not type JSON.

## Listings — find, change, or add a card

1. Type in **Find an organisation** — the list filters as you type and stays A–Z.
2. Click a row to **select** it (for Add service line). Click **Edit** to change it. Those are different actions.
3. Tick **Show listings that are off the site** to see archived cards. **Put it back on the site** restores one.
4. Add is either a **new community organisation** or a **new service line** on a selected organisation (including a government one).
5. Name, description, Address, Phone, Website, Help types (tick existing chips only), map pin (search an address, then **drag the pin** if it is wrong). You never see latitude or longitude numbers.
6. When you leave **Name**, we look for a similar organisation — including ones taken off the site or already merged. **Open the existing one** if that is the same group. **Create anyway** if they really are two different groups.
7. Save writes the listing. It does **not** put a row on Review. The public site still shows the last Publish. A confirmation tells you it will go public when you publish.
8. The banner says changes are unpublished. Click **Publish** when you are ready for the public site.

## Review — government (FSD) proposals only

Your own creates never appear here. The tab shows how many changes are waiting (**4 changes to review**). Each card names the organisation, says what kind of proposal it is in plain words, and shows the change:

- **Details changed** — field rows like `Phone: 04 237 7749 → 04 237 9608` (only fields that actually moved)
- **New service** — the fields being added
- **Gone from the government list** — what will come off the site
- **Check the pin** — the map, not a pair of numbers

| What you see | What to do |
|--------------|------------|
| Details changed | **Accept**, or **Keep yours** if you already set that field, or **Don't use this change** |
| New service | **Accept**, or **Don't add this** |
| Gone from the government list | **Take it off the site** — or leave it |
| Check the pin | **The pin is fine**, or **Skip this pin check** |

After each action a confirmation says what happens next: **Accepted. It will go on the public site when you publish.**

When the last card is gone: **You've reviewed everything. Put 4 changes on the public site** — with **Publish** right there.

**Take it off the site** hides the service so next week’s feed does not put it back.

## Take a service off the site from Listings

**Archive this service line.** Confirm in the dialog (not a browser alert). If it is the only public line left, we ask whether to take the organisation off too.

## Duplicates we already know about

Four organisation pairs are on the public site twice today (macrons, a phone split, a sheet typo). The name warning will flag them. Merging them is a separate tool — when two names match except for macrons, keep the macronised name (**Porirua Whānau Centre**, **Te Rūnanga o Toa Rangatira**). Details: [open-duplicate-org-cards](../issues/open-duplicate-org-cards.md).
