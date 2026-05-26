---
title: Getting Input from Users — Forms and Controls
source_chapter: 10 — Getting Input from Users: Forms and Controls
purpose: Catalog of Ch.10's form + control patterns, with audit-ready signals
---

# Getting Input from Users — Forms and Controls

Patterns for surfaces that ask the user to enter, choose, or correct data — sign-up, sign-in, checkout, search, settings, profile, content creation, configuration. Audit lens: each field costs the user time and attention; does the form earn that cost, or does it ask redundant questions, hide the format it wants, validate at the wrong moment, or fail silently?

## Form design heuristics

Audit checks for any form surface. Apply field-by-field.

- **Respect the user's time + attention** — Is every field load-bearing? Could any be inferred (city/state from zip, card type from BIN) or deferred (ask later, not now)?
- **State the form's purpose** — Does the header explain *why* this information is being requested, *how* it will be used, and *what the user gets*? "Sign up" is not a purpose; "Save your favorites across devices" is.
- **Minimize the number of inputs** — Each input must justify its existence. Avoid duplicate identity fields (email + username + first/last + display name); avoid asking for data computable from other inputs.
- **Minimize visual clutter** — Nothing on the form competes with the form. No marketing copy, no promo banners, no animated illustrations interleaved with fields.
- **Group and title sections** — Long forms broken into [[04-layout|Titled Sections]] (and optionally progressive show/hide), not one giant scroll.
- **Show/hide for length** — Long or branching forms reveal sections one at a time; optional sections collapsed by default.
- **Vertical alignment** — Inputs left-aligned; labels above or left-aligned; eye should travel straight down, not jog left-right.
- **Mark required vs optional consistently** — Pick one rule (mark required, mark optional, mark the minority, show only required) and apply it everywhere. Asterisk-without-legend is a usability bug.
- **Label + example + help** — Real `<label>` (not placeholder-only) for a11y; example or [[#Input Hints]] for ambiguous formats; longer help in a triggered popover for the few who need it.
- **Field width hints at expected length** — A 6-char zip input should *look* 6 chars wide; a paragraph field looks like a paragraph.
- **Accept input variation** — Format-tolerant fields ([[#Forgiving Format]]) for dates, phones, credit cards, addresses; structured controls ([[#Structured Format]]) only when format is genuinely universal and predictable.
- **Validate early, not at submit** — Validate on blur (or after typing settles); show field-level errors in place; never throw a wall of errors only after Submit. Don't fire errors *while* the user is mid-typing a valid string.
- **Give actionable error messages** — Each error names *which field*, *what's wrong*, *how to fix* — never "Invalid input." See [[#Error Messages]].
- **Internationalization** — Layout survives translated string length and writing direction; units, dates, currencies, address formats adapt; no field assumes US conventions ("State" dropdown, "Zip" label, "First / Last name" decomposition).
- **Confirm success** — When the form submits, tell the user it worked and what happens next, not just "Thanks."
- **Top-aligned labels for responsive layouts** — Survives column collapse without re-flow.
- **Evolving conventions** — Floating labels (label-as-placeholder that animates up on focus) preserve the label after the user types — unlike pure [[#Input Prompt]] which disappears; pick floating labels when you need the label *and* a hint to coexist.
- **Usability-test it** — Form terminology drifts between designer and user faster than anywhere else in the UI. If you haven't watched a person fill it out, the form has bugs you can't see.

## Patterns

### Forgiving Format

- Use when: The field accepts data users might type in many shapes (date, address, phone, credit card, search query, name) and you'd rather make the parser smart than the UI fussy.
- What it is: A single input that accepts a wide range of formats and the software normalizes/disambiguates after entry.
- Why it works: Users don't want to think about format; computers can. Removes a whole class of "format error" frustration and keeps the UI visually simple — often eliminates the need for an [[#Input Hints]] or [[#Input Prompt]].
- How to apply:
  - Identify the legitimate variations (whitespace, separators, capitalization, abbreviations, partial values like "7/20" without a year).
  - Implement parsing on commit or blur; *don't* re-format mid-typing while the user is still entering.
  - Echo the normalized value back so the user sees how the system interpreted it ("Saturday, July 20, 2026").
  - Fall back to a clear [[#Error Messages|error message]] when the input is truly unparseable — name what was ambiguous.
  - Test against real user input, not just synthetic cases.
- Signals present (in code/spec): Server-side or client-side normalization function (`parseDate`, `parsePhone`, `parseCreditCard`); regex with multiple capture alternatives; libraries like `libphonenumber`, `chrono-node`, `date-fns/parseISO` with fallback parsers.
- Signals missing (red flag): A field that rejects "07/20/26" because it wanted "2026-07-20"; a credit card field that errors on spaces; a search box that only matches exact stock tickers.
- Anti-patterns / mis-applications: Silently parsing an ambiguous input wrong (e.g., interpreting `7/20` as 20 July in EU locale where users meant 7 Feb 0020 — no, but you get the idea); stripping characters mid-keystroke so cursor jumps; "smart" parser that throws on edge cases without explanation.
- Related: [[#Structured Format]], [[#Input Hints]], [[#Autocompletion]], [[#Error Messages]]

### Structured Format

- Use when: The field captures a value with a *universal*, *predictable*, *fixed-length* format that doesn't vary by user or locale — security codes, card CVV chunks, single-country phone numbers, license keys.
- What it is: A row of small text fields, each sized to one segment of the value, with focus auto-advancing as each fills.
- Why it works: The shape of the inputs tells the user the expected format without requiring instructions. Short segments are easier to scan, double-check, and dictate. Auto-advance reduces typing friction.
- How to apply:
  - One sub-field per natural segment; size to match segment length.
  - Auto-advance focus on segment completion; allow backspace to retreat into the previous segment.
  - Show separators (dashes, slashes, colons) between fields as static text.
  - Pair with an [[#Input Prompt]] for date / time segments ("MM", "DD", "YYYY").
  - Never use for any field that varies internationally (postal codes, phone numbers, addresses, names) — fall back to [[#Forgiving Format]].
  - Support paste across all segments (paste of "123456" should populate all six boxes, not just the first).
- Signals present (in code/spec): Multi-input OTP / PIN / code components (`<OTPInput>`, `<PinInput>`); explicit `onChange` handlers that advance `ref.current.focus()`; `inputMode="numeric"` with `maxLength={1}` per segment.
- Signals missing (red flag): A "phone number" field that's one box and rejects spaces (use [[#Forgiving Format]] instead); a verification-code field that's one long text input asking for "6 digits."
- Anti-patterns / mis-applications: Using structured format for international phone numbers (US-shape `(___) ___-____` breaks for everyone else); blocking paste because the input is split; no backspace-retreat (user has to click into the previous box to fix a typo); structured format on a field that *could* legitimately vary.
- Related: [[#Forgiving Format]], [[#Input Prompt]], [[01-foundations-cognition#P-07. Habituation]]

### Fill-in-the-Blanks

- Use when: A control or set of controls is easier to understand when read as a sentence than as a labeled field — query builders, rule editors, conditional logic, filter conditions, "remind me X days before Y."
- What it is: A natural-language sentence with controls (dropdowns, text fields, combo boxes) embedded inline as the "blanks."
- Why it works: Sentences are self-explanatory; users complete them without reading instructions. Inline controls inherit context from the surrounding words, eliminating the cognitive jump from label to value.
- How to apply:
  - Write the sentence first in plain prose; then replace nouns/values with controls.
  - Use inline controls with the same form-factor as words (compact dropdowns, short text fields). Avoid embedding large multi-line inputs mid-sentence.
  - Align text baselines between prose and controls; maintain word spacing.
  - Size controls just wide enough for the expected value.
  - For complex logic, stack multiple fill-in sentences vertically rather than nesting one giant sentence.
  - Plan for i18n: word order changes by language. Either commit to a separate layout per locale or fall back to labeled fields.
- Signals present (in code/spec): Inline `<select>` / `<input>` elements within flowing text spans; rule-builder / query-builder components where the rule reads as a sentence; conditional-formatting UIs.
- Signals missing (red flag): A modal full of "Operator: [equals]", "Value: [...]" labels for what is conceptually "show items where price equals X"; complex rule-builder UI that requires a help doc to interpret.
- Anti-patterns / mis-applications: Sentence so long it wraps unpredictably and breaks alignment; localizing word-for-word into a language with different syntax and ending up with a non-sentence; using fill-in-the-blanks for simple short fields where a plain label would have done.
- Related: [[#Drop-down Chooser]], [[08-actions]] (Smart Menu Items)

### Input Hints

- Use when: A text field's purpose or required format isn't obvious from its label alone, but you don't want to clutter the label itself.
- What it is: A short example or explanatory phrase placed below, beside, or above the field — *outside* the input — that clarifies what to enter.
- Why it works: Visible help for users who need it, easy to skip for users who don't. The field stays empty (no placeholder confusion about whether it's already filled).
- How to apply:
  - Place the hint adjacent to the field, not inside it (avoid the placeholder-as-help anti-pattern).
  - Keep it short — one sentence or less.
  - Make it smaller and lighter than the label (typically 2pt smaller font, secondary color), still readable.
  - Use plain language; show one example value when possible ("e.g., name@example.com").
  - For longer explanations, link to a popover / modal — but don't depend on the link being followed.
  - Right-aligned hints (Apple-checkout style) work for label/control/hint triplets if vertical space is short.
- Signals present (in code/spec): A `<FormField>` component with a `helperText` / `description` slot rendered below the input; design-token-sized "caption" or "help" typography style; hints rendered even before focus.
- Signals missing (red flag): Placeholder text used as the only explanation of what the field wants (disappears on focus, mistaken for filled value); cryptic labels with no clarifying example ("Reference number" with no format shown); critical context buried in a tooltip on a `?` icon.
- Anti-patterns / mis-applications: Hint text that's longer than three lines (users skip it); using hints to communicate validation errors (errors should appear conditionally in their own slot); identical hint repeated under every field (sign you needed one section-level instruction instead).
- Related: [[#Input Prompt]], [[#Forgiving Format]], [[#Error Messages]], [[01-foundations-cognition#P-03. Satisficing]]

### Input Prompt

- Use when: A text field, dropdown, or combo box needs a hint *inside* the control itself — typically because there's no good default value and you want the user to notice the field is empty and actionable.
- What it is: Placeholder text *inside* the control (e.g., "Type your message", "Choose a state") that disappears when the user begins entering.
- Why it works: Sits exactly where the user will act, so it can't be missed. Imperative phrasing ("Pick a date") communicates that an action is required.
- How to apply:
  - Use a verb prompt: "Select / Choose / Pick…" for dropdowns; "Type / Enter…" for text fields.
  - End the phrase with a noun describing the data ("Enter your email address").
  - For dropdowns, the prompt is *not* a selectable value — selecting it returns to "no choice."
  - Disable the form's Submit until the prompt has been replaced with real input (no error message needed).
  - Restore the prompt when the user clears their entry.
  - Use [[#Good Defaults and Smart Prefills]] instead when you can guess accurately.
  - **Don't conflate with floating labels** — input prompts *disappear* on focus; floating labels shrink and stay. If you need both label + format hint, use a floating label with a separate [[#Input Hints]].
- Signals present (in code/spec): `placeholder` attribute on `<input>` / `<select>`; first dropdown `<option>` value is empty string with a verb-phrase label.
- Signals missing (red flag): Dropdowns that default to the first real option (user can't tell if they picked it on purpose or by default); text fields with no label, no placeholder, no hint; "Enter information" as the only direction.
- Anti-patterns / mis-applications: Using a prompt as a *substitute* for a label (kills a11y — screen readers may skip placeholder text; once the user types, no label is visible); prompts that are also valid values (user can't tell empty from selected); colored placeholder that looks like real input.
- Related: [[#Input Hints]], [[#Good Defaults and Smart Prefills]], [[#Autocompletion]]

### Password Strength Meter

- Use when: The user is choosing a new password and the system has password-strength requirements, or you want to actively help users avoid weak passwords.
- What it is: Live feedback (color bar, checklist, text label) that appears while the user types, indicating whether the password meets requirements / is strong enough.
- Why it works: Immediate, in-place feedback lets the user iterate to a valid password before submitting — no submit-error-resubmit loop. Concrete requirements (length, character class) reduce frustration vs. a vague "weak."
- How to apply:
  - Update while the user types (or on blur of the password field).
  - Show at minimum: weak / medium / strong (or pass / fail). Colors: red unacceptable, yellow intermediate, green acceptable.
  - Pair colors with text *and* iconography (red-green colorblindness).
  - If you reject weak passwords, surface the rules up-front via [[#Input Hints]] — don't let the user discover them by repeated rejection.
  - Best contemporary form is a *checklist* of explicit requirements (≥8 chars, includes a number, includes a symbol) that tick green as satisfied.
  - Offer a show/hide-password toggle (default hidden).
  - Don't suggest replacement passwords (security risk).
- Signals present (in code/spec): A `PasswordField` component with a strength estimator (`zxcvbn`, custom regex checklist); render of requirement-checkmark rows that update on `onChange`; explicit `aria-live="polite"` on the meter so screen readers hear strength updates.
- Signals missing (red flag): Password field that accepts anything, then rejects on submit with "password too weak — must contain X, Y, Z" *after* the user committed; password rules listed in the legal copy or a separate help page.
- Anti-patterns / mis-applications: Meter that says "strong" for any 8+ char string regardless of dictionary attacks; rules so onerous and unstated that users build a password by trial and error; auto-clearing the password field when validation fails (user retypes from scratch).
- Related: [[#Input Hints]], [[#Error Messages]], [[01-foundations-cognition#P-06. Incremental Construction]]

### Autocompletion

- Use when: The user types something predictable — URLs, email addresses, names, stock symbols, search terms, file paths, code — and there's a known set of likely values (user history, popular queries, dictionary, content corpus).
- What it is: As the user types, the UI surfaces likely completions (drop-down list, inline ghost text, tab-completion) that the user can accept with one keystroke / tap.
- Why it works: Cuts typing effort, reduces typo / memory errors, and works as a soft map of valid values. Especially valuable on mobile, where typing is expensive.
- How to apply:
  - Source the suggestions: user history, common-phrase dictionary, content corpus (for site search), contacts, popular queries — pick what fits.
  - Two interaction styles: (a) explicit completions list shown below the field, picked with arrow keys / tap; (b) inline ghost-text completion accepted with Tab / right-arrow / swipe.
  - Default to *not* accepting the completion — the user must opt in (key press or tap). Never auto-commit.
  - Allow straight-through typing: if the user keeps typing past the suggestion, treat their text as authoritative.
  - Stop offering a suggestion the user has rejected repeatedly in the same session.
  - Highlight the matched substring in each suggestion.
  - Debounce server requests for remote suggestions; cap list length.
- Signals present (in code/spec): `<Combobox>` / `<Autocomplete>` component with async suggestion fetcher; `aria-autocomplete="list"` / `"inline"`; search field with debounced query and dropdown of results.
- Signals missing (red flag): Search field with no suggestions on a corpus where the user is guessing at exact terms; email composer with no contact completion; "username" field that lets the user type a duplicate and only fails on submit.
- Anti-patterns / mis-applications: Auto-committing the top suggestion when the user blurs (silently changes their input); suggestions that block typing (keystrokes lost while the dropdown is rendering); offensive / wrong popular-search suggestions surfaced without guardrails; suggestions hide the next field on mobile.
- Related: [[#Input Prompt]], [[#Forgiving Format]], [[#Good Defaults and Smart Prefills]], [[01-foundations-cognition#P-11. Streamlined Repetition]]

### Drop-down Chooser

- Use when: The user needs to pick a value (color, date, time, number, file, font, brush, location, asset) and a richer UI than a flat list would help — but you can't spare main-canvas space for it.
- What it is: A control that looks like a closed combo box / button in its resting state and expands on click to reveal a complex picker — calendar, color wheel, grid of thumbnails, tree, calculator, slider, file browser.
- Why it works: Encapsulates a rich picker in a small footprint; the main surface stays clean and the chooser appears only when invoked. Users already understand the down-arrow disclosure idiom.
- How to apply:
  - Closed state: show the current value plus a down-arrow.
  - Click anywhere on the control (not just the arrow) opens the chooser; click again or click outside closes it.
  - Choose a picker layout that matches the data: list, table, tree, calendar, swatch grid, tabbed panel.
  - For very large source sets (filesystems), allow scrolling but consider a "Browse…" link to a full modal as escape hatch.
  - The chooser can expose recent / favorite picks at the top to short-circuit the full picker.
  - Echo the chosen value back in the closed control immediately on selection.
  - Don't trap focus; pressing Esc closes the chooser without changing value.
- Signals present (in code/spec): Popover / floating-panel components anchored to a button with `aria-haspopup` / `aria-expanded`; custom pickers built on top of `<Popover>` (date picker, color picker, font picker); MUI `<Select>` with custom render.
- Signals missing (red flag): A toolbar with a "Color…" button that opens a full modal dialog for one swatch pick; a date field that's just a free-text input with no calendar affordance; a font picker that requires typing the font name.
- Anti-patterns / mis-applications: Chooser that's too small to use (date picker with 8px touch targets); chooser that doesn't close on outside click; closed state that doesn't show the current value (just a generic label); committing on hover instead of click.
- Related: [[#Autocompletion]], [[#Fill-in-the-Blanks]], [[08-actions]] (toolbars), [[03-navigation]] (Escape Hatch)

### List Builder

- Use when: The user needs to assemble a subset out of a potentially large source set — recipients from a directory, tags from a tag library, files into a batch, columns to display, features to include.
- What it is: A two-pane widget with the source list on one side and the destination list on the other, with controls (Add/Remove buttons, drag-and-drop, click-to-jump) to move items between them.
- Why it works: Both states — what's available and what's chosen — are visible at once, so the user always knows what's in their selection. Scales to large source lists better than a wall of checkboxes (where "what did I check?" is unanswerable).
- How to apply:
  - Lay out source and destination side-by-side (left/right) or stacked (top/bottom).
  - Provide bidirectional movement (Add and Remove, or drag both directions).
  - Support multi-select semantics — let users move several items at once.
  - Make each list searchable when long.
  - Allow ordering of the destination list when order matters (drag-handles, move-up/down buttons).
  - Decide whether items disappear from the source when moved (consumable lists) or stay (catalog-style); document the choice in the UI.
  - Confirm moves with motion (item visibly travels) or at minimum updates of both lists in the same tick.
- Signals present (in code/spec): Dual `<List>` / `<DataTable>` components with a shared selection model; drag-and-drop library (`dnd-kit`, `react-beautiful-dnd`) wired across both panes; Add/Remove buttons between panes.
- Signals missing (red flag): A "Manage tags" UI that's just one long checklist where the user can't see at a glance what's checked; column-picker modal that hides the destination list under another tab; tag picker forcing the user to type each one even though a directory exists.
- Anti-patterns / mis-applications: Drag-only with no button fallback (broken for keyboard users); destination list that doesn't preserve order; moves that don't take effect until the user clicks "Apply" elsewhere.
- Related: [[#Drop-down Chooser]], [[07-lists]] (multi-select), [[01-foundations-cognition#P-12. Keyboard Only]]

### Good Defaults and Smart Prefills

- Use when: A field has a high-probability answer based on user context (account info, location, prior session, common case) that would save the user typing or thinking.
- What it is: Pre-populated values in form controls — text fields, dropdowns, checkboxes — chosen because most users, most of the time, will accept them.
- Why it works: Halves the time to complete the form for the common case; provides an example of the expected answer type even when the user changes it; supplies graceful guesses where the user genuinely doesn't care (install location, theme).
- How to apply:
  - Identify each field's most-likely value from: session context, user account, prior input, derived data (city/state from zip; timezone from locale; "From" city from current location).
  - Prefill on first render or dynamically as earlier fields are filled.
  - **Don't prefill sensitive or politically-charged values** (gender, citizenship, password) — let the user choose explicitly.
  - **Don't pre-check opt-in boxes for marketing / data sharing / "I agree to be contacted"** — implicit consent is dark-pattern territory.
  - Make defaults easy to change — never hide the underlying control.
  - Watch for the "auto-skip" failure: a prefilled field may not register in the user's awareness; for important decisions, prefer an explicit prompt.
- Signals present (in code/spec): `defaultValue` populated from user context / profile / session; derived state effects that auto-fill dependent fields (`useEffect(() => setState(...))`); zip-to-city lookup wired to a form effect.
- Signals missing (red flag): A profile form that asks the user to retype their name and email they already gave during signup; a checkout that re-asks the shipping address every time; a calendar form that defaults date to 1970-01-01.
- Anti-patterns / mis-applications: Pre-checked marketing / newsletter / "share my data" boxes; defaults that imply consent or commitment (pre-selected paid plan); defaults users don't notice silently changing their submission; defaulting destructive options (delete all, share publicly).
- Related: [[#Input Prompt]], [[#Autocompletion]], [[01-foundations-cognition#P-11. Streamlined Repetition]], [[01-foundations-cognition#P-01. Safe Exploration]]

### Error Messages

- Use when: A form input is rejected — required field skipped, format unparseable, value out of range, server-side validation failure — and the user needs to fix it.
- What it is: An inline message rendered on the form itself, next to the offending field, naming what's wrong and how to fix it.
- Why it works: Keeping the message *next to* the field means the user can read and act simultaneously, with no dismissal-then-memory step. Field-level marking shows at a glance where the problem is.
- How to apply:
  - Validate as early as feasible — on blur (after typing settles), or live for password-strength-style feedback. Never validate only on submit when client-side checks would catch it.
  - Mark every offending field with: color (red), icon (warning), inline message — not color alone (colorblind users).
  - Message structure: name the field, name the problem, suggest the fix. "Email must include an '@'." not "Invalid input."
  - For long forms, also render a top-of-form summary that lists each error with a link to its field (good for screen readers and long scroll forms).
  - Clear the error as soon as the user starts fixing it — but don't fire a *new* error while they're still typing a valid string.
  - Use plain language, not computerese ("Is that a letter in your zip code?" not "Numeric validation error 0x42").
  - Be polite; phrase the error as helpful, not accusatory.
  - Prevent errors up front with [[#Input Hints]], [[#Input Prompt]], [[#Forgiving Format]], [[#Autocompletion]], [[#Good Defaults and Smart Prefills]].
- Signals present (in code/spec): Form library (`react-hook-form`, `Formik`, native `<Form>`) with field-level error rendering; `aria-invalid` and `aria-describedby` on inputs wired to error messages; blur-triggered validation in field components.
- Signals missing (red flag): Validation only on submit; "Invalid input" with no field reference; modal alert that disappears before the user reaches the broken field; entire-form red border with no per-field marking; errors reported only as native browser tooltips.
- Anti-patterns / mis-applications: Clearing the form on a validation failure (forces retype); error message that appears mid-typing while the user is still constructing a valid string; throwing a stack trace or HTTP status code at the user; locking the Submit button without explaining which field is invalid; one error at a time (user fixes, submits, sees the next, fixes, submits…).
- Related: [[#Password Strength Meter]], [[#Forgiving Format]], [[#Input Hints]], [[08-actions]] (Cancelability), [[01-foundations-cognition#P-01. Safe Exploration]]
