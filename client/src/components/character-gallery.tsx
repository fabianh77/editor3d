import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GalleryCard } from "@/components/gallery-card";
import { Pagination } from "@/components/pagination-controls";
import { FilterControls } from "@/components/filter-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Character } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface CharacterGalleryProps {
  onSelectCharacter: (characterId: string, characterName: string, modelUrl?: string) => void;
  onGenerateThumbnail?: (characterId: string, characterName: string, modelUrl?: string) => void;
  searchQuery?: string;
}

interface CharactersResponse {
  success: boolean;
  data: Character[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function CharacterGallery({ onSelectCharacter, onGenerateThumbnail, searchQuery = "" }: CharacterGalleryProps) {
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [thumbnailSize, setThumbnailSize] = useState<"small" | "medium" | "large">("medium");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<CharactersResponse>({
    queryKey: ['/api/characters', currentPage, itemsPerPage, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      const res = await fetch(`/api/characters?${params}`);
      if (!res.ok) throw new Error('Failed to fetch characters');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/characters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "Character eliminado",
        description: "El personaje se eliminó correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el personaje.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setCharacterToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (characterToDelete) {
      deleteMutation.mutate(characterToDelete);
    }
    setDeleteDialogOpen(false);
    setCharacterToDelete(null);
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`/api/characters/${id}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `character-${id}.fbx`;
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
      const response = await fetch('/api/characters', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "Archivo subido",
        description: "El personaje se subió correctamente.",
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

    const validExtensions = ['.fbx', '.obj', '.gltf', '.glb'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Formato no válido",
        description: "Por favor sube un archivo FBX, OBJ, GLTF o GLB.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    const fileName = file.name.replace(fileExtension, '');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', fileName);
    formData.append('author', 'Usuario');

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
      <Alert variant="destructive" data-testid="error-characters">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load characters. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".fbx,.obj,.gltf,.glb"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
      />
      <FilterControls
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(value: number) => {
          setItemsPerPage(value);
          setCurrentPage(1);
        }}
        thumbnailSize={thumbnailSize}
        onThumbnailSizeChange={setThumbnailSize}
      />

      {isLoading ? (
        <div className={`grid gap-4 ${gridClasses[thumbnailSize]}`} data-testid="loading-characters">
          {Array.from({ length: itemsPerPage }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`grid gap-4 ${gridClasses[thumbnailSize]}`} data-testid="character-grid">
            {data?.data.map((character) => (
              <GalleryCard
                key={character.id}
                id={character.id}
                title={character.name}
                subtitle={character.author}
                thumbnailUrl={character.thumbnailUrl}
                type="character"
                hasModel={!!character.modelUrl}
                onClick={() => onSelectCharacter(character.id, character.name, character.modelUrl)}
                onUpload={handleUpload}
                onDelete={() => handleDelete(character.id)}
                onDownload={() => handleDownload(character.id)}
                onGenerateThumbnail={onGenerateThumbnail ? () => onGenerateThumbnail(character.id, character.name, character.modelUrl) : undefined}
              />
            ))}
          </div>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar personaje?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. El personaje será eliminado permanentemente.
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
    </div>
  );
}
