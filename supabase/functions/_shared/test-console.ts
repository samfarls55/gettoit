type ConsoleMethod = "error" | "log" | "warn";

export async function withMutedConsole<T>(
  methods: ConsoleMethod[],
  run: () => Promise<T> | T,
): Promise<T> {
  const originals = new Map<ConsoleMethod, typeof console.error>();

  for (const method of methods) {
    originals.set(method, console[method]);
    console[method] = () => undefined;
  }

  try {
    return await run();
  } finally {
    for (const [method, original] of originals) {
      console[method] = original;
    }
  }
}
