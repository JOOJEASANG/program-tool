# N-UP precedence regression cases

The PDF editor must keep this precedence order:

1. `page.nupDisabled` forces a one-page group.
2. `page.nupOverride` applies to that page.
3. `fileNupMap[file_index]` applies to pages without an override.
4. The global `nup` value is the final fallback.

Manual browser regression checks:

- Set a file to 4-UP, then set one page to 1-UP. Changing the file to 6-UP must leave that page at 1-UP.
- Set a page override to 2-UP. Selecting `기본` for the file must preserve the page override.
- Save and restore an editor session. Page overrides and one-page groups must remain unchanged.
