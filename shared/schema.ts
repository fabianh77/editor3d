import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const characters = pgTable("characters", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  author: text("author"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  modelUrl: text("model_url"),
  type: text("type").notNull().default("character"),
  polygonCount: integer("polygon_count"),
  boneCount: integer("bone_count"),
});

export const animations = pgTable("animations", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  modelUrl: text("model_url"),
  type: text("type").notNull(),
  category: text("category"),
  animationCount: integer("animation_count"),
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  itemId: varchar("item_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionItems = pgTable("collection_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  itemId: varchar("item_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;

export type Character = {
  id: string;
  name: string;
  author?: string;
  thumbnailUrl: string;
  modelUrl?: string;
  type: "character";
  polygonCount?: number;
  boneCount?: number;
};

export type AnimationCategory = "idle" | "walk" | "run" | "combat" | "dance" | "jump" | "other";

export type Animation = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  modelUrl?: string;
  type: "motion" | "motionpack";
  category?: AnimationCategory;
  animationCount?: number;
};

export type RigMarker = {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  placed: boolean;
};

export type RigConfiguration = {
  useSymmetry: boolean;
  skeletonLOD: "standard" | "uniform";
  markers: RigMarker[];
};
