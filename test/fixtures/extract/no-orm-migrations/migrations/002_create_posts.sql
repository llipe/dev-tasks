CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_author ON posts (author_id);
