import { NextRequest, NextResponse } from "next/server";
import { getComments, createComment } from "@/lib/supabase-comments";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get("marketId");
  const version = searchParams.get("version") || "v1";
  const userAddress = searchParams.get("userAddress");

  if (!marketId) {
    return NextResponse.json(
      { error: "Market ID is required" },
      { status: 400 }
    );
  }

  try {
    const comments = await getComments(
      marketId,
      version,
      userAddress || undefined
    );
    return NextResponse.json({
      comments,
      total: comments.length,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, content, userAddress, version = "v1" } = body;

    if (!marketId || !content || !userAddress) {
      return NextResponse.json(
        { error: "Market ID, content, and user address are required" },
        { status: 400 }
      );
    }

    const comment = await createComment({
      marketId,
      content,
      userAddress,
      version,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
