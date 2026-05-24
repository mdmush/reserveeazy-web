export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-0 h-full overflow-y-auto bg-background">{children}</div>
  );
}
