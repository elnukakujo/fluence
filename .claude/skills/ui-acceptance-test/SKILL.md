---
name: ui-acceptance-test
description: Use when a feature, task or spec is finished and the owner must verify it by hand, or when the owner returns a filled-in UI test page. Builds `docs/tests/<date>-<topic>-ui-test.md` with only clickable steps, tick boxes and comment lines; everything checkable by code is tested by pytest/vitest instead. Also handles the owner's answers.
---

# UI acceptance test

Rule: [[ui-acceptance-tests]] (`docs/rules/ui-acceptance-tests.md`). Reference page: `docs/skills/ui-acceptance-test/SKILL.md`.

## 1. Split the checks first
For every behaviour the work added, ask: *can code check it?* Routes, status codes, payloads, database rows, exact numbers, migrations, validation, i18n key parity, component rendering → **write the automated test now** (pytest / vitest, failing first when it is a fix) and list it in the page's "Covered by code" table. Only what needs eyes and a mouse goes to the owner: layout, wording, flow, "does it feel right", things only a real browser and real data show.
Writing these tests often finds bugs — fix them before handing over.

## 2. Write the page `docs/tests/<YYYY-MM-DD>-<topic>-ui-test.md`
- Frontmatter (title, tags `fluence`/`testing`, `last_updated`); add it to `docs/tests/README.md`.
- Top callout "How to fill this in": `[x]` = works, `[ ]` = not working or not tried; write what you saw after **Comment:**.
- **Before you start**: backup, how to start the app, the minimum test data to create. Setup steps are checkboxes too.
- Numbered sections, one per feature. Every step is `- [ ] **n.** <where to click / what to do + the exact expected result>` followed by `  - Comment: `. Use real URLs, button and label texts read from the client code and `messages/en/*.json`; never invent a screen. No curl, Network tab, SQL or console steps.
- Each section ends with `**Section comments:** `; the page ends with "Overall verdict" (`[ ] Ready to merge`, `[ ] Needs changes`) and `**Overall comments / criticism:** `.
- Then "Covered by code (not for you to test)": table area → test file. Then "Still needs a decision from you" listing the open `RD-n`.

## 3. When the owner returns it
Read every `Comment:`, section comment and the verdict. For each: reproduce or locate the cause, fix it (test first), or record it as an open decision. Reply under the comment with `  - Reply: <what changed or why not>`; never delete the owner's text. Unticked steps the owner skipped ("no time", "no data") stay unticked: cover them with a test and say so in the reply. Record domain differences (`refactor-differences.md` RD row + the domain page itself), CHANGELOG and session log in the same edit.

## 4. Keep it honest
Expected numbers come from running the code, not from memory. State in the final message which steps you have not clicked through yourself.
