// GetToIt — PlacesProxy client backed by supabase-swift's Functions API.
//
// Calls the `places-proxy` Edge Function via the same SupabaseClient
// that holds the authenticated session. The user's JWT is attached
// automatically; no Foursquare API key ever crosses the iOS process.

import Foundation
import Supabase

public final class SupabaseFunctionsPlacesProxyClient: PlacesProxyClient {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
        // `client.functions.invoke(...)` POSTs to /functions/v1/<name>
        // with the user's bearer token and a JSON body. The supabase-swift
        // wrapper decodes the response into our Codable struct.
        let response: PlacesProxyResponse = try await client.functions.invoke(
            "places-proxy",
            options: FunctionInvokeOptions(
                method: .post,
                body: request
            )
        )
        return response
    }
}
