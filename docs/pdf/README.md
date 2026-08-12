# PDF exports

## Scope of Work v2

**Source (print layout):** [porirua-directory-scope-of-work-v2.html](./porirua-directory-scope-of-work-v2.html)  
**Output:** [../porirua-services-directory-requirements-v2.pdf](../porirua-services-directory-requirements-v2.pdf)

Regenerate from the repo root:

```bash
python3 -m http.server 8765 &
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf=docs/porirua-services-directory-requirements-v2.pdf \
  --virtual-time-budget=15000 \
  "http://127.0.0.1:8765/docs/pdf/porirua-directory-scope-of-work-v2.html"
kill %1
```

Preview the HTML in a browser at the same URL, then print if you prefer.

## Word / Google Docs

**Output:** [../porirua-services-directory-requirements-v2.docx](../porirua-services-directory-requirements-v2.docx)

Regenerate:

```bash
uv venv /tmp/docx-venv && uv pip install --python /tmp/docx-venv/bin/python python-docx
/tmp/docx-venv/bin/python docs/pdf/build-sow-v2-docx.py
```

Upload the `.docx` to Google Drive → **Open with → Google Docs**. Optional: delete the plain Contents list and use **Insert → Table of contents** so headings link automatically.

There is no Google Docs API access from this repo, so the Word file is the path into Docs.
