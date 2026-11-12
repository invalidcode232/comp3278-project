import { pool } from "@/lib/db";
import { searchTopics } from "@/lib/queries/topics";
import { normalizeTopicName } from "@/lib/topic-name";

/** Raw MySQL queries require the Node runtime. */
export const runtime = "nodejs";

/** Read-only public autocomplete; bounded input/results and no caching of a changing vocabulary. */
export async function GET(request: Request): Promise<Response> {
  const query = normalizeTopicName(
    new URL(request.url).searchParams.get("q") ?? "",
  );
  if ([...query].length > 50)
    return Response.json({ error: "Topic is too long." }, { status: 400 });
  return Response.json(await searchTopics(pool, query), {
    headers: { "Cache-Control": "no-store" },
  });
}
