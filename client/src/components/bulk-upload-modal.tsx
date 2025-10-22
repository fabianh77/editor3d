import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimationCategory } from "@shared/schema";
import { Upload, X, CheckCircle2, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: AnimationCategory;
}

interface FileStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function BulkUploadModal({ open, onOpenChange, defaultCategory }: BulkUploadModalProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [category, setCategory] = useState<AnimationCategory>(defaultCategory || "other");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      const formData = new FormData();
      filesToUpload.forEach(file => {
        formData.append('files', file);
      });
      formData.append('category', category);

      const response = await fetch('/api/animations/bulk', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/animations'] });
      
      const { summary } = data;
      toast({
        title: "Carga completada",
        description: `${summary.successful} de ${summary.total} animaciones subidas exitosamente`,
      });

      // Actualizar estado de archivos
      if (data.errors && data.errors.length > 0) {
        setFiles(prev => prev.map(fileStatus => {
          const error = data.errors.find((e: any) => e.file === fileStatus.file.name);
          if (error) {
            return { ...fileStatus, status: 'error' as const, error: error.error };
          }
          return { ...fileStatus, status: 'success' as const };
        }));
      } else {
        setFiles(prev => prev.map(f => ({ ...f, status: 'success' as const })));
      }
      
      setUploadProgress(100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudieron subir las animaciones",
        variant: "destructive",
      });
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const })));
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validExtensions = ['.fbx', '.bvh', '.dae'];
    
    const validFiles = selectedFiles.filter(file => {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return validExtensions.includes(extension);
    });

    if (validFiles.length < selectedFiles.length) {
      toast({
        title: "Archivos no válidos",
        description: `Solo se admiten archivos ${validExtensions.join(', ')}`,
        variant: "destructive",
      });
    }

    setFiles(validFiles.map(file => ({ file, status: 'pending' })));
    event.target.value = '';
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));
    setUploadProgress(0);

    const filesToUpload = files.map(f => f.file);
    uploadMutation.mutate(filesToUpload);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setFiles([]);
    setUploadProgress(0);
    onOpenChange(false);
  };

  const allSuccess = files.length > 0 && files.every(f => f.status === 'success');
  const isUploading = uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-bulk-upload">
        <DialogHeader>
          <DialogTitle>Subir Múltiples Animaciones</DialogTitle>
          <DialogDescription>
            Selecciona múltiples archivos FBX, BVH o DAE para subir
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoría</label>
            <Select value={category} onValueChange={(value: AnimationCategory) => setCategory(value)}>
              <SelectTrigger data-testid="select-bulk-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="walk">Walk</SelectItem>
                <SelectItem value="run">Run</SelectItem>
                <SelectItem value="combat">Combat</SelectItem>
                <SelectItem value="dance">Dance</SelectItem>
                <SelectItem value="jump">Jump</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".fbx,.bvh,.dae"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-bulk-file-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={isUploading || allSuccess}
              data-testid="button-select-files"
            >
              <Upload className="w-4 h-4 mr-2" />
              Seleccionar Archivos
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{files.length} archivo(s) seleccionado(s)</span>
                {isUploading && (
                  <span className="text-xs text-muted-foreground">Subiendo...</span>
                )}
              </div>

              {isUploading && (
                <Progress value={uploadProgress} className="h-2" />
              )}

              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted/50 text-sm"
                    data-testid={`file-item-${index}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {fileStatus.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      )}
                      {fileStatus.status === 'error' && (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      {fileStatus.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground shrink-0" />
                      )}
                      {fileStatus.status === 'uploading' && (
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                      )}
                      
                      <span className="truncate">{fileStatus.file.name}</span>
                      
                      {fileStatus.error && (
                        <span className="text-xs text-destructive">({fileStatus.error})</span>
                      )}
                    </div>
                    
                    {!isUploading && fileStatus.status !== 'success' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveFile(index)}
                        className="h-6 w-6 shrink-0"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            data-testid="button-cancel-bulk-upload"
          >
            {allSuccess ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!allSuccess && (
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              data-testid="button-start-bulk-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              Subir {files.length} Animación{files.length !== 1 ? 'es' : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
