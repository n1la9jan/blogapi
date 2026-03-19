import { relations } from "drizzle-orm";
import { time } from "drizzle-orm/mysql-core";
import { pgTable, text, timestamp, boolean, index, integer, primaryKey } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const CATEGORIES = [
  { slug: "technology", label: "Technology" },
  { slug: "programming", label: "Programming" },
  { slug: "design", label: "Design" },
  { slug: "career", label: "Career" },
  { slug: "personal", label: "Personal" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [
  CategorySlug,
  ...CategorySlug[],
];


//Blog tables

export const blog = pgTable("blog", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  coverImageKey: text("cover_image_key"),
  coverImageUrl: text("cover_image_url"),
  category: text("category").$type<CategorySlug>().notNull(),
  published: boolean("published").notNull().default(false),
  publihsedAt: timestamp("published_at"),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
})

export const blogImage = pgTable("blog_image", {
  id: text("id").primaryKey(),
  blogId: text("blog_id").notNull().references(() => blog.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  url: text("url").notNull(),
  fileName: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow()
})

export const REACTION_TYPES = ["like", "love", "fire", "clap", "sad"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const blogReaction = pgTable("blog_reaction", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  blogId: text("blog_id").notNull().references(() => blog.id, { onDelete: "cascade" }),
  reaction: text("reaction").$type<ReactionType>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.blogId] })
})
)

export const blogComment = pgTable("blog_comment", {
  id: text("id").primaryKey(),
  blogId: text("blog_id").notNull().references(() => blog.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
})

export const userRelations = relations(user, ({ many }) => ({
  blogs: many(blog),
  sessions: many(session),
  accounts: many(account),
  reactions: many(blogReaction)
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Blog relation

export const blogRelations = relations(blog, ({ one, many }) => ({
  author: one(user, { fields: [blog.authorId], references: [user.id] }),
  images: many(blogImage),
  reactions: many(blogReaction),
}));

export const blogImageRelations = relations(blogImage, ({ one }) => ({
  blog: one(blog, { fields: [blogImage.blogId], references: [blog.id] }),
}));

export const blogReactionRelations = relations(blogReaction, ({ one }) => ({
  user: one(user, { fields: [blogReaction.userId], references: [user.id] }),
  blog: one(blog, { fields: [blogReaction.blogId], references: [blog.id] }),
}));

export const blogCommentRelations = relations(blogComment, ({ one }) => ({
  blog: one(blog, { fields: [blogComment.blogId], references: [blog.id] }),
  author: one(user, { fields: [blogComment.authorId], references: [user.id] }),
}));
