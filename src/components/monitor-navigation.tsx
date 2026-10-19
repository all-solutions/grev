import Link from "next/link";
import { MONITOR_NAVIGATION } from "@/lib/monitor-navigation";

export function MonitorNavigation() {
    return (
        <nav aria-label="Hauptnavigation" className="border-b bg-background">
            <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
                {MONITOR_NAVIGATION.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
}
