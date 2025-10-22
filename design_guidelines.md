# Design Guidelines: 3D Editor - 3D Character & Animation Platform

## Design Approach

**Selected Framework**: Material Design with Custom Dark Theme
**Rationale**: Professional 3D asset management tool requiring efficient data organization, clear visual hierarchy, and sophisticated technical UI components while maintaining visual appeal for creative professionals.

**Reference Inspiration**: Sketchfab, Unity Asset Store, Adobe 3D tools
**Key Principles**: Professional utility, visual clarity, efficient workflow, technical precision

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary Theme)**
- Background Base: 220 15% 8% (deep charcoal)
- Surface Elevated: 220 12% 12% (card backgrounds)
- Surface Hover: 220 10% 16% (interactive states)
- Border/Divider: 220 8% 20%

**Accent & Brand**
- Primary Accent: 200 95% 55% (vibrant cyan-blue)
- Secondary Accent: 280 70% 60% (purple for special features)
- Success: 142 70% 45%
- Warning: 38 95% 55%

**Text Hierarchy**
- Primary Text: 220 10% 95%
- Secondary Text: 220 8% 70%
- Tertiary Text: 220 8% 50%

### B. Typography

**Font Stack**: 
- Primary: 'Inter', system-ui, sans-serif (clean, technical)
- Monospace: 'JetBrains Mono', monospace (for technical data)

**Scale**:
- Hero/Display: text-4xl to text-5xl, font-semibold
- Section Headers: text-2xl, font-semibold
- Card Titles: text-base, font-medium
- Body: text-sm, font-normal
- Labels/Meta: text-xs, font-medium, uppercase tracking-wide

### C. Layout System

**Spacing Primitives**: Consistently use 4, 8, 12, 16, 24, 32 (Tailwind units: p-1, p-2, p-3, p-4, p-6, p-8)

**Grid System**:
- Gallery Grid: 4 columns (lg), 3 columns (md), 2 columns (sm), 1 column (mobile)
- Gap spacing: gap-4 for thumbnails, gap-6 for major sections
- Container: max-w-7xl with px-6 padding

### D. Component Library

#### Gallery Cards (Characters & Animations)
- Aspect Ratio: 3:4 for character thumbnails, 16:9 for animations
- Background: Surface Elevated color
- Border: 1px solid Border color
- Hover State: Border changes to Primary Accent, slight scale (1.02)
- Thumbnail: Covers entire card area, object-fit: cover
- Overlay: Gradient from transparent to black (bottom 30%) for text
- Card Footer: Character/animation name, author/description
- Badge: Top-right corner for motion pack count or character type indicator

#### Pagination & Filters
- Pills/Tabs Style: Rounded-full backgrounds for active states
- Items Per Page: Horizontal pill group (24/48/96)
- Thumbnail Size Toggle: Icon buttons with active state highlighting
- Page Numbers: Simple text buttons, active with Primary Accent background

#### Auto-Rigger Modal
- Modal Size: Full-screen overlay with 90vw/90vh content area, max 1400px width
- Layout: Split 60/40 (3D viewer left, instructions/controls right)
- 3D Viewer Panel:
  - Dark background (220 15% 5%)
  - Grid floor reference
  - Marker dots: Cyan circles with white outlines when placed
  - Skeleton preview: Green lines connecting joints
- Instructions Panel:
  - Step-by-step numbered list
  - Icon indicators for each marker point
  - Progress indicator showing completed steps
  - Collapsible advanced options section

#### Navigation Header
- Height: h-16
- Background: Surface Elevated with border-b
- Logo: Left-aligned with "3D Editor" branding
- Tab Navigation: Center-aligned (Characters / Animations)
- Actions: Right-aligned (Upload Character, Download, User menu)

#### Sidebar Preview Panel
- Width: 320px (fixed on desktop, full-width drawer on mobile)
- Sticky positioning
- Sections: Preview image, Title, Metadata, Action buttons
- Animated thumbnail for selected motion
- Stats display: Polygon count, bone count, file size

### E. Interactions & Animations

**Minimize Animations** - Use sparingly:
- Card hover: Transform scale 1.02, transition 150ms
- Modal open/close: Fade in/out 200ms
- Thumbnail loading: Subtle skeleton loader
- NO page transitions, NO unnecessary micro-interactions
- 3D viewer: Smooth camera orbit controls only

## Specific Feature Guidelines

### Character Gallery
- Grid layout with square thumbnails
- Static character pose images
- Author attribution below each character
- Filter by category if applicable
- Lazy loading for performance

### Animation Gallery  
- Grid layout with rectangular thumbnails
- Animated GIF previews (auto-play on hover)
- Animation packs show pack count badge (e.g., "47" in top-right)
- Description visible on hover overlay
- Category tags (Motion, MotionPack)

### Auto-Rigger Interface
**Step Flow**:
1. Character orientation instruction (front-facing, T-pose)
2. Marker placement phase - interactive 3D model with clickable marker points
3. Skeleton preview phase - show applied skeleton over model
4. Configuration options - symmetry toggle, LOD selection
5. Final confirmation and process button

**3D Viewer**:
- Three.js implementation
- Orbit camera controls
- Marker visualization: Translucent cyan spheres with labels
- Skeleton lines: Neon green connecting joints
- Background: Very dark gray with subtle grid

**Controls Panel**:
- Clear step indicators (1/5, 2/5, etc.)
- Visual marker checklist
- Symmetry toggle switch
- LOD dropdown (Standard/Uniform)
- Large "Next" / "Apply Rigging" button at bottom

## Technical Specifications

**Performance Priorities**:
- Lazy load gallery thumbnails
- Virtual scrolling for large galleries
- Optimize GIF file sizes (compress, limit frames)
- Three.js level-of-detail for 3D viewer

**Responsive Breakpoints**:
- Mobile: < 640px (single column, drawer navigation)
- Tablet: 640-1024px (2-3 columns)
- Desktop: > 1024px (4 columns, sidebar visible)

## Asset Integration

**Icons**: Font Awesome (via CDN) for UI controls
**3D Rendering**: Three.js (via CDN) for auto-rigger modal
**Fonts**: Inter from Google Fonts
**Character Images**: Placeholder thumbnails with proper aspect ratios
**Animation GIFs**: Use actual animated placeholders or cycling static frames

## Images

This application does NOT use traditional hero images. Instead:
- Gallery serves as the primary visual content
- Character/animation thumbnails are the hero elements
- Auto-rigger modal contains the 3D viewer as its centerpiece
- No marketing-style hero section needed - this is a utility application