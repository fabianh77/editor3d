import { 
  type User, 
  type InsertUser, 
  type Character, 
  type Animation,
  type Favorite,
  type InsertFavorite,
  type Collection,
  type InsertCollection,
  type CollectionItem,
  type InsertCollectionItem,
  users,
  characters as charactersTable,
  animations as animationsTable,
  favorites as favoritesTable,
  collections as collectionsTable,
  collectionItems as collectionItemsTable
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, like, or, count, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCharacters(page: number, limit: number, search?: string): Promise<{ characters: Character[]; total: number }>;
  getAnimations(page: number, limit: number, search?: string, category?: string): Promise<{ animations: Animation[]; total: number }>;
  getCharacterById(id: string): Promise<Character | undefined>;
  getAnimationById(id: string): Promise<Animation | undefined>;
  createCharacter(character: Omit<Character, "id">): Promise<Character>;
  createAnimation(animation: Omit<Animation, "id">): Promise<Animation>;
  updateCharacterThumbnail(id: string, thumbnailUrl: string): Promise<Character | null>;
  updateAnimationThumbnail(id: string, thumbnailUrl: string): Promise<Animation | null>;
  deleteCharacter(id: string): Promise<void>;
  deleteAnimation(id: string): Promise<void>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: string, itemType: string, itemId: string): Promise<void>;
  getFavorites(userId: string): Promise<Favorite[]>;
  isFavorite(userId: string, itemType: string, itemId: string): Promise<boolean>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  getCollections(userId: string): Promise<Collection[]>;
  deleteCollection(id: string): Promise<void>;
  addItemToCollection(item: InsertCollectionItem): Promise<CollectionItem>;
  removeItemFromCollection(collectionId: string, itemId: string): Promise<void>;
  getCollectionItems(collectionId: string): Promise<CollectionItem[]>;
}

const characterNames = [
  "Warrok W Kurniawan", "Mutant", "Remy", "Vanguard By T. Choonyung",
  "Ely By K.Atienza", "Exo Gray", "Erika Archer", "Maria W/Prop J J Ong",
  "The Boss", "Maria J J Ong", "Skeletonzombie T Avelange", "Peasant Girl",
  "Vampire A Lusth", "Prisoner B Styperek", "Romero", "Louise",
  "James", "Amy", "Abe", "Mannequin", "Jolleen", "Ninja",
  "Megan", "Kate", "Mousey", "Claire", "Warzombie F Pedroso",
  "Medea By M. Arrebola", "Maw J Laygo", "Passive Marker Man", "Aj",
  "Erika Archer With Bow/Arrow", "Kaya", "Peasant Man", "Paladin J Nordstrom",
  "Demon T Wiezzorek", "Eve By J.Gonzales", "Pumpkinhulk L Shaw", "Olivia",
  "Crypto", "Alien Soldier", "Leonard", "Racer", "Doozy", "Swat Guy",
  "Lola B Styperek", "Akai E Espiritu", "Girlscout T Masuyama"
];

const authors = [
  "W Kurniawan", "T. Choonyung", "K.Atienza", "J J Ong", "T Avelange",
  "A Lusth", "B Styperek", "M. Arrebola", "J Laygo", "J Nordstrom",
  "T Wiezzorek", "J.Gonzales", "L Shaw", "E Espiritu", "T Masuyama", "F Pedroso"
];

import type { AnimationCategory } from "@shared/schema";

const animationData: Array<{name: string; description: string; type: "motion" | "motionpack"; category: AnimationCategory; count?: number}> = [
  { name: "Praying", description: "Kneeling In Prayer To Standing Up", type: "motion", category: "idle" },
  { name: "Crouch To Stand", description: "Male Crouch To Stand", type: "motion", category: "other" },
  { name: "Hip Hop Dancing", description: "Female Hip Hop 'Slide Step' Dancing", type: "motion", category: "dance" },
  { name: "Silly Dancing", description: "Silly Dancing The Cabbage Patch", type: "motion", category: "dance" },
  { name: "Rumba Dancing", description: "Female Rumba Dancing - Loop", type: "motion", category: "dance" },
  { name: "Joyful Jump", description: "Ecstatic Jumping With Both Legs And Arms", type: "motion", category: "jump" },
  { name: "Zombie Idle", description: "Zombie Twitching Idle", type: "motion", category: "idle" },
  { name: "Pro Melee Axe Pack", description: "Professional melee combat animations with axe", type: "motionpack", category: "combat", count: 47 },
  { name: "Basic Shooter Pack", description: "Essential first-person shooter animations", type: "motionpack", category: "combat", count: 16 },
  { name: "Standing Torch Light", description: "Lighting Torch With Right Hand", type: "motion", category: "idle" },
  { name: "Female Standing Pose", description: "On Right Foot, Left Leg Raised", type: "motion", category: "idle" },
  { name: "Catwalk Walk Turn 180", description: "Female Walk Forward In A Tight Turn", type: "motion", category: "walk" },
  { name: "Female Dynamic Pose", description: "Floating, Bent Forwards", type: "motion", category: "idle" },
  { name: "Standing Dodge Backward", description: "Dodge Backward With Bow", type: "motion", category: "combat" },
  { name: "Unarmed Walk Forward", description: "Walking Forward", type: "motion", category: "walk" },
  { name: "Shoved Reaction With Spin", description: "Reaction To Getting Clipped", type: "motion", category: "combat" },
  { name: "Defeated", description: "Showing Frustration After A Loss", type: "motion", category: "idle" },
  { name: "Capoeira", description: "Capoeira Idle", type: "motion", category: "dance" },
  { name: "Taunt", description: "Taunting Pointing At Wrist", type: "motion", category: "idle" },
  { name: "Old Man Idle", description: "Old Man Standing Idle", type: "motion", category: "idle" },
  { name: "Sitting Laughing", description: "Sitting While Laughing", type: "motion", category: "idle" },
  { name: "Reaction", description: "Male Reaction Hit On The Left Side", type: "motion", category: "combat" },
  { name: "Dying", description: "Dying With Front Impact To The Head", type: "motion", category: "combat" },
  { name: "Jumping Down", description: "Male Cape Jump Down", type: "motion", category: "jump" },
  { name: "Longbow Locomotion Pack", description: "Complete movement set for longbow combat", type: "motionpack", category: "combat", count: 12 },
  { name: "Sword and Shield Pack", description: "Comprehensive melee combat pack", type: "motionpack", category: "combat", count: 49 },
  { name: "Sitting Clap", description: "Sitting Unenthusiastic Clap", type: "motion", category: "idle" },
  { name: "Header Soccerball", description: "Juggling Header Of A Soccer Ball", type: "motion", category: "other" },
  { name: "Goalkeeper Scoop", description: "Goalkeeper Scooping The Ball", type: "motion", category: "other" },
  { name: "Removing Driver", description: "Passenger Attempts To Pull Driver Out", type: "motion", category: "other" },
];

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCharacters(page: number, limit: number, search: string = ""): Promise<{ characters: Character[]; total: number }> {
    let query = db.select().from(charactersTable);
    let countQuery = db.select({ count: count() }).from(charactersTable);
    
    if (search) {
      const searchLower = search.toLowerCase();
      const searchCondition = or(
        sql`lower(${charactersTable.name}) like ${`%${searchLower}%`}`,
        sql`lower(${charactersTable.author}) like ${`%${searchLower}%`}`
      );
      query = query.where(searchCondition) as any;
      countQuery = countQuery.where(searchCondition) as any;
    }
    
    const [{ count: total }] = await countQuery;
    const characters = await query.limit(limit).offset((page - 1) * limit);
    
    return { 
      characters: characters.map(c => ({
        ...c,
        author: c.author || undefined,
        modelUrl: c.modelUrl || undefined,
        type: c.type as "character",
        polygonCount: c.polygonCount || undefined,
        boneCount: c.boneCount || undefined,
      })), 
      total: Number(total) 
    };
  }

  async getAnimations(page: number, limit: number, search: string = "", category?: string): Promise<{ animations: Animation[]; total: number }> {
    let query = db.select().from(animationsTable);
    let countQuery = db.select({ count: count() }).from(animationsTable);
    
    const conditions = [];
    if (search) {
      const searchLower = search.toLowerCase();
      conditions.push(or(
        sql`lower(${animationsTable.name}) like ${`%${searchLower}%`}`,
        sql`lower(${animationsTable.description}) like ${`%${searchLower}%`}`
      ));
    }
    if (category && category !== "all") {
      conditions.push(eq(animationsTable.category, category));
    }
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition) as any;
      countQuery = countQuery.where(whereCondition) as any;
    }
    
    const [{ count: total }] = await countQuery;
    const animations = await query.limit(limit).offset((page - 1) * limit);
    
    return { 
      animations: animations.map(a => ({
        ...a,
        modelUrl: a.modelUrl || undefined,
        type: a.type as "motion" | "motionpack",
        category: a.category as any,
        animationCount: a.animationCount || undefined,
      })), 
      total: Number(total) 
    };
  }

  async getCharacterById(id: string): Promise<Character | undefined> {
    const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
    if (!character) return undefined;
    return {
      ...character,
      author: character.author || undefined,
      modelUrl: character.modelUrl || undefined,
      type: character.type as "character",
      polygonCount: character.polygonCount || undefined,
      boneCount: character.boneCount || undefined,
    };
  }

  async getAnimationById(id: string): Promise<Animation | undefined> {
    const [animation] = await db.select().from(animationsTable).where(eq(animationsTable.id, id));
    if (!animation) return undefined;
    return {
      ...animation,
      modelUrl: animation.modelUrl || undefined,
      type: animation.type as "motion" | "motionpack",
      category: animation.category as any,
      animationCount: animation.animationCount || undefined,
    };
  }

  async createCharacter(character: Omit<Character, "id">): Promise<Character> {
    const id = `char-${randomUUID()}`;
    const [created] = await db.insert(charactersTable).values({
      id,
      ...character,
    }).returning();
    return {
      ...created,
      author: created.author || undefined,
      modelUrl: created.modelUrl || undefined,
      type: created.type as "character",
      polygonCount: created.polygonCount || undefined,
      boneCount: created.boneCount || undefined,
    };
  }

  async createAnimation(animation: Omit<Animation, "id">): Promise<Animation> {
    const id = `anim-${randomUUID()}`;
    const [created] = await db.insert(animationsTable).values({
      id,
      ...animation,
    }).returning();
    return {
      ...created,
      modelUrl: created.modelUrl || undefined,
      type: created.type as "motion" | "motionpack",
      category: created.category as any,
      animationCount: created.animationCount || undefined,
    };
  }

  async updateCharacterThumbnail(id: string, thumbnailUrl: string): Promise<Character | null> {
    const [updated] = await db.update(charactersTable)
      .set({ thumbnailUrl })
      .where(eq(charactersTable.id, id))
      .returning();
    
    if (!updated) return null;
    
    return {
      ...updated,
      author: updated.author || undefined,
      modelUrl: updated.modelUrl || undefined,
      type: updated.type as "character",
      polygonCount: updated.polygonCount || undefined,
      boneCount: updated.boneCount || undefined,
    };
  }

  async updateAnimationThumbnail(id: string, thumbnailUrl: string): Promise<Animation | null> {
    const [updated] = await db.update(animationsTable)
      .set({ thumbnailUrl })
      .where(eq(animationsTable.id, id))
      .returning();
    
    if (!updated) return null;
    
    return {
      ...updated,
      modelUrl: updated.modelUrl || undefined,
      type: updated.type as "motion" | "motionpack",
      category: updated.category as any,
      animationCount: updated.animationCount || undefined,
    };
  }

  async deleteCharacter(id: string): Promise<void> {
    await db.delete(charactersTable).where(eq(charactersTable.id, id));
  }

  async deleteAnimation(id: string): Promise<void> {
    await db.delete(animationsTable).where(eq(animationsTable.id, id));
  }

  async addFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [created] = await db.insert(favoritesTable).values(favorite).returning();
    return created;
  }

  async removeFavorite(userId: string, itemType: string, itemId: string): Promise<void> {
    await db.delete(favoritesTable).where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.itemType, itemType),
        eq(favoritesTable.itemId, itemId)
      )
    );
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    return await db.select().from(favoritesTable).where(eq(favoritesTable.userId, userId));
  }

  async isFavorite(userId: string, itemType: string, itemId: string): Promise<boolean> {
    const [result] = await db.select().from(favoritesTable).where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.itemType, itemType),
        eq(favoritesTable.itemId, itemId)
      )
    );
    return !!result;
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [created] = await db.insert(collectionsTable).values(collection).returning();
    return created;
  }

  async getCollections(userId: string): Promise<Collection[]> {
    return await db.select().from(collectionsTable).where(eq(collectionsTable.userId, userId));
  }

  async deleteCollection(id: string): Promise<void> {
    await db.delete(collectionsTable).where(eq(collectionsTable.id, id));
  }

  async addItemToCollection(item: InsertCollectionItem): Promise<CollectionItem> {
    const [created] = await db.insert(collectionItemsTable).values(item).returning();
    return created;
  }

  async removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
    await db.delete(collectionItemsTable).where(
      and(
        eq(collectionItemsTable.collectionId, collectionId),
        eq(collectionItemsTable.itemId, itemId)
      )
    );
  }

  async getCollectionItems(collectionId: string): Promise<CollectionItem[]> {
    return await db.select().from(collectionItemsTable).where(eq(collectionItemsTable.collectionId, collectionId));
  }
}

export const storage = new DatabaseStorage();
