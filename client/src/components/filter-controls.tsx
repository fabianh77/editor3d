import { Button } from "@/components/ui/button";
import { LayoutGrid, Square, Maximize2 } from "lucide-react";

interface FilterControlsProps {
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  thumbnailSize: "small" | "medium" | "large";
  onThumbnailSizeChange: (size: "small" | "medium" | "large") => void;
}

export function FilterControls({ 
  itemsPerPage, 
  onItemsPerPageChange, 
  thumbnailSize, 
  onThumbnailSizeChange 
}: FilterControlsProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" data-testid="label-items-per-page">
          Items per page:
        </span>
        <div className="inline-flex rounded-md border border-border bg-background p-1" role="group">
          {[24, 48, 96].map((count) => (
            <Button
              key={count}
              variant={itemsPerPage === count ? "default" : "ghost"}
              size="sm"
              onClick={() => onItemsPerPageChange(count)}
              className="h-7 px-3 text-xs"
              data-testid={`button-items-${count}`}
            >
              {count}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" data-testid="label-thumbnail-size">
          Size:
        </span>
        <div className="inline-flex rounded-md border border-border bg-background p-1" role="group">
          <Button
            variant={thumbnailSize === "small" ? "default" : "ghost"}
            size="sm"
            onClick={() => onThumbnailSizeChange("small")}
            className="h-7 w-7 p-0"
            data-testid="button-size-small"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={thumbnailSize === "medium" ? "default" : "ghost"}
            size="sm"
            onClick={() => onThumbnailSizeChange("medium")}
            className="h-7 w-7 p-0"
            data-testid="button-size-medium"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={thumbnailSize === "large" ? "default" : "ghost"}
            size="sm"
            onClick={() => onThumbnailSizeChange("large")}
            className="h-7 w-7 p-0"
            data-testid="button-size-large"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
