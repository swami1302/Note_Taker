import EditorScreen from "@/components/editor-screen";

// In Next.js 16, route `params` is async and must be awaited.
export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorScreen key={id} noteId={id} />;
}
