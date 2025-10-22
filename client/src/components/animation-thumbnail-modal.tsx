import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimationThumbnailCapture } from "./animation-thumbnail-capture";

interface AnimationThumbnailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animationId: string;
  animationName: string;
  animationUrl?: string;
}

export function AnimationThumbnailModal({ 
  open, 
  onOpenChange, 
  animationId,
  animationName,
  animationUrl 
}: AnimationThumbnailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-animation-thumbnail">
        <DialogHeader>
          <DialogTitle>Generar Thumbnail</DialogTitle>
          <DialogDescription>
            Vista previa de "{animationName}" con modelo base femenino
          </DialogDescription>
        </DialogHeader>

        <AnimationThumbnailCapture
          animationId={animationId}
          animationUrl={animationUrl}
          onCapture={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
