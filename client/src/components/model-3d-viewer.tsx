import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FBXLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import { OrbitControls } from "three-stdlib";
import { Camera, Skull, Grid3x3, Sun, Maximize2, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";

export interface Model3DViewerHandle {
  handleToggleAnimation: () => void;
  handleFrameChange: (frameValues: number[]) => void;
  handleSpeedChange: (speed: number) => void;
  handleEnthusiasmChange: (enthusiasm: number) => void;
  handleArmSpacingChange: (spacing: number) => void;
  handleInPlaceChange: (inPlace: boolean) => void;
  handleCaptureSnapshot: () => void;
  handleClearAnimation: () => void;
  getHasSkeleton: () => boolean;
}

interface Model3DViewerProps {
  characterId: string | null;
  characterName?: string;
  modelUrl?: string;
  animationUrl?: string;
  onAnimationStateChange?: (state: {
    isPlaying: boolean;
    currentFrame: number;
    totalFrames: number;
    hasAnimation: boolean;
  }) => void;
  onToggleAnimation?: () => void;
  onFrameChange?: (frame: number) => void;
  onModelLoaded?: () => void;
  onModelLoadError?: () => void;
}

export const Model3DViewer = forwardRef<Model3DViewerHandle, Model3DViewerProps>(
  (props, ref) => {
  const { 
    characterId, 
    characterName, 
    modelUrl, 
    animationUrl,
    onAnimationStateChange,
    onToggleAnimation: onToggleAnimationProp,
    onFrameChange: onFrameChangeProp,
    onModelLoaded,
    onModelLoadError
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const floorPlaneRef = useRef<THREE.Mesh | null>(null);
  const animationMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationActionRef = useRef<THREE.AnimationAction | null>(null);
  const originalAnimationClipRef = useRef<THREE.AnimationClip | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isRendererReady, setIsRendererReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(50); // 0-100, donde 50 es velocidad normal
  const [animationEnthusiasm, setAnimationEnthusiasm] = useState(50); // 0-100, donde 50 es amplitud normal
  const [armSpacing, setArmSpacing] = useState(50); // 0-100, donde 50 es espacio normal
  const [inPlace, setInPlace] = useState(false); // false = animación con desplazamiento
  const neutralPoseRef = useRef<Map<THREE.Bone, { position: THREE.Vector3; rotation: THREE.Quaternion }>>(new Map());
  const rootBoneRef = useRef<THREE.Bone | null>(null);
  const initialRootBonePositionRef = useRef<THREE.Vector3 | null>(null);
  const loadRequestIdRef = useRef<number>(0);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateThumbnailMutation = useMutation({
    mutationFn: async (thumbnailBlob: Blob) => {
      const formData = new FormData();
      formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
      
      const response = await fetch(`/api/characters/${characterId}/thumbnail`, {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update thumbnail');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "Miniatura actualizada",
        description: "La imagen del personaje se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la miniatura",
        variant: "destructive",
      });
    },
  });

  const handleToggleAnimation = () => {
    if (!animationActionRef.current) return;
    
    if (isAnimationPlaying) {
      animationActionRef.current.paused = true;
      setIsAnimationPlaying(false);
    } else {
      animationActionRef.current.paused = false;
      setIsAnimationPlaying(true);
    }
    
    if (onToggleAnimationProp) {
      onToggleAnimationProp();
    }
  };

  const handleFrameChange = (frameValues: number[]) => {
    if (!animationActionRef.current || !animationDuration) return;
    
    const targetFrame = frameValues[0];
    const fps = 30;
    const targetTime = targetFrame / fps;
    
    animationActionRef.current.time = targetTime;
    setCurrentFrame(targetFrame);
    
    if (onFrameChangeProp) {
      onFrameChangeProp(targetFrame);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setAnimationSpeed(speed);
    
    if (!animationActionRef.current) return;
    
    // Mapear 0-100 a timeScale
    // 0 = 0.1x, 50 = 1.0x (normal), 100 = 3.0x
    let timeScale: number;
    if (speed < 50) {
      // 0-50 mapea de 0.1 a 1.0
      timeScale = 0.1 + (speed / 50) * 0.9;
    } else {
      // 50-100 mapea de 1.0 a 3.0
      timeScale = 1.0 + ((speed - 50) / 50) * 2.0;
    }
    
    animationActionRef.current.timeScale = timeScale;
    console.log(`⚡ Animation speed changed: ${speed}% (timeScale: ${timeScale.toFixed(2)}x)`);
  };

  const handleEnthusiasmChange = (enthusiasm: number) => {
    setAnimationEnthusiasm(enthusiasm);
    console.log(`🎭 Animation enthusiasm changed: ${enthusiasm}%`);
  };

  const handleArmSpacingChange = (spacing: number) => {
    setArmSpacing(spacing);
    console.log(`💪 Arm spacing changed: ${spacing}%`);
  };

  const handleInPlaceChange = (enabled: boolean) => {
    setInPlace(enabled);
    console.log(`📍 In-place animation ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleClearAnimation = () => {
    console.log('🧹 Clearing animation and restoring neutral pose');
    
    // Detener el mixer
    if (animationMixerRef.current) {
      animationMixerRef.current.stopAllAction();
      // Limpiar clips cacheados para evitar clips obsoletos
      if (originalAnimationClipRef.current) {
        animationMixerRef.current.uncacheClip(originalAnimationClipRef.current);
      }
    }
    
    // Limpiar referencias de animación
    animationActionRef.current = null;
    originalAnimationClipRef.current = null;
    
    // Restaurar pose neutral si existe
    if (meshRef.current && neutralPoseRef.current.size > 0) {
      meshRef.current.traverse((child) => {
        if ((child as any).isBone) {
          const bone = child as THREE.Bone;
          const neutralData = neutralPoseRef.current.get(bone);
          if (neutralData) {
            bone.position.copy(neutralData.position);
            bone.quaternion.copy(neutralData.rotation);
          }
        }
      });
    }
    
    // Resetear estado de animación - isPlaying debe ser false
    setIsAnimationPlaying(false);
    setCurrentFrame(0);
    setTotalFrames(0);
    setAnimationDuration(0);
    
    // Notificar al padre que no hay animación
    if (onAnimationStateChange) {
      onAnimationStateChange({
        isPlaying: false,
        currentFrame: 0,
        totalFrames: 0,
        hasAnimation: false,
      });
    }
  };

  // Exponer funciones al componente padre mediante ref
  useImperativeHandle(ref, () => ({
    handleToggleAnimation,
    handleFrameChange,
    handleSpeedChange,
    handleEnthusiasmChange,
    handleArmSpacingChange,
    handleInPlaceChange,
    handleCaptureSnapshot,
    handleClearAnimation,
    getHasSkeleton: () => neutralPoseRef.current.size > 0,
  }));

  // Notificar cambios de estado de animación al componente padre
  useEffect(() => {
    if (onAnimationStateChange) {
      onAnimationStateChange({
        isPlaying: isAnimationPlaying,
        currentFrame,
        totalFrames,
        hasAnimation: !!animationUrl && totalFrames > 0,
      });
    }
  }, [isAnimationPlaying, currentFrame, totalFrames, animationUrl, onAnimationStateChange]);

  // Aplicar velocidad inicial cuando se carga una nueva animación
  useEffect(() => {
    if (animationActionRef.current && animationSpeed !== 50) {
      handleSpeedChange(animationSpeed);
    }
  }, [totalFrames]); // Ejecutar cuando se carga nueva animación

  // Crear versión del clip sin tracks de posición del root bone para "En el lugar"
  const createInPlaceClip = (originalClip: THREE.AnimationClip): THREE.AnimationClip => {
    if (!rootBoneRef.current) {
      return originalClip; // Si no hay root bone, retornar original
    }

    const rootBoneName = rootBoneRef.current.name;
    console.log(`🔧 Creating in-place version of clip, filtering position tracks for: ${rootBoneName}`);

    // Filtrar todos los tracks de POSICIÓN del root bone
    const filteredTracks = originalClip.tracks.filter(track => {
      // Los tracks de posición tienen nombres como "mixamorigHips.position"
      const isRootPositionTrack = track.name.includes(rootBoneName) && track.name.includes('.position');
      
      if (isRootPositionTrack) {
        console.log(`  ❌ Removing position track: ${track.name}`);
      }
      
      return !isRootPositionTrack; // Mantener todos excepto los de posición del root
    });

    // Crear nuevo clip con los tracks filtrados
    const inPlaceClip = new THREE.AnimationClip(
      originalClip.name + '_inPlace',
      originalClip.duration,
      filteredTracks
    );

    console.log(`✅ In-place clip created: ${originalClip.tracks.length} -> ${filteredTracks.length} tracks`);
    return inPlaceClip;
  };

  // Actualizar animación cuando cambia "En el lugar"
  useEffect(() => {
    if (!animationMixerRef.current || !originalAnimationClipRef.current) {
      return;
    }

    const mixer = animationMixerRef.current;
    const originalClip = originalAnimationClipRef.current;

    // Detener acción actual
    if (animationActionRef.current) {
      const currentTime = animationActionRef.current.time;
      const wasPlaying = isAnimationPlaying;
      
      animationActionRef.current.stop();
      mixer.uncacheClip(animationActionRef.current.getClip());
      animationActionRef.current = null;

      // Crear nueva acción con el clip apropiado
      const clipToUse = inPlace ? createInPlaceClip(originalClip) : originalClip;
      const newAction = mixer.clipAction(clipToUse);
      newAction.reset();
      newAction.setLoop(THREE.LoopRepeat, Infinity);
      newAction.time = currentTime; // Mantener el tiempo actual
      newAction.play();
      
      if (!wasPlaying) {
        newAction.paused = true;
      }
      
      animationActionRef.current = newAction;
      
      console.log(`📍 In-place ${inPlace ? 'enabled' : 'disabled'}: Animation reloaded with ${clipToUse.tracks.length} tracks`);
    }
  }, [inPlace]);

  const handleCaptureSnapshot = () => {
    console.log('📷 Capture button clicked!', {
      hasRenderer: !!rendererRef.current,
      hasCharacterId: !!characterId,
      isPending: updateThumbnailMutation.isPending
    });

    if (!rendererRef.current || !characterId || !sceneRef.current) {
      console.error('❌ Cannot capture - missing renderer or characterId');
      toast({
        title: "Error",
        description: "No se puede capturar la imagen en este momento",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🎨 Starting capture...');
      
      // Renderizar un frame antes de capturar
      if (cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      const canvas = rendererRef.current.domElement;
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('✅ Blob created, size:', blob.size);
          updateThumbnailMutation.mutate(blob);
        } else {
          console.error('❌ Failed to create blob');
        }
      }, 'image/png');
    } catch (error) {
      console.error('❌ Capture error:', error);
      toast({
        title: "Error",
        description: "No se pudo capturar la imagen",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!characterId) {
      console.log('No characterId, skipping 3D viewer initialization');
      return;
    }

    const initViewer = () => {
      if (!containerRef.current) {
        console.log('containerRef not available, retrying...');
        setTimeout(initViewer, 100);
        return;
      }

      if (sceneRef.current) {
        console.log('Scene already initialized');
        return;
      }

      console.log('Initializing 3D viewer...');
      console.log('Container dimensions:', {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });

      try {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);
        sceneRef.current = scene;

        const width = containerRef.current.clientWidth || 500;
        const height = containerRef.current.clientHeight || 600;

        const camera = new THREE.PerspectiveCamera(
          50,
          width / height,
          0.1,
          1000
        );
        camera.position.z = 3;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        setIsRendererReady(true);
        
        console.log('WebGL renderer initialized successfully');
        console.log('Canvas element:', renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.minDistance = 1;
        controls.maxDistance = 10;
        controlsRef.current = controls;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0x00d9ff, 0.5);
        pointLight.position.set(-5, 5, 0);
        scene.add(pointLight);

        // Plano sólido gris debajo de la cuadrícula
        const floorGeometry = new THREE.PlaneGeometry(10, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x3a3a3a,
          roughness: 0.8,
          metalness: 0.2,
        });
        const floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
        floorPlane.rotation.x = -Math.PI / 2; // Rotar para que esté horizontal
        floorPlane.position.y = -2.01; // Ligeramente debajo de la cuadrícula
        floorPlane.receiveShadow = true;
        scene.add(floorPlane);
        floorPlaneRef.current = floorPlane;

        // Cuadrícula encima del plano
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        gridHelper.position.y = -2;
        scene.add(gridHelper);
        gridHelperRef.current = gridHelper;

        const handleResize = () => {
          if (!containerRef.current || !camera || !renderer) return;
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        };

        // Guardar referencia para poder remover el listener más tarde
        resizeHandlerRef.current = handleResize;
        window.addEventListener("resize", handleResize);

        const animate = () => {
          animationFrameRef.current = requestAnimationFrame(animate);
          
          const delta = clockRef.current.getDelta();
          
          if (animationMixerRef.current && isAnimationPlaying) {
            animationMixerRef.current.update(delta);
            
            // Aplicar espacio de brazos usando pose neutral como base
            if (meshRef.current && neutralPoseRef.current.size > 0) {
              // Calcular rotación de los brazos basado en armSpacing
              // 0% = brazos pegados al cuerpo (-30°), 50% = normal (0°), 100% = brazos extendidos (+60°)
              let armAngle: number;
              if (armSpacing < 50) {
                // 0-50 mapea de -30° a 0°
                armAngle = THREE.MathUtils.degToRad(-30 + (armSpacing / 50) * 30);
              } else {
                // 50-100 mapea de 0° a +60°
                armAngle = THREE.MathUtils.degToRad(((armSpacing - 50) / 50) * 60);
              }
              
              meshRef.current.traverse((child) => {
                if ((child as any).isBone) {
                  const bone = child as THREE.Bone;
                  const boneName = bone.name.toLowerCase();
                  const neutralData = neutralPoseRef.current.get(bone);
                  
                  if (!neutralData) return;
                  
                  // Detectar bones de brazos (upper arm / shoulder)
                  if (boneName.includes('shoulder') || boneName.includes('upperarm') || 
                      boneName.includes('arm') && !boneName.includes('forearm') && !boneName.includes('lowerarm')) {
                    
                    // Guardar la rotación actual aplicada por la animación
                    const currentRotation = bone.quaternion.clone();
                    
                    // Aplicar rotación en el eje Z (abrir/cerrar brazos)
                    const isLeftArm = boneName.includes('left') || boneName.includes('_l') || boneName.includes('l_');
                    const rotationAxis = new THREE.Vector3(0, 0, 1); // Eje Z para abrir/cerrar
                    const armRotation = new THREE.Quaternion().setFromAxisAngle(
                      rotationAxis,
                      isLeftArm ? armAngle : -armAngle // Invertir para el brazo derecho
                    );
                    
                    // Aplicar: bone = currentRotation * armRotation
                    // Esto mantiene la animación original y agrega la separación de brazos
                    bone.quaternion.copy(currentRotation).multiply(armRotation);
                  }
                }
              });
            }
            
            // Aplicar factor de entusiasmo a los bones
            if (meshRef.current && animationEnthusiasm !== 50 && neutralPoseRef.current.size > 0) {
              // Calcular factor de escala para el entusiasmo
              // 0 = 0.2x, 50 = 1.0x (normal), 100 = 2.0x
              let enthusiasmFactor: number;
              if (animationEnthusiasm < 50) {
                // 0-50 mapea de 0.2 a 1.0
                enthusiasmFactor = 0.2 + (animationEnthusiasm / 50) * 0.8;
              } else {
                // 50-100 mapea de 1.0 a 2.0
                enthusiasmFactor = 1.0 + ((animationEnthusiasm - 50) / 50) * 1.0;
              }

              meshRef.current.traverse((child) => {
                if ((child as any).isBone) {
                  const bone = child as THREE.Bone;
                  const neutralData = neutralPoseRef.current.get(bone);
                  
                  if (!neutralData) return;
                  
                  // Solo aplicar a bones que no sean el root (para evitar mover todo el modelo)
                  if (bone.parent && (bone.parent as any).isBone) {
                    // Guardar la rotación actual aplicada por la animación
                    const currentRotation = bone.quaternion.clone();
                    const currentPosition = bone.position.clone();
                    
                    if (enthusiasmFactor <= 1.0) {
                      // Valores 0-50%: Interpolar entre pose neutral y pose animada
                      bone.quaternion.slerpQuaternions(
                        neutralData.rotation,
                        currentRotation,
                        enthusiasmFactor
                      );
                      bone.position.lerpVectors(
                        neutralData.position,
                        currentPosition,
                        enthusiasmFactor
                      );
                    } else {
                      // Valores 50-100%: Extrapolar usando axis-angle
                      // Para rotaciones: convertir a axis-angle, escalar el ángulo, reconstruir
                      const axis = new THREE.Vector3();
                      
                      // Calcular delta como: neutral^-1 * current
                      const deltaQ = neutralData.rotation.clone().invert().multiply(currentRotation);
                      deltaQ.normalize();
                      
                      // Extraer axis-angle del delta
                      const halfAngle = Math.acos(Math.max(-1, Math.min(1, deltaQ.w)));
                      const sinHalfAngle = Math.sin(halfAngle);
                      
                      if (sinHalfAngle > 0.0001) { // Evitar divisiones por cero
                        axis.set(
                          deltaQ.x / sinHalfAngle,
                          deltaQ.y / sinHalfAngle,
                          deltaQ.z / sinHalfAngle
                        );
                        
                        // Escalar el ángulo por el factor de entusiasmo
                        const scaledAngle = 2 * halfAngle * enthusiasmFactor;
                        
                        // Reconstruir quaternion escalado
                        const deltaScaled = new THREE.Quaternion();
                        deltaScaled.setFromAxisAngle(axis, scaledAngle);
                        
                        // Aplicar: bone = neutral * deltaScaled
                        bone.quaternion.copy(neutralData.rotation).multiply(deltaScaled);
                      } else {
                        // Si no hay rotación significativa, mantener la rotación neutral
                        bone.quaternion.copy(neutralData.rotation);
                      }
                      
                      // Para posiciones: extrapolar linealmente
                      const delta = currentPosition.clone().sub(neutralData.position);
                      bone.position.copy(neutralData.position).add(delta.multiplyScalar(enthusiasmFactor));
                    }
                  }
                }
              });
            }
            
            // Actualizar el frame actual
            if (animationActionRef.current) {
              const time = animationActionRef.current.time;
              const clip = animationActionRef.current.getClip();
              if (clip) {
                const fps = 30; // Asumimos 30 FPS
                const frame = Math.floor(time * fps);
                setCurrentFrame(frame);
              }
            }
          }
          
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          
          renderer.render(scene, camera);
        };
        animate();
      } catch (error) {
        console.error("WebGL initialization failed:", error);
        setHasWebGL(false);
      }
    };

    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (rendererRef.current && containerRef.current?.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;
      setIsRendererReady(false);
    };

    // Solo inicializar si no existe una escena ya creada
    // Esto permite que el efecto se ejecute cuando characterId cambia de null a un valor
    // pero evita reinicializaciones innecesarias cuando se cambia entre personajes
    if (!sceneRef.current && characterId) {
      initViewer();
    }
    
    // El cleanup solo debe ejecutarse al desmontar el componente
    // No debe ejecutarse cada vez que cambia characterId
    return () => {
      // Solo limpiar si el componente se está desmontando
      // (no cuando solo cambia characterId)
    };
  }, [characterId]); // Mantener characterId para detectar cuando está disponible por primera vez
  
  // Cleanup al desmontar el componente
  useEffect(() => {
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      // Remover el resize listener
      if (resizeHandlerRef.current) {
        window.removeEventListener("resize", resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      if (rendererRef.current && containerRef.current?.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;
      setIsRendererReady(false);
      sceneRef.current = null;
    };
    
    return cleanup;
  }, []); // Solo ejecutar cleanup al desmontar

  useEffect(() => {
    console.log('Model viewer effect triggered:', { characterId, modelUrl, hasWebGL, sceneExists: !!sceneRef.current, isRendererReady });
    
    if (!sceneRef.current || !hasWebGL || !isRendererReady) return;

    const cleanupObject = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    };

    if (meshRef.current) {
      cleanupObject(meshRef.current);
      sceneRef.current.remove(meshRef.current);
      meshRef.current = null;
    }

    const requestId = ++loadRequestIdRef.current;

    if (modelUrl) {
      console.log('✅ modelUrl is defined, loading model from:', modelUrl, 'requestId:', requestId);
      console.log('   File type:', modelUrl.substring(modelUrl.lastIndexOf('.')));
      const extension = modelUrl.toLowerCase().substring(modelUrl.lastIndexOf('.'));
      
      const onLoad = (object: THREE.Object3D) => {
        console.log('Model loaded successfully, requestId:', requestId, 'current:', loadRequestIdRef.current);
        
        if (requestId !== loadRequestIdRef.current) {
          console.log('⚠️ Load request is stale (requestId:', requestId, 'current:', loadRequestIdRef.current, '), aborting and cleaning resources');
          cleanupObject(object);
          return;
        }

        if (!sceneRef.current) {
          console.log('⚠️ Scene was disposed during model loading, aborting');
          return;
        }
        
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const min = box.min;
        
        console.log('Model size:', size);
        console.log('Model center:', center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4 / maxDim;
        object.scale.multiplyScalar(scale);
        
        // Calcular posición para que los pies estén sobre la grilla (y=-2)
        const gridY = -2;
        const scaledMin = min.clone().multiplyScalar(scale);
        const scaledCenter = center.clone().multiplyScalar(scale);
        
        // Posicionar: centrado en X y Z, pero con los pies en el grid
        object.position.set(
          -scaledCenter.x,
          gridY - scaledMin.y, // Los pies del modelo estarán en gridY
          -scaledCenter.z
        );
        
        console.log('Model positioned at:', object.position, 'with feet at grid level:', gridY);
        
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                  m.needsUpdate = true;
                });
              } else {
                child.material.needsUpdate = true;
              }
            }
          }
        });
        
        sceneRef.current.add(object);
        meshRef.current = object as any;
        
        // Capturar la pose neutral del skeleton para el control de entusiasmo
        neutralPoseRef.current.clear();
        rootBoneRef.current = null;
        object.traverse((child) => {
          if ((child as any).isBone) {
            const bone = child as THREE.Bone;
            neutralPoseRef.current.set(bone, {
              position: bone.position.clone(),
              rotation: bone.quaternion.clone(),
            });
            
            // Identificar el bone raíz (hips/pelvis) - es el bone que no tiene parent bone
            const boneName = bone.name.toLowerCase();
            if (!rootBoneRef.current && 
                (boneName.includes('hips') || boneName.includes('pelvis') || boneName.includes('root')) &&
                !(bone.parent as any)?.isBone) {
              rootBoneRef.current = bone;
              console.log(`🦴 Found root bone: ${bone.name}`);
            }
          }
        });
        console.log(`💀 Captured neutral pose for ${neutralPoseRef.current.size} bones`);
        
        if (cameraRef.current) {
          const scaledSize = size.clone().multiplyScalar(scale);
          const distance = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 2.5;
          cameraRef.current.position.set(0, scaledSize.y * 0.3, distance);
          cameraRef.current.lookAt(0, 0, 0);
        }
        
        console.log('Model added to scene');
        
        // Notificar que el modelo se ha cargado completamente
        if (onModelLoaded) {
          console.log('📢 Model loaded, calling onModelLoaded callback');
          onModelLoaded();
        }
      };
      
      const onProgress = (xhr: ProgressEvent) => {
        if (xhr.lengthComputable) {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log('Model loading progress:', percentComplete.toFixed(2) + '%');
        }
      };
      
      const onError = (error: any) => {
        console.error('Error loading model:', error);
        if (requestId !== loadRequestIdRef.current) {
          console.log('⚠️ Error for stale request, ignoring');
          return;
        }
        loadPlaceholder();
        if (onModelLoadError) {
          console.log('📢 Model load error, calling onModelLoadError callback');
          onModelLoadError();
        }
      };
      
      if (extension === '.fbx') {
        const loader = new FBXLoader();
        loader.load(modelUrl, onLoad, onProgress, onError);
      } else if (extension === '.gltf' || extension === '.glb') {
        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => onLoad(gltf.scene), onProgress, onError);
      } else if (extension === '.obj') {
        const loader = new OBJLoader();
        loader.load(modelUrl, onLoad, onProgress, onError);
      } else {
        console.warn('⚠️  Unknown file extension:', extension);
        loadPlaceholder();
      }
    } else {
      console.warn('❌ No modelUrl provided - loading placeholder');
      loadPlaceholder();
    }
    
    function loadPlaceholder() {
      if (!sceneRef.current) return;
      console.log('📦 Loading placeholder box (no 3D model available)');
      const geometry = new THREE.BoxGeometry(1, 1.8, 0.4);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00d9ff,
        metalness: 0.3,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.9;
      
      sceneRef.current.add(mesh);
      meshRef.current = mesh;
    }
  }, [modelUrl, hasWebGL, isRendererReady]); // Recargar cuando cambia el modelo o cuando el renderer está listo

  // Effect para cargar y reproducir animaciones
  useEffect(() => {
    console.log('⚡ Animation effect triggered with URL:', animationUrl);
    
    // Limpiar animación anterior SIEMPRE que cambie el animationUrl
    if (animationActionRef.current) {
      console.log('🧹 Cleaning previous action');
      animationActionRef.current.stop();
      animationActionRef.current.reset();
      animationActionRef.current = null;
    }
    if (animationMixerRef.current && meshRef.current) {
      console.log('🧹 Cleaning previous mixer');
      animationMixerRef.current.stopAllAction();
      animationMixerRef.current.uncacheRoot(meshRef.current);
      animationMixerRef.current = null;
    }
    
    if (!animationUrl || !meshRef.current || !sceneRef.current) {
      console.log('❌ Animation effect: Missing requirements', {
        hasAnimationUrl: !!animationUrl,
        hasMesh: !!meshRef.current,
        hasScene: !!sceneRef.current
      });
      setTotalFrames(0);
      setCurrentFrame(0);
      setAnimationDuration(0);
      return;
    }

    console.log('🎬 Loading NEW animation from:', animationUrl);

    const extension = animationUrl.toLowerCase().substring(animationUrl.lastIndexOf('.'));
    
    const onAnimationLoad = (object: THREE.Group | THREE.Scene) => {
      console.log('📦 Animation loaded successfully:', object);
      
      // Buscar animaciones en el objeto cargado
      const animations = (object as any).animations;
      
      if (!animations || animations.length === 0) {
        console.warn('⚠️  No animations found in file');
        toast({
          title: "Sin animaciones",
          description: "El archivo no contiene animaciones válidas",
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Found ${animations.length} animation(s)`);

      // Reiniciar el reloj para que el delta sea correcto
      clockRef.current.start();

      // Crear nuevo mixer para el modelo actual
      const mixer = new THREE.AnimationMixer(meshRef.current!);
      animationMixerRef.current = mixer;
      console.log('🎭 Created new mixer');

      // Verificar si la animación es compatible (tiene nombres de huesos estándar)
      let clip = animations[0];
      const hasMixamoTracks = clip.tracks.some((track: THREE.KeyframeTrack) => track.name.startsWith('mixamorig'));
      
      if (!hasMixamoTracks) {
        console.warn('❌ Animation is not compatible with this model (different skeleton)');
        toast({
          title: "Animación incompatible",
          description: "Esta animación no es compatible con el modelo actual. Use solo animaciones compatibles.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Animation is compatible with skeleton');
      
      // Guardar el clip original
      originalAnimationClipRef.current = clip;
      
      // Si "En el lugar" está activado, usar versión filtrada
      const clipToUse = inPlace ? createInPlaceClip(clip) : clip;
      
      const action = mixer.clipAction(clipToUse);
      action.reset(); // Reiniciar la acción
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      animationActionRef.current = action;
      
      // Guardar información de la animación
      const fps = 30; // Asumimos 30 FPS
      const duration = clip.duration;
      const frames = Math.floor(duration * fps);
      setTotalFrames(frames);
      setAnimationDuration(duration);
      setCurrentFrame(0);
      setIsAnimationPlaying(true);

      console.log('✅ Animation configured:', clip.name, `Duration: ${duration}s, Frames: ${frames}`);
      console.log('▶️  Animation state:', {
        isPlaying: true,
        paused: action.paused,
        timeScale: action.timeScale,
        weight: action.getEffectiveWeight()
      });
      
      toast({
        title: "Animación cargada",
        description: `Reproduciendo: ${clip.name}`,
      });
    };

    const onError = (error: any) => {
      console.error('❌ Error loading animation:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la animación",
        variant: "destructive",
      });
    };

    // Cargar animación según el tipo de archivo
    if (extension === '.fbx') {
      const loader = new FBXLoader();
      loader.load(animationUrl, onAnimationLoad, undefined, onError);
    } else if (extension === '.gltf' || extension === '.glb') {
      const loader = new GLTFLoader();
      loader.load(animationUrl, (gltf) => {
        onAnimationLoad(gltf.scene);
      }, undefined, onError);
    } else {
      console.warn('⚠️  Unsupported animation file format:', extension);
      toast({
        title: "Formato no soportado",
        description: "Solo se admiten archivos FBX, GLTF y GLB",
        variant: "destructive",
      });
    }
  }, [animationUrl]);

  // Effect para mostrar/ocultar el esqueleto
  useEffect(() => {
    if (!meshRef.current || !sceneRef.current) return;

    // Limpiar skeleton anterior si existe
    if (skeletonHelperRef.current) {
      sceneRef.current.remove(skeletonHelperRef.current);
      skeletonHelperRef.current.dispose();
      skeletonHelperRef.current = null;
    }

    if (showSkeleton) {
      // Buscar el objeto con skeleton
      let skinnedMesh: THREE.SkinnedMesh | null = null;
      meshRef.current.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          skinnedMesh = child;
        }
      });

      if (skinnedMesh) {
        // Crear el skeleton helper
        const skeletonHelper = new THREE.SkeletonHelper(meshRef.current);
        const material = skeletonHelper.material as THREE.LineBasicMaterial;
        material.linewidth = 2;
        material.color.setHex(0x00ff00);
        sceneRef.current.add(skeletonHelper);
        skeletonHelperRef.current = skeletonHelper;
        
        // OCULTAR el modelo cuando se muestra el esqueleto
        meshRef.current.visible = false;
        
        console.log('✅ Skeleton helper added, model hidden');
      } else {
        console.warn('⚠️  No skeleton found in model');
        toast({
          title: "Sin esqueleto",
          description: "Este modelo no tiene un rigging/esqueleto",
          variant: "destructive",
        });
        setShowSkeleton(false);
      }
    } else {
      // MOSTRAR el modelo cuando se oculta el esqueleto
      if (meshRef.current) {
        meshRef.current.visible = true;
      }
    }
  }, [showSkeleton, meshRef.current]);

  // Effect para mostrar/ocultar el grid y el plano
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
    if (floorPlaneRef.current) {
      floorPlaneRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Effect para wireframe mode
  useEffect(() => {
    if (!meshRef.current) return;

    meshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if ('wireframe' in mat) {
              mat.wireframe = wireframeMode;
            }
          });
        } else if ('wireframe' in child.material) {
          child.material.wireframe = wireframeMode;
        }
      }
    });
  }, [wireframeMode]);

  if (!hasWebGL) {
    return (
      <Card className="h-full overflow-hidden bg-card border-border flex flex-col">
        {characterId && characterName && (
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground" data-testid="text-viewer-title">
              {characterName}
            </h3>
            <p className="text-sm text-muted-foreground">Visualizador 3D</p>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <p className="text-muted-foreground mb-2">WebGL no disponible</p>
            <p className="text-sm text-muted-foreground">
              El visualizador 3D requiere soporte WebGL
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!characterId) {
    return (
      <Card className="h-full flex items-center justify-center bg-card border-border">
        <div className="text-center p-8">
          <p className="text-muted-foreground mb-2">Selecciona un personaje</p>
          <p className="text-sm text-muted-foreground">
            Haz clic en cualquier personaje de la galería para visualizarlo en 3D
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden bg-card border-border flex flex-col">
      {/* Header con título y botón de captura */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground" data-testid="text-viewer-title">
            {characterName || "Modelo 3D"}
          </h3>
          <p className="text-sm text-muted-foreground">Visualizador 3D</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCaptureSnapshot}
          disabled={updateThumbnailMutation.isPending || !isRendererReady}
          title="Capturar miniatura"
          data-testid="button-capture-viewer-thumbnail"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas y Panel de Botones */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas 3D */}
        <div className="flex-1 relative">
          <div 
            ref={containerRef} 
            className="w-full h-full"
            data-testid="viewer-3d-canvas"
          />
          
          {/* Controles flotantes (grid, wireframe, reset camera) */}
          <div className="absolute left-2 top-2 flex flex-col gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowGrid(!showGrid)}
              className={`bg-background/80 backdrop-blur-sm ${showGrid ? 'bg-primary/20' : ''}`}
              title="Mostrar/Ocultar Grid"
              data-testid="button-toggle-grid"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setWireframeMode(!wireframeMode)}
              className={`bg-background/80 backdrop-blur-sm ${wireframeMode ? 'bg-primary/20' : ''}`}
              title="Modo Wireframe"
              data-testid="button-toggle-wireframe"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (cameraRef.current && meshRef.current) {
                  const box = new THREE.Box3().setFromObject(meshRef.current);
                  const size = box.getSize(new THREE.Vector3());
                  const distance = Math.max(size.x, size.y, size.z) * 2.5;
                  cameraRef.current.position.set(0, size.y * 0.3, distance);
                  cameraRef.current.lookAt(0, 0, 0);
                  if (controlsRef.current) {
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                  }
                }
              }}
              className="bg-background/80 backdrop-blur-sm"
              title="Resetear cámara"
              data-testid="button-reset-camera"
            >
              <Sun className="h-4 w-4" />
            </Button>
            
            <Button
              size="icon"
              variant={showSkeleton ? "default" : "ghost"}
              onClick={() => setShowSkeleton(!showSkeleton)}
              title="Mostrar/Ocultar Esqueleto"
              data-testid="button-toggle-skeleton"
              className={`bg-background/80 backdrop-blur-sm ${showSkeleton ? 'bg-primary/20' : ''}`}
            >
              <Skull className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
});
