# Swift Coding Standards

Reference document for reviewing the Swift target (`ios/`). Each rule has a stable ID. When citing a violation, use the ID.

## How to use this file

Each rule entry has:
- **ID** -- stable identifier. Cite as `NAME-001` etc.
- **Rule** -- one imperative sentence. The standard itself.
- **Signal** -- concrete things to look for in source (keywords, patterns, anti-patterns). What an agent greps or skims for.
- **Fix** -- corrected form, or the question to ask if judgement is needed.
- **Example** (optional) -- BAD / GOOD snippet when the contrast is non-obvious.

Review process:
1. Open each Swift file under change.
2. For each rule section, scan for **Signal** matches.
3. Emit findings as `ID: <file>:<line> <one-line violation>`.
4. For ambiguous cases (rule requires architectural judgement), flag with `ID? <file>:<line>` and a one-line question.

---

## NAME -- Naming and API surface

### NAME-001 -- Types UpperCamelCase; functions, vars, enum cases lowerCamelCase
- Signal: `struct lower`, `enum lower`, `class lower`, `protocol lower`, `func Upper`, `let Upper =`, `var Upper =`, `case Upper`.
- Fix: rename per kind.

### NAME-002 -- Optimise names for the call site, not the declaration
- Signal: methods read awkwardly when invoked (e.g. `array.insertAt(index:5,value:x)` instead of `array.insert(x, at: 5)`); argument labels missing or redundant at call site.
- Fix: re-label so the call reads as a phrase. Drop labels that duplicate the type already conveyed by the value.

### NAME-003 -- Every public/internal function has a `///` doc comment; generic functions especially
- Signal: `public func`, `internal func`, `func <T>` with no `///` line above.
- Fix: add a doc comment describing purpose, parameters, returns, and `- Throws:` if it throws.

### NAME-004 -- Clarity over brevity
- Signal: 1-2 character identifiers outside tight scopes; abbreviations that obscure meaning (`usr`, `mgr`, `ctx` where a fuller name fits).
- Fix: spell out names unless the scope is < ~5 lines and the meaning is local.

---

## TYPE -- Choosing struct vs class vs enum vs actor

### TYPE-001 -- Default to `struct`. Use `class` only when shared identity is essential
- Signal: `class Foo` where the type has only data + pure methods and no shared-mutable-state requirement.
- Fix: convert to `struct`. If callers depend on reference-identity (`===`, `===` comparisons, shared observers), keep as class and document why.

### TYPE-002 -- Classes are `final` unless explicitly designed for inheritance
- Signal: `class Foo {` with no `final` and no subclass in the codebase, or subclasses that only override one method.
- Fix: add `final`. If subclassing is the design, replace inheritance with composition or protocol conformance where possible.

### TYPE-003 -- Use `public` (not `open`) for classes external code may use but must not subclass
- Signal: `open class Foo` exposed in the public API with no documented subclass extension point.
- Fix: downgrade to `public`.

### TYPE-004 -- Value-semantic classes are `final` with only `let` stored properties
- Signal: a class advertised as value-like but with `var` stored properties or no `final`.
- Fix: `final class` + `let` everywhere, OR convert to `struct`.

### TYPE-005 -- Use `enum` when modelling a closed set of mutually exclusive states; use `struct` when consumers in other modules need to add cases
- Signal: a struct with a `kind: Kind` enum plus mutually exclusive optional fields; or a sealed `enum` exposed by a library that downstream modules need to extend.
- Fix: collapse the struct + flags into an `enum` with associated values; or replace the closed `enum` with a struct exposing static factories.

---

## REF -- Reference semantics, lifecycles, COW

### REF-001 -- Break reference cycles in closures with capture lists
- Signal: closures stored on a class (`self.handler = { ... self ... }`, NotificationCenter blocks, Combine sinks, Task closures held by self) that reference `self` without `[weak self]` or `[unowned self]`.
- Fix: add capture list. Default to `[weak self]`; use `[unowned self]` only when `self` is guaranteed to outlive the closure.
- Example:
    ```swift
    // BAD
    self.observer = NotificationCenter.default.addObserver(forName: .x, object: nil, queue: nil) { _ in
        self.refresh()
    }
    // GOOD
    self.observer = NotificationCenter.default.addObserver(forName: .x, object: nil, queue: nil) { [weak self] _ in
        self?.refresh()
    }
    ```

### REF-002 -- Prefer `weak` over `unowned` when lifetimes are independent
- Signal: `[unowned self]` or `unowned let parent: X` where the referenced object's lifetime is not provably longer than the holder's.
- Fix: switch to `weak`. Reserve `unowned` for parent/child pairs where the child cannot exist without the parent.

### REF-003 -- Function-typed stored properties cannot be `weak`; use a capture list inside the closure value instead
- Signal: `weak var handler: (() -> Void)?` (illegal) or `var handler: (() -> Void)?` that captures `self` strongly.
- Fix: keep the property strong, but capture `[weak self]` at the point of closure construction.

### REF-004 -- Structs that hold class references do not give value semantics for free
- Signal: `struct Foo { let cache: NSMutableArray }` or similar -- mutating one "copy" mutates all.
- Fix: switch the field to a value type, OR convert the wrapper to a class, OR implement copy-on-write through `isKnownUniquelyReferenced`.

### REF-005 -- Copy-on-write storage gates writes through `isKnownUniquelyReferenced`
- Signal: a value type wrapping a class storage but mutating it directly without uniqueness check.
- Fix: route writes through a `mutating get` that copies when not unique:
    ```swift
    private var storageForWriting: Storage {
        mutating get {
            if !isKnownUniquelyReferenced(&storage) {
                storage = storage.copy()
            }
            return storage
        }
    }
    ```

### REF-006 -- Do not attach `willSet`/`didSet` to a property backing copy-on-write storage
- Signal: a COW-style storage property with `willSet`/`didSet`, or `@Published` / wrappers that internally use `willSet` on a COW value.
- Fix: remove the observer or move it to a different layer. The observer forces a copy on every mutation, defeating COW.

---

## OPT -- Optionals

### OPT-001 -- No `!` force-unwraps outside the narrow "this can never be nil and a crash is acceptable" case
- Signal: `something!` in normal code paths; `as!` casts; `try!` outside test setup.
- Fix: use `if let`, `guard let`, `??`, `?.`, `map`, `compactMap`. Where a crash IS the right behaviour, replace `!` with the `!!` operator (OPT-002).

### OPT-002 -- Document force-unwraps with an `!!` operator that supplies a failure message
- Signal: bare `!` whose author knows the precondition; comments like `// safe because...` next to `!`.
- Fix:
    ```swift
    let i = Int(input) !! "Expecting integer, got \"\(input)\""
    ```

### OPT-003 -- No implicitly unwrapped optionals (`T!`) in pure Swift APIs
- Signal: `var foo: Foo!`, `func bar() -> Foo!`. Exceptions: `@IBOutlet`, brief two-phase init, un-audited Obj-C/C bridges.
- Fix: change to `Foo?` and handle the optional, or `Foo` and initialise it properly.

### OPT-004 -- Use `compactMap` to drop nils; do not handwrite the loop
- Signal: `for x in xs { if let y = transform(x) { result.append(y) } }`.
- Fix: `let result = xs.compactMap(transform)`.

### OPT-005 -- Prefer optional chaining + `??` over `if let` when the body is a single expression
- Signal: `if let x = optional { use(x) } else { fallback }` returning one value.
- Fix: `let y = optional.map(use) ?? fallback` or `optional?.use() ?? fallback`.

### OPT-006 -- Use `guard` to exit early on missing optionals; do not nest `if let` pyramids
- Signal: multiple nested `if let` clauses at the top of a function.
- Fix: convert to `guard let ... else { return }`.

### OPT-007 -- Choose the right trap API
- Signal: `fatalError`, `assert`, `precondition` used interchangeably.
- Fix: `assert` for debug-only checks (stripped in release); `precondition` for invariants that must hold in release; `fatalError` for unreachable code paths.

---

## FUN -- Functions and closures

### FUN-001 -- Use trailing closure syntax, except when immediately followed by another `{`
- Signal: `array.map({ $0 + 1 })` instead of `array.map { $0 + 1 }`; trailing closure used inside `if condition { ... }` (creates ambiguity).
- Fix: drop the parens for trailing closures; keep parens when the next token would otherwise open a block.

### FUN-002 -- Closures are `@escaping` only when the closure outlives the call
- Signal: `@escaping` annotation on a closure that is invoked synchronously inside the function body and never stored, scheduled, or returned.
- Fix: remove `@escaping`.

### FUN-003 -- Optional closure parameters are implicitly escaping; overload if a non-escaping optional is needed
- Signal: `(() -> Void)?` parameter in a function that needs the non-escaping guarantee.
- Fix: provide two overloads -- one taking `(() -> Void)?` (escaping by virtue of being inside Optional), one taking `() -> Void` (non-escaping).

### FUN-004 -- `withoutActuallyEscaping` is only for "I know it doesn't escape but the compiler can't prove it"
- Signal: `withoutActuallyEscaping` wrapping a closure that is then stored or returned.
- Fix: do not let the inner copy escape; if it must, the closure has to be `@escaping`.

### FUN-005 -- `@autoclosure` only where the deferred evaluation is obvious from the function name
- Signal: `@autoclosure` on a parameter of a function whose name does not telegraph deferred evaluation.
- Fix: remove `@autoclosure`; require the caller to write `{ ... }` explicitly. Acceptable autoclosure sites: `??`, `assert`, `precondition`, custom log helpers.

### FUN-006 -- `inout` is copy-in/copy-out, not pass-by-reference; do not let `&` pointers escape the call
- Signal: a nested function that captures an inout parameter and is then returned or stored; storing the `UnsafeMutablePointer` produced by `&x` past the call.
- Fix: refactor so the inout is used only synchronously within the call.

### FUN-007 -- Use `#fileID` / `#function` / `#line` as default parameters in log/assert helpers
- Signal: log helpers that take literal strings for source location, or omit source location entirely.
- Fix: add `file: StaticString = #fileID, function: StaticString = #function, line: UInt = #line` to the helper signature.

### FUN-008 -- Reach for `@resultBuilder` only when the DSL improves readability
- Signal: a custom result builder used for a flat list of two or three values.
- Fix: build the value with a plain initialiser or array literal instead.

---

## PROP -- Properties

### PROP-001 -- `lazy var` lives on classes, not on structs
- Signal: `lazy var` inside a `struct`.
- Fix: move the lazy initialisation to a class, OR compute on demand (computed property), OR pre-initialise.

### PROP-002 -- `lazy` is not thread-safe; do not first-touch from multiple threads concurrently
- Signal: `lazy var` on a type accessed from multiple `Task`s or queues without serialisation.
- Fix: pre-initialise, wrap access in an actor/lock, or move to a serial-accessed class.

### PROP-003 -- `willSet`/`didSet` belong at the declaration site, not in extensions
- Signal: attempts to add observers in an `extension` of a type the author does not own.
- Fix: relocate to the declaration. If the type is third-party, wrap it.

### PROP-004 -- Property wrappers exist to remove repeated boilerplate
- Signal: a `@propertyWrapper` used at exactly one site with no reuse potential.
- Fix: inline the logic. Keep wrappers only when 2+ properties share the boilerplate.

### PROP-005 -- Prefer key-path expressions over single-arg `{ $0.x }` closures
- Signal: `people.map { $0.name }`.
- Fix: `people.map(\.name)`.

### PROP-006 -- Omit `self.` where the compiler does not require it; keep `self.` inside closures as the capture signal
- Signal: `self.someVar` on every line of a non-closure method; or `someVar` referenced inside a `[weak self]` closure without `self?.`.
- Fix: drop `self.` outside closures; require it inside closures.

---

## ENUM -- Enums and state modelling

### ENUM-001 -- Make illegal states unrepresentable using associated values per case
- Signal: a struct that bundles `kind: Kind` plus several optional fields where only certain fields are valid for certain kinds.
- Fix: replace with an `enum` whose cases each carry exactly the data their state requires.

### ENUM-002 -- Switch exhaustively; avoid `default:` for in-module enums
- Signal: `switch foo { case .a: ... default: ... }` over an enum defined in the same module.
- Fix: enumerate remaining cases explicitly so the compiler warns on additions.

### ENUM-003 -- Use `@unknown default:` for non-frozen enums from other modules
- Signal: `default:` on a switch over an enum imported from a resilient framework.
- Fix: change to `@unknown default:` and keep handling for the cases you know.

### ENUM-004 -- Mark your own enum `@frozen` only when you guarantee no new cases
- Signal: `@frozen public enum` in code that will plausibly add cases.
- Fix: remove `@frozen`.

### ENUM-005 -- Do not name enum cases `none` or `some`
- Signal: `case none` / `case some` on a non-`Optional` enum.
- Fix: rename. They collide with `Optional`'s cases in pattern matching.

### ENUM-006 -- Recursive enums use `indirect`
- Signal: a self-referencing enum case without `indirect`; compiler error.
- Fix: `indirect case` or `indirect enum`.

### ENUM-007 -- Switch over a tuple instead of nesting switches
- Signal: `switch a { ... switch b { ... } }`.
- Fix: `switch (a, b) { case (.x, .y): ... }`.

### ENUM-008 -- Bind values per-case with `let`, not `var` + reassignment
- Signal: `var x: Int; switch foo { case .a(let v): x = v; case .b: x = 0 }`.
- Fix: bind with `let` directly: `let x: Int = { switch foo { case .a(let v): return v; case .b: return 0 } }()`.

### ENUM-009 -- Prefer `Result<Success, Failure>` over `(Value?, Error?)` callback parameters
- Signal: completion handlers shaped `(T?, Error?) -> Void`.
- Fix: `(Result<T, Error>) -> Void`, or convert the function to `async throws`.

---

## STR -- Strings

### STR-001 -- Treat `String` as a `BidirectionalCollection`; do not iterate by integer index
- Signal: `for i in 0..<s.count { let c = s[s.index(s.startIndex, offsetBy: i)] ... }` inside a loop.
- Fix: walk via `String.Index` once, use `for c in s`, `enumerated()`, `prefix`, `dropFirst`, `firstIndex(of:)`, `split(separator:)`.

### STR-002 -- Mutate strings with `replaceSubrange`; do not subscript-set a single character
- Signal: attempts to `s[idx] = "x"` (compile error). Even when worked around, single-character writes are usually wrong because `Character` is variable-width.
- Fix: `s.replaceSubrange(range, with: "x")`.

### STR-003 -- Store `String`, not `Substring`, when retention crosses a subsystem boundary
- Signal: `Substring` stored in a struct property, returned from a public API, or pushed onto a long-lived array.
- Fix: convert with `String(substring)` at the boundary. Slicing is cheap, but a `Substring` keeps the entire original `String` alive.

### STR-004 -- Allocating string ops return `String`; pure slicing ops return `Substring`
- Signal: a function named like a slicer (`func head() -> String`) that allocates, or named like an allocator (`func uppercased() -> Substring`) that does not.
- Fix: align return type to the work performed.

### STR-005 -- Extend `StringProtocol` to share behaviour across `String` and `Substring`; do not conform new types to `StringProtocol`
- Signal: `extension String { ... }` of a helper that should also apply to `Substring`; or a `struct Foo: StringProtocol`.
- Fix: `extension StringProtocol { ... }`. Only `String` and `Substring` are valid conformers.

### STR-006 -- Do not generify APIs over `StringProtocol` just because you can
- Signal: `func parse<S: StringProtocol>(_ input: S) -> ...` with no substring-friendly use case.
- Fix: take `String`. Generify only when callers actually pass `Substring`s and the API treats them substring-aware.

### STR-007 -- Use code-unit views (`utf8`, `unicodeScalars`) only for genuine code-unit work
- Signal: `s.utf8.count` used as a stand-in for "length"; `unicodeScalars` indexing used to count characters.
- Fix: use `s.count` for Character count. Reach into code-unit views only when interop or wire-format requires it.

### STR-008 -- Use `#"..."#` to avoid escaping
- Signal: long string literals with `\"` everywhere or escaped backslashes for regexes.
- Fix: extended-delimiter literal.

---

## GEN -- Generics

### GEN-001 -- Prefer generic functions over `Any`-typed functions where the call site knows the type
- Signal: `func foo(_ x: Any) -> Any` operating on values whose static type is known at the call site.
- Fix: `func foo<T>(_ x: T) -> T` or constrain on a protocol.

### GEN-002 -- Prefer generics over existentials when the call site knows the concrete type
- Signal: `any P` parameter where each call uses a fixed conforming type.
- Fix: `<T: P>` parameter. Reserve `any P` for genuinely heterogeneous storage or runtime polymorphism.

### GEN-003 -- Factor common patterns as a generic value + an injected variant
- Signal: many near-identical functions that differ only in parse/format/dispatch logic.
- Fix: define a generic value type carrying the variant as a closure or protocol-typed property:
    ```swift
    struct Resource<A> {
        let url: URL
        let parse: (Data) throws -> A
    }
    ```

---

## PROTO -- Protocols

### PROTO-001 -- Customisation points must be declared as protocol requirements, not only in extensions
- Signal: a method defined only in a protocol extension that conforming types attempt to "override"; the override silently does not dispatch dynamically.
- Fix: add the method as a protocol requirement. Keep the extension as the default implementation.

### PROTO-002 -- No retroactive conformance of third-party types to third-party protocols
- Signal: `extension SomeFrameworkType: SomeFrameworkProtocol { ... }` where neither is owned by this codebase.
- Fix: wrap the type in a local struct or class that conforms instead.

### PROTO-003 -- Spell existentials `any P`, not bare `P`
- Signal: `let x: P` where `P` is a protocol; `[P]`.
- Fix: `let x: any P`; `[any P]`. Use `some P` when the concrete type is fixed and hidden.

### PROTO-004 -- Return `some P` for "one specific concrete type satisfying P, callers do not need to know which"
- Signal: function returning `any P` where every return path produces the same concrete type.
- Fix: change to `some P`. Preserves type identity, avoids boxing.

### PROTO-005 -- Heterogeneous collections of conforming types need `any P` or a manual type eraser
- Signal: `[some P]` (compile error in collection context); fighting the type checker with `AnyP`-style wrappers that already exist in the stdlib.
- Fix: `[any P]`. Build an eraser only when methods with `Self`/associated types in non-covariant position make `any P` unusable.

### PROTO-006 -- Compose protocols with `&` instead of inheriting unless it models a real "is-a"
- Signal: `protocol ChildP: ParentP` introduced only to combine two requirement sets at one call site.
- Fix: at the use site, `some ParentP & OtherP` (or `any ParentP & OtherP`).

---

## COLL -- Collection protocols

### COLL-001 -- Conform to `Collection` (not just `Sequence`) when the type is multi-pass and finite
- Signal: a `Sequence` conformance on a type that callers iterate more than once.
- Fix: implement `Collection`. `Sequence` makes no guarantee that a second `for-in` sees the same elements.

### COLL-002 -- Custom `Index` types are opaque structs unless storage is genuinely contiguous
- Signal: a custom `Collection` exposing `Int` indices over non-contiguous storage.
- Fix: define an opaque `Index` struct so callers cannot do unsafe arithmetic.

### COLL-003 -- `SubSequence` shares indices with the base collection
- Signal: a custom collection whose `SubSequence` defines fresh indices, so `base[slice.startIndex]` fails.
- Fix: use `Slice<Self>` as the SubSequence, or design the custom slice to share indices.

### COLL-004 -- Override `SubSequence` only when the default `Slice<Self>` is insufficient
- Signal: a custom SubSequence type with no efficiency or convenience gain over `Slice`.
- Fix: delete it.

### COLL-005 -- Use `.lazy` to avoid intermediate arrays in chained `map`/`filter`, but mind subscript cost
- Signal: long `map(...).filter(...).map(...)` chain that allocates intermediates only to take a `prefix` or `first`.
- Fix: insert `.lazy` at the head. Be aware that subscripting a lazy collection recomputes per access, and `lazy.filter` yields O(n) subscript.

### COLL-006 -- Lazy collection methods cannot `throws`
- Signal: `lazy.map { try parse($0) }` (does not compile).
- Fix: drop `.lazy` for the throwing step, or pre-validate so the lazy step cannot throw.

---

## CONC -- Concurrency

### CONC-001 -- Prefer structured concurrency over unstructured `Task { ... }`
- Signal: `Task { ... }` capturing values from a function scope, used in place of `async let` or a task group.
- Fix: use `async let` for a known number of children, or `withTaskGroup` for a dynamic number.

### CONC-002 -- `async let` for static fan-out, task group for dynamic fan-out
- Signal: hand-rolled task arrays + manual await loops where `async let` would fit; or `async let` inside a loop that adds tasks.
- Fix: match the pattern to the cardinality.

### CONC-003 -- Task groups do not auto-cancel children on early exit; call `cancelAll()` after taking the result
- Signal: `withTaskGroup` that returns the first result without cancelling pending children, leaving them to run to completion.
- Fix: `group.cancelAll()` after the `break` / result is obtained.

### CONC-004 -- Default to `Task { ... }`; use `Task.detached` only when intentionally shedding context
- Signal: `Task.detached { ... }` used as the default for any background work.
- Fix: `Task { ... }` to inherit actor isolation, priority, and task-locals. Detach only when leaving the current actor is the explicit goal.

### CONC-005 -- Cancellation is cooperative; long-running work must check
- Signal: long synchronous loops with no `Task.checkCancellation()` or `Task.isCancelled` check; long async loops with no `Task.yield()`.
- Fix: insert `try Task.checkCancellation()` (sync) or `await Task.yield()` (async) at loop boundaries.

### CONC-006 -- Throw `CancellationError()` when your code detects cancellation
- Signal: returning a sentinel value or partial result on cancellation; swallowing cancellation silently.
- Fix: `throw CancellationError()`. Map domain-specific cancel signals (e.g. `URLError.cancelled`) to it only when hiding the source benefits callers.

### CONC-007 -- `Sendable` closures capture by value, and every captured type must be `Sendable`
- Signal: a `@Sendable` closure or `Task` capturing a class with mutable state that is not `Sendable` / `@unchecked Sendable` with locking.
- Fix: make captures value types, or mark the class `@unchecked Sendable` with a documented locking strategy.

### CONC-008 -- Use `actor` for mutable shared state instead of queues + locks
- Signal: dispatch-queue-protected state, or `NSLock` around a class's mutable property, in new code.
- Fix: convert the type to an `actor`.

### CONC-009 -- Actors prevent data races, not race conditions; do not assume state holds across `await`
- Signal: `await` inside an actor method followed by a read that assumes a prior check still holds.
- Fix: re-validate after the suspension, OR track in-flight work explicitly (e.g. `var inProcess: Set<URL>`).

### CONC-010 -- Pin UI state and main-thread methods with `@MainActor`
- Signal: UI code dispatched manually via `DispatchQueue.main.async`; UI properties on non-MainActor types.
- Fix: `@MainActor` on the type or member. Be aware non-async `@MainActor` checks are compile-time only; Obj-C callers (`URLSession` delegates, etc.) can defeat them.

### CONC-011 -- Pin the whole type with `@MainActor` and opt members out with `nonisolated`
- Signal: `@MainActor` repeated on every method of a class.
- Fix: annotate the type once; mark non-UI members `nonisolated`.

### CONC-012 -- Treat hops to/from `@MainActor` as cache misses; keep hot paths uncontended
- Signal: tight loops that bounce between actors per iteration.
- Fix: batch the actor-isolated work and call it once.

---

## ERR -- Error handling

### ERR-001 -- Match the failure category to the right tool
- Signal: `throws` used for "not found" lookups (should be `Optional`); `Optional?` used for I/O failures with multiple causes (should be `throws`); `assert` used for user-input validation (should be `throws`); `throws` used for programmer errors (should be `precondition`).
- Fix: trivial expected failure -> `Optional`; rich expected failure -> `throws` or `Result`; unexpected/programmer error -> `assert`/`precondition`/`fatalError`.

### ERR-002 -- Prefer `throws` over `Result` for synchronous returns
- Signal: synchronous function returning `Result<T, Error>` where callers immediately `switch` on it.
- Fix: change to `func ... throws -> T`. `throws` is non-ignorable; `Result` can be silently discarded with `_ =`.

### ERR-003 -- Use `Result` when failure travels DOWN into a callback; for async, prefer `async throws`
- Signal: completion handlers shaped `(T?, Error?) -> Void` (see ENUM-009).
- Fix: `(Result<T, Error>) -> Void`, or rewrite as `async throws`.

### ERR-004 -- Document throwable error types in `/// - Throws:`
- Signal: `func ... throws` with no `- Throws:` line in the doc comment.
- Fix: add the throwable types and conditions to the doc comment. (Swift errors are untyped; the doc comment IS the contract.)

### ERR-005 -- Use an `enum` with associated values for rich domain errors; reserve `String` errors for prototypes
- Signal: `extension String: Error {}` used in shipping code; ad-hoc error strings thrown from production paths.
- Fix: define an `enum Error: Swift.Error` with explicit cases and associated values.

### ERR-006 -- `try?` discards the error; `try!` only when failure is a logic bug
- Signal: `try!` outside of test setup or genuinely impossible-to-fail paths; `try?` used to silently swallow important errors.
- Fix: handle the error with `do/catch`, or use `throws` to propagate, or document why discarding is correct.

### ERR-007 -- Use `do { ... } catch SpecificError { ... } catch { ... }` for selective handling
- Signal: a single `catch` block that switches on the error type internally.
- Fix: use typed `catch` clauses.

### ERR-008 -- Pair every acquire with an adjacent `defer { release }`
- Signal: file/socket/lock acquired at the top of a function, released only at the end of one return path.
- Fix:
    ```swift
    let file = open(filename, O_RDONLY)
    defer { close(file) }
    return try load(file: file)
    ```

### ERR-009 -- Multiple `defer` blocks run in reverse order; rely on that ordering
- Signal: cleanup code reordered into one big `defer` block to "control order".
- Fix: keep multiple small `defer`s; they unwind in LIFO order.

### ERR-010 -- Higher-order functions that throw only because their closure throws use `rethrows`
- Signal: a `(_ body: () throws -> T) throws` helper that does not declare `rethrows`, forcing callers to `try` even with non-throwing closures.
- Fix: change `throws` to `rethrows`.

### ERR-011 -- Conform error types to `CustomNSError` for Obj-C bridging
- Signal: errors crossing into Obj-C with garbage `domain`/`code` derived from the synthesised bridge.
- Fix: implement `CustomNSError` (`errorDomain`, `errorCode`, `errorUserInfo`).

---

## CODE -- Encoding and decoding

### CODE-001 -- Let the compiler synthesise `Codable`; customise wire format with `CodingKeys`
- Signal: hand-written `init(from:)` and `encode(to:)` whose only job is to rename fields.
- Fix: drop the manual implementations, add a `private enum CodingKeys: String, CodingKey { case foo = "wire_name" }`.

### CODE-002 -- Per-property wire transforms ship as `@propertyWrapper`s, not bespoke init/encode
- Signal: manual `init(from:)` whose only customisation is one field encoded as a string instead of a number.
- Fix: define a Codable property wrapper (e.g. `@CodedAsString`) and apply it.

### CODE-003 -- No retroactive `Codable` on third-party types
- Signal: `extension ThirdPartyType: Codable { ... }`.
- Fix: wrap the type in a local struct that owns the codable storage and reconstructs the third-party value on access.

### CODE-004 -- Non-final classes cannot retroactively conform to `Codable`
- Signal: `extension SomeNonFinalClass: Codable` (won't compile because `required init` cannot be added in an extension).
- Fix: wrap with a struct or property wrapper that stores the codable fields and constructs the class on access.

### CODE-005 -- Polymorphic decode goes through an enum router; there is no automatic polymorphic decode
- Signal: ad-hoc `if let _ = try? container.decode(A.self) ... else if ...` ladders.
- Fix: define an enum with one case per supported subtype and a discriminator in the wire format.

### CODE-006 -- Group keys with `nestedContainer(keyedBy:forKey:)` instead of inventing a nested struct just for the schema
- Signal: a private `struct _Wire` nested inside a type purely to group sub-keys.
- Fix: use `nestedContainer(keyedBy: ..., forKey: ...)` in the encode/decode implementations.

---

## INTEROP -- C interoperability

### INTEROP-001 -- Wrap C libraries in two layers: a thin class owning the opaque pointer, then a value-typed Swift API on top
- Signal: C resources held directly in structs; multiple call sites managing the same C pointer.
- Fix: class owns the pointer (free in `deinit`); struct/enum public API wraps the class.

### INTEROP-002 -- Enforce structural invariants in the Swift wrapper with enums + associated values
- Signal: Swift wrapper exposes the C struct's "all fields optional, some only valid in some states" shape verbatim.
- Fix: wrap with an enum whose cases carry exactly the fields valid for that state.

### INTEROP-003 -- Every `allocate(capacity:)` has a matching `deallocate()`; non-trivial types need `initialize` + `deinitialize`
- Signal: `UnsafeMutablePointer.allocate(capacity:)` with no `deallocate()` on every exit path; non-trivial types written without `initialize`.
- Fix: pair allocation with `defer { ptr.deallocate() }`. For non-trivial element types, `ptr.initialize` before use and `ptr.deinitialize` before `deallocate`.

### INTEROP-004 -- Use `MemoryLayout<T>.stride` for element widths in C calls, not `.size`
- Signal: `MemoryLayout<T>.size` passed as element width to C APIs.
- Fix: `.stride` (includes alignment padding).

### INTEROP-005 -- `&x` pointers are valid only for the duration of the call; do not store or return them
- Signal: a function takes `inout T` (or `UnsafeMutablePointer<T>`) and stashes the pointer in a property or returns it.
- Fix: copy the value out, or restructure so the pointer is used only inside the call.

### INTEROP-006 -- Smuggle Swift state into C callbacks via the `void *context` pattern with `Unmanaged`
- Signal: a `@convention(c)` closure trying to capture local state (does not compile); or use of global state as a workaround.
- Fix:
    ```swift
    let box = Box(wrappedValue: callback)
    let unmanaged = Unmanaged.passRetained(box)
    defer { unmanaged.release() }
    c_register(context: unmanaged.toOpaque()) { ctx, x in
        let cb = Unmanaged<Box<Callback>>
            .fromOpaque(ctx!).takeUnretainedValue().wrappedValue
        cb(x)
    }
    ```

### INTEROP-007 -- Use `assumingMemoryBound(to:)` to reinterpret raw pointers only when the layout is known
- Signal: `assumingMemoryBound(to:)` used speculatively or to silence a compiler warning.
- Fix: validate the layout assumption (size, alignment, lifetime). Mistakes are undefined behaviour, not crashes.

### INTEROP-008 -- Optional pointer types encode nullability; the zero pattern is `nil`
- Signal: `UnsafePointer<T>!` used as the default; explicit `nil` checks against zero raw addresses.
- Fix: `UnsafePointer<T>?` and standard optional handling.
