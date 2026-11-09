/** Max characters in one visitor chat message (project.md §6.6). */
export const MAX_CHAT_MESSAGE_LENGTH = 1000;

/** Chat messages allowed per minute per public key + IP (project.md §6.6). */
export const CHAT_RATE_LIMIT_PER_MINUTE = 20;

/** Max size of an uploaded knowledge file: 10 MB (project.md §6.4). */
export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;

/** Max characters in one pasted knowledge text. */
export const MAX_KNOWLEDGE_TEXT_LENGTH = 100_000;

/** Max characters in a knowledge source title. */
export const MAX_KNOWLEDGE_TITLE_LENGTH = 200;

/** Max characters in a project name. */
export const MAX_PROJECT_NAME_LENGTH = 80;

/** Max characters in the widget button label. */
export const MAX_WIDGET_LABEL_LENGTH = 40;

/** Max characters in the widget header text. */
export const MAX_WIDGET_HEADER_TEXT_LENGTH = 80;

/** Every project public key starts with this (project.md §6.3). */
export const PUBLIC_KEY_PREFIX = "pk_";
