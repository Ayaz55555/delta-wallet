import { NextRequest, NextResponse } from "next/server";
import { getCommentCounts } from "@/lib/supabase-comments";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketIds = searchParams.get("marketIds")?.split(",") || [];
    const version = searchParams.get("version") || "v1";

    if (marketIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    const counts = await getCommentCounts(marketIds, version);

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("Error fetching comment counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch comment counts" },
      { status: 500 }
    );
  }
}
