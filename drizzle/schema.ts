import { pgTable, foreignKey, serial, integer, bigint, text, jsonb, boolean, timestamp, bigserial, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const drafts = pgTable("drafts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	threadId: bigint("thread_id", { mode: "number" }),
	subject: text(),
	body: text(),
	to: text(),
	cc: text(),
	bcc: text(),
	attachments: jsonb(),
	aiGenerated: boolean("ai_generated").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "drafts_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [threads.id],
			name: "drafts_thread_id_threads_id_fk"
		}).onDelete("set null"),
]);

export const attachments = pgTable("attachments", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	messageId: bigint("message_id", { mode: "number" }).notNull(),
	gmailAttachmentId: text("gmail_attachment_id").notNull(),
	filename: text().notNull(),
	mimeType: text("mime_type").notNull(),
	size: integer().notNull(),
	s3Key: text("s3_key").notNull(),
	inline: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "attachments_message_id_messages_id_fk"
		}).onDelete("cascade"),
]);

export const labels = pgTable("labels", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	labelId: text("label_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "labels_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const threads = pgTable("threads", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	gmailThreadId: text("gmail_thread_id").notNull(),
	userId: integer("user_id").notNull(),
	historyId: text("history_id"),
	snippet: text(),
	lastMessageDate: timestamp("last_message_date", { mode: 'string' }).notNull(),
	isUnread: boolean("is_unread").default(false).notNull(),
	isStarred: boolean("is_starred").default(false).notNull(),
	isImportant: boolean("is_important").default(false).notNull(),
	isDraft: boolean("is_draft").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "threads_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	gmailMessageId: text("gmail_message_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	threadId: bigint("thread_id", { mode: "number" }).notNull(),
	from: text().notNull(),
	to: text().notNull(),
	cc: text(),
	bcc: text(),
	subject: text().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	snippet: text().notNull(),
	bodyS3Key: text("body_s3_key"),
	headers: jsonb(),
	isUnread: boolean("is_unread").default(false).notNull(),
	isStarred: boolean("is_starred").default(false).notNull(),
	isDraft: boolean("is_draft").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [threads.id],
			name: "messages_thread_id_threads_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	oauthAccessToken: text("oauth_access_token"),
	oauthRefreshToken: text("oauth_refresh_token"),
	oauthTokenExpiry: timestamp("oauth_token_expiry", { mode: 'string' }),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const syncLogs = pgTable("sync_logs", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	syncType: text("sync_type").notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	status: text().notNull(),
	errorMessage: text("error_message"),
	threadsSynced: integer("threads_synced").default(0).notNull(),
	messagesSynced: integer("messages_synced").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sync_logs_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const threadLabels = pgTable("thread_labels", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	threadId: bigint("thread_id", { mode: "number" }).notNull(),
	labelId: integer("label_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [threads.id],
			name: "thread_labels_thread_id_threads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.labelId],
			foreignColumns: [labels.id],
			name: "thread_labels_label_id_labels_id_fk"
		}).onDelete("cascade"),
]);
