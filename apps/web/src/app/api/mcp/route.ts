import { NextResponse } from "next/server";
import {
  executeListTasks,
  executeAddTask,
  executeUpdateTask,
  executeDeleteTask,
  executeListTables,
  executeGetTableRows,
  executeAddTableRow,
  executeUpdateTableRow,
  executeDeleteTableRow,
} from "@/lib/ai-tools";

const MCP_TOOLS = [
  {
    name: "vexa_list_tasks",
    description: "List tasks from Vexa Eisenhower Matrix across the 4 categories (Personal, College, Prep/Projects, Career). Filter by quadrant, category, or completion status.",
    inputSchema: {
      type: "object",
      properties: {
        quadrant: {
          type: "string",
          enum: ["q1", "q2", "q3", "q4"],
          description: "Filter by Eisenhower quadrant: q1 (Urgent & Important / Do First), q2 (Not Urgent & Important / Deep Work), q3 (Urgent & Not Important / Delegate), q4 (Not Urgent & Not Important / Backlog)",
        },
        category: {
          type: "string",
          enum: ["personal", "college", "interview", "other"],
          description: "Filter by category: personal (Neon Pink), college (Neon Green), interview (Neon Cyan prep/projects), other (Amber career)",
        },
        status: {
          type: "string",
          enum: ["all", "open", "completed"],
          description: "Filter by task status: open (default), completed, or all",
        },
        search: {
          type: "string",
          description: "Search keyword matching title or notes",
        },
      },
    },
  },
  {
    name: "vexa_add_task",
    description: "Add a new task to Vexa dashboard under any of the 4 categories on the home page (Personal, College, Prep/Projects, Career) and assign to an Eisenhower quadrant.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title / description (required)",
        },
        category: {
          type: "string",
          enum: ["personal", "college", "interview", "other"],
          description: "Category on the home page: personal, college, interview (projects & prep), other (career/jobs)",
        },
        quadrant: {
          type: "string",
          enum: ["q1", "q2", "q3", "q4"],
          description: "Eisenhower quadrant: q1 (Urgent & Important), q2 (Deep Work & Important), q3 (Delegate/Quick), q4 (Backlog)",
        },
        dueAt: {
          type: "string",
          description: "Optional due date in ISO format (e.g. 2026-11-25T18:00:00Z) or YYYY-MM-DD",
        },
        notes: {
          type: "string",
          description: "Optional notes, details, links, or instructions",
        },
        urgent: {
          type: "boolean",
          description: "Whether the task is time-sensitive/urgent",
        },
        important: {
          type: "boolean",
          description: "Whether the task has high strategic importance",
        },
      },
      required: ["title", "category"],
    },
  },
  {
    name: "vexa_update_task",
    description: "Update an existing task in Vexa: mark it as completed or open, change its quadrant, edit title, category, notes, or due date.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Task unique ID (e.g. task_hack_1)",
        },
        title: {
          type: "string",
          description: "Updated title",
        },
        done: {
          type: "boolean",
          description: "Set true to mark completed, false to reopen",
        },
        quadrant: {
          type: "string",
          enum: ["q1", "q2", "q3", "q4"],
          description: "Move task to a different quadrant (q1, q2, q3, q4)",
        },
        category: {
          type: "string",
          enum: ["personal", "college", "interview", "other"],
          description: "Update task category",
        },
        dueAt: {
          type: "string",
          description: "Updated deadline ISO date string",
        },
        notes: {
          type: "string",
          description: "Updated notes",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "vexa_delete_task",
    description: "Permanently delete a task from Vexa by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique task ID to delete",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "vexa_list_tables",
    description: "List all database tables in Vexa (applications, jobs, companies, contacts, tasks) with record counts and descriptions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "vexa_get_table_rows",
    description: "Get rows from any Vexa table: applications, jobs, companies, contacts, or tasks.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["applications", "jobs", "companies", "contacts", "tasks"],
          description: "Name of the table to query",
        },
        limit: {
          type: "number",
          description: "Max number of records to return (default 50)",
        },
        search: {
          type: "string",
          description: "Optional search query to filter rows",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "vexa_add_table_row",
    description: "Insert a new row into any Vexa table (applications, jobs, companies, contacts, tasks).",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["applications", "jobs", "companies", "contacts", "tasks"],
          description: "Target table name",
        },
        data: {
          type: "object",
          description: "Record data. For applications: companyName, jobTitle, stage (applied, screen, technical, offer, rejected), status (active, archived). For jobs: title, companyName, location, salaryRange. For companies: name, domain. For contacts: name, email, companyName, title.",
        },
      },
      required: ["table", "data"],
    },
  },
  {
    name: "vexa_update_table_row",
    description: "Update an existing row in any Vexa table (applications, jobs, companies, contacts, tasks) by ID.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["applications", "jobs", "companies", "contacts", "tasks"],
          description: "Target table name",
        },
        id: {
          type: "string",
          description: "ID of the record to update",
        },
        data: {
          type: "object",
          description: "Updated fields for the record (e.g. stage, status, notes, etc.)",
        },
      },
      required: ["table", "id", "data"],
    },
  },
  {
    name: "vexa_delete_table_row",
    description: "Delete a row from any Vexa table (applications, jobs, companies, contacts, tasks) by ID.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ["applications", "jobs", "companies", "contacts", "tasks"],
          description: "Target table name",
        },
        id: {
          type: "string",
          description: "ID of the record to delete",
        },
      },
      required: ["table", "id"],
    },
  },
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/mcp
 * Discovery and documentation endpoint for MCP clients and developers.
 */
export async function GET(request: Request) {
  const host = request.headers.get("host") || "localhost:5173";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  return NextResponse.json(
    {
      ok: true,
      service: "Vexa Model Context Protocol (MCP) Server",
      version: "1.0.0",
      description: "Direct AI agent & ChatGPT integration for Vexa tasks, Eisenhower matrix, and CRM workspace tables.",
      mcpEndpoint: `${baseUrl}/api/mcp`,
      restEndpoint: `${baseUrl}/api/ai/action`,
      openApiSchema: `${baseUrl}/api/ai/openapi.json`,
      capabilities: {
        tasks: {
          categories: ["personal", "college", "interview", "other"],
          quadrants: ["q1", "q2", "q3", "q4"],
          actions: ["list", "add", "update", "delete", "toggle_done"],
        },
        tables: {
          tables: ["applications", "jobs", "companies", "contacts", "tasks"],
          actions: ["list", "query", "insert", "update", "delete"],
        },
      },
      tools: MCP_TOOLS,
      chatgptSetupInstructions: {
        optionA_MCP: `In your MCP client (Claude Desktop, Cursor, or ChatGPT MCP), add server URL: ${baseUrl}/api/mcp`,
        optionB_CustomGPT: `In ChatGPT Custom GPT Actions, click "Import from URL" and enter: ${baseUrl}/api/ai/openapi.json`,
      },
    },
    { headers: CORS_HEADERS }
  );
}

/**
 * POST /api/mcp
 * Full JSON-RPC 2.0 Model Context Protocol (MCP) transport.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id !== undefined ? body.id : null;
    const method = body.method;
    const params = body.params || {};

    // 1. Initialize
    if (method === "initialize") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "vexa-mcp",
              version: "1.0.0",
            },
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Initialized notification
    if (method === "notifications/initialized") {
      return NextResponse.json(
        { jsonrpc: "2.0", id, result: {} },
        { headers: CORS_HEADERS }
      );
    }

    // 3. Ping
    if (method === "ping") {
      return NextResponse.json(
        { jsonrpc: "2.0", id, result: {} },
        { headers: CORS_HEADERS }
      );
    }

    // 4. Tools list
    if (method === "tools/list") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // 5. Tools call
    if (method === "tools/call") {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      let resultData: any;

      switch (toolName) {
        case "vexa_list_tasks":
        case "list_tasks":
          resultData = await executeListTasks(toolArgs);
          break;

        case "vexa_add_task":
        case "add_task":
          resultData = await executeAddTask(toolArgs);
          break;

        case "vexa_update_task":
        case "update_task":
          resultData = await executeUpdateTask(toolArgs);
          break;

        case "vexa_delete_task":
        case "delete_task":
          resultData = await executeDeleteTask(toolArgs);
          break;

        case "vexa_list_tables":
        case "list_tables":
          resultData = await executeListTables();
          break;

        case "vexa_get_table_rows":
        case "get_table_rows":
          resultData = await executeGetTableRows(toolArgs);
          break;

        case "vexa_add_table_row":
        case "add_table_row":
          resultData = await executeAddTableRow(toolArgs);
          break;

        case "vexa_update_table_row":
        case "update_table_row":
          resultData = await executeUpdateTableRow(toolArgs);
          break;

        case "vexa_delete_table_row":
        case "delete_table_row":
          resultData = await executeDeleteTableRow(toolArgs);
          break;

        default:
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32601,
                message: `Method / tool not found: ${toolName}`,
              },
            },
            { status: 404, headers: CORS_HEADERS }
          );
      }

      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(resultData, null, 2),
              },
            ],
            isError: false,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Direct invocation fallback if client sends tool name as method
    if (method.startsWith("vexa_") || MCP_TOOLS.some((t) => t.name === method)) {
      const toolName = method;
      let resultData: any;
      if (toolName.includes("list_tasks")) resultData = await executeListTasks(params);
      else if (toolName.includes("add_task")) resultData = await executeAddTask(params);
      else if (toolName.includes("update_task")) resultData = await executeUpdateTask(params);
      else if (toolName.includes("delete_task")) resultData = await executeDeleteTask(params);
      else if (toolName.includes("list_tables")) resultData = await executeListTables();
      else if (toolName.includes("get_table_rows")) resultData = await executeGetTableRows(params);
      else if (toolName.includes("add_table_row")) resultData = await executeAddTableRow(params);
      else if (toolName.includes("update_table_row")) resultData = await executeUpdateTableRow(params);
      else if (toolName.includes("delete_table_row")) resultData = await executeDeleteTableRow(params);

      return NextResponse.json(
        { jsonrpc: "2.0", id, result: resultData },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32600,
          message: `Unsupported method: ${method}`,
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: err?.message || "Internal server error during MCP call",
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
