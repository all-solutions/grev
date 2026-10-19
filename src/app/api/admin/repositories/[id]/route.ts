import { NextRequest, NextResponse } from "next/server";
import { changeRepository, removeRepository } from "@/lib/monitor";
import { authorizeAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await context.params).id);
    const body = await request.json();
    if (!Number.isSafeInteger(id) || typeof body.enabled !== "boolean")
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return changeRepository(id, body.enabled)
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Repository not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: Context) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id))
        return NextResponse.json(
            { error: "Invalid repository id" },
            { status: 400 },
        );
    return removeRepository(id)
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json({ error: "Repository not found" }, { status: 404 });
}
