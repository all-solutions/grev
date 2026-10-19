import { collectRepository } from "../src/lib/monitor";

async function main(): Promise<void> {
    try {
        const result = await collectRepository();
        console.log(
            `Collector finished: ${result.processed} succeeded, ${result.failed} failed.`,
        );
        process.exitCode = result.failed ? 1 : 0;
    } catch (error) {
        const busy =
            error instanceof Error &&
            error.message === "A collector is already running.";
        console.error(
            busy
                ? error.message
                : `Collector failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        process.exitCode = busy ? 2 : 1;
    }
}

void main();
