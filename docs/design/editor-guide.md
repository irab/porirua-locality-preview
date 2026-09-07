# Directory editor — one-pager

**Who this is for:** Moana and Kahu in Data Studio.  
**Not this doc:** rebuilds, Kubernetes, or `npm test` — that is the [MVP runbook](../MVP-RUNBOOK.md).

## Open Directory

Data Studio sidebar → **Directory**. Two equal tabs: **Review** and **Listings**. Review opens first if anything is waiting; otherwise Listings.

You will not see raw Organisations, Services, Snapshots, or Review queue collections. You do not type JSON.

## Listings — change or add a card

1. Find the organisation, or **Add**.
2. Add is either a **new community organisation** or a **new service line** on an organisation that already exists (including a government one).
3. Name, description, Address, Phone, Website, Help types (tick existing chips only), map pin (search an address, then drag if it is wrong).
4. When you leave **Name**, we look for a similar organisation — including ones taken off the site or already merged. **Open the existing one** if that is the same group. **Create anyway** if they really are two different groups.
5. Save writes the listing. It does **not** put a row on Review. The public site still shows the last Publish.
6. The banner says changes are unpublished. Click **Publish** when you are ready for the public site.

## Review — government (FSD) proposals only

Your own creates never appear here. Each row is something the weekly government feed proposed.

| What you see | What to do |
|--------------|------------|
| A field changed | **Take government value**, or **Keep yours** if you already set that field, or Edit |
| A new government listing | Accept, Reject, or Edit |
| Gone from the government feed | **Take it off the site** (not “Accept”) — or keep it |
| Pin looks wrong | The pin is fine / Move the pin / Keep it |

**Take it off the site** hides the service so next week’s feed does not put it back.

## Take a service off the site from Listings

Archive **this service line**. If it is the only public line left, we will ask whether to take the organisation off too.

## Duplicates we already know about

Four organisation pairs are on the public site twice today (macrons, a phone split, a sheet typo). The name warning will flag them. Merging them is a separate tool — when two names match except for macrons, keep the macronised name (**Porirua Whānau Centre**, **Te Rūnanga o Toa Rangatira**). Details: [open-duplicate-org-cards](../issues/open-duplicate-org-cards.md).
