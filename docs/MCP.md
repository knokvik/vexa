# Vexa MCP and AI access

Vexa exposes a discovery GET route and a JSON-RPC MCP POST route:

- `GET /api/mcp` returns the complete capability manifest, tool schemas, route descriptions, authentication requirements, and setup instructions.
- `POST /api/mcp` accepts MCP JSON-RPC methods: `initialize`, `tools/list`, and `tools/call`.
- `POST /api/ai/action` is the REST/OpenAPI fallback for agents that do not support MCP.
- `GET /api/ai/openapi.json` returns the OpenAPI schema for the REST fallback.

## Configure the secret

Set this server-side environment variable in the deployment hosting Vexa:

```env
MCP_API_KEY=<a-long-random-secret>
```

Generate one locally with:

```bash
openssl rand -hex 32
```

Never put the key in browser code, `NEXT_PUBLIC_*`, a committed file, or a prompt. Restart/redeploy Vexa after changing it.

When `MCP_API_KEY` is set, MCP clients authenticate with either:

```http
x-api-key: <the-secret>
```

or:

```http
Authorization: Bearer <the-secret>
```

If the variable is empty, the endpoint remains open for local development.

## Test discovery and MCP

```bash
BASE_URL=https://your-vexa-host.example
KEY='your-secret'

curl -sS "$BASE_URL/api/mcp" \
  -H "x-api-key: $KEY" | jq '{service,version,routes,authentication,tools:[.tools[].name]}'

curl -sS -X POST "$BASE_URL/api/mcp" \
  -H 'content-type: application/json' \
  -H "x-api-key: $KEY" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vexa_get_workspace","arguments":{}}}'
```

Agents should call `vexa_get_workspace` first, then use `vexa_list_tables` or `vexa_get_table_rows` to inspect records before changing them. Available write operations include task CRUD, table-row CRUD, timeline-event CRUD, and `vexa_reorder_table`.

## Live dashboard behavior

The dashboard polls the CRM tables and task feed every five seconds while the page is visible. A task or row created through MCP therefore appears without a manual reload. Tables sort newest `updatedAt` first by default, and manual drag-and-drop ordering is persisted through `vexa_reorder_table` (or `PATCH /api/crm/tables` with `table` and `orderedIds`).
