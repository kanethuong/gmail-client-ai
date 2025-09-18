import { relations } from "drizzle-orm/relations";
import { users, drafts, threads, messages, attachments, labels, syncLogs, threadLabels } from "./schema";

export const draftsRelations = relations(drafts, ({one}) => ({
	user: one(users, {
		fields: [drafts.userId],
		references: [users.id]
	}),
	thread: one(threads, {
		fields: [drafts.threadId],
		references: [threads.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	drafts: many(drafts),
	labels: many(labels),
	threads: many(threads),
	syncLogs: many(syncLogs),
}));

export const threadsRelations = relations(threads, ({one, many}) => ({
	drafts: many(drafts),
	user: one(users, {
		fields: [threads.userId],
		references: [users.id]
	}),
	messages: many(messages),
	threadLabels: many(threadLabels),
}));

export const attachmentsRelations = relations(attachments, ({one}) => ({
	message: one(messages, {
		fields: [attachments.messageId],
		references: [messages.id]
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	attachments: many(attachments),
	thread: one(threads, {
		fields: [messages.threadId],
		references: [threads.id]
	}),
}));

export const labelsRelations = relations(labels, ({one, many}) => ({
	user: one(users, {
		fields: [labels.userId],
		references: [users.id]
	}),
	threadLabels: many(threadLabels),
}));

export const syncLogsRelations = relations(syncLogs, ({one}) => ({
	user: one(users, {
		fields: [syncLogs.userId],
		references: [users.id]
	}),
}));

export const threadLabelsRelations = relations(threadLabels, ({one}) => ({
	thread: one(threads, {
		fields: [threadLabels.threadId],
		references: [threads.id]
	}),
	label: one(labels, {
		fields: [threadLabels.labelId],
		references: [labels.id]
	}),
}));