"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Heart, Reply, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useFarcasterUser } from "@/hooks/useFarcasterUser";

interface Comment {
  id: string;
  marketId: string;
  content: string;
  user?: {
    id: string;
    address: string;
    fid?: string;
    username?: string;
    pfpUrl?: string;
  };
  createdAt: string;
  parentId?: string;
  likesCount: number;
  hasLiked?: boolean;
  replies?: Comment[];
}

interface CommentSystemProps {
  marketId: string;
  version?: "v1" | "v2";
  className?: string;
}

// Individual comment component
const CommentItem = ({
  comment,
  onReply,
  onLike,
  currentUserAddress,
  level = 0,
}: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onLike: (commentId: string) => void;
  currentUserAddress?: string;
  level?: number;
}) => {
  const formatTimeAgo = (createdAt: string) => {
    const now = Date.now();
    const timestamp = new Date(createdAt).getTime();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const hasLiked = comment.hasLiked;
  const isMaxDepth = level >= 2; // Limit reply depth

  return (
    <div
      className={`${
        level > 0
          ? "ml-4 md:ml-6 border-l-2 border-gray-100 dark:border-gray-700 pl-3 md:pl-4"
          : ""
      }`}
    >
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 md:p-4 mb-2 md:mb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-xs md:text-sm font-medium text-blue-700 dark:text-blue-300">
                {comment.user?.username?.charAt(0).toUpperCase() ||
                  comment.user?.address?.slice(2, 4).toUpperCase() ||
                  "?"}
              </span>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">
                {comment.user?.username ||
                  (comment.user?.fid
                    ? `FID: ${comment.user.fid}`
                    : `${comment.user?.address?.slice(
                        0,
                        6
                      )}...${comment.user?.address?.slice(-4)}`)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 md:ml-2">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs md:text-sm text-gray-700 dark:text-gray-300 mb-2 md:mb-3 leading-relaxed">
          <LinkifiedText text={comment.content} />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike(comment.id)}
            className={`text-xs ${
              hasLiked
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
            } hover:text-red-600 dark:hover:text-red-400 px-2 py-1 h-auto`}
          >
            <Heart
              className={`w-3 h-3 mr-1 ${hasLiked ? "fill-current" : ""}`}
            />
            {comment.likesCount}
          </Button>

          {!isMaxDepth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment.id)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 h-auto"
            >
              <Reply className="w-3 h-3 mr-1" />
              Reply
            </Button>
          )}
        </div>
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1 md:space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onLike={onLike}
              currentUserAddress={currentUserAddress}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Simple linkified text component (reused from market details)
const LinkifiedText = ({ text }: { text: string }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) =>
        urlRegex.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};

export function CommentSystem({
  marketId,
  version = "v1",
  className,
}: CommentSystemProps) {
  const { address } = useAccount();
  const farcasterUser = useFarcasterUser();
  const { toast } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const url = `/api/comments?marketId=${marketId}&version=${version}${
        address ? `&userAddress=${address}` : ""
      }`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  }, [marketId, version, address]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Post new comment
  const handlePostComment = async (content: string, parentId?: string) => {
    if (!address || !content.trim()) return;

    setPosting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          version,
          content: content.trim(),
          parentId,
          author: {
            fid: farcasterUser?.fid || "unknown",
            username: farcasterUser?.username || `User ${address.slice(0, 6)}`,
            pfpUrl: farcasterUser?.pfpUrl,
            address,
          },
        }),
      });

      if (response.ok) {
        toast({
          title: "Comment posted!",
          description: "Your comment has been added successfully.",
        });

        // Reset forms
        if (parentId) {
          setReplyContent("");
          setReplyingTo(null);
        } else {
          setNewComment("");
        }

        // Refresh comments
        fetchComments();
      } else {
        throw new Error("Failed to post comment");
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!address) {
      toast({
        title: "Connect wallet",
        description: "Please connect your wallet to like comments.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          userAddress: address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Optimistically update the UI
        setComments((prevComments) =>
          updateCommentInTree(prevComments, commentId, {
            likesCount: data.likesCount,
            hasLiked: data.liked,
          })
        );
      } else {
        throw new Error("Failed to toggle like");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to update a comment in the nested tree structure
  const updateCommentInTree = (
    comments: Comment[],
    commentId: string,
    updates: Partial<Comment>
  ): Comment[] => {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        return { ...comment, ...updates };
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: updateCommentInTree(comment.replies, commentId, updates),
        };
      }
      return comment;
    });
  };

  const handleReply = (parentId: string) => {
    setReplyingTo(replyingTo === parentId ? null : parentId);
    setReplyContent("");
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
          Discussion ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        {/* New comment form */}
        {address ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Share your thoughts on this market..."
              value={newComment}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setNewComment(e.target.value)
              }
              maxLength={500}
              className="min-h-[70px] md:min-h-[80px] text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {newComment.length}/500
              </span>
              <Button
                onClick={() => handlePostComment(newComment)}
                disabled={!newComment.trim() || posting}
                size="sm"
                className="text-xs md:text-sm"
              >
                {posting ? (
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1 md:mr-2" />
                ) : (
                  <Send className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                )}
                Post Comment
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
              Connect your wallet to join the discussion
            </p>
          </div>
        )}

        {/* Comments list */}
        <div className="space-y-3 md:space-y-4">
          {comments.length === 0 ? (
            <div className="text-center p-6 md:p-8 text-gray-500">
              <MessageCircle className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-50" />
              <p className="text-xs md:text-sm">
                No comments yet. Be the first to share your thoughts!
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  onReply={handleReply}
                  onLike={handleLike}
                  currentUserAddress={address}
                />

                {/* Reply form */}
                {replyingTo === comment.id && (
                  <div className="ml-4 md:ml-6 mt-3 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Textarea
                      placeholder={`Reply to ${
                        comment.user?.username || "user"
                      }...`}
                      value={replyContent}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setReplyContent(e.target.value)
                      }
                      maxLength={500}
                      className="mb-3 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          handlePostComment(replyContent, comment.id)
                        }
                        disabled={!replyContent.trim() || posting}
                        size="sm"
                        className="text-xs md:text-sm"
                      >
                        {posting ? (
                          <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1 md:mr-2" />
                        ) : (
                          <Send className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                        )}
                        Reply
                      </Button>
                      <Button
                        onClick={() => setReplyingTo(null)}
                        variant="outline"
                        size="sm"
                        className="text-xs md:text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
