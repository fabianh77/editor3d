import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skull, Trash2, Download, X, MoveVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { FBXLoader, GLTFLoader, OBJLoader, GLTFExporter, OrbitControls } from "three-stdlib";

interface SkeletonReplacerModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string | null;
  modelUrl?: string;
  onSkeletonChanged?: (characterId: string, newModelUrl: string) => void;
}

export function SkeletonReplacerModal({
  isOpen,
  onClose,
  characterId,
  modelUrl,
  onSkeletonChanged,
}: SkeletonReplacerModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSkeletonRemoved, setHasSkeletonRemoved] = useState(false);
  const [isRendererReady, setIsRendererReady] = useState(false);
  const [skeletonInfo, setSkeletonInfo] = useState<{ hasSkeleton: boolean; boneCount: number }>({
    hasSkeleton: false,
    boneCount: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const characterMeshRef = useRef<THREE.Object3D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loadRequestIdRef = useRef<number>(0);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  // Inicializar escena cuando el modal se abre
  useEffect(() => {
    if (!isOpen) return;
    
    // Intentar inicializar con retries
    const initializeScene = (retryCount = 0) => {
      const canvas = canvasRef.current;
      
      if (!canvas) {
        if (retryCount < 5) {
          setTimeout(() => initializeScene(retryCount + 1), 100);
        } else {
          console.error('Failed to initialize canvas after 5 retries');
        }
        return;
      }
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      
      // Verificar que el canvas tenga dimensiones válidas
      if (canvasWidth === 0 || canvasHeight === 0) {
        if (retryCount < 5) {
          setTimeout(() => initializeScene(retryCount + 1), 100);
        } else {
          console.error('Canvas has invalid dimensions after retries');
        }
        return;
      }
      
      // Si ya está inicializado, no reinicializar
      if (sceneRef.current) {
        return;
      }
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x2a2a2a);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 2000);
      camera.position.set(0, 1, 5);  // Más cerca y a la altura del modelo
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(canvasWidth, canvasHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 0, 0);  // Apuntar al centro donde está el modelo
      controlsRef.current = controls;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 7);
      scene.add(directionalLight);

      const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
      gridHelper.position.y = -2;
      scene.add(gridHelper);

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        
        // Verificar que todas las referencias existen antes de actualizar
        if (controlsRef.current && cameraRef.current && sceneRef.current && rendererRef.current) {
          controlsRef.current.update();
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      animate();

      const handleResize = () => {
        if (!canvas || !camera || !renderer) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      resizeHandlerRef.current = handleResize;
      window.addEventListener('resize', handleResize);

      setIsRendererReady(true);
    };

    // Iniciar proceso de inicialización
    initializeScene();

    return () => {
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      setIsRendererReady(false);
    };
  }, [isOpen]);

  // Cargar modelo cuando cambia modelUrl o cuando el renderer está listo
  useEffect(() => {
    if (!isOpen || !modelUrl || !sceneRef.current || !isRendererReady) {
      return;
    }
    const requestId = ++loadRequestIdRef.current;
    loadModel(modelUrl, requestId);
  }, [isOpen, modelUrl, isRendererReady]);

  const loadModel = async (url: string, requestId: number) => {
    if (!sceneRef.current) return;

    setIsLoading(true);

    try {
      const fileExtension = url.split('.').pop()?.toLowerCase();
      let object: THREE.Object3D | null = null;

      if (fileExtension === 'fbx') {
        const loader = new FBXLoader();
        object = await loader.loadAsync(url);
      } else if (fileExtension === 'gltf' || fileExtension === 'glb') {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        object = gltf.scene;
      } else if (fileExtension === 'obj') {
        const loader = new OBJLoader();
        object = await loader.loadAsync(url);
      }

      if (requestId !== loadRequestIdRef.current) {
        if (object) {
          object.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
        return;
      }

      if (!sceneRef.current) {
        return;
      }

      if (object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Centrar modelo
        object.position.x -= center.x;
        object.position.y = -2 - box.min.y;
        object.position.z -= center.z;

        // Asegurar que todos los meshes tengan materiales visibles
        object.traverse((child: any) => {
          if (child.isMesh || child.isSkinnedMesh) {
            if (!child.material) {
              child.material = new THREE.MeshStandardMaterial({ 
                color: 0xcccccc,
                roughness: 0.7,
                metalness: 0.3
              });
            } else {
              // Asegurar que el material sea visible
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat.transparent && mat.opacity === 0) {
                    mat.opacity = 1;
                    mat.transparent = false;
                  }
                  mat.side = THREE.DoubleSide;
                });
              } else {
                if (child.material.transparent && child.material.opacity === 0) {
                  child.material.opacity = 1;
                  child.material.transparent = false;
                }
                child.material.side = THREE.DoubleSide;
              }
            }
          }
        });

        if (characterMeshRef.current && sceneRef.current) {
          sceneRef.current.remove(characterMeshRef.current);
        }

        if (sceneRef.current && cameraRef.current && controlsRef.current) {
          sceneRef.current.add(object);
          characterMeshRef.current = object;

          // Auto-framing: ajustar cámara basado en el tamaño del modelo
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = cameraRef.current.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          cameraZ *= 1.5; // Agregar margen
          
          cameraRef.current.position.set(0, size.y * 0.3, cameraZ);
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();

          analyzeSkeletonInfo(object);

          toast({
            title: "Modelo cargado",
            description: "El modelo se ha cargado correctamente",
          });
        }
      }
    } catch (error) {
      console.error('❌ Error loading model:', error);
      if (requestId === loadRequestIdRef.current && sceneRef.current) {
        toast({
          title: "Error",
          description: "No se pudo cargar el modelo",
          variant: "destructive",
        });
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const analyzeSkeletonInfo = (model: THREE.Object3D) => {
    let boneCount = 0;
    let hasSkeleton = false;

    model.traverse((child: any) => {
      if (child.isBone) {
        boneCount++;
      }
      if (child.isSkinnedMesh && child.skeleton) {
        hasSkeleton = true;
      }
    });

    setSkeletonInfo({ hasSkeleton, boneCount });
  };

  const handleRemoveSkeleton = () => {
    if (!characterMeshRef.current) {
      toast({
        title: "Error",
        description: "No hay un modelo cargado",
        variant: "destructive",
      });
      return;
    }

    // Crear un nuevo grupo para el modelo limpio
    const cleanModel = new THREE.Group();
    cleanModel.name = characterMeshRef.current.name || 'model';
    
    // Copiar transformaciones del modelo original
    cleanModel.position.copy(characterMeshRef.current.position);
    cleanModel.rotation.copy(characterMeshRef.current.rotation);
    cleanModel.scale.copy(characterMeshRef.current.scale);

    // Procesar cada child del modelo original
    characterMeshRef.current.traverse((child: any) => {
      // Saltar huesos
      if (child.isBone) {
        return;
      }

      if (child.isSkinnedMesh) {
        // Crear un Mesh normal a partir del SkinnedMesh
        const geometry = child.geometry.clone();
        const material = child.material.clone ? child.material.clone() : child.material;
        
        const normalMesh = new THREE.Mesh(geometry, material);
        normalMesh.name = child.name;
        
        // Copiar transformaciones
        normalMesh.position.copy(child.position);
        normalMesh.rotation.copy(child.rotation);
        normalMesh.scale.copy(child.scale);
        
        // Copiar userData y otras propiedades
        normalMesh.userData = { ...child.userData };
        normalMesh.castShadow = child.castShadow;
        normalMesh.receiveShadow = child.receiveShadow;
        
        cleanModel.add(normalMesh);
      } else if (child.isMesh) {
        const meshCopy = child.clone();
        cleanModel.add(meshCopy);
      } else if (child.isGroup && child !== characterMeshRef.current) {
        const groupCopy = child.clone();
        cleanModel.add(groupCopy);
      }
    });

    // Reemplazar el modelo en la escena
    if (sceneRef.current && characterMeshRef.current) {
      sceneRef.current.remove(characterMeshRef.current);
      sceneRef.current.add(cleanModel);
      characterMeshRef.current = cleanModel;
    }

    analyzeSkeletonInfo(cleanModel);
    setHasSkeletonRemoved(true);

    toast({
      title: "Esqueleto eliminado",
      description: "El esqueleto ha sido removido del modelo. Los SkinnedMesh han sido convertidos a Mesh normales.",
    });
  };

  const handleTPose = () => {
    if (!characterMeshRef.current) {
      toast({
        title: "Error",
        description: "No hay un modelo cargado",
        variant: "destructive",
      });
      return;
    }

    let bonesAdjusted = 0;
    const allBones: string[] = [];

    // Primero, listar todos los huesos para debug
    characterMeshRef.current.traverse((child: any) => {
      if (child.isBone) {
        allBones.push(child.name);
      }
    });

    console.log('🦴 Todos los huesos en el modelo:', allBones);

    // Resetear a bind pose primero
    characterMeshRef.current.traverse((child: any) => {
      if (child.isSkinnedMesh && child.skeleton) {
        child.skeleton.pose();
      }
    });

    // Función para alinear un hueso de brazo superior usando quaternions
    const alignArmBone = (armBone: THREE.Bone, targetX: number) => {
      // Encontrar el forearm (primer hijo)
      const forearm = armBone.children.find((c: any) => c.isBone) as THREE.Bone | undefined;
      if (!forearm) {
        console.warn('⚠️  No se encontró forearm para', armBone.name);
        return false;
      }

      // Actualizar matrices mundiales
      armBone.updateMatrixWorld(true);
      forearm.updateMatrixWorld(true);

      // Obtener posiciones mundiales
      const armWorldPos = new THREE.Vector3();
      const forearmWorldPos = new THREE.Vector3();
      armBone.getWorldPosition(armWorldPos);
      forearm.getWorldPosition(forearmWorldPos);

      // Vector de dirección actual (mundo)
      const dCurrent = new THREE.Vector3().subVectors(forearmWorldPos, armWorldPos).normalize();

      // Vector objetivo (modelo space): +X para izquierdo, -X para derecho
      const dTarget = new THREE.Vector3(targetX, 0, 0).normalize();

      // Crear quaternion de alineación
      const qAlign = new THREE.Quaternion().setFromUnitVectors(dCurrent, dTarget);

      // Obtener quaternion mundial actual del hueso
      const qWorld = new THREE.Quaternion();
      armBone.getWorldQuaternion(qWorld);

      // Componer alineación con quaternion mundial
      qWorld.premultiply(qAlign);

      // Convertir a espacio local usando inverso del padre
      if (armBone.parent) {
        const qParentWorld = new THREE.Quaternion();
        armBone.parent.getWorldQuaternion(qParentWorld);
        const qParentInv = qParentWorld.clone().invert();
        const qLocal = qParentInv.multiply(qWorld);
        
        // Asignar nuevo quaternion local
        armBone.quaternion.copy(qLocal);
        console.log('✅ Ajustado', armBone.name, 'con quaternion local:', qLocal);
        return true;
      }

      return false;
    };

    // Buscar y ajustar huesos de brazos
    characterMeshRef.current.traverse((child: any) => {
      if (child.isBone) {
        const boneName = child.name.toLowerCase();
        
        // Brazo izquierdo (objetivo: +X)
        if (boneName.includes('leftarm') && !boneName.includes('forearm')) {
          if (alignArmBone(child, 1.0)) {
            bonesAdjusted++;
          }
        }
        // Brazo derecho (objetivo: -X)
        else if (boneName.includes('rightarm') && !boneName.includes('forearm')) {
          if (alignArmBone(child, -1.0)) {
            bonesAdjusted++;
          }
        }
      }
    });

    // Actualizar skeleton
    characterMeshRef.current.traverse((child: any) => {
      if (child.isSkinnedMesh && child.skeleton) {
        child.skeleton.update();
      }
    });

    if (bonesAdjusted > 0) {
      toast({
        title: "Posición T aplicada",
        description: `${bonesAdjusted} brazo(s) ajustado(s) a T-pose`,
      });
    } else {
      toast({
        title: "Advertencia",
        description: "No se encontraron huesos de brazos compatibles",
        variant: "destructive",
      });
    }
  };

  const handleExportModel = async () => {
    if (!characterMeshRef.current) {
      toast({
        title: "Error",
        description: "No hay un modelo para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const exporter = new GLTFExporter();
      
      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          characterMeshRef.current!,
          (gltf: any) => resolve(gltf as ArrayBuffer),
          (error: any) => reject(error),
          { binary: true }
        );
      });

      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `modelo_${Date.now()}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Modelo exportado",
        description: "El modelo se ha descargado correctamente",
      });
    } catch (error) {
      console.error('❌ Error exporting model:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el modelo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportTPoseModel = async () => {
    if (!characterMeshRef.current) {
      toast({
        title: "Error",
        description: "No hay un modelo para exportar",
        variant: "destructive",
      });
      return;
    }

    if (!skeletonInfo.hasSkeleton) {
      toast({
        title: "Advertencia",
        description: "El modelo no tiene esqueleto para guardar en T-pose",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const exporter = new GLTFExporter();
      
      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          characterMeshRef.current!,
          (gltf: any) => resolve(gltf as ArrayBuffer),
          (error: any) => reject(error),
          { binary: true }
        );
      });

      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `modelo_tpose_${Date.now()}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "T-Pose guardada",
        description: "El modelo con T-pose se ha descargado correctamente",
      });
    } catch (error) {
      console.error('❌ Error exporting T-pose model:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el modelo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setHasSkeletonRemoved(false);
    setSkeletonInfo({ hasSkeleton: false, boneCount: 0 });
    if (characterMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(characterMeshRef.current);
      characterMeshRef.current = null;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col" data-testid="dialog-skeleton-replacer">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5" />
              Cambiar Esqueleto
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              data-testid="button-close-skeleton-replacer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              data-testid="canvas-skeleton-replacer"
            />
          </div>

          <div className="w-80 space-y-4 overflow-y-auto">
            <div className="bg-card/50 border border-border rounded-md p-4 space-y-3">
              <h3 className="text-sm font-semibold">Información del Esqueleto</h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={skeletonInfo.hasSkeleton ? "text-green-500" : "text-orange-500"}>
                    {skeletonInfo.hasSkeleton ? "Con esqueleto" : "Sin esqueleto"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Huesos:</span>
                  <span>{skeletonInfo.boneCount}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Acciones</h3>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={handleTPose}
                disabled={isLoading || !skeletonInfo.hasSkeleton}
                data-testid="button-t-pose"
              >
                <MoveVertical className="h-4 w-4 mr-2" />
                Poner en Posición de T
              </Button>

              <Button
                variant="default"
                className="w-full"
                onClick={handleExportTPoseModel}
                disabled={isLoading || !skeletonInfo.hasSkeleton}
                data-testid="button-export-tpose"
              >
                <Download className="h-4 w-4 mr-2" />
                Guardar T-Pose
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleRemoveSkeleton}
                disabled={isLoading || !skeletonInfo.hasSkeleton}
                data-testid="button-remove-skeleton"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Esqueleto
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleExportModel}
                disabled={isLoading || !characterMeshRef.current}
                data-testid="button-export-model"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Modelo Actual
              </Button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs space-y-2">
              <p className="font-semibold text-blue-400">💡 Información</p>
              <p className="text-muted-foreground">
                Puedes poner el modelo en posición T antes de eliminarlo y usar el Auto-Rigger, o eliminar directamente el esqueleto y usar el Auto-Rigger para crear un esqueleto compatible.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
