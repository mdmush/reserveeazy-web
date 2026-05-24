import Script from "next/script";

export default async function EmbedDemoPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    position?: string;
    label?: string;
  }>;
}) {
  const { token, position, label } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-lg p-8 space-y-4">
        <h1 className="text-xl font-semibold">Embed widget demo</h1>
        <p className="text-sm text-muted-foreground">
          Chrome blocks the widget when the host page is opened as{" "}
          <code className="text-xs">file://</code>. Test over HTTP instead.
        </p>
        <p className="text-sm text-muted-foreground">
          Copy your token from{" "}
          <strong>Dashboard → Widgets</strong>, then open:
        </p>
        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
          {`/embed-demo?token=ew_your_token_here`}
        </pre>
        <p className="text-xs text-muted-foreground">
          Optional: <code>&amp;position=bottom-right</code>,{" "}
          <code>&amp;label=Book%20now</code>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-8">
      <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Sample customer website</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The booking widget loads from the same origin as this page, so the
          iframe works in Chrome. Use this page for local testing—not{" "}
          <code className="text-xs">file://test.html</code>.
        </p>
        <p className="mt-6 text-muted-foreground">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Scroll down
          to see the floating button in the corner.
        </p>
      </div>
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-token={token}
        data-position={position ?? "bottom-right"}
        data-label={label ?? "Book now"}
      />
    </div>
  );
}
