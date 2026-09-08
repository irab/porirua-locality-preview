# Design artifacts

Working design material for **Your Porirua Directory**. Product requirements stay in the parent [docs index](../README.md).

| Artifact | Audience | Use |
|----------|----------|-----|
| [persona-journey-ana-support.html](./persona-journey-ana-support.html) | Stakeholders | Public **Find support** journey (help-seeker) |
| [persona-journey-sam-community.html](./persona-journey-sam-community.html) | Stakeholders | Public **Connect with community** journey |
| [admin-testing-personas.md](./admin-testing-personas.md) | Locality testers, Coshop | Admin / editor personas and jobs to be done for **design + Directory module** review |
| [editor-interface-design.md](./editor-interface-design.md) | Moana, Kahu, Aroha | **Accepted interface design** (8 Sep 2026) — screens, flows, copy. Not the current Vue sketch |
| [payload-editor-parity.md](./payload-editor-parity.md) | Payload children | Contract pack: Review/Listings/publish routes, auth gate, editor-core reuse. Design wins over Vue |
| [editor-guide.md](./editor-guide.md) | Moana, Kahu | Short editor one-pager (rewrite to match the accepted design as the module is rebuilt) |
| [org-service-grouping-options.md](./org-service-grouping-options.md) | Product, developers | FSD org + subservice grouping (Option B implemented) |

Serve HTML posters from the **repository root** (same as other docs):

```bash
python3 -m http.server 8080
```

- [http://localhost:8080/docs/design/persona-journey-ana-support.html](http://localhost:8080/docs/design/persona-journey-ana-support.html)
- [http://localhost:8080/docs/design/persona-journey-sam-community.html](http://localhost:8080/docs/design/persona-journey-sam-community.html)
