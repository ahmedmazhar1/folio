CREATE TABLE enquiries (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  created_epoch INTEGER NOT NULL,
  contact_json TEXT NOT NULL,
  items_json TEXT NOT NULL,
  estimate_json TEXT,
  client_hash TEXT NOT NULL,
  email_status TEXT NOT NULL,
  delivery_error TEXT
);
--> statement-breakpoint
CREATE INDEX enquiries_recent_client ON enquiries(client_hash,created_epoch);
