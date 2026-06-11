import { handleRequest } from "./handler.ts";

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      GOOGLE_PLACES_API_KEY: Deno.env.get("GOOGLE_PLACES_API_KEY"),
    },
  })
);
