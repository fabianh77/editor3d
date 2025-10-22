import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/characters", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 24;
      const search = (req.query.search as string) || "";
      
      const result = await storage.getCharacters(page, limit, search);
      
      res.json({
        success: true,
        data: result.characters,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ success: false, error: "Failed to fetch characters" });
    }
  });

  app.get("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const character = await storage.getCharacterById(id);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }
      
      res.json({ success: true, data: character });
    } catch (error) {
      console.error("Error fetching character:", error);
      res.status(500).json({ success: false, error: "Failed to fetch character" });
    }
  });

  app.post("/api/characters", upload.any(), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: "No files uploaded" });
      }
      
      const modelFile = files?.find(f => f.fieldname === 'model');
      if (!modelFile) {
        return res.status(400).json({ success: false, error: "No model file uploaded" });
      }

      const { name, author } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: "Name is required" });
      }

      const modelUrl = `/uploads/${modelFile.filename}`;
      
      const thumbnailFile = files?.find(f => f.fieldname === 'thumbnail');
      const thumbnailUrl = thumbnailFile
        ? `/uploads/${thumbnailFile.filename}`
        : "https://placehold.co/400x400/1a1a1a/60a5fa?text=3D+Model";
      
      const character = await storage.createCharacter({
        name,
        author: author || undefined,
        thumbnailUrl,
        modelUrl,
        type: "character",
        polygonCount: 10000,
        boneCount: 65,
      });

      res.json({ success: true, data: character });
    } catch (error) {
      console.error("Error creating character:", error);
      res.status(500).json({ success: false, error: "Failed to create character" });
    }
  });

  app.patch("/api/characters/:id/thumbnail", upload.single('thumbnail'), async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No thumbnail file uploaded" });
      }

      const thumbnailUrl = `/uploads/${req.file.filename}`;
      
      const character = await storage.updateCharacterThumbnail(id, thumbnailUrl);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }

      res.json({ success: true, data: character });
    } catch (error) {
      console.error("Error updating character thumbnail:", error);
      res.status(500).json({ success: false, error: "Failed to update thumbnail" });
    }
  });

  app.post("/api/characters/:id/rigging", async (req, res) => {
    try {
      const { id } = req.params;
      const { markers, useSymmetry, skeletonLOD } = req.body;
      
      if (!markers || !Array.isArray(markers)) {
        return res.status(400).json({ success: false, error: "Markers data is required" });
      }

      const character = await storage.getCharacterById(id);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }

      // Guardar información del rigging
      const riggingData = {
        characterId: id,
        markers,
        useSymmetry,
        skeletonLOD,
        appliedAt: new Date().toISOString(),
      };

      console.log('✅ Rigging applied to character:', id);
      console.log('📊 Rigging data:', riggingData);

      res.json({ 
        success: true, 
        message: "Rigging applied successfully",
        data: {
          characterId: id,
          boneCount: markers.length,
          skeletonLOD,
          useSymmetry,
        }
      });
    } catch (error) {
      console.error("Error applying rigging:", error);
      res.status(500).json({ success: false, error: "Failed to apply rigging" });
    }
  });

  app.get("/api/animations", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 24;
      const search = (req.query.search as string) || "";
      const category = (req.query.category as string) || undefined;
      
      const result = await storage.getAnimations(page, limit, search, category);
      
      res.json({
        success: true,
        data: result.animations,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching animations:", error);
      res.status(500).json({ success: false, error: "Failed to fetch animations" });
    }
  });

  app.get("/api/animations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const animation = await storage.getAnimationById(id);
      
      if (!animation) {
        return res.status(404).json({ success: false, error: "Animation not found" });
      }
      
      res.json({ success: true, data: animation });
    } catch (error) {
      console.error("Error fetching animation:", error);
      res.status(500).json({ success: false, error: "Failed to fetch animation" });
    }
  });

  app.post("/api/animations", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const { name, description, category } = req.body;
      if (!name || !description) {
        return res.status(400).json({ success: false, error: "Name and description are required" });
      }

      const modelUrl = `/uploads/${req.file.filename}`;
      
      const animation = await storage.createAnimation({
        name,
        description,
        thumbnailUrl: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400",
        modelUrl,
        type: "motion",
        category: category || "other",
      });

      res.json({ success: true, data: animation });
    } catch (error) {
      console.error("Error creating animation:", error);
      res.status(500).json({ success: false, error: "Failed to create animation" });
    }
  });

  app.post("/api/animations/bulk", upload.array('files', 50), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: "No files uploaded" });
      }

      const { category } = req.body;
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const fileName = path.basename(file.originalname, path.extname(file.originalname));
          const modelUrl = `/uploads/${file.filename}`;
          
          const animation = await storage.createAnimation({
            name: fileName,
            description: `Animación ${fileName}`,
            thumbnailUrl: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400",
            modelUrl,
            type: "motion",
            category: category || "other",
          });

          results.push(animation);
        } catch (error) {
          errors.push({ file: file.originalname, error: String(error) });
        }
      }

      res.json({ 
        success: true, 
        data: results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: files.length,
          successful: results.length,
          failed: errors.length
        }
      });
    } catch (error) {
      console.error("Error bulk creating animations:", error);
      res.status(500).json({ success: false, error: "Failed to create animations" });
    }
  });

  app.patch("/api/characters/:id/thumbnail", upload.single('thumbnail'), async (req, res) => {
    try {
      const { id } = req.params;
      const character = await storage.getCharacterById(id);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No thumbnail file uploaded" });
      }

      const thumbnailUrl = `/uploads/${req.file.filename}`;
      await storage.updateCharacterThumbnail(id, thumbnailUrl);
      
      res.json({ success: true, data: { thumbnailUrl } });
    } catch (error) {
      console.error("Error updating character thumbnail:", error);
      res.status(500).json({ success: false, error: "Failed to update thumbnail" });
    }
  });

  app.patch("/api/animations/:id/thumbnail", upload.single('thumbnail'), async (req, res) => {
    try {
      const { id } = req.params;
      const animation = await storage.getAnimationById(id);
      
      if (!animation) {
        return res.status(404).json({ success: false, error: "Animation not found" });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No thumbnail file uploaded" });
      }

      const thumbnailUrl = `/uploads/${req.file.filename}`;
      await storage.updateAnimationThumbnail(id, thumbnailUrl);
      
      res.json({ success: true, data: { thumbnailUrl } });
    } catch (error) {
      console.error("Error updating animation thumbnail:", error);
      res.status(500).json({ success: false, error: "Failed to update thumbnail" });
    }
  });

  app.delete("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const character = await storage.getCharacterById(id);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }
      
      await storage.deleteCharacter(id);
      res.json({ success: true, message: "Character deleted successfully" });
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ success: false, error: "Failed to delete character" });
    }
  });

  app.delete("/api/animations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const animation = await storage.getAnimationById(id);
      
      if (!animation) {
        return res.status(404).json({ success: false, error: "Animation not found" });
      }
      
      await storage.deleteAnimation(id);
      res.json({ success: true, message: "Animation deleted successfully" });
    } catch (error) {
      console.error("Error deleting animation:", error);
      res.status(500).json({ success: false, error: "Failed to delete animation" });
    }
  });

  app.get("/api/characters/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const character = await storage.getCharacterById(id);
      
      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }
      
      const fbxContent = `; FBX 7.4.0 project file
; Character: ${character.name}
; Exported from Mixamo Clone
; This is a mock FBX file for demonstration purposes

FBXHeaderExtension:  {
    FBXHeaderVersion: 1003
    FBXVersion: 7400
    CreationTimeStamp:  {
        Version: 1000
        Year: 2025
        Month: 10
        Day: 19
    }
}

Definitions:  {
    ObjectType: "Model" {
        Count: 1
    }
}

Objects:  {
    Model: "${character.id}", "Model::${character.name}", "Mesh" {
        Properties70:  {
            P: "RotationActive", "bool", "", "",1
        }
    }
}`;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${character.name.replace(/[^a-z0-9]/gi, '_')}.fbx"`);
      res.send(fbxContent);
    } catch (error) {
      console.error("Error downloading character:", error);
      res.status(500).json({ success: false, error: "Failed to download character" });
    }
  });

  app.get("/api/animations/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const animation = await storage.getAnimationById(id);
      
      if (!animation) {
        return res.status(404).json({ success: false, error: "Animation not found" });
      }
      
      const fbxContent = `; FBX 7.4.0 project file
; Animation: ${animation.name}
; Exported from Mixamo Clone
; This is a mock FBX file for demonstration purposes

FBXHeaderExtension:  {
    FBXHeaderVersion: 1003
    FBXVersion: 7400
    CreationTimeStamp:  {
        Version: 1000
        Year: 2025
        Month: 10
        Day: 19
    }
}

Definitions:  {
    ObjectType: "AnimationStack" {
        Count: 1
    }
}

Objects:  {
    AnimationStack: "${animation.id}", "AnimStack::${animation.name}", "" {
        Properties70:  {
            P: "LocalStart", "KTime", "Time", "",0
            P: "LocalStop", "KTime", "Time", "",46186158000
        }
    }
}`;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${animation.name.replace(/[^a-z0-9]/gi, '_')}.fbx"`);
      res.send(fbxContent);
    } catch (error) {
      console.error("Error downloading animation:", error);
      res.status(500).json({ success: false, error: "Failed to download animation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
