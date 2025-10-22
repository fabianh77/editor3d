import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, RotateCcw, Trash2, Eye, Bone, Save, Wrench, Download, Layers } from "lucide-react";
import * as THREE from "three";
import { FBXLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import { OrbitControls } from "three-stdlib";
import { GLTFExporter } from "three-stdlib";
import { RigMarker } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AutoRiggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string | null;
  modelUrl?: string;
  onApplyRigging?: (riggingData: {
    markers: RigMarker[];
    useSymmetry: boolean;
    skeletonLOD: string;
  }) => void;
}

type StepType = "upload" | "opacity" | "markers" | "generate" | "adjust" | "save";

// Mapa de colores únicos para cada marcador
const MARKER_COLORS: Record<string, { color3D: number; colorUI: string; colorUIText: string }> = {
  chin: { color3D: 0xff6b6b, colorUI: 'bg-red-500', colorUIText: 'text-red-500' },
  neckBase: { color3D: 0xffa500, colorUI: 'bg-orange-500', colorUIText: 'text-orange-500' },
  leftShoulder: { color3D: 0xffeb3b, colorUI: 'bg-yellow-500', colorUIText: 'text-yellow-500' },
  rightShoulder: { color3D: 0x9ccc65, colorUI: 'bg-lime-500', colorUIText: 'text-lime-500' },
  leftElbow: { color3D: 0x4caf50, colorUI: 'bg-green-500', colorUIText: 'text-green-500' },
  rightElbow: { color3D: 0x26a69a, colorUI: 'bg-teal-500', colorUIText: 'text-teal-500' },
  leftWrist: { color3D: 0x00bcd4, colorUI: 'bg-cyan-500', colorUIText: 'text-cyan-500' },
  rightWrist: { color3D: 0x2196f3, colorUI: 'bg-blue-500', colorUIText: 'text-blue-500' },
  groin: { color3D: 0x9c27b0, colorUI: 'bg-purple-500', colorUIText: 'text-purple-500' },
  leftKnee: { color3D: 0xe91e63, colorUI: 'bg-pink-500', colorUIText: 'text-pink-500' },
  rightKnee: { color3D: 0xf06292, colorUI: 'bg-pink-400', colorUIText: 'text-pink-400' },
  leftAnkle: { color3D: 0xba68c8, colorUI: 'bg-purple-400', colorUIText: 'text-purple-400' },
  rightAnkle: { color3D: 0x7e57c2, colorUI: 'bg-violet-500', colorUIText: 'text-violet-500' },
};

export function AutoRiggerModal({ isOpen, onClose, characterId, modelUrl, onApplyRigging }: AutoRiggerModalProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const characterMeshRef = useRef<THREE.Group | THREE.Scene | null>(null);
  const markersRef = useRef<THREE.Group | null>(null);
  const skeletonRef = useRef<THREE.Group | null>(null);
  const bonesGroupRef = useRef<THREE.Bone | null>(null); // Root bone de la jerarquía
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const draggedMarkerRef = useRef<string | null>(null);
  const markerMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const highlightTimeoutRef = useRef<number | null>(null);

  const [currentStep, setCurrentStep] = useState<StepType>("upload");
  const [webglError, setWebglError] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [hasSkeletonRemoved, setHasSkeletonRemoved] = useState(false);
  const [isTranslucent, setIsTranslucent] = useState(false);
  const [bonesGenerated, setBonesGenerated] = useState(false);
  const [highlightedMarker, setHighlightedMarker] = useState<string | null>(null);
  
  const [markers, setMarkers] = useState<RigMarker[]>([
    { id: "chin", label: "Barbilla", position: { x: 0, y: 0.5, z: 0.3 }, placed: false },
    { id: "neckBase", label: "Base del Cuello", position: { x: 0, y: 0.3, z: 0.2 }, placed: false },
    { id: "leftShoulder", label: "Hombro Izquierdo", position: { x: -0.5, y: 0.3, z: 0.1 }, placed: false },
    { id: "rightShoulder", label: "Hombro Derecho", position: { x: 0.5, y: 0.3, z: 0.1 }, placed: false },
    { id: "leftElbow", label: "Codo Izquierdo", position: { x: -0.7, y: 0, z: 0.2 }, placed: false },
    { id: "rightElbow", label: "Codo Derecho", position: { x: 0.7, y: 0, z: 0.2 }, placed: false },
    { id: "leftWrist", label: "Muñeca Izquierda", position: { x: -0.8, y: -0.5, z: 0.2 }, placed: false },
    { id: "rightWrist", label: "Muñeca Derecha", position: { x: 0.8, y: -0.5, z: 0.2 }, placed: false },
    { id: "groin", label: "Ingle", position: { x: 0, y: -0.7, z: 0.15 }, placed: false },
    { id: "leftKnee", label: "Rodilla Izquierda", position: { x: -0.2, y: -1.2, z: 0.2 }, placed: false },
    { id: "rightKnee", label: "Rodilla Derecha", position: { x: 0.2, y: -1.2, z: 0.2 }, placed: false },
    { id: "leftAnkle", label: "Tobillo Izquierdo", position: { x: -0.2, y: -1.9, z: 0.1 }, placed: false },
    { id: "rightAnkle", label: "Tobillo Derecho", position: { x: 0.2, y: -1.9, z: 0.1 }, placed: false },
  ]);

  // Setup inicial de la escena
  useEffect(() => {
    if (!isOpen) return;

    const initTimeout = setTimeout(() => {
      if (!canvasRef.current) {
        console.log('❌ Canvas not available');
        return;
      }

      console.log('🎨 Initializing auto-rigger modal scene');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5f5);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
      camera.position.set(0, 1.5, 3);
      camera.lookAt(0, 1, 0);
      cameraRef.current = camera;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        const width = canvasRef.current!.clientWidth || 800;
        const height = canvasRef.current!.clientHeight || 600;
        renderer.setSize(width, height);
        canvasRef.current!.innerHTML = "";
        canvasRef.current!.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        setWebglError(false);
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.minDistance = 1;
        controls.maxDistance = 10;
        controlsRef.current = controls;
      } catch (error) {
        console.warn("WebGL not available:", error);
        setWebglError(true);
        return;
      }

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight1.position.set(5, 10, 5);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight2.position.set(-5, 5, -5);
      scene.add(directionalLight2);

      const gridHelper = new THREE.GridHelper(10, 10, 0x60a5fa, 0x93c5fd);
      gridHelper.position.y = -2;
      scene.add(gridHelper);

      const markersGroup = new THREE.Group();
      scene.add(markersGroup);
      markersRef.current = markersGroup;

      const skeletonGroup = new THREE.Group();
      scene.add(skeletonGroup);
      skeletonRef.current = skeletonGroup;

      let animationFrameId: number;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        if (width > 0 && height > 0) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
        }
      };
      
      window.addEventListener("resize", handleResize);
      setTimeout(handleResize, 100);
    }, 50);

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener("resize", () => {});
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isOpen]);

  // Limpiar timeout de resaltado al cerrar modal
  useEffect(() => {
    if (!isOpen) {
      if (highlightTimeoutRef.current !== null) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      setHighlightedMarker(null);
    }
  }, [isOpen]);

  // Controlar rotación
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enableRotate = rotationEnabled;
    }
  }, [rotationEnabled]);

  // Cargar modelo
  useEffect(() => {
    if (!isOpen || !modelUrl) return;

    const checkScene = setInterval(() => {
      if (sceneRef.current && rendererRef.current) {
        clearInterval(checkScene);
        
        console.log('📦 Loading model:', modelUrl);
        const scene = sceneRef.current;
        
        if (characterMeshRef.current) {
          scene.remove(characterMeshRef.current);
          characterMeshRef.current = null;
        }

        const extension = modelUrl.toLowerCase().substring(modelUrl.lastIndexOf('.'));
        
        const onLoad = (object: THREE.Group | THREE.Scene) => {
          console.log('✅ Model loaded successfully');
          
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              
              if (mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                    mat.needsUpdate = true;
                  }
                });
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x888888,
                  roughness: 0.7,
                  metalness: 0.2,
                });
              }
              
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const min = box.min;
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 3;
          const scale = targetSize / maxDim;
          object.scale.setScalar(scale);
          
          const gridY = -2;
          const scaledMin = min.clone().multiplyScalar(scale);
          const scaledCenter = center.clone().multiplyScalar(scale);
          
          object.position.set(
            -scaledCenter.x, 
            gridY - scaledMin.y,
            -scaledCenter.z
          );
          
          scene.add(object);
          characterMeshRef.current = object;
          
          if (cameraRef.current) {
            const modelHeight = size.y * scale;
            const modelCenterY = gridY + (modelHeight / 2);
            const distance = targetSize * 2;
            cameraRef.current.position.set(0, modelCenterY, distance);
            cameraRef.current.lookAt(0, modelCenterY, 0);
          }
        };
        
        const loadPlaceholder = () => {
          const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
          const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          const characterMesh = new THREE.Mesh(geometry, material);
          characterMesh.position.y = -0.5;
          scene.add(characterMesh);
          characterMeshRef.current = new THREE.Group();
          characterMeshRef.current.add(characterMesh);
        };
        
        const onError = (error: any) => {
          console.error('Error loading model:', error);
          loadPlaceholder();
        };
        
        if (extension === '.fbx') {
          const loader = new FBXLoader();
          loader.load(modelUrl, onLoad, undefined, onError);
        } else if (extension === '.gltf' || extension === '.glb') {
          const loader = new GLTFLoader();
          loader.load(modelUrl, (gltf) => onLoad(gltf.scene), undefined, onError);
        } else if (extension === '.obj') {
          const loader = new OBJLoader();
          loader.load(modelUrl, onLoad, undefined, onError);
        } else {
          loadPlaceholder();
        }
      }
    }, 100);

    return () => clearInterval(checkScene);
  }, [isOpen, modelUrl]);

  // Actualizar huesos cuando cambien los marcadores (en modo adjust)
  useEffect(() => {
    if (currentStep === "adjust" && bonesGenerated) {
      updateBonesFromMarkers();
    }
  }, [markers, currentStep, bonesGenerated]);

  // Renderizar marcadores
  useEffect(() => {
    if (!markersRef.current || !sceneRef.current) return;
    
    markersRef.current.clear();
    markerMeshesRef.current.clear();
    
    markers.forEach((marker) => {
      if (marker.placed) {
        // Determinar si este marcador está resaltado
        const isHighlighted = highlightedMarker === marker.id;
        const markerSize = isHighlighted ? 0.08 : 0.05;
        const outlineSize = isHighlighted ? 0.12 : 0.06;
        
        const markerGeometry = new THREE.SphereGeometry(markerSize, 16, 16);
        const markerColor = MARKER_COLORS[marker.id]?.color3D || 0x0ea5e9;
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: markerColor,
          transparent: true,
          opacity: isHighlighted ? 1.0 : 0.9
        });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.set(marker.position.x, marker.position.y, marker.position.z);
        markerMesh.userData = { markerId: marker.id, isHighlighted };
        markersRef.current?.add(markerMesh);
        markerMeshesRef.current.set(marker.id, markerMesh);

        const outlineGeometry = new THREE.SphereGeometry(outlineSize, 16, 16);
        const outlineMaterial = new THREE.MeshBasicMaterial({ 
          color: isHighlighted ? markerColor : 0xffffff,
          transparent: true,
          opacity: isHighlighted ? 0.6 : 0.3,
          side: THREE.BackSide
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.copy(markerMesh.position);
        outline.userData = { isOutline: true, markerId: marker.id };
        markersRef.current?.add(outline);
      }
    });
  }, [markers, bonesGenerated, highlightedMarker]);

  // Efecto de pulsación para el marcador resaltado
  useEffect(() => {
    if (!highlightedMarker || !markersRef.current) return;
    
    let animationId: number;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const pulse = Math.sin(elapsed * 0.005) * 0.2 + 1.0; // Oscila entre 0.8 y 1.2
      
      markersRef.current?.children.forEach((child) => {
        if (child.userData.markerId === highlightedMarker) {
          const baseScale = child.userData.isOutline ? 2.0 : 1.6;
          child.scale.setScalar(baseScale * pulse);
        }
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      // Restaurar escala normal
      markersRef.current?.children.forEach((child) => {
        if (child.userData.markerId === highlightedMarker) {
          child.scale.setScalar(1.0);
        }
      });
    };
  }, [highlightedMarker]);

  // Event listeners para arrastrar markers
  useEffect(() => {
    if (!isOpen || !rendererRef.current || (currentStep !== "markers" && currentStep !== "adjust")) return;

    const canvas = rendererRef.current.domElement;

    const handleMouseDown = (event: MouseEvent) => {
      if (!cameraRef.current || !markersRef.current) return;

      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const markerMeshes = Array.from(markerMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(markerMeshes);

      if (intersects.length > 0) {
        const intersected = intersects[0].object as THREE.Mesh;
        draggedMarkerRef.current = intersected.userData.markerId;
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!cameraRef.current || !characterMeshRef.current) return;

      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      if (draggedMarkerRef.current) {
        const intersects = raycasterRef.current.intersectObject(characterMeshRef.current, true);
        let newPosition: THREE.Vector3;

        if (intersects.length > 0) {
          // Si hay intersección con la superficie del modelo, usar ese punto
          newPosition = intersects[0].point;
        } else {
          // Si no hay intersección (arrastrando en el espacio), proyectar en un plano virtual
          // El plano es perpendicular a la cámara y pasa por la posición actual del marcador
          const currentMarker = markers.find(m => m.id === draggedMarkerRef.current);
          if (!currentMarker) return;

          const markerPosition = new THREE.Vector3(
            currentMarker.position.x,
            currentMarker.position.y,
            currentMarker.position.z
          );

          // Crear un plano perpendicular a la dirección de la cámara que pase por el marcador
          const cameraDirection = new THREE.Vector3();
          cameraRef.current.getWorldDirection(cameraDirection);
          
          const plane = new THREE.Plane();
          plane.setFromNormalAndCoplanarPoint(cameraDirection, markerPosition);

          // Proyectar el rayo del mouse en el plano
          const intersection = new THREE.Vector3();
          raycasterRef.current.ray.intersectPlane(plane, intersection);

          if (intersection) {
            newPosition = intersection;
          } else {
            return; // No se pudo proyectar en el plano
          }
        }

        setMarkers(prev => prev.map(m =>
          m.id === draggedMarkerRef.current
            ? { ...m, position: { x: newPosition.x, y: newPosition.y, z: newPosition.z } }
            : m
        ));
        
        canvas.style.cursor = 'grabbing';
      } else {
        const markerMeshes = Array.from(markerMeshesRef.current.values());
        const markerIntersects = raycasterRef.current.intersectObjects(markerMeshes);
        const modelIntersects = raycasterRef.current.intersectObject(characterMeshRef.current, true);
        
        if (markerIntersects.length > 0) {
          canvas.style.cursor = 'grab';
        } else if (modelIntersects.length > 0) {
          canvas.style.cursor = 'crosshair';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    const handleMouseUp = () => {
      draggedMarkerRef.current = null;
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isOpen, currentStep, markers]);

  const handleRemoveSkeleton = () => {
    if (!characterMeshRef.current) return;
    
    console.log('🗑️ Removing skeleton from model');
    
    // Remover skeleton y bones del modelo
    characterMeshRef.current.traverse((child: any) => {
      if (child.isBone) {
        console.log('Removing bone:', child.name);
        // Los bones serán removidos cuando reconstruyamos el modelo
      }
      if (child.isSkinnedMesh) {
        console.log('Found skinned mesh, removing skeleton binding');
        // Convertir SkinnedMesh a Mesh regular
        if (child.skeleton) {
          child.skeleton = undefined;
          child.isSkinnedMesh = false;
        }
      }
    });
    
    // Crear una copia limpia del modelo sin skeleton
    const cleanModel = characterMeshRef.current.clone();
    
    // Remover todos los bones de la copia
    const bonesToRemove: THREE.Object3D[] = [];
    cleanModel.traverse((child: any) => {
      if (child.isBone) {
        bonesToRemove.push(child);
      }
    });
    
    bonesToRemove.forEach(bone => {
      if (bone.parent) {
        bone.parent.remove(bone);
      }
    });
    
    // Reemplazar el modelo con la versión limpia
    if (sceneRef.current && characterMeshRef.current) {
      sceneRef.current.remove(characterMeshRef.current);
      sceneRef.current.add(cleanModel);
      characterMeshRef.current = cleanModel;
    }
    
    setHasSkeletonRemoved(true);
    
    toast({
      title: "Esqueleto Eliminado",
      description: "El esqueleto existente ha sido removido del modelo",
    });
    
    setCurrentStep("opacity");
  };

  const handleToggleTranslucent = () => {
    if (!characterMeshRef.current) return;
    
    const newOpacity = isTranslucent ? 1.0 : 0.3;
    
    characterMeshRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat: any) => {
          mat.transparent = !isTranslucent;
          mat.opacity = newOpacity;
          mat.needsUpdate = true;
        });
      }
    });
    
    setIsTranslucent(!isTranslucent);
  };

  const handleMarkerClick = (markerId: string) => {
    const markerIndex = markers.findIndex(m => m.id === markerId);
    const offsetY = markerIndex * 0.3;
    
    const initialPosition = {
      x: -2.5,
      y: 1.5 - offsetY,
      z: 0
    };
    
    setMarkers(prev => prev.map(m => 
      m.id === markerId 
        ? { ...m, placed: true, position: initialPosition } 
        : m
    ));
  };

  const handleHighlightMarker = (markerId: string) => {
    // Limpiar timeout anterior si existe
    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    
    // Resaltar el marcador en el visor 3D
    setHighlightedMarker(markerId);
    
    // Si el marcador está colocado, mover cámara para enfocarlo
    const marker = markers.find(m => m.id === markerId);
    if (marker?.placed && cameraRef.current && controlsRef.current) {
      const targetPos = new THREE.Vector3(
        marker.position.x,
        marker.position.y,
        marker.position.z
      );
      
      // Animar la cámara hacia el marcador
      controlsRef.current.target.copy(targetPos);
      controlsRef.current.update();
    }
    
    // Auto-desresaltar después de 3 segundos
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMarker(null);
      highlightTimeoutRef.current = null;
    }, 3000);
  };

  const getMarkerPosition = (markerId: string): THREE.Vector3 | null => {
    const marker = markers.find(m => m.id === markerId);
    if (!marker?.placed) return null;
    return new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
  };

  const createBoneHierarchy = () => {
    console.log('🦴 Creating bone hierarchy');
    
    // Crear bones basados en marcadores
    const boneMap = new Map<string, THREE.Bone>();
    
    markers.forEach(marker => {
      if (marker.placed) {
        const bone = new THREE.Bone();
        bone.name = `mixamorig${marker.id.charAt(0).toUpperCase() + marker.id.slice(1)}`;
        boneMap.set(marker.id, bone);
      }
    });
    
    // Definir jerarquía (parent -> children)
    const hierarchy: Array<[string, string[]]> = [
      ["groin", ["neckBase", "leftKnee", "rightKnee"]],
      ["neckBase", ["chin", "leftShoulder", "rightShoulder"]],
      ["leftShoulder", ["leftElbow"]],
      ["leftElbow", ["leftWrist"]],
      ["rightShoulder", ["rightElbow"]],
      ["rightElbow", ["rightWrist"]],
      ["leftKnee", ["leftAnkle"]],
      ["rightKnee", ["rightAnkle"]],
    ];
    
    // Construir jerarquía y calcular posiciones RELATIVAS
    hierarchy.forEach(([parentId, childrenIds]) => {
      const parentBone = boneMap.get(parentId);
      const parentPos = getMarkerPosition(parentId);
      
      if (!parentBone || !parentPos) return;
      
      childrenIds.forEach(childId => {
        const childBone = boneMap.get(childId);
        const childPos = getMarkerPosition(childId);
        
        if (!childBone || !childPos) return;
        
        // Calcular posición RELATIVA al padre
        const relativePos = childPos.clone().sub(parentPos);
        childBone.position.copy(relativePos);
        
        parentBone.add(childBone);
      });
    });
    
    // Configurar posición absoluta del root bone
    const rootBone = boneMap.get("groin");
    if (!rootBone) {
      console.error('Groin bone not found');
      return null;
    }
    
    const groinPos = getMarkerPosition("groin");
    if (groinPos) {
      rootBone.position.copy(groinPos);
    }
    
    return rootBone;
  };

  const updateBonesFromMarkers = () => {
    if (!bonesGroupRef.current || !skeletonRef.current) return;
    
    console.log('🔄 Updating bones from markers');
    
    // Definir jerarquía (parent -> children) - mismo que createBoneHierarchy
    const hierarchy: Array<[string, string[]]> = [
      ["groin", ["neckBase", "leftKnee", "rightKnee"]],
      ["neckBase", ["chin", "leftShoulder", "rightShoulder"]],
      ["leftShoulder", ["leftElbow"]],
      ["leftElbow", ["leftWrist"]],
      ["rightShoulder", ["rightElbow"]],
      ["rightElbow", ["rightWrist"]],
      ["leftKnee", ["leftAnkle"]],
      ["rightKnee", ["rightAnkle"]],
    ];
    
    // Actualizar posición del root bone (absoluta)
    const groinPos = getMarkerPosition("groin");
    if (groinPos) {
      bonesGroupRef.current.position.copy(groinPos);
    }
    
    // Actualizar posiciones relativas de bones hijos
    hierarchy.forEach(([parentId, childrenIds]) => {
      const parentPos = getMarkerPosition(parentId);
      if (!parentPos) return;
      
      childrenIds.forEach(childId => {
        const childPos = getMarkerPosition(childId);
        if (!childPos) return;
        
        // Buscar el bone por nombre
        const boneName = `mixamorig${childId.charAt(0).toUpperCase() + childId.slice(1)}`;
        
        bonesGroupRef.current!.traverse((child) => {
          if ((child as any).isBone && child.name === boneName) {
            const bone = child as THREE.Bone;
            // Calcular posición RELATIVA al padre
            const relativePos = childPos.clone().sub(parentPos);
            bone.position.copy(relativePos);
          }
        });
      });
    });
    
    // Redibujar visualización
    renderSkeletonVisualization();
  };

  const renderSkeletonVisualization = () => {
    if (!skeletonRef.current || !bonesGroupRef.current) return;
    
    skeletonRef.current.clear();
    
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
    
    // Dibujar líneas entre bones padres e hijos
    bonesGroupRef.current.traverse((bone: any) => {
      if (bone.isBone && bone.parent && (bone.parent as any).isBone) {
        const parentPos = new THREE.Vector3();
        const childPos = new THREE.Vector3();
        
        bone.parent.getWorldPosition(parentPos);
        bone.getWorldPosition(childPos);
        
        const points = [parentPos, childPos];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        skeletonRef.current?.add(line);
      }
    });
  };

  const handleGenerateBones = () => {
    if (!skeletonRef.current || !sceneRef.current) return;
    
    console.log('🦴 Generating bones from markers');
    
    // Crear jerarquía de bones
    const rootBone = createBoneHierarchy();
    
    if (!rootBone) {
      toast({
        title: "Error",
        description: "No se pudo crear la jerarquía de huesos",
        variant: "destructive"
      });
      return;
    }
    
    // Agregar el root bone a la escena
    if (bonesGroupRef.current) {
      sceneRef.current.remove(bonesGroupRef.current);
    }
    
    sceneRef.current.add(rootBone);
    bonesGroupRef.current = rootBone;
    
    // Visualizar el skeleton
    renderSkeletonVisualization();
    
    setBonesGenerated(true);
    
    toast({
      title: "Huesos Generados",
      description: "La estructura de huesos ha sido creada",
    });
  };

  const handleSaveModel = async () => {
    if (!characterMeshRef.current || !bonesGroupRef.current) {
      toast({
        title: "Error",
        description: "No hay modelo o huesos para guardar",
        variant: "destructive"
      });
      return;
    }
    
    console.log('💾 Saving model with skeleton structure');
    
    try {
      // Crear un grupo que contenga el modelo y los huesos con binding
      const exportGroup = new THREE.Group();
      
      // Clonar el modelo
      const modelClone = characterMeshRef.current.clone();
      
      // Clonar los bones
      const bonesClone = bonesGroupRef.current.clone();
      
      // Recolectar todos los bones en un array para el Skeleton
      const boneArray: THREE.Bone[] = [];
      bonesClone.traverse((child: any) => {
        if (child.isBone) {
          boneArray.push(child);
        }
      });
      
      console.log(`Found ${boneArray.length} bones for skeleton`);
      
      // Crear un Skeleton con los bones
      const skeleton = new THREE.Skeleton(boneArray);
      
      // Encontrar el primer mesh del modelo y convertirlo a SkinnedMesh
      let skinnedMeshCreated = false;
      modelClone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !skinnedMeshCreated) {
          const mesh = child as THREE.Mesh;
          
          // Crear SkinnedMesh con la geometría y material existentes
          const skinnedMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
          
          // Copiar propiedades
          skinnedMesh.position.copy(mesh.position);
          skinnedMesh.rotation.copy(mesh.rotation);
          skinnedMesh.scale.copy(mesh.scale);
          skinnedMesh.name = mesh.name;
          
          // Bindear el skeleton al SkinnedMesh
          skinnedMesh.add(bonesClone); // Agregar los bones al SkinnedMesh
          skinnedMesh.bind(skeleton);
          
          // Reemplazar el mesh original con el SkinnedMesh
          if (mesh.parent) {
            const parent = mesh.parent;
            parent.remove(mesh);
            parent.add(skinnedMesh);
          }
          
          skinnedMeshCreated = true;
          console.log('✅ Created SkinnedMesh with bound skeleton');
        }
      });
      
      exportGroup.add(modelClone);
      
      // Exportar usando GLTFExporter
      const exporter = new GLTFExporter();
      
      exporter.parse(
        exportGroup,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rigged-model-${Date.now()}.glb`;
            link.click();
            URL.revokeObjectURL(url);
            
            toast({
              title: "Modelo Guardado",
              description: "El modelo con estructura de huesos ha sido descargado como GLB",
            });
          } else {
            const blob = new Blob([JSON.stringify(result)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rigged-model-${Date.now()}.gltf`;
            link.click();
            URL.revokeObjectURL(url);
            
            toast({
              title: "Modelo Guardado",
              description: "El modelo con estructura de huesos ha sido descargado como GLTF",
            });
          }
        },
        (error) => {
          console.error('Error exporting model:', error);
          toast({
            title: "Error al Exportar",
            description: "Hubo un error al exportar el modelo",
            variant: "destructive"
          });
        },
        { binary: true }
      );
      
      // Llamar onApplyRigging si existe
      if (onApplyRigging) {
        onApplyRigging({
          markers,
          useSymmetry: true,
          skeletonLOD: "standard"
        });
      }
      
    } catch (error) {
      console.error('Error saving model:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el modelo",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setMarkers(prev => prev.map(m => ({ ...m, placed: false })));
    setHasSkeletonRemoved(false);
    setIsTranslucent(false);
    setBonesGenerated(false);
    if (skeletonRef.current) {
      skeletonRef.current.clear();
    }
    if (bonesGroupRef.current && sceneRef.current) {
      sceneRef.current.remove(bonesGroupRef.current);
      bonesGroupRef.current = null;
    }
  };

  const allMarkersPlaced = markers.every(m => m.placed);

  const getStepTitle = () => {
    switch (currentStep) {
      case "upload": return "Paso 1: Cargar Modelo";
      case "opacity": return "Paso 2: Ajustar Opacidad";
      case "markers": return "Paso 3: Colocar Marcadores";
      case "generate": return "Paso 4: Generar Huesos";
      case "adjust": return "Paso 5: Ajustar Posiciones";
      case "save": return "Paso 6: Guardar Modelo";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-7xl h-[90vh]" 
        data-testid="auto-rigger-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Auto-Rigger Avanzado
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              data-testid="button-reset-rigger"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reiniciar
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-sm">
              {getStepTitle()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex gap-4 h-full">
          {/* Panel izquierdo - Controles */}
          <div className="w-80 space-y-4 overflow-y-auto">
            
            {/* Controles Globales - Visibles en todos los pasos */}
            <div className="p-4 border rounded-lg bg-card/50 space-y-3">
              <h3 className="font-semibold text-sm">Controles del Visor</h3>
              
              {/* Control de Rotación */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rotation-global"
                  checked={rotationEnabled}
                  onCheckedChange={(checked) => setRotationEnabled(checked as boolean)}
                  data-testid="checkbox-rotation"
                />
                <Label htmlFor="rotation-global" className="text-xs cursor-pointer">
                  Activar rotación
                </Label>
              </div>

              {/* Control de Translucidez */}
              <Button
                onClick={handleToggleTranslucent}
                size="sm"
                className="w-full"
                variant={isTranslucent ? "default" : "outline"}
                data-testid="button-toggle-translucent"
              >
                <Eye className="h-4 w-4 mr-2" />
                {isTranslucent ? "Modelo Translúcido" : "Hacer Translúcido"}
              </Button>
            </div>
            
            {/* Paso 1: Cargar + Eliminar Esqueleto */}
            {currentStep === "upload" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Modelo Cargado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    El modelo ha sido cargado correctamente. Elige una opción para continuar:
                  </p>
                  
                  <div className="space-y-2">
                    <Button
                      onClick={handleRemoveSkeleton}
                      className="w-full"
                      variant="default"
                      data-testid="button-remove-skeleton"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Esqueleto y Crear Nuevo
                    </Button>
                    
                    <Button
                      onClick={() => {
                        setHasSkeletonRemoved(true);
                        setCurrentStep("adjust");
                      }}
                      className="w-full"
                      variant="outline"
                      data-testid="button-keep-skeleton"
                    >
                      <Layers className="h-4 w-4 mr-2" />
                      Mantener y Ajustar Esqueleto Existente
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2: Ajustar Opacidad */}
            {currentStep === "opacity" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Ajustar Visibilidad</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Usa el botón "Hacer Translúcido" arriba para ver mejor el interior donde colocarás los huesos
                  </p>
                  <Button
                    onClick={() => setCurrentStep("markers")}
                    className="w-full"
                    data-testid="button-next-to-markers"
                  >
                    Continuar a Marcadores
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 3: Colocar Marcadores */}
            {currentStep === "markers" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Colocar Marcadores</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Haz clic en cada marcador y luego arrástralo a su posición en el modelo. Usa los controles globales arriba para rotar o hacer translúcido el modelo.
                  </p>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {markers.map((marker) => {
                      const markerColor = MARKER_COLORS[marker.id];
                      const isHighlighted = highlightedMarker === marker.id;
                      return (
                        <div key={marker.id} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            marker.placed 
                              ? `${markerColor?.colorUI || 'bg-cyan-500'} border-current` 
                              : 'border-gray-400'
                          }`}>
                            {marker.placed && <span className="text-white text-xs">✓</span>}
                          </div>
                          <Button
                            variant={isHighlighted ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (!marker.placed) {
                                handleMarkerClick(marker.id);
                              } else {
                                handleHighlightMarker(marker.id);
                              }
                            }}
                            className="flex-1"
                            data-testid={`button-marker-${marker.id}`}
                          >
                            <span className={marker.placed && !isHighlighted ? markerColor?.colorUIText || 'text-cyan-500' : ''}>
                              {marker.label}
                            </span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => setCurrentStep("generate")}
                    className="w-full mt-4"
                    disabled={!allMarkersPlaced}
                    data-testid="button-next-to-generate"
                  >
                    Continuar a Generar Huesos
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 4: Generar Huesos */}
            {currentStep === "generate" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Generar Estructura de Huesos</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Genera la estructura de huesos conectando los marcadores
                  </p>
                  <Button
                    onClick={handleGenerateBones}
                    className="w-full mb-2"
                    disabled={bonesGenerated}
                    data-testid="button-generate-bones"
                  >
                    <Bone className="h-4 w-4 mr-2" />
                    {bonesGenerated ? "Huesos Generados" : "Generar Huesos"}
                  </Button>
                  {bonesGenerated && (
                    <Button
                      onClick={() => setCurrentStep("adjust")}
                      className="w-full"
                      data-testid="button-next-to-adjust"
                    >
                      Continuar a Ajustar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Paso 5: Ajustar */}
            {currentStep === "adjust" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Ajustar Posiciones</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Haz clic en un marcador de la lista para localizarlo en el modelo. Luego arrástralo para ajustar su posición. Los huesos se actualizarán automáticamente.
                  </p>

                  <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                    {markers.map((marker) => {
                      const markerColor = MARKER_COLORS[marker.id];
                      const isHighlighted = highlightedMarker === marker.id;
                      return (
                        <div key={marker.id} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            marker.placed 
                              ? `${markerColor?.colorUI || 'bg-cyan-500'} border-current` 
                              : 'border-gray-400'
                          }`}>
                            {marker.placed && <span className="text-white text-xs">✓</span>}
                          </div>
                          <Button
                            variant={isHighlighted ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleHighlightMarker(marker.id)}
                            disabled={!marker.placed}
                            className="flex-1"
                            data-testid={`button-adjust-marker-${marker.id}`}
                          >
                            <span className={marker.placed && !isHighlighted ? markerColor?.colorUIText || 'text-cyan-500' : ''}>
                              {marker.label}
                            </span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => setCurrentStep("save")}
                    className="w-full"
                    data-testid="button-next-to-save"
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Continuar a Guardar
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 6: Guardar */}
            {currentStep === "save" && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Guardar Modelo</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Guarda el modelo con la estructura de huesos
                  </p>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md mb-4">
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      <strong>Importante:</strong> El modelo se guardará con la estructura de huesos pero SIN weight painting (skinning). 
                      Deberás aplicar el peso manualmente en un software 3D externo como Blender.
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveModel}
                    className="w-full"
                    data-testid="button-save-model"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Modelo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Visor 3D */}
          <div className="flex-1 relative">
            <div 
              ref={canvasRef} 
              className="w-full h-full rounded-lg border bg-gray-100 dark:bg-gray-900"
              data-testid="rigger-3d-viewer"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
