import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Download, Camera } from "lucide-react";

interface GalleryCardProps {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl: string;
  type: "character" | "motion" | "motionpack";
  count?: number;
  hasModel?: boolean;
  onClick?: () => void;
  onUpload?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onGenerateThumbnail?: () => void;
}

export function GalleryCard({ id, title, subtitle, thumbnailUrl, type, count, hasModel, onClick, onUpload, onDelete, onDownload, onGenerateThumbnail }: GalleryCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  // Detectar si el thumbnail es un video
  const isVideo = thumbnailUrl.endsWith('.webm') || thumbnailUrl.endsWith('.mp4');

  return (
    <Card 
      className="overflow-hidden border-card-border bg-card transition-all duration-200"
      data-testid={`card-${type}-${id}`}
    >
      <div 
        className="group relative aspect-[3/4] overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2"
        onClick={handleCardClick}
      >
        {isVideo ? (
          <video 
            src={thumbnailUrl}
            className="h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-110 group-hover:brightness-110"
            data-testid={`video-thumbnail-${id}`}
            key={thumbnailUrl}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img 
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-110 group-hover:brightness-110"
            data-testid={`img-thumbnail-${id}`}
            key={thumbnailUrl}
          />
        )}
        
        <div className="absolute inset-0 bg-primary/0 transition-all duration-300 group-hover:bg-primary/5 pointer-events-none" />
        
        {count && (
          <Badge 
            className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm text-foreground border-border transition-all duration-200 group-hover:scale-105"
            data-testid={`badge-count-${id}`}
          >
            {count}
          </Badge>
        )}
        
        {hasModel && (
          <Badge 
            className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm text-primary-foreground border-primary transition-all duration-200 group-hover:scale-105"
            data-testid={`badge-3d-model-${id}`}
          >
            3D
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 p-2 border-t border-border bg-card">
        {onGenerateThumbnail && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateThumbnail();
            }}
            className="flex-1"
            data-testid={`button-generate-thumbnail-${id}`}
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}
        {onUpload && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onUpload();
            }}
            className="flex-1"
            data-testid={`button-upload-${id}`}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="flex-1"
            data-testid={`button-download-${id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-1 text-destructive hover:text-destructive"
            data-testid={`button-delete-${id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
