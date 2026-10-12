// Shown while a client-only view (maps need the browser) is loading.
export default function PageLoading() {
    return (
        <div className="grid h-full min-h-60 place-items-center text-sm text-muted-foreground" aria-busy="true">
            Memuat…
        </div>
    );
}
