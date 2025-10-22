## Overview

This project is a full-stack web application designed for browsing, managing, and manipulating 3D characters and animations. Its core purpose is to provide a professional and interactive platform for users to upload, view, and auto-rig 3D models. The application emphasizes ease of use, interactive 3D experiences, and complete localization in Spanish, aiming to be a comprehensive solution for 3D asset management.

## User Preferences

- Dark mode always enabled
- Professional, clean aesthetic
- Smooth interactions and transitions
- Comprehensive mock data for realistic feel
- **Spanish language** for all UI text and interactions

## System Architecture

The application employs a 3-column layout: a fixed-width left sidebar for dynamic galleries (characters/animations), a flexible center column for the 3D viewer, and a fixed-width right panel for controls and actions. A sticky header handles navigation and search functionalities.

### UI/UX Decisions
- **Layout:** 3-column structure (Gallery, 3D Viewer, Controls Panel) with a sticky header.
- **Color Scheme:** Dark mode with a very dark blue-gray background, cyan-blue accent, and multi-level text hierarchy.
- **Typography:** Inter font for a professional look.
- **Components:** Smooth hover effects, loading skeletons, consistent spacing, and Shadcn UI for high-quality components.
- **Localization:** Complete Spanish translation for all UI elements.
- **3D Viewer Backgrounds:** Light gray backgrounds with enhanced lighting for better model visibility.

### Technical Implementations

#### Frontend
- **Frameworks & Libraries:** React 18 with TypeScript, Tailwind CSS, Three.js, React Query, and Wouter.
- **3D Model Viewer:** Interactive rendering with camera controls, professional lighting, grid helper, and support for FBX, GLTF, GLB, and OBJ formats. Features animation playback and camera capture for thumbnail updates.
- **Auto-Rigger Modal:** A multi-step wizard for character rigging with 3D visualization, interactive marker placement (including advanced features like surface-based dragging, free 3D movement, and real-time bone updates), and the ability to export models with a `SkinnedMesh` bound to a `Skeleton` using `GLTFExporter`. It includes options to remove existing skeletons or adjust them.
- **Right Control Panel:** Contains primary actions in Spanish, including animation controls (Play/Pause, frame slider, speed, enthusiasm, arm spacing, "In Place" checkbox) and buttons for downloading, uploading, rigging, and searching animations.
- **Gallery Cards:** Provide direct Upload, Download, and Delete actions for assets.
- **Skeleton Validation System:** Automatically detects compatible skeletons (`mixamorig` bones) and provides visual indicators and direct links to the Auto-Rigger.
- **Animation Compatibility System:** Ensures only compatible animations (based on `mixamorig` bone naming convention) are accepted to prevent mesh deformation.
- **Skeleton Replacer Modal:** A dedicated modal for managing model skeletons with robust initialization and rendering. Features include:
  - **Retry-based canvas initialization:** Handles DOM mounting timing with 5 retry attempts (100ms delays) to ensure reliable setup
  - **Auto-framing camera system:** Automatically adjusts camera distance and position based on model bounding box for optimal viewing of any model size
  - **Safe skeleton removal:** Converts SkinnedMesh to normal Mesh to prevent broken references during GLTF export
  - **Material normalization:** Ensures all meshes have visible materials with DoubleSide rendering
  - **Memory management:** Proper cleanup of event listeners and animation loops to prevent leaks
  - Functionalities: T-pose restoration, skeleton removal, and GLTF model export

#### Backend
- **API:** Express.js provides a REST API.
- **Data Storage:** Utilizes in-memory storage with comprehensive mock data.
- **File Uploads:** Supports real file uploads using `multer` for individual and bulk uploads, saving to an `/uploads` directory and serving statically.
- **Thumbnail Generation:** Backend endpoints to save generated animation thumbnails, including animated video thumbnails (WebM).

## External Dependencies

- **Three.js:** Core library for 3D rendering, model loading, camera controls, animation, and raycasting.
- **React Query:** For efficient data fetching, caching, and state synchronization.
- **Wouter:** For lightweight client-side routing.
- **Shadcn UI:** For high-quality, reusable UI components.
- **Multer:** Node.js middleware for handling multipart/form-data for file uploads.
- **Express.js:** Web application framework for the backend API.