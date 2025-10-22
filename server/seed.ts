import { db } from "./db";
import { characters, animations } from "@shared/schema";
import type { AnimationCategory } from "@shared/schema";

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

async function seed() {
  console.log("Seeding database...");
  
  const characterData = Array.from({ length: 120 }, (_, i) => ({
    id: `char-${i + 1}`,
    name: characterNames[i % characterNames.length],
    author: i % 3 === 0 ? authors[i % authors.length] : null,
    thumbnailUrl: `https://placehold.co/400x500/1a1a2e/0ea5e9?text=Character+${i + 1}`,
    type: "character",
    polygonCount: Math.floor(Math.random() * 50000) + 10000,
    boneCount: Math.floor(Math.random() * 100) + 50,
  }));

  const categories: AnimationCategory[] = ["idle", "walk", "run", "combat", "dance", "jump", "other"];
  const animationDataExtended = Array.from({ length: 150 }, (_, i) => {
    if (i < animationData.length) {
      const data = animationData[i];
      return {
        id: `anim-${i + 1}`,
        name: data.name,
        description: data.description,
        thumbnailUrl: `https://placehold.co/400x300/1a1a2e/${data.type === 'motionpack' ? '8b5cf6' : '0ea5e9'}?text=${encodeURIComponent(data.name.substring(0, 15))}`,
        type: data.type,
        category: data.category,
        animationCount: data.count || null,
      };
    }
    return {
      id: `anim-${i + 1}`,
      name: `Animation ${i + 1}`,
      description: `Description for animation ${i + 1}`,
      thumbnailUrl: `https://placehold.co/400x300/1a1a2e/0ea5e9?text=Anim+${i + 1}`,
      type: "motion" as const,
      category: categories[i % categories.length],
      animationCount: null,
    };
  });

  await db.insert(characters).values(characterData).onConflictDoNothing();
  await db.insert(animations).values(animationDataExtended).onConflictDoNothing();
  
  console.log("Database seeded successfully!");
}

seed().catch(console.error);
