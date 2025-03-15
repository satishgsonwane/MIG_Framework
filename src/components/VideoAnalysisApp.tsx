"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Spinner from "@/components/ui/spinner";
import { Square, Play, Pause, Trash2, Info, HelpCircle, Upload, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  HoverCard, 
  HoverCardContent, 
  HoverCardTrigger 
} from "@/components/ui/hover-card";


interface JointType {
  id: string;
  name: string;
  description: string;
}

// Add to existing interfaces
interface ROIAnalysis {
  roi1Image: string | null;
  roi2Image: string | null;
}

// Add these interfaces at the top with other interfaces
interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ROIState {
  start: { x: number; y: number } | null;
  current: ROI | null;
  isSelecting: boolean;
}

interface WeldParameter {
  id: string;
  name: string;
  unit: string;
  options: string[];
}

const jointTypes: JointType[] = [
  { id: 'lap', name: 'Lap Joint', description: 'Overlapping joint connection' },
  { id: 'butt', name: 'Butt Joint', description: 'End to end joint connection' },
  { id: 'tee', name: 'T Joint', description: 'Perpendicular joint connection' },
  { id: 'corner', name: 'Corner Joint', description: '90-degree angle joint' },
];


const weldParameters: WeldParameter[] = [
  {
    id: 'material',
    name: 'Welding Material',
    unit: '',
    options: ['Mild Steel', 'Stainless Steel', 'Aluminum', 'Nickel Alloy']
  },
  {
    id: 'current',
    name: 'Welding Current',
    unit: 'A',
    options: ['50', '100', '150', '200', '250', '300', '350', '400']
  },
  {
    id: 'voltage',
    name: 'Welding Voltage',
    unit: 'V',
    options: ['15', '18', '21', '24', '27', '30', '33', '36']
  },
  {
    id: 'speed',
    name: 'Welding Speed',
    unit: 'mm/s',
    options: ['2', '4', '6', '8', '10', '12', '14', '16']
  },
  {
    id: 'wireFeedSpeed',
    name: 'Wire Feed Speed',
    unit: 'm/min',
    options: ['2', '4', '6', '8', '10', '12', '14', '16']
  },
  {
    id: 'gasFlow',
    name: 'Gas Flow',
    unit: 'L/min',
    options: ['8', '10', '12', '14', '16', '18', '20', '22']
  },
  {
    id: 'wireDiameter',
    name: 'Wire Diameter',
    unit: 'mm',
    options: ['0.8', '1.0', '1.2', '1.6']
  }
];

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  aspectRatio: 16/9,
  frameRate: { ideal: 60, min: 30 }
} as MediaTrackConstraints;

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;


const VideoAnalysisApp: React.FC = () => {
  // Camera device states
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera1, setSelectedCamera1] = useState<string>("default");
  const [selectedCamera2, setSelectedCamera2] = useState<string>("default");
  
  // Stream states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStream2Active, setIsStream2Active] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // ROI states
  const [roi1State, setRoi1State] = useState<ROIState>({
    start: null,
    current: null,
    isSelecting: false
  });
  const [roi2State, setRoi2State] = useState<ROIState>({
    start: null,
    current: null,
    isSelecting: false
  });
  
  // Other states
  const [error, setError] = useState('');
  const [jointType, setJointType] = useState(jointTypes[0].id);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);
  const [roiAnalysis, setRoiAnalysis] = useState<ROIAnalysis>({
    roi1Image: null,
    roi2Image: null
  });
  
  // Weld parameter states
  const [weldParams, setWeldParams] = useState<Record<string, string>>(() => 
    Object.fromEntries(weldParameters.map(param => [param.id, param.options[0]]))
  );

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  // const roiStartRef = useRef<{ x: number; y: number } | null>(null);

  // Add state for imported images
  const [importedImage1, setImportedImage1] = useState<string | null>(null);
  const [importedImage2, setImportedImage2] = useState<string | null>(null);
  
  // Add refs for file inputs
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  // Create refs for cached images
  const cachedImage1Ref = useRef<HTMLImageElement | null>(null);
  const cachedImage2Ref = useRef<HTMLImageElement | null>(null);
  
  // Add these new states for analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    predictedClass: string;
    confidence: number | null;
  } | null>(null);
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  
  // Add these new states for edge detection
  const [showEdgeDetectionConfirm, setShowEdgeDetectionConfirm] = useState(false);
  const [isRunningEdgeDetection, setIsRunningEdgeDetection] = useState(false);
  const [edgeDetectionResult, setEdgeDetectionResult] = useState<string | null>(null);
  const [savedImagePath, setSavedImagePath] = useState<string | null>(null);
  
  // Effect for getting cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices);
        setCameras(videoDevices);
        
        if (videoDevices.length > 0 && videoDevices[0].deviceId) {
          setSelectedCamera1(videoDevices[0].deviceId);
        }
        if (videoDevices.length > 1 && videoDevices[1].deviceId) {
          setSelectedCamera2(videoDevices[1].deviceId);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        setError('Failed to get camera devices. Please check permissions.');
      }
    };

    getCameras();
    navigator.mediaDevices.addEventListener('devicechange', getCameras);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getCameras);
    };
  }, []);

  // Effect to cache imported images
  useEffect(() => {
    if (importedImage1) {
      const img = document.createElement('img');
      img.onload = () => {
        cachedImage1Ref.current = img;
      };
      img.src = importedImage1;
    } else {
      cachedImage1Ref.current = null;
    }
  }, [importedImage1]);
  
  useEffect(() => {
    if (importedImage2) {
      const img = document.createElement('img');
      img.onload = () => {
        cachedImage2Ref.current = img;
      };
      img.src = importedImage2;
    } else {
      cachedImage2Ref.current = null;
    }
  }, [importedImage2]);

  const captureROI = (isFirst: boolean) => {
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    const roiState = isFirst ? roi1State.current : roi2State.current;
    const video = isFirst ? videoRef.current : video2Ref.current;
    const isVideoActive = isFirst ? isStreaming : isStream2Active;
    const importedImage = isFirst ? importedImage1 : importedImage2;
    const cachedImage = isFirst ? cachedImage1Ref.current : cachedImage2Ref.current;
    
    if (!canvas || !roiState) return;
    
    try {
      // Create a temporary canvas to capture the ROI
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = roiState.width;
      tempCanvas.height = roiState.height;
      
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      // Draw directly from the source (video or image) to avoid capturing the blue tint
      if (video && isVideoActive) {
        // Calculate scale to maintain aspect ratio
        const scale = Math.min(
          canvas.width / video.videoWidth,
          canvas.height / video.videoHeight
        );
        
        // Calculate the position of the video on the canvas
        const x = (canvas.width - video.videoWidth * scale) / 2;
        const y = (canvas.height - video.videoHeight * scale) / 2;
        
        // Calculate the source coordinates in the video
        const sourceX = (roiState.x - x) / scale;
        const sourceY = (roiState.y - y) / scale;
        const sourceWidth = roiState.width / scale;
        const sourceHeight = roiState.height / scale;
        
        // Draw only the ROI portion from the video
        tempCtx.drawImage(
          video,
          Math.max(0, sourceX), 
          Math.max(0, sourceY),
          Math.min(video.videoWidth, sourceWidth),
          Math.min(video.videoHeight, sourceHeight),
          0, 0,
          roiState.width,
          roiState.height
        );
      } else if (importedImage && cachedImage) {
        // Calculate scale to maintain aspect ratio
        const scale = Math.min(
          canvas.width / cachedImage.width,
          canvas.height / cachedImage.height
        );
        
        // Calculate the position of the image on the canvas
        const x = (canvas.width - cachedImage.width * scale) / 2;
        const y = (canvas.height - cachedImage.height * scale) / 2;
        
        // Calculate the source coordinates in the image
        const sourceX = (roiState.x - x) / scale;
        const sourceY = (roiState.y - y) / scale;
        const sourceWidth = roiState.width / scale;
        const sourceHeight = roiState.height / scale;
        
        // Draw only the ROI portion from the image
        tempCtx.drawImage(
          cachedImage,
          Math.max(0, sourceX), 
          Math.max(0, sourceY),
          Math.min(cachedImage.width, sourceWidth),
          Math.min(cachedImage.height, sourceHeight),
          0, 0,
          roiState.width,
          roiState.height
        );
      }
      
      // Convert to data URL
      const dataUrl = tempCanvas.toDataURL('image/png');
      
      // Update ROI analysis state
      setRoiAnalysis(prev => ({
        ...prev,
        [isFirst ? 'roi1Image' : 'roi2Image']: dataUrl
      }));
    } catch (err) {
      console.error('Error capturing ROI:', err);
      setError('Failed to capture ROI');
    }
  };
  
  // Add function to handle image import
  const handleImageImport = (isFirst: boolean, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      if (isFirst) {
        // Stop any active stream
        if (isStreaming && videoRef.current?.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
          setIsStreaming(false);
        }
        
        // Set imported image state
        setImportedImage1(result);
        
        // Set canvas dimensions to match the standard dimensions
        if (canvasRef.current) {
          canvasRef.current.width = CANVAS_WIDTH;
          canvasRef.current.height = CANVAS_HEIGHT;
        }
        
        // Reset ROI state
        setRoi1State({ start: null, current: null, isSelecting: false });
      } else {
        // Stop any active stream
        if (isStream2Active && video2Ref.current?.srcObject) {
          const tracks = (video2Ref.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          video2Ref.current.srcObject = null;
          setIsStream2Active(false);
        }
        
        // Set imported image state
        setImportedImage2(result);
        
        // Set canvas dimensions to match the standard dimensions
        if (canvas2Ref.current) {
          canvas2Ref.current.width = CANVAS_WIDTH;
          canvas2Ref.current.height = CANVAS_HEIGHT;
        }
        
        // Reset ROI state
        setRoi2State({ start: null, current: null, isSelecting: false });
      }
      
      // Reset file input
      if (isFirst && fileInput1Ref.current) {
        fileInput1Ref.current.value = '';
      } else if (!isFirst && fileInput2Ref.current) {
        fileInput2Ref.current.value = '';
      }
    };
    
    reader.onerror = () => {
      setError('Error reading the image file');
    };
    
    reader.readAsDataURL(file);
  };
  
  // Add function to clear imported image
  const clearImportedImage = (isFirst: boolean) => {
    if (isFirst) {
      setImportedImage1(null);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      setRoi1State({ start: null, current: null, isSelecting: false });
      setRoiAnalysis(prev => ({ ...prev, roi1Image: null }));
    } else {
      setImportedImage2(null);
      if (canvas2Ref.current) {
        const ctx = canvas2Ref.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas2Ref.current.width, canvas2Ref.current.height);
        }
      }
      setRoi2State({ start: null, current: null, isSelecting: false });
      setRoiAnalysis(prev => ({ ...prev, roi2Image: null }));
    }
  };
  
  const toggleStream = async () => {
    // Clear imported image if exists
    if (importedImage1) {
      clearImportedImage(true);
    }
    
    if (isStreaming) {
      if (videoRef.current?.srcObject) {
        // Capture the last frame before stopping the stream
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext('2d', {
            alpha: false,
            desynchronized: true
          });
          
          if (ctx) {
            // Clear the canvas first to prevent artifacts
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            // Calculate scale to maintain aspect ratio
            const scale = Math.min(
              canvasRef.current.width / videoRef.current.videoWidth,
              canvasRef.current.height / videoRef.current.videoHeight
            );
            
            // Center the video in canvas
            const x = (canvasRef.current.width - videoRef.current.videoWidth * scale) / 2;
            const y = (canvasRef.current.height - videoRef.current.videoHeight * scale) / 2;

            // Draw the last video frame
            ctx.drawImage(
              videoRef.current,
              0, 0,
              videoRef.current.videoWidth,
              videoRef.current.videoHeight,
              x, y,
              videoRef.current.videoWidth * scale,
              videoRef.current.videoHeight * scale
            );
          }
        }
        
        // Stop the stream
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setRoi1State({ start: null, current: null, isSelecting: false });
        setIsStreaming(false);
      }
      return;
    }
  
    if (!selectedCamera1 || selectedCamera1 === "default") {
      setError('Please select a camera first');
      return;
    }
  
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...VIDEO_CONSTRAINTS,
          deviceId: { exact: selectedCamera1 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            videoRef.current.play();
            canvasRef.current.width = CANVAS_WIDTH;
            canvasRef.current.height = CANVAS_HEIGHT;
          }
        };
      }
      setIsStreaming(true);
      setError('');
    } catch (err) {
      console.log("ERROR: ", err)
      setError('Unable to access first camera. Please check permissions.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleStream2 = async () => {
    // Clear imported image if exists
    if (importedImage2) {
      clearImportedImage(false);
    }
    
    if (isStream2Active) {
      if (video2Ref.current?.srcObject) {
        // Capture the last frame before stopping the stream
        if (canvas2Ref.current && video2Ref.current) {
          const ctx = canvas2Ref.current.getContext('2d', {
            alpha: false,
            desynchronized: true
          });
          
          if (ctx) {
            // Clear the canvas first to prevent artifacts
            ctx.clearRect(0, 0, canvas2Ref.current.width, canvas2Ref.current.height);
            
            // Calculate scale to maintain aspect ratio
            const scale = Math.min(
              canvas2Ref.current.width / video2Ref.current.videoWidth,
              canvas2Ref.current.height / video2Ref.current.videoHeight
            );
            
            // Center the video in canvas
            const x = (canvas2Ref.current.width - video2Ref.current.videoWidth * scale) / 2;
            const y = (canvas2Ref.current.height - video2Ref.current.videoHeight * scale) / 2;

            // Draw the last video frame
            ctx.drawImage(
              video2Ref.current,
              0, 0,
              video2Ref.current.videoWidth,
              video2Ref.current.videoHeight,
              x, y,
              video2Ref.current.videoWidth * scale,
              video2Ref.current.videoHeight * scale
            );
          }
        }
        
        // Stop the stream
        const tracks = (video2Ref.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        video2Ref.current.srcObject = null;
        setRoi2State({ start: null, current: null, isSelecting: false });
        setIsStream2Active(false);
      }
      return;
    }
  
    if (!selectedCamera2 || selectedCamera2 === "default") {
      setError('Please select a camera first');
      return;
    }
  
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...VIDEO_CONSTRAINTS,
          deviceId: { exact: selectedCamera2 }
        }
      });
      
      if (video2Ref.current) {
        video2Ref.current.srcObject = stream;
        video2Ref.current.onloadedmetadata = () => {
          if (video2Ref.current && canvas2Ref.current) {
            video2Ref.current.play();
            canvas2Ref.current.width = CANVAS_WIDTH;
            canvas2Ref.current.height = CANVAS_HEIGHT;
          }
        };
      }
      setIsStream2Active(true);
      setError('');
    } catch (err) {
      console.log("Error: ", err);
      setError('Unable to access second camera.');
    } finally {
      setIsLoading(false);
    }
  };

  // Canvas handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    const roiState = isFirst ? roi1State : roi2State;
    if (!roiState.isSelecting) return;
    
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    const video = isFirst ? videoRef.current : video2Ref.current;
    const importedImage = isFirst ? importedImage1 : importedImage2;
    
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // For video streams
    if ((isFirst && isStreaming && video) || (!isFirst && isStream2Active && video)) {
      // Calculate video display dimensions
      const scale = Math.min(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
      );
      const videoDisplayWidth = video.videoWidth * scale;
      const videoDisplayHeight = video.videoHeight * scale;
      const xOffset = (canvas.width - videoDisplayWidth) / 2;
      const yOffset = (canvas.height - videoDisplayHeight) / 2;
      
      // Adjust coordinates to account for video position
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Check if click is within video bounds
      if (x < xOffset || x > xOffset + videoDisplayWidth || 
          y < yOffset || y > yOffset + videoDisplayHeight) {
        return;
      }

      const startPoint = { x, y };
      
      if (isFirst) {
        setRoi1State({
          start: startPoint,
          current: {
            x: startPoint.x,
            y: startPoint.y,
            width: 1,
            height: 1
          },
          isSelecting: true
        });
      } else {
        setRoi2State({
          start: startPoint,
          current: {
            x: startPoint.x,
            y: startPoint.y,
            width: 1,
            height: 1
          },
          isSelecting: true
        });
      }
    }
    // For imported images
    else if (importedImage) {
      // Get coordinates within canvas
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const startPoint = { x, y };
      
      if (isFirst) {
        setRoi1State({
          start: startPoint,
          current: {
            x: startPoint.x,
            y: startPoint.y,
            width: 1,
            height: 1
          },
          isSelecting: true
        });
      } else {
        setRoi2State({
          start: startPoint,
          current: {
            x: startPoint.x,
            y: startPoint.y,
            width: 1,
            height: 1
          },
          isSelecting: true
        });
      }
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    const roiState = isFirst ? roi1State : roi2State;
    if (!roiState.isSelecting || !roiState.start) return;
  
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    const video = isFirst ? videoRef.current : video2Ref.current;
    const importedImage = isFirst ? importedImage1 : importedImage2;
    
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // For video streams
    if ((isFirst && isStreaming && video) || (!isFirst && isStream2Active && video)) {
      // Calculate video display dimensions
      const scale = Math.min(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
      );
      const videoDisplayWidth = video.videoWidth * scale;
      const videoDisplayHeight = video.videoHeight * scale;
      const xOffset = (canvas.width - videoDisplayWidth) / 2;
      const yOffset = (canvas.height - videoDisplayHeight) / 2;
      
      const currentX = Math.max(xOffset, Math.min((e.clientX - rect.left) * scaleX, xOffset + videoDisplayWidth));
      const currentY = Math.max(yOffset, Math.min((e.clientY - rect.top) * scaleY, yOffset + videoDisplayHeight));

      // Calculate width and height based on start and current position
      const width = Math.abs(currentX - roiState.start.x);
      const height = Math.abs(currentY - roiState.start.y);
      
      // Calculate top-left corner of the rectangle
      const x = Math.min(roiState.start.x, currentX);
      const y = Math.min(roiState.start.y, currentY);

      const newROI = {
        x,
        y,
        width,
        height
      };
    
      if (isFirst) {
        setRoi1State(prev => ({ ...prev, current: newROI }));
      } else {
        setRoi2State(prev => ({ ...prev, current: newROI }));
      }
    }
    // For imported images
    else if (importedImage) {
      // Get coordinates within canvas with bounds checking
      const currentX = Math.max(0, Math.min((e.clientX - rect.left) * scaleX, canvas.width));
      const currentY = Math.max(0, Math.min((e.clientY - rect.top) * scaleY, canvas.height));

      // Calculate width and height based on start and current position
      const width = Math.abs(currentX - roiState.start.x);
      const height = Math.abs(currentY - roiState.start.y);
      
      // Calculate top-left corner of the rectangle
      const x = Math.min(roiState.start.x, currentX);
      const y = Math.min(roiState.start.y, currentY);

      const newROI = {
        x,
        y,
        width,
        height
      };
    
      if (isFirst) {
        setRoi1State(prev => ({ ...prev, current: newROI }));
      } else {
        setRoi2State(prev => ({ ...prev, current: newROI }));
      }
    }
  };
  
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    const roiState = isFirst ? roi1State : roi2State;
    if (!roiState.isSelecting || !roiState.start) return;
  
    const MIN_ROI_SIZE = 20; // Minimum size in pixels
    
    if (roiState.current && 
        (roiState.current.width < MIN_ROI_SIZE || 
         roiState.current.height < MIN_ROI_SIZE)) {
      // Reset ROI if too small
      if (isFirst) {
        setRoi1State(prev => ({ ...prev, current: null, isSelecting: false }));
      } else {
        setRoi2State(prev => ({ ...prev, current: null, isSelecting: false }));
      }
      return;
    }

    if (isFirst) {
      setRoi1State(prev => ({ ...prev, isSelecting: false }));
      captureROI(true);
    } else {
      setRoi2State(prev => ({ ...prev, isSelecting: false }));
      captureROI(false);
    }
  };

  // Update the delete ROI button click handlers
const handleDeleteROI = (isFirst: boolean) => {
  if (isFirst) {
    setRoi1State(prev => ({ ...prev, current: null, isSelecting: false }));
    setRoiAnalysis(prev => ({ ...prev, roi1Image: null }));
  } else {
    setRoi2State(prev => ({ ...prev, current: null, isSelecting: false }));
    setRoiAnalysis(prev => ({ ...prev, roi2Image: null }));
  }
};

  const handleCanvasMouseLeave = (isFirst: boolean) => {
    if (isFirst) {
      setRoi1State(prev => ({ ...prev, isSelecting: false }));
    } else {
      setRoi2State(prev => ({ ...prev, isSelecting: false }));
    }
  };

  const drawROI = (canvas: HTMLCanvasElement, roi: ROI) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the video frame first
    const video = canvas === canvasRef.current ? videoRef.current : video2Ref.current;
    if (video) {
      const scale = Math.min(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
      );
      
      const x = (canvas.width - video.videoWidth * scale) / 2;
      const y = (canvas.height - video.videoHeight * scale) / 2;
  
      ctx.drawImage(
        video,
        0, 0,
        video.videoWidth,
        video.videoHeight,
        x, y,
        video.videoWidth * scale,
        video.videoHeight * scale
      );
    }
  
    // Draw ROI with improved visual style
    ctx.setLineDash([6]);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    
    // Draw fill
    ctx.fillRect(roi.x, roi.y, roi.width, roi.height);
    
    // Draw border
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
    
    // Draw corner markers
    const markerSize = 6;
    ctx.setLineDash([]);
    ctx.fillStyle = '#3B82F6';
    
    // Draw corners
    [
      [roi.x, roi.y],
      [roi.x + roi.width, roi.y],
      [roi.x, roi.y + roi.height],
      [roi.x + roi.width, roi.y + roi.height]
    ].forEach(([x, y]) => {
      ctx.fillRect(x - markerSize/2, y - markerSize/2, markerSize, markerSize);
    });
  };

  // Process video frame
  const processFrame = () => {
    // Process first video/image
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw video frame or imported image
        if (videoRef.current && isStreaming) {
          // Draw video frame
          const video = videoRef.current;
          
          // Calculate scale to maintain aspect ratio
          const scale = Math.min(
            canvasRef.current.width / video.videoWidth,
            canvasRef.current.height / video.videoHeight
          );
          
          // Center the video in canvas
          const x = (canvasRef.current.width - video.videoWidth * scale) / 2;
          const y = (canvasRef.current.height - video.videoHeight * scale) / 2;
          
          ctx.drawImage(
            video,
            0, 0,
            video.videoWidth,
            video.videoHeight,
            x, y,
            video.videoWidth * scale,
            video.videoHeight * scale
          );
        } else if (importedImage1 && cachedImage1Ref.current) {
          // Draw imported image
          const img = cachedImage1Ref.current;
          
          // Calculate scale to maintain aspect ratio
          const scale = Math.min(
            canvasRef.current.width / img.width,
            canvasRef.current.height / img.height
          );
          
          // Center the image in canvas
          const x = (canvasRef.current.width - img.width * scale) / 2;
          const y = (canvasRef.current.height - img.height * scale) / 2;
          
          // Draw image at high quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            img,
            0, 0,
            img.width,
            img.height,
            x, y,
            img.width * scale,
            img.height * scale
          );
        }
        
        // Draw ROI if selecting or selected
        if (roi1State.isSelecting && roi1State.start && roi1State.current) {
          // Draw rectangle for ROI selection
          ctx.setLineDash([6]);
          ctx.strokeStyle = '#3B82F6'; // Blue color
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Semi-transparent blue
          
          // Fill the rectangle
          ctx.fillRect(
            roi1State.current.x,
            roi1State.current.y,
            roi1State.current.width,
            roi1State.current.height
          );
          
          // Draw the border
          ctx.strokeRect(
            roi1State.current.x,
            roi1State.current.y,
            roi1State.current.width,
            roi1State.current.height
          );
          
          // Reset line dash
          ctx.setLineDash([]);
        } else if (roi1State.current && !roi1State.isSelecting) {
          // Draw completed ROI
          ctx.setLineDash([]);
          ctx.strokeStyle = '#2563EB'; // Darker blue
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // Very light blue
          
          // Fill the rectangle
          ctx.fillRect(
            roi1State.current.x,
            roi1State.current.y,
            roi1State.current.width,
            roi1State.current.height
          );
          
          // Draw the border
          ctx.strokeRect(
            roi1State.current.x,
            roi1State.current.y,
            roi1State.current.width,
            roi1State.current.height
          );
        }
      }
    }
    
    // Process second video/image
    if (canvas2Ref.current) {
      const ctx = canvas2Ref.current.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas2Ref.current.width, canvas2Ref.current.height);
        
        // Draw video frame or imported image
        if (video2Ref.current && isStream2Active) {
          // Draw video frame
          const video = video2Ref.current;
          
          // Calculate scale to maintain aspect ratio
          const scale = Math.min(
            canvas2Ref.current.width / video.videoWidth,
            canvas2Ref.current.height / video.videoHeight
          );
          
          // Center the video in canvas
          const x = (canvas2Ref.current.width - video.videoWidth * scale) / 2;
          const y = (canvas2Ref.current.height - video.videoHeight * scale) / 2;
          
          ctx.drawImage(
            video,
            0, 0,
            video.videoWidth,
            video.videoHeight,
            x, y,
            video.videoWidth * scale,
            video.videoHeight * scale
          );
        } else if (importedImage2 && cachedImage2Ref.current) {
          // Draw imported image
          const img = cachedImage2Ref.current;
          
          // Calculate scale to maintain aspect ratio
          const scale = Math.min(
            canvas2Ref.current.width / img.width,
            canvas2Ref.current.height / img.height
          );
          
          // Center the image in canvas
          const x = (canvas2Ref.current.width - img.width * scale) / 2;
          const y = (canvas2Ref.current.height - img.height * scale) / 2;
          
          // Draw image at high quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            img,
            0, 0,
            img.width,
            img.height,
            x, y,
            img.width * scale,
            img.height * scale
          );
        }
        
        // Draw ROI if selecting or selected
        if (roi2State.isSelecting && roi2State.start && roi2State.current) {
          // Draw rectangle for ROI selection
          ctx.setLineDash([6]);
          ctx.strokeStyle = '#3B82F6'; // Blue color
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Semi-transparent blue
          
          // Fill the rectangle
          ctx.fillRect(
            roi2State.current.x,
            roi2State.current.y,
            roi2State.current.width,
            roi2State.current.height
          );
          
          // Draw the border
          ctx.strokeRect(
            roi2State.current.x,
            roi2State.current.y,
            roi2State.current.width,
            roi2State.current.height
          );
          
          // Reset line dash
          ctx.setLineDash([]);
        } else if (roi2State.current && !roi2State.isSelecting) {
          // Draw completed ROI
          ctx.setLineDash([]);
          ctx.strokeStyle = '#2563EB'; // Darker blue
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // Very light blue
          
          // Fill the rectangle
          ctx.fillRect(
            roi2State.current.x,
            roi2State.current.y,
            roi2State.current.width,
            roi2State.current.height
          );
          
          // Draw the border
          ctx.strokeRect(
            roi2State.current.x,
            roi2State.current.y,
            roi2State.current.width,
            roi2State.current.height
          );
        }
      }
    }
  };

  // Set up animation frame for video processing
  useEffect(() => {
    let animationFrameId: number | undefined = undefined;
    
    // Start animation frame if streaming or if we have imported images
    if ((isStreaming || isStream2Active || importedImage1 || importedImage2) && 
        (canvasRef.current || canvas2Ref.current)) {
      // Cancel any existing animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      const animate = () => {
        processFrame();
        animationFrameId = requestAnimationFrame(animate);
      };
      
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isStreaming, isStream2Active, importedImage1, importedImage2, roi1State, roi2State]);

  // Cleanup effect
  useEffect(() => {
    const cleanup = () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.enumerateDevices()
          .then(devices => {
            devices.forEach(device => {
              if (device.kind === 'videoinput') {
                navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: device.deviceId } }
                })
                .then(stream => {
                  stream.getTracks().forEach(track => track.stop());
                })
                .catch(() => {});
              }
            });
          })
          .catch(() => {});
      }
      
      // Clean up first video stream
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setIsStreaming(false);
      }
  
      // Clean up second video stream
      if (video2Ref.current?.srcObject) {
        const tracks = (video2Ref.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        video2Ref.current.srcObject = null;
        setIsStream2Active(false);
      }
    };
  
    cleanup();
    return () => cleanup();
  }, []);
  
  // Add function to save ROI as image file
  const saveROIAsImage = async (dataUrl: string, fileName: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create a File object
      const file = new File([blob], fileName, { type: 'image/png' });
      
      // Create FormData
      const formData = new FormData();
      formData.append('image', file);
      
      // Send to server endpoint that saves the file
      const saveResponse = await fetch('/api/save-roi-image', {
        method: 'POST',
        body: formData
      });
      
      if (!saveResponse.ok) {
        throw new Error('Failed to save ROI image');
      }
      
      const result = await saveResponse.json();
      return result.filePath;
    } catch (err) {
      console.error('Error saving ROI image:', err);
      setError('Failed to save ROI image for analysis');
      throw err;
    }
  };
  
  // Add function to run weld prediction
  const runWeldPrediction = async (imagePath: string): Promise<{predictedClass: string, confidence: number | null}> => {
    try {
      const response = await fetch('/api/run-weld-prediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imagePath })
      });
      
      if (!response.ok) {
        throw new Error('Failed to run weld prediction');
      }
      
      const result = await response.json();
      return {
        predictedClass: result.predictedClass,
        confidence: result.confidence
      };
    } catch (err) {
      console.error('Error running weld prediction:', err);
      setError('Failed to run weld prediction');
      throw err;
    }
  };
  
  // Add function to run edge detection
  const runEdgeDetection = async () => {
    setIsRunningEdgeDetection(true);
    
    try {
      // If we don't have a saved image path yet, save the ROI first
      if (!savedImagePath) {
        let imagePath = '';
        
        // Prioritize ROI 1 if available, otherwise use ROI 2
        if (roiAnalysis.roi1Image) {
          imagePath = await saveROIAsImage(roiAnalysis.roi1Image, 'roi1.png');
        } else if (roiAnalysis.roi2Image) {
          imagePath = await saveROIAsImage(roiAnalysis.roi2Image, 'roi2.png');
        } else {
          throw new Error('No ROI selected for edge detection');
        }
        
        // Save the image path for future use
        setSavedImagePath(imagePath);
      }
      
      const response = await fetch('/api/run-edge-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imagePath: savedImagePath || '' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to run edge detection');
      }
      
      const result = await response.json();
      
      if (result.success && result.edgeDetectionImagePath) {
        setEdgeDetectionResult(result.edgeDetectionImagePath);
      } else {
        throw new Error(result.error || 'Edge detection failed');
      }
    } catch (err: any) {
      console.error('Error running edge detection:', err);
      setError(err.message || 'Failed to run edge detection');
    } finally {
      setIsRunningEdgeDetection(false);
      setShowEdgeDetectionConfirm(false);
    }
  };
  
  // Modify the handleAnalyze function to not show edge detection confirmation
  const handleAnalyze = async () => {
    // Check if ROIs are selected
    if (!roiAnalysis.roi1Image && !roiAnalysis.roi2Image) {
      setError('Please select at least one ROI for analysis');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      let imagePath = '';
      
      // Prioritize ROI 1 if available, otherwise use ROI 2
      if (roiAnalysis.roi1Image) {
        imagePath = await saveROIAsImage(roiAnalysis.roi1Image, 'roi1.png');
      } else if (roiAnalysis.roi2Image) {
        imagePath = await saveROIAsImage(roiAnalysis.roi2Image, 'roi2.png');
      }
      
      // Save the image path for edge detection
      setSavedImagePath(imagePath);
      
      // Run weld prediction
      const result = await runWeldPrediction(imagePath);
      
      // Update state with results
      setAnalysisResult(result);
      
      // Set joint type based on prediction
      if (result.predictedClass) {
        const matchingJointType = jointTypes.find(
          type => type.name.toLowerCase().includes(result.predictedClass.toLowerCase())
        );
        
        if (matchingJointType) {
          setJointType(matchingJointType.id);
        }
      }
      
      // Show joint identification popup
      setShowAnalysisPopup(true);
      
      // Auto-hide analysis popup after 5 seconds
      setTimeout(() => {
        setShowAnalysisPopup(false);
      }, 5000);
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6 space-y-6">
        {/* Hidden file inputs */}
        <input 
          type="file" 
          ref={fileInput1Ref} 
          className="hidden" 
          accept="image/*" 
          onChange={(e) => handleImageImport(true, e)} 
        />
        <input 
          type="file" 
          ref={fileInput2Ref} 
          className="hidden" 
          accept="image/*" 
          onChange={(e) => handleImageImport(false, e)} 
        />
        
        {/* Page Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Weld Analysis Dashboard</h1>
          <p className="text-muted-foreground max-w-3xl">
            Real-time monitoring and analysis of welding processes using dual camera feeds with advanced edge detection.
          </p>
          <div className="h-1.5 w-40 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-full mt-2"></div>
        </div>

        {/* Top Row - Camera Feeds */}
        <div className="grid grid-cols-2 gap-8">
          {/* First Video Feed */}
          <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-blue-950/5">
            <CardHeader className="p-4 pb-2 bg-gradient-to-r from-background to-blue-900/10">
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-lg text-blue-600">Depth Camera Feed</span>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                        <span className="sr-only">Depth Camera Info</span>
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Depth Camera</h4>
                        <p className="text-sm text-muted-foreground">
                          This camera captures depth information for precise weld joint analysis. 
                          Select a region of interest (ROI) to analyze specific areas.
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <Select 
                    value={selectedCamera1 || "default"} 
                    onValueChange={setSelectedCamera1}
                  >
                    <SelectTrigger className="w-[200px] h-9 px-3 text-sm hover:bg-accent transition-colors">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[200px]">
                      <SelectItem value="default" disabled className="text-muted-foreground">
                        Select a camera
                      </SelectItem>
                      {cameras.map((camera) => (
                        <SelectItem 
                          key={camera.deviceId} 
                          value={camera.deviceId}
                          className="text-sm hover:bg-accent transition-colors"
                        >
                          {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDeleteROI(true)}
                        disabled={!roi1State.current}
                        className="hover:bg-destructive/10 transition-colors rounded-full"
                      >
                        <Trash2 className="h-4 w-4" /> 
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete region of interest</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => fileInput1Ref.current?.click()}
                        className="hover:bg-primary/10 transition-colors rounded-full"
                      >
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Import image for analysis</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setRoi1State(prev => ({ ...prev, isSelecting: !prev.isSelecting }))}
                        className={cn(
                          "transition-colors rounded-full",
                          roi1State.isSelecting ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-primary/10"
                        )}
                      >
                        <Square className={cn(
                          "h-4 w-4",
                          roi1State.isSelecting ? "text-primary" : "text-muted-foreground"
                        )} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{roi1State.isSelecting ? "Cancel selection" : "Select region of interest"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleStream}
                        disabled={isLoading || importedImage1 !== null}
                        className={cn(
                          "transition-colors rounded-full",
                          isStreaming ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-primary/10"
                        )}
                      >
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : isStreaming ? (
                          <Pause className="h-4 w-4 text-primary" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{importedImage1 !== null ? "Clear imported image first" : isStreaming ? "Pause camera" : "Start camera"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="relative aspect-[16/9] max-w-3xl mx-auto rounded-lg overflow-hidden border border-border/50 shadow-inner bg-black/5">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover bg-muted",
                    importedImage1 ? "hidden" : "block"
                  )}
                  style={{ objectFit: 'cover' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  onMouseDown={(e) => handleCanvasMouseDown(e, true)}
                  onMouseMove={(e) => handleCanvasMouseMove(e, true)}
                  onMouseUp={(e) => handleCanvasMouseUp(e, true)}
                  onMouseLeave={() => handleCanvasMouseLeave(true)}
                />
                {importedImage1 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => clearImportedImage(true)}
                          className="bg-background/80 hover:bg-background transition-colors rounded-full"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear imported image</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                {!isStreaming && !importedImage1 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-sm">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                      <Play className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-blue-700">Click play to start camera</p>
                    <p className="text-xs text-blue-500 mt-1">or import an image for analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
    
          {/* Second Video Feed */}
          <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-indigo-950/5">
            <CardHeader className="p-4 pb-2 bg-gradient-to-r from-background to-indigo-900/10">
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-lg text-indigo-600">Weld Camera Feed</span>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                        <span className="sr-only">Weld Camera Info</span>
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Weld Camera</h4>
                        <p className="text-sm text-muted-foreground">
                          This camera provides a direct view of the welding process. 
                          Use it to monitor the weld pool and track the quality of the weld in real-time.
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <Select 
                    value={selectedCamera2 || "default"} 
                    onValueChange={setSelectedCamera2}
                  >
                    <SelectTrigger className="w-[200px] h-9 px-3 text-sm hover:bg-accent transition-colors">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[200px]">
                      <SelectItem value="default" disabled className="text-muted-foreground">
                        Select a camera
                      </SelectItem>
                      {cameras.map((camera) => (
                        <SelectItem 
                          key={camera.deviceId} 
                          value={camera.deviceId}
                          className="text-sm hover:bg-accent transition-colors"
                        >
                          {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDeleteROI(false)}
                        disabled={!roi2State.current}
                        className="hover:bg-destructive/10 transition-colors rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete region of interest</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => fileInput2Ref.current?.click()}
                        className="hover:bg-primary/10 transition-colors rounded-full"
                      >
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Import image for analysis</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setRoi2State(prev => ({ ...prev, isSelecting: !prev.isSelecting }))}
                        className={cn(
                          "transition-colors rounded-full",
                          roi2State.isSelecting ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-primary/10"
                        )}
                      >
                        <Square className={cn(
                          "h-4 w-4",
                          roi2State.isSelecting ? "text-primary" : "text-muted-foreground"
                        )} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{roi2State.isSelecting ? "Cancel selection" : "Select region of interest"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleStream2}
                        disabled={isLoading || importedImage2 !== null}
                        className={cn(
                          "transition-colors rounded-full",
                          isStream2Active ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-primary/10"
                        )}
                      >
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : isStream2Active ? (
                          <Pause className="h-4 w-4 text-primary" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{importedImage2 !== null ? "Clear imported image first" : isStream2Active ? "Pause camera" : "Start camera"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="relative aspect-[16/9] max-w-3xl mx-auto rounded-lg overflow-hidden border border-border/50 shadow-inner bg-black/5">
                <video
                  ref={video2Ref}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover bg-muted",
                    importedImage2 ? "hidden" : "block"
                  )}
                  style={{ objectFit: 'cover' }}
                />
                <canvas
                  ref={canvas2Ref}
                  className="absolute inset-0 w-full h-full object-cover"
                  onMouseDown={(e) => handleCanvasMouseDown(e, false)}
                  onMouseMove={(e) => handleCanvasMouseMove(e, false)}
                  onMouseUp={(e) => handleCanvasMouseUp(e, false)}
                  onMouseLeave={() => handleCanvasMouseLeave(false)}
                />
                {importedImage2 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => clearImportedImage(false)}
                          className="bg-background/80 hover:bg-background transition-colors rounded-full"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear imported image</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                {!isStream2Active && !importedImage2 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50/80 to-purple-50/80 backdrop-blur-sm">
                    <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                      <Play className="h-8 w-8 text-indigo-500" />
                    </div>
                    <p className="text-sm font-medium text-indigo-700">Click play to start camera</p>
                    <p className="text-xs text-indigo-500 mt-1">or import an image for analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
    
        {/* Bottom Section - Controls and Analysis */}
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - ROI Analysis */}
          <div className="col-span-4 space-y-6">
            {/* ROI Analysis */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-purple-950/5">
              <CardHeader className="p-4 pb-2 bg-gradient-to-r from-background to-purple-900/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-purple-600">ROI Analysis</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Selected regions of interest from both camera feeds</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 h-full">
                  <div className="h-full bg-muted rounded-lg overflow-hidden border border-border/50 hover:border-purple-400 transition-all duration-300 shadow-inner">
                    {roiAnalysis.roi1Image ? (
                      <img 
                        src={roiAnalysis.roi1Image} 
                        alt="ROI 1" 
                        className="w-full h-full object-contain transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50/50">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                          <Square className="h-6 w-6 text-purple-400" />
                        </div>
                        <span className="text-sm text-purple-700 text-center">No ROI selected</span>
                        <span className="text-xs text-purple-500 mt-1 text-center">Use the square tool to select a region</span>
                      </div>
                    )}
                  </div>
                  <div className="h-full bg-muted rounded-lg overflow-hidden border border-border/50 hover:border-purple-400 transition-all duration-300 shadow-inner">
                    {roiAnalysis.roi2Image ? (
                      <img 
                        src={roiAnalysis.roi2Image} 
                        alt="ROI 2" 
                        className="w-full h-full object-contain transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50/50">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                          <Square className="h-6 w-6 text-purple-400" />
                        </div>
                        <span className="text-sm text-purple-700 text-center">No ROI selected</span>
                        <span className="text-xs text-purple-500 mt-1 text-center">Use the square tool to select a region</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg" 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (!roiAnalysis.roi1Image && !roiAnalysis.roi2Image)}
                  >
                    {isAnalyzing ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyse'
                    )}
                  </Button>
                  <Button 
                    className="w-full transition-all duration-300 border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50/30 text-indigo-700" 
                    onClick={runEdgeDetection}
                    disabled={isRunningEdgeDetection || (!roiAnalysis.roi1Image && !roiAnalysis.roi2Image)}
                    variant="outline"
                  >
                    {isRunningEdgeDetection ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Processing...
                      </>
                    ) : (
                      'Edge Detection'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Joint Configuration */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-green-950/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-lg font-semibold">
                    <div className="flex items-center">
                      <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full mr-2"></div>
                      <span className="text-green-700">Joint Configuration</span>
                    </div>
                  </CardTitle>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Joint Types</h4>
                        <p className="text-sm">Select the appropriate joint type for your welding process:</p>
                        <ul className="text-sm space-y-1">
                          {jointTypes.map(type => (
                            <li key={type.id} className="flex items-start gap-2">
                              <span className="font-medium">{type.name}:</span> {type.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <CardDescription className="pb-3">Select the type of joint for analysis</CardDescription>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={jointType} onValueChange={setJointType}>
                    <SelectTrigger className="hover:bg-accent transition-colors border-border/50 focus:ring-primary/30">
                      <SelectValue placeholder="Select joint type" />
                    </SelectTrigger>
                    <SelectContent>
                      {jointTypes.map((type) => (
                        <SelectItem 
                          key={type.id} 
                          value={type.id}
                          className="hover:bg-accent transition-colors"
                        >
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-end">
                    <div className="px-3 py-1.5 rounded-md bg-green-100 border border-green-200">
                      <span className="text-sm">
                        Selected: <span className="font-medium capitalize text-green-700">
                          {jointTypes.find(t => t.id === jointType)?.name || jointType}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weld Parameters */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-amber-950/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-lg font-semibold">
                    <div className="flex items-center">
                      <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full mr-2"></div>
                      <span className="text-amber-700">Weld Parameters</span>
                    </div>
                  </CardTitle>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Weld Parameters</h4>
                        <p className="text-sm">Configure these parameters to match your welding setup for accurate analysis.</p>
                        <p className="text-sm text-muted-foreground">Changes to these parameters will affect the analysis results and recommendations.</p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <CardDescription className='pb-3'>Configure welding parameters for analysis</CardDescription>
                <div className="grid grid-cols-2 gap-4">
                  {weldParameters.map((param: WeldParameter) => (
                    <div key={param.id} className="space-y-2 group">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-medium flex items-center gap-1 cursor-help group-hover:text-primary transition-colors">
                            {param.name} {param.unit && `(${param.unit})`}
                            <Info className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Configure the {param.name.toLowerCase()} for your welding process</p>
                        </TooltipContent>
                      </Tooltip>
                      <Select
                        value={weldParams[param.id]}
                        onValueChange={(value: string) => 
                          setWeldParams((prev: Record<string, string>) => ({ ...prev, [param.id]: value }))
                        }
                      >
                        <SelectTrigger className="hover:bg-accent transition-colors border-border/50 focus:ring-primary/30 group-hover:border-primary/50 transition-colors">
                          <SelectValue placeholder={`Select ${param.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options.map((option: string) => (
                            <SelectItem 
                              key={option} 
                              value={option}
                              className="hover:bg-accent transition-colors"
                            >
                              {option} {param.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Analysis Visualizations */}
          <div className="col-span-8 grid grid-cols-2 gap-8">
            {/* Edge Detection */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-red-950/5">
              <CardHeader className="p-4 pb-2 bg-gradient-to-r from-background to-red-900/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    <div className="flex items-center">
                      <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-rose-600 rounded-full mr-2"></div>
                      <span className="text-red-600">Edge Detection</span>
                    </div>
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edge detection analysis of the selected regions</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-lg border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden shadow-inner">
                  {isRunningEdgeDetection ? (
                    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-rose-50/50">
                      <div className="relative w-16 h-16 mb-3">
                        <div className="absolute inset-0 rounded-full border-4 border-red-200 border-t-red-500 animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-red-600">Processing</span>
                        </div>
                      </div>
                      <span className="text-sm text-red-700 animate-pulse">Detecting edges in selected ROI...</span>
                    </div>
                  ) : edgeDetectionResult ? (
                    <div className="relative h-full group">
                      <img 
                        src={edgeDetectionResult} 
                        alt="Edge Detection Result" 
                        className="w-full h-full object-contain transition-all duration-500 group-hover:scale-[1.02]"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-900/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs text-white font-medium">Edge detection completed successfully</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-rose-50/50">
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
                        <HelpCircle className="h-8 w-8 text-red-300" />
                      </div>
                      <span className="text-sm text-red-700">No edge detection results</span>
                      <span className="text-xs text-red-500 mt-1">Select an ROI and click Edge Detection</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* LOWESS Visualization */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden bg-gradient-to-b from-background to-cyan-950/5">
              <CardHeader className="p-4 pb-2 bg-gradient-to-r from-background to-cyan-900/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    <div className="flex items-center">
                      <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-sky-600 rounded-full mr-2"></div>
                      <span className="text-cyan-600">LOWESS Analysis</span>
                    </div>
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Locally weighted scatterplot smoothing analysis</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-lg border border-border/50 hover:border-cyan-400 transition-all duration-300 shadow-inner flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-sky-50/50">
                  <div className="w-16 h-16 rounded-full bg-cyan-100 flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M3 3v18h18"/><path d="M7 12c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3s-1.3 3-3 3h-4c-1.7 0-3-1.3-3-3z"/></svg>
                  </div>
                  <span className="text-sm text-cyan-700">LOWESS Analysis</span>
                  <span className="text-xs text-cyan-500 mt-1">Coming soon</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="fixed bottom-4 right-4 max-w-md animate-in slide-in-from-bottom-2 shadow-lg border border-destructive/20 bg-gradient-to-r from-red-50 to-red-100">
            <AlertDescription className="text-sm flex items-center text-red-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-red-600"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Analysis Result Popup */}
        {showAnalysisPopup && analysisResult && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAnalysisPopup(false)}></div>
            <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full z-10 animate-in fade-in-50 slide-in-from-bottom-10 border border-border/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Analysis Result</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowAnalysisPopup(false)} className="rounded-full hover:bg-destructive/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800">Predicted Joint Type:</p>
                  <p className="text-xl font-bold mt-1 text-indigo-700">{analysisResult.predictedClass}</p>
                  {analysisResult.confidence !== null && (
                    <div className="mt-2 bg-white/80 p-2 rounded">
                      <p className="text-sm font-medium text-blue-700">Confidence Level:</p>
                      <div className="w-full bg-blue-100 rounded-full h-2.5 mt-1">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full" 
                          style={{ width: `${(analysisResult.confidence * 100).toFixed(0)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-right mt-1 text-indigo-600 font-medium">
                        {(analysisResult.confidence * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Info className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    The joint type has been automatically updated in the configuration panel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoAnalysisApp;