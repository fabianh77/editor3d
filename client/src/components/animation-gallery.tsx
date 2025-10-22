import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GalleryCard } from "@/components/gallery-card";
import { Pagination } from "@/components/pagination-controls";
import { FilterControls } from "@/components/filter-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, FolderUp } from "lucide-react";
import { Animation, AnimationCategory } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BulkUploadModal } from "@/components/bulk-upload-modal";
import { AnimationThumbnailModal } from "@/components/animation-thumbnail-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AnimationsResponse {
  success: boolean;
  data: Animation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AnimationGalleryProps {
  searchQuery?: string;
  onSelectAnimation?: (animationId: string, animationName: string, animationUrl?: string) => void;
}

export function AnimationGallery({ searchQuery = "", onSelectAnimation }: AnimationGalleryProps) {
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [thumbnailSize, setThumbnailSize] = useState<"small" | "medium" | "large">("medium");
  const [currentPage, setCurrentPage] = useState(1);
  const [category, setCategory] = useState<AnimationCategory | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [animationToDelete, setAnimationToDelete] = useState<string | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);
  const [selectedAnimation, setSelectedAnimation] = useState<{ id: string; name: string; url?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<AnimationsResponse>({
    queryKey: ['/api/animations', currentPage, itemsPerPage, searchQuery, category],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (category && category !== "all") {
        params.append('category', category);
      }
      const res = await fetch(`/api/animations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch animations');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/animations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animations'] });
      toast({
        title: "Animación eliminada",
        description: "La animación se eliminó correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la animación.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setAnimationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (animationToDelete) {
      deleteMutation.mutate(animationToDelete);
    }
    setDeleteDialogOpen(false);
    setAnimationToDelete(null);
  };

  const handleGenerateThumbnail = (id: string, name: string, url?: string) => {
    setSelectedAnimation({ id, name, url });
    setThumbnailModalOpen(true);
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`/api/animations/${id}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `animation-${id}.fbx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/animations', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animations'] });
      toast({
        title: "Archivo subido",
        description: "La animación se subió correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo subir el archivo.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.fbx', '.bvh', '.dae'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Formato no válido",
        description: "Por favor sube un archivo FBX, BVH o DAE.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    const fileName = file.name.replace(fileExtension, '');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', fileName);
    formData.append('description', `Animación ${fileName}`);
    formData.append('category', category === 'all' ? 'other' : category);

    toast({
      title: "Subiendo archivo",
      description: `Subiendo ${file.name}...`,
    });

    uploadMutation.mutate(formData);
    event.target.value = '';
  };

  const gridClasses = {
    small: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    medium: "grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
    large: "grid-cols-1 md:grid-cols-1 lg:grid-cols-2",
  };

  if (error) {
    return (
      <Alert variant="destructive" data-testid="error-animations">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load animations. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".fbx,.bvh,.dae"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload-animation"
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Category:</span>
          <Select
            value={category}
            onValueChange={(value: AnimationCategory | "all") => {
              setCategory(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-40" data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="walk">Walk</SelectItem>
              <SelectItem value="run">Run</SelectItem>
              <SelectItem value="combat">Combat</SelectItem>
              <SelectItem value="dance">Dance</SelectItem>
              <SelectItem value="jump">Jump</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button 
              onClick={handleUpload}
              variant="default"
              className="gap-2"
              data-testid="button-upload-animation"
            >
              <Upload className="w-4 h-4" />
              Subir Animación
            </Button>
            <Button 
              onClick={() => setBulkUploadOpen(true)}
              variant="outline"
              className="gap-2"
              data-testid="button-bulk-upload-animations"
            >
              <FolderUp className="w-4 h-4" />
              Carga Masiva
            </Button>
          </div>
        </div>
        <FilterControls
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(value: number) => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
          thumbnailSize={thumbnailSize}
          onThumbnailSizeChange={setThumbnailSize}
        />
      </div>

      {isLoading ? (
        <div className={`grid gap-4 ${gridClasses[thumbnailSize]}`} data-testid="loading-animations">
          {Array.from({ length: itemsPerPage }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`grid gap-4 ${gridClasses[thumbnailSize]}`} data-testid="animation-grid">
            {data?.data.map((animation) => (
              <GalleryCard
                key={animation.id}
                id={animation.id}
                title={animation.name}
                subtitle={animation.description}
                thumbnailUrl={animation.thumbnailUrl}
                type={animation.type}
                count={animation.animationCount}
                hasModel={!!animation.modelUrl}
                onClick={() => onSelectAnimation?.(animation.id, animation.name, animation.modelUrl)}
                onGenerateThumbnail={() => handleGenerateThumbnail(animation.id, animation.name, animation.modelUrl)}
                onUpload={handleUpload}
                onDelete={() => handleDelete(animation.id)}
                onDownload={() => handleDownload(animation.id)}
              />
            ))}
          </div>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar animación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. La animación será eliminada permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {data && (
            <Pagination
              currentPage={currentPage}
              totalPages={data.pagination.totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      <BulkUploadModal
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        defaultCategory={category === "all" ? "other" : category}
      />

      {selectedAnimation && (
        <AnimationThumbnailModal
          open={thumbnailModalOpen}
          onOpenChange={setThumbnailModalOpen}
          animationId={selectedAnimation.id}
          animationName={selectedAnimation.name}
          animationUrl={selectedAnimation.url}
        />
      )}
    </div>
  );
}
