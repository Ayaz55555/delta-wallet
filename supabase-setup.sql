-- Supabase Database Setup for Buster Market Comments
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced with wallet addresses and Farcaster data)
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  fid TEXT,
  username TEXT,
  pfp_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comments table
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  market_id TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  version TEXT DEFAULT 'v1' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comment likes table (to track who liked what)
CREATE TABLE comment_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Indexes for better performance
CREATE INDEX idx_comments_market_id ON comments(market_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_version ON comments(version);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_users_address ON users(address);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Anyone can read, users can insert/update their own data
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (true);

-- Comments: Anyone can read, authenticated users can insert
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own comments" ON comments FOR UPDATE USING (true);

-- Comment likes: Anyone can read, authenticated users can insert/delete their own likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON comment_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own likes" ON comment_likes FOR DELETE USING (true);

-- Function to increment/decrement likes count
CREATE OR REPLACE FUNCTION handle_comment_like()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update likes count
CREATE TRIGGER comment_like_trigger
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION handle_comment_like();

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
