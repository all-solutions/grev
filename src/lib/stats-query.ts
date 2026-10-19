export type TimeRange = { from: string; to: string; period: string };
const durations: Record<string, number> = {
    "24h": 86400000,
    "7d": 7 * 86400000,
    "30d": 30 * 86400000,
    "90d": 90 * 86400000,
};

export function parseTimeRange(
    params: URLSearchParams,
    now = new Date(),
): TimeRange | { error: string } {
    const period = params.get("period") ?? "30d";
    const toParam = params.get("to");
    const fromParam = params.get("from");
    if (period === "custom" || fromParam || toParam) {
        if (!fromParam || !toParam)
            return {
                error: "Custom ranges require both from and to timestamps.",
            };
        const fromDate = new Date(fromParam);
        const toDate = new Date(toParam);
        if (
            !Number.isFinite(fromDate.getTime()) ||
            !Number.isFinite(toDate.getTime())
        )
            return { error: "Invalid date. Use ISO 8601 timestamps." };
        if (fromDate >= toDate)
            return { error: "from must be earlier than to." };
        if (toDate.getTime() > now.getTime() + 5 * 60 * 1000)
            return { error: "to cannot be in the future." };
        if (toDate.getTime() - fromDate.getTime() > 10 * 365 * 86400000)
            return { error: "Custom range cannot exceed 10 years." };
        return {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            period: "custom",
        };
    }
    if (period === "all")
        return {
            from: "0000-01-01T00:00:00.000Z",
            to: now.toISOString(),
            period,
        };
    const duration = durations[period];
    if (!duration)
        return { error: "period must be 24h, 7d, 30d, 90d, all, or custom." };
    return {
        from: new Date(now.getTime() - duration).toISOString(),
        to: now.toISOString(),
        period,
    };
}

export function parsePositiveInteger(
    value: string | null,
    name: string,
): number | { error: string } | null {
    if (value === null) return null;
    if (!/^\d+$/.test(value))
        return { error: `${name} must be a positive integer.` };
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1)
        return { error: `${name} must be a positive integer.` };
    return parsed;
}
