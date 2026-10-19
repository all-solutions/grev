import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function authorizeAdmin(request: NextRequest): boolean {
    const secret = process.env.GREV_ADMIN_TOKEN;
    if (!secret || secret.length < 32) return false;
    const auth = request.headers.get("authorization") || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const expectedBuffer = Buffer.from(secret);
    const providedBuffer = Buffer.from(provided);
    const validToken =
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer);
    const origin = request.headers.get("origin");
    const host =
        request.headers.get("x-forwarded-host") || request.headers.get("host");
    const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method);
    let validOrigin = false;
    if (origin) {
        try {
            const parsedOrigin = new URL(origin);
            const forwardedProto = request.headers
                .get("x-forwarded-proto")
                ?.split(",")[0]
                ?.trim();
            const expectedProto = forwardedProto
                ? `${forwardedProto}:`
                : new URL(request.url).protocol;
            validOrigin =
                parsedOrigin.protocol === expectedProto &&
                Boolean(host) &&
                parsedOrigin.host.toLowerCase() === host!.toLowerCase();
        } catch {
            validOrigin = false;
        }
    } else {
        // Cross-origin browser requests include Origin. Non-browser cron clients
        // may omit it, but unsafe requests must prove same-origin via Fetch Metadata.
        validOrigin =
            isSafeMethod ||
            request.headers.get("sec-fetch-site") === "same-origin";
    }
    return validToken && Boolean(validOrigin);
}
