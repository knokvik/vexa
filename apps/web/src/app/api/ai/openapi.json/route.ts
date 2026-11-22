import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const host = request.headers.get("host") || "localhost:5173";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Vexa AI & MCP Automation API",
      description: "Direct API for AI models (ChatGPT, Claude, etc.) to manage Eisenhower Matrix tasks and CRM workspace tables.",
      version: "1.0.0",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/api/ai/action": {
        post: {
          operationId: "executeVexaAction",
          summary: "Execute task or table actions in Vexa",
          description: "Add, update, delete, or list tasks and table rows in Vexa.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["action"],
                  properties: {
                    action: {
                      type: "string",
                      enum: [
                        "add_task",
                        "update_task",
                        "delete_task",
                        "list_tasks",
                        "list_tables",
                        "get_table_rows",
                        "add_table_row",
                        "update_table_row",
                        "delete_table_row",
                      ],
                      description: "The action to perform in Vexa",
                    },
                    title: { type: "string", description: "Title of the task (for add_task or update_task)" },
                    category: {
                      type: "string",
                      enum: ["personal", "college", "interview", "other"],
                      description: "Category: personal, college, interview, or other",
                    },
                    quadrant: {
                      type: "string",
                      enum: ["q1", "q2", "q3", "q4"],
                      description: "Eisenhower matrix quadrant: q1 (urgent&important), q2 (deep work), q3 (delegate), q4 (backlog)",
                    },
                    dueAt: { type: "string", description: "ISO due date string" },
                    notes: { type: "string", description: "Notes or description" },
                    done: { type: "boolean", description: "Whether the task is completed" },
                    id: { type: "string", description: "ID of the task or table record to update/delete" },
                    table: {
                      type: "string",
                      enum: ["applications", "jobs", "companies", "contacts", "tasks"],
                      description: "Table name (for table actions)",
                    },
                    data: {
                      type: "object",
                      description: "Data object for table insert/update",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Action executed successfully",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
