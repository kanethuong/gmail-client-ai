import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  bigserial,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Users table: Stores user information and OAuth credentials for Gmail access
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    oauthAccessToken: text("oauth_access_token"), // Made nullable for users who haven't completed OAuth
    oauthRefreshToken: text("oauth_refresh_token"), // Made nullable
    oauthTokenExpiry: timestamp("oauth_token_expiry"), // Made nullable
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    {
      emailIdx: uniqueIndex("users_email_idx").on(table.email),
    },
  ],
);

// Labels table: Stores Gmail labels (system and user-defined)
export const labels = pgTable(
  "labels",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    labelId: text("label_id").notNull(), // Gmail's label ID
    name: text("name").notNull(),
    type: text("type").notNull(), // 'system' or 'user'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    {
      userLabelIdIdx: uniqueIndex("labels_user_label_id_idx").on(
        table.userId,
        table.labelId,
      ),
      nameIdx: index("labels_name_idx").on(table.name),
    },
  ],
);

// Threads table: Stores Gmail threads metadata
export const threads = pgTable(
  "threads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gmailThreadId: text("gmail_thread_id").notNull(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    historyId: text("history_id"),
    snippet: text("snippet"),
    lastMessageDate: timestamp("last_message_date").notNull(),
    isUnread: boolean("is_unread").default(false).notNull(),
    isStarred: boolean("is_starred").default(false).notNull(),
    isImportant: boolean("is_important").default(false).notNull(),
    isDraft: boolean("is_draft").default(false).notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    {
      userThreadIdIdx: uniqueIndex("threads_user_thread_id_idx").on(
        table.userId,
        table.gmailThreadId,
      ),
      lastMessageDateIdx: index("threads_last_message_date_idx").on(
        table.lastMessageDate,
      ),
      unreadIdx: index("threads_unread_idx").on(table.isUnread),
    },
  ],
);

// Thread Labels junction table: Many-to-many between threads and labels
export const threadLabels = pgTable(
  "thread_labels",
  {
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    labelId: integer("label_id")
      .references(() => labels.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.threadId, table.labelId] }),
      threadIdx: index("thread_labels_thread_idx").on(table.threadId),
      labelIdx: index("thread_labels_label_idx").on(table.labelId),
    },
  ],
);

// Messages table: Stores individual message metadata (body HTML and attachments in S3)
export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gmailMessageId: text("gmail_message_id").notNull(), // Gmail's string message ID
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    from: text("from").notNull(),
    to: text("to").notNull(),
    cc: text("cc"),
    bcc: text("bcc"),
    subject: text("subject").notNull(),
    date: timestamp("date").notNull(),
    snippet: text("snippet").notNull(),
    bodyS3Key: text("body_s3_key"), // S3 key for HTML body
    headers: jsonb("headers"), // Store raw headers as JSONB for flexibility
    isUnread: boolean("is_unread").default(false).notNull(),
    isStarred: boolean("is_starred").default(false).notNull(),
    isDraft: boolean("is_draft").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    {
      threadMessageIdIdx: uniqueIndex("messages_thread_message_id_idx").on(
        table.threadId,
        table.gmailMessageId,
      ),
      subjectIdx: index("messages_subject_idx").on(table.subject),
      fromIdx: index("messages_from_idx").on(table.from),
      snippetIdx: index("messages_snippet_idx").on(table.snippet),
      dateIdx: index("messages_date_idx").on(table.date),
    },
  ],
);

// Attachments table: Stores attachment metadata (files in S3)
export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("message_id", { mode: "number" })
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    gmailAttachmentId: text("gmail_attachment_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    s3Key: text("s3_key").notNull(), // S3 key for the attachment file
    inline: boolean("inline").default(false).notNull(), // Whether to display inline
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    {
      messageAttachmentIdIdx: uniqueIndex(
        "attachments_message_attachment_id_idx",
      ).on(table.messageId, table.gmailAttachmentId),
      filenameIdx: index("attachments_filename_idx").on(table.filename),
    },
  ],
);

// Drafts table: For unsent drafts composed in the app (before sending via Gmail API)
export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  threadId: bigint("thread_id", { mode: "number" }).references(
    () => threads.id,
    {
      onDelete: "set null",
    },
  ), // Optional, for replies/forwards
  subject: text("subject"),
  body: text("body"), // Plain text or HTML draft body (since not sent yet, store locally)
  to: text("to"),
  cc: text("cc"),
  bcc: text("bcc"),
  attachments: jsonb("attachments"), // Array of temp attachment info (before upload to S3/Gmail)
  aiGenerated: boolean("ai_generated").default(false).notNull(), // Flag if generated by AI
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sync Logs table: For tracking sync operations (errors, last history ID, etc.)
export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  syncType: text("sync_type").notNull(), // 'full' or 'incremental'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull(), // 'success', 'failed', etc.
  errorMessage: text("error_message"),
  threadsSynced: integer("threads_synced").default(0).notNull(),
  messagesSynced: integer("messages_synced").default(0).notNull(),
});

// Relations (for Drizzle ORM queries)
export const usersRelations = relations(users, ({ many }) => ({
  labels: many(labels),
  threads: many(threads),
  drafts: many(drafts),
  syncLogs: many(syncLogs),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  user: one(users, { fields: [labels.userId], references: [users.id] }),
  threadLabels: many(threadLabels),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  messages: many(messages),
  threadLabels: many(threadLabels),
  drafts: many(drafts),
}));

export const threadLabelsRelations = relations(threadLabels, ({ one }) => ({
  thread: one(threads, {
    fields: [threadLabels.threadId],
    references: [threads.id],
  }),
  label: one(labels, {
    fields: [threadLabels.labelId],
    references: [labels.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export const draftsRelations = relations(drafts, ({ one }) => ({
  user: one(users, { fields: [drafts.userId], references: [users.id] }),
  thread: one(threads, { fields: [drafts.threadId], references: [threads.id] }),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  user: one(users, { fields: [syncLogs.userId], references: [users.id] }),
}));