const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const response = await fetch(
    `${backendBaseUrl}/api/v1/transactions/arweave/relay/${encodeURIComponent(jobId)}/events`,
    {
      headers: {
        Accept: "text/event-stream",
      },
    },
  );

  if (!response.body) {
    return new Response("No response body", { status: 502 });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
