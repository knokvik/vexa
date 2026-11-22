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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "list_tasks";

  try {
    if (action === "list_tasks") {
      const result = await executeListTasks({
        quadrant: searchParams.get("quadrant") || undefined,
        category: searchParams.get("category") || undefined,
        status: (searchParams.get("status") as any) || undefined,
        search: searchParams.get("search") || undefined,
      });
      return NextResponse.json(result, { headers: CORS_HEADERS });
    }

    if (action === "list_tables") {
      const result = await executeListTables();
      return NextResponse.json(result, { headers: CORS_HEADERS });
    }

    if (action === "get_table_rows") {
      const table = searchParams.get("table") || "tasks";
      const limit = Number(searchParams.get("limit")) || 50;
      const search = searchParams.get("search") || undefined;
      const result = await executeGetTableRows({ table, limit, search });
      return NextResponse.json(result, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { error: `Unknown GET action: ${action}` },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Execution error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || body.method;

    if (!action) {
      return NextResponse.json(
        {
          error: "Action parameter is required. Available: add_task, update_task, delete_task, list_tasks, list_tables, get_table_rows, add_table_row, update_table_row, delete_table_row",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let result: any;

    switch (action) {
      case "add_task":
      case "vexa_add_task":
        result = await executeAddTask({
          title: body.title,
          category: body.category || body.kind || "personal",
          quadrant: body.quadrant,
          dueAt: body.dueAt,
          notes: body.notes,
          urgent: body.urgent,
          important: body.important,
        });
        break;

      case "update_task":
      case "vexa_update_task":
        result = await executeUpdateTask({
          id: body.id,
          title: body.title,
          done: body.done,
          quadrant: body.quadrant,
          category: body.category || body.kind,
          dueAt: body.dueAt,
          notes: body.notes,
        });
        break;

      case "delete_task":
      case "vexa_delete_task":
        result = await executeDeleteTask({ id: body.id });
        break;

      case "list_tasks":
      case "vexa_list_tasks":
        result = await executeListTasks({
          quadrant: body.quadrant,
          category: body.category,
          status: body.status,
          search: body.search,
        });
        break;

      case "list_tables":
      case "vexa_list_tables":
        result = await executeListTables();
        break;

      case "get_table_rows":
      case "vexa_get_table_rows":
        result = await executeGetTableRows({
          table: body.table,
          limit: body.limit,
          search: body.search,
        });
        break;

      case "add_table_row":
      case "vexa_add_table_row":
        result = await executeAddTableRow({
          table: body.table,
          data: body.data || body,
        });
        break;

      case "update_table_row":
      case "vexa_update_table_row":
        result = await executeUpdateTableRow({
          table: body.table,
          id: body.id,
          data: body.data || body,
        });
        break;

      case "delete_table_row":
      case "vexa_delete_table_row":
        result = await executeDeleteTableRow({
          table: body.table,
          id: body.id,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action "${action}"` },
          { status: 400, headers: CORS_HEADERS }
        );
    }

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Execution error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
