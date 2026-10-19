export function parseRepositoryInput(input: string): {
    owner: string;
    name: string;
} {
    const value = input.trim();
    const match =
        /^(?:https:\/\/github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})\/?$/.exec(
            value,
        );
    if (!match || match[2] === "." || match[2] === "..")
        throw new Error(
            "Repository must be owner/name or https://github.com/owner/name.",
        );
    return { owner: match[1], name: match[2] };
}

export function calculateDownloadDelta(
    samples: { timestamp: string; download_count: number }[],
) {
    if (samples.length < 2)
        return {
            downloads: null,
            sampledFrom: samples[0]?.timestamp ?? null,
            sampledTo: samples.at(-1)?.timestamp ?? null,
            reset: false,
            unknown: true,
        };
    const first = samples[0];
    const last = samples.at(-1)!;
    const reset = samples.some(
        (sample, index) =>
            index > 0 &&
            sample.download_count < samples[index - 1].download_count,
    );
    return {
        downloads: reset ? null : last.download_count - first.download_count,
        sampledFrom: first.timestamp,
        sampledTo: last.timestamp,
        reset,
        unknown: reset,
    };
}
