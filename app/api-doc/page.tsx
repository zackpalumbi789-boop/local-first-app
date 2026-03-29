import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./react-swagger";

export default async function ApiDocPage() {
  const spec = await getApiDocs();
  return (
    <section className="min-h-screen bg-zinc-50 p-4">
      <ReactSwagger spec={spec} />
    </section>
  );
}
