import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three-stdlib';
import { GLTFLoader } from 'three-stdlib';
import { OrbitControls } from 'three-stdlib';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AnimationThumbnailCaptureProps {
  animationId: string;
  animationUrl?: string;
  onCapture?: () => void;
}

export function AnimationThumbnailCapture({ 
  animationId, 
  animationUrl,
  onCapture 
}: AnimationThumbnailCaptureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const animationMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationActionRef = useRef<THREE.AnimationAction | null>(null);
  const rootBoneRef = useRef<THREE.Bone | null>(null);
  const originalAnimationClipRef = useRef<THREE.AnimationClip | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const frameIdRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webGLError, setWebGLError] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [inPlace, setInPlace] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Modelo base - usar un modelo existente del sistema
  const baseFemaleModelUrl = '/uploads/model-1761069436401-683664055.fbx';

  const updateThumbnailMutation = useMutation({
    mutationFn: async (thumbnailBlob: Blob) => {
      const formData = new FormData();
      formData.append('thumbnail', thumbnailBlob, 'thumbnail.webm');

      const response = await fetch(`/api/animations/${animationId}/thumbnail`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update thumbnail');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animations'] });
      toast({
        title: "Thumbnail actualizado",
        description: "La vista previa de la animación se ha actualizado correctamente",
      });
      onCapture?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el thumbnail",
        variant: "destructive",
      });
    },
  });

  // Crear versión del clip sin tracks de posición del root bone para "En el lugar"
  const createInPlaceClip = (originalClip: THREE.AnimationClip): THREE.AnimationClip => {
    if (!rootBoneRef.current) {
      return originalClip; // Si no hay root bone, retornar original
    }

    const rootBoneName = rootBoneRef.current.name;
    console.log(`🔧 [Thumbnail] Creating in-place version of clip, filtering position tracks for: ${rootBoneName}`);

    // Filtrar todos los tracks de POSICIÓN del root bone
    const filteredTracks = originalClip.tracks.filter(track => {
      // Los tracks de posición tienen nombres como "mixamorigHips.position"
      const isRootPositionTrack = track.name.includes(rootBoneName) && track.name.includes('.position');
      
      if (isRootPositionTrack) {
        console.log(`  ❌ [Thumbnail] Removing position track: ${track.name}`);
      }
      
      return !isRootPositionTrack; // Mantener todos excepto los de posición del root
    });

    // Crear nuevo clip con los tracks filtrados
    const inPlaceClip = new THREE.AnimationClip(
      originalClip.name + '_InPlace',
      originalClip.duration,
      filteredTracks
    );

    console.log(`✅ [Thumbnail] In-place clip created: ${originalClip.tracks.length} -> ${filteredTracks.length} tracks`);
    return inPlaceClip;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Configurar escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Configurar cámara
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    // Posicionar cámara para ver modelo completo (pies en y=-2, cabeza en y~0)
    camera.position.set(0, -0.5, 3.5); // Vista frontal, ligeramente más atrás
    camera.lookAt(0, -1, 0); // Mirar al centro del modelo
    cameraRef.current = camera;
    
    console.log('📷 Camera positioned at:', camera.position, 'looking at: (0, -1, 0)');

    // Configurar renderer con manejo de errores para entornos sin WebGL
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(400, 400);
      renderer.shadowMap.enabled = true;
      
      // Asegurar que el canvas se ajuste al contenedor
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      
      console.log('✅ Thumbnail renderer initialized with size 400x400');
    } catch (error) {
      console.error('Error creating WebGL renderer:', error);
      setWebGLError(true);
      return;
    }

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xe0e0e0);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // Configurar OrbitControls para permitir rotación del modelo
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -1, 0); // Apuntar al centro del modelo
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.enablePan = true;
    controls.enableZoom = true;
    controlsRef.current = controls;
    
    console.log('🎮 OrbitControls configurados para rotación libre del modelo');

    // Cargar modelo base femenino
    console.log('🎨 Attempting to load base female model from:', baseFemaleModelUrl);
    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      baseFemaleModelUrl,
      (object) => {
        console.log('✅ Base female model loaded successfully');
        
        // Calcular tamaño del modelo
        const bbox = new THREE.Box3().setFromObject(object);
        const size = bbox.getSize(new THREE.Vector3());
        console.log('📐 Model size before scaling:', size);
        
        // Escalar para que sea visible (aprox 2 unidades de alto)
        const targetHeight = 2;
        const scale = targetHeight / size.y;
        object.scale.setScalar(scale);
        
        // Recalcular bbox con escala aplicada
        const scaledBbox = new THREE.Box3().setFromObject(object);
        const scaledSize = scaledBbox.getSize(new THREE.Vector3());
        const scaledMin = scaledBbox.min;
        
        // Posicionar con pies en el grid (y=-2)
        object.position.set(0, -2 - scaledMin.y, 0);
        
        console.log('📐 Model scaled to:', scaledSize);
        console.log('📍 Model positioned at:', object.position);
        
        scene.add(object);
        meshRef.current = object;

        // Si hay animación, cargarla
        if (animationUrl) {
          loadAnimation(animationUrl, object);
        } else {
          setIsReady(true);
        }
      },
      (progress) => {
        console.log('📥 Loading base model:', Math.round((progress.loaded / progress.total) * 100) + '%');
      },
      (error) => {
        console.error('❌ Error loading base female model:', error);
        console.log('💡 Creating placeholder model instead');
        
        console.warn('⚠️ Error loading base model, creating placeholder');
        toast({
          title: "Error al cargar modelo base",
          description: "Se usará un placeholder para la vista previa. La captura funcionará de todas formas.",
        });
        
        // Si falla, crear un placeholder simple pero BIEN VISIBLE
        const group = new THREE.Group();
        
        // Cuerpo principal
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x00d9ff,
          metalness: 0.3,
          roughness: 0.6,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0; // Centrado en el origen
        group.add(body);
        
        // Cabeza
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 0.95;
        group.add(head);
        
        // Posicionar el grupo completo con pies en el grid
        group.position.set(0, -2 + 0.8, 0); // Elevar para que los pies estén en y=-2
        
        console.log('✅ Placeholder model created at:', group.position);
        
        scene.add(group);
        meshRef.current = group;
        
        // Si hay animación, intentar cargarla aunque el modelo base falló
        if (animationUrl) {
          loadAnimation(animationUrl, group);
        } else {
          setIsReady(true);
        }
      }
    );

    // Loop de renderizado
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      if (animationMixerRef.current) {
        const delta = clockRef.current.getDelta();
        animationMixerRef.current.update(delta);
      }
      
      // Actualizar controles para damping suave
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  const loadAnimation = (url: string, mesh: THREE.Group) => {
    const extension = url.toLowerCase().substring(url.lastIndexOf('.'));

    const onAnimationLoad = (object: THREE.Group | THREE.Scene) => {
      const animations = (object as any).animations;
      
      if (!animations || animations.length === 0) {
        console.warn('No animations found');
        setIsReady(true);
        return;
      }

      // Verificar compatibilidad de la animación
      let clip = animations[0];
      const hasMixamoTracks = clip.tracks.some((track: THREE.KeyframeTrack) => track.name.startsWith('mixamorig'));
      
      if (!hasMixamoTracks) {
        console.warn('Animation is not compatible (different skeleton), skipping thumbnail');
        setIsReady(true);
        return;
      }

      // Detectar el root bone (Hips) del modelo
      let foundRootBone: THREE.Bone | undefined;
      mesh.traverse((child: THREE.Object3D) => {
        if (!foundRootBone && child instanceof THREE.Bone && child.name.includes('Hips')) {
          foundRootBone = child;
        }
      });
      
      if (foundRootBone) {
        rootBoneRef.current = foundRootBone;
        console.log('🦴 [Thumbnail] Root bone found:', foundRootBone.name);
      } else {
        console.warn('⚠️ [Thumbnail] No root bone found, in-place mode will not work');
      }

      // Limpiar mixer anterior
      if (animationMixerRef.current) {
        animationMixerRef.current.stopAllAction();
        animationMixerRef.current = null;
      }

      // Crear nuevo mixer
      const mixer = new THREE.AnimationMixer(mesh);
      animationMixerRef.current = mixer;

      // Guardar el clip original
      originalAnimationClipRef.current = clip;
      
      // Si "En el lugar" está activado, usar versión filtrada
      const clipToUse = inPlace ? createInPlaceClip(clip) : clip;

      // Reproducir primera animación
      const action = mixer.clipAction(clipToUse);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      animationActionRef.current = action;

      // Adelantar a un frame interesante (30% de la animación)
      const targetTime = clipToUse.duration * 0.3;
      mixer.setTime(targetTime);

      console.log(`✅ [Thumbnail] Animation loaded with ${inPlace ? 'in-place' : 'normal'} mode`);
      setIsReady(true);
    };

    if (extension === '.fbx') {
      const loader = new FBXLoader();
      loader.load(url, onAnimationLoad);
    } else if (extension === '.gltf' || extension === '.glb') {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => onAnimationLoad(gltf.scene));
    } else {
      setIsReady(true);
    }
  };

  useEffect(() => {
    if (animationUrl && meshRef.current) {
      loadAnimation(animationUrl, meshRef.current);
    }
  }, [animationUrl]);

  // Actualizar animación cuando cambia "En el lugar"
  useEffect(() => {
    if (!animationMixerRef.current || !originalAnimationClipRef.current || !meshRef.current) {
      return;
    }

    const mixer = animationMixerRef.current;
    const originalClip = originalAnimationClipRef.current;

    // Detener acción actual
    if (animationActionRef.current) {
      const currentTime = animationActionRef.current.time;
      const wasPlaying = !animationActionRef.current.paused;
      
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
      
      console.log(`📍 [Thumbnail] In-place ${inPlace ? 'enabled' : 'disabled'}: Animation reloaded with ${clipToUse.tracks.length} tracks`);
    }
  }, [inPlace]);

  const handleCapture = async () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !animationMixerRef.current) {
      toast({
        title: "Error",
        description: "El renderizador no está listo o no hay animación",
        variant: "destructive",
      });
      return;
    }

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const mixer = animationMixerRef.current;
    const canvas = renderer.domElement;

    setIsCapturing(true);
    recordedChunksRef.current = [];

    try {
      console.log('🎬 Iniciando captura de video...');
      
      // Capturar el stream del canvas
      const stream = canvas.captureStream(30); // 30 fps
      
      // Crear MediaRecorder con opciones de video
      const options = { 
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      };
      
      // Fallback si vp9 no está disponible
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Manejar datos disponibles
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Cuando termine la grabación
      mediaRecorder.onstop = () => {
        console.log('✅ Grabación completada');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        console.log('📦 Video blob creado:', blob.size, 'bytes');
        
        // Subir el video
        updateThumbnailMutation.mutate(blob);
        setIsCapturing(false);
        
        // Limpiar
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
      };

      // Iniciar grabación
      mediaRecorder.start();
      console.log('▶️ Grabación iniciada');

      // Resetear animación al inicio
      mixer.setTime(0);
      
      // Calcular duración dinámica basada en los frames de la animación
      // Si la animación tiene una acción, obtener su duración
      const animationDuration = animationActionRef.current?.getClip().duration || 2;
      const frames = Math.round(animationDuration * 30); // Calcular frames a 30 fps
      const recordDuration = (frames / 30) * 1000; // Convertir a milisegundos
      
      console.log('🎬 Configuración de grabación:', {
        animationDuration: animationDuration.toFixed(2) + 's',
        frames,
        recordDuration: (recordDuration / 1000).toFixed(2) + 's'
      });
      
      const startTime = Date.now();
      
      // Animar durante la grabación
      const animateForRecording = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed < recordDuration) {
          // Actualizar animación
          const delta = clockRef.current.getDelta();
          mixer.update(delta);
          
          // Renderizar
          renderer.render(scene, camera);
          
          // Continuar
          requestAnimationFrame(animateForRecording);
        } else {
          // Detener grabación
          console.log('⏹️ Deteniendo grabación...');
          mediaRecorder.stop();
          
          // Detener el stream
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      // Iniciar el loop de animación para grabación
      clockRef.current.start();
      animateForRecording();

    } catch (error) {
      console.error('❌ Error al capturar video:', error);
      toast({
        title: "Error al capturar video",
        description: "No se pudo grabar la animación. Tu navegador podría no soportar esta función.",
        variant: "destructive",
      });
      setIsCapturing(false);
    }
  };

  if (webGLError) {
    return (
      <div className="space-y-2">
        <div 
          className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center p-8 text-center"
          style={{ maxWidth: '400px', margin: '0 auto' }}
        >
          <p className="text-muted-foreground">
            WebGL no está disponible en este navegador. La generación de thumbnails requiere soporte de WebGL.
          </p>
        </div>
        <Button
          disabled
          className="w-full"
          data-testid="button-capture-animation-thumbnail"
        >
          <Camera className="w-4 h-4 mr-2" />
          Capturar Thumbnail (No disponible)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef} 
        className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
        style={{ maxWidth: '400px', margin: '0 auto' }}
      />
      <p className="text-sm text-muted-foreground text-center">
        Rota el modelo con el mouse para elegir el ángulo de grabación
      </p>
      <div className="flex items-center gap-2 justify-center p-2 border rounded-lg">
        <Checkbox
          id="thumbnail-in-place"
          checked={inPlace}
          onCheckedChange={(checked) => setInPlace(checked === true)}
          data-testid="checkbox-thumbnail-in-place"
        />
        <Label 
          htmlFor="thumbnail-in-place" 
          className="text-sm font-normal cursor-pointer"
        >
          En el lugar (sin movimiento de cámara)
        </Label>
      </div>
      <Button
        onClick={handleCapture}
        disabled={!isReady || isCapturing || updateThumbnailMutation.isPending}
        className="w-full"
        data-testid="button-capture-animation-thumbnail"
      >
        <Camera className="w-4 h-4 mr-2" />
        {isCapturing 
          ? 'Grabando Video...' 
          : updateThumbnailMutation.isPending 
            ? 'Guardando...' 
            : 'Capturar Video Animado'}
      </Button>
    </div>
  );
}
