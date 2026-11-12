// Stop older dashboard tabs from reconnecting to the retired event stream.
export function GET() {
  return new Response(null, { status: 204 });
}
