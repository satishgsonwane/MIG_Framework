"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Spinner from "@/components/ui/spinner";
import { Square, Play, Pause, Camera, Trash2 } from 'lucide-react';

interface VideoAnalysisProps {
  onAnalysisComplete?: (data: any) => void;
}

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
  { id: 'butt', name: 'Butt Joint', description: 'End to end joint connection' },
  { id: 'lap', name: 'Lap Joint', description: 'Overlapping joint connection' },
  { id: 'tee', name: 'T Joint', description: 'Perpendicular joint connection' },
  { id: 'corner', name: 'Corner Joint', description: '90-degree angle joint' },
];


const weldParameters: WeldParameter[] = [
  {
    id: 'material',
    name: 'Welding Material',
    unit: '',
    options: ['Carbon Steel', 'Stainless Steel', 'Aluminum', 'Nickel Alloy']
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


const VideoAnalysisApp: React.FC<VideoAnalysisProps> = ({ onAnalysisComplete }) => {
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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

  const captureROI = (isFirst: boolean) => {
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    const video = isFirst ? videoRef.current : video2Ref.current;
    const roi = isFirst ? roi1State.current : roi2State.current;
    
    if (!canvas || !roi || !video) return;
    
    // Create temporary canvas for ROI
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const mainCtx = canvas.getContext('2d');
    
    if (!tempCtx || !mainCtx) return;
  
    // Calculate scale to maintain aspect ratio (same as in processFrame)
    const scale = Math.min(
      canvas.width / video.videoWidth,
      canvas.height / video.videoHeight
    );
    
    // Calculate centered position
    const x = (canvas.width - video.videoWidth * scale) / 2;
    const y = (canvas.height - video.videoHeight * scale) / 2;
  
    // Set dimensions to ROI size
    tempCanvas.width = roi.width;
    tempCanvas.height = roi.height;
  
    // First draw the current video frame to the main canvas
    mainCtx.drawImage(
      video,
      0, 0,
      video.videoWidth,
      video.videoHeight,
      x, y,
      video.videoWidth * scale,
      video.videoHeight * scale
    );
  
    // Then capture the ROI portion
    tempCtx.drawImage(
      canvas,
      roi.x, roi.y, roi.width, roi.height,
      0, 0, roi.width, roi.height
    );
    
    // Convert to base64
    const roiImage = tempCanvas.toDataURL('image/png');
    
    // Update ROI analysis state
    setRoiAnalysis(prev => ({
      ...prev,
      [isFirst ? 'roi1Image' : 'roi2Image']: roiImage
    }));
  };
  
  const toggleStream = async () => {
    if (isStreaming) {
      if (videoRef.current?.srcObject) {
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
      setError('Unable to access first camera. Please check permissions.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleStream2 = async () => {
    if (isStream2Active) {
      if (video2Ref.current?.srcObject) {
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
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const startPoint = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  
    if (isFirst) {
      setRoi1State(prev => ({
        ...prev,
        start: startPoint,
        current: {
          x: startPoint.x,
          y: startPoint.y,
          width: 0,
          height: 0
        }
      }));
    } else {
      setRoi2State(prev => ({
        ...prev,
        start: startPoint,
        current: {
          x: startPoint.x,
          y: startPoint.y,
          width: 0,
          height: 0
        }
      }));
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    const roiState = isFirst ? roi1State : roi2State;
    if (!roiState.isSelecting || !roiState.start) return;
  
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
  
    const newROI = {
      x: Math.min(roiState.start.x, currentX),
      y: Math.min(roiState.start.y, currentY),
      width: Math.abs(currentX - roiState.start.x),
      height: Math.abs(currentY - roiState.start.y)
    };
  
    if (isFirst) {
      setRoi1State(prev => ({ ...prev, current: newROI }));
    } else {
      setRoi2State(prev => ({ ...prev, current: newROI }));
    }
  
    drawROI(canvas, newROI);
  };
  
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    const roiState = isFirst ? roi1State : roi2State;
    if (!roiState.isSelecting || !roiState.start) return;
  
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
  
    // Draw ROI
    ctx.setLineDash([6]);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    
    ctx.fillRect(roi.x, roi.y, roi.width, roi.height);
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
  };

  // Frame processing function
  const processFrame = () => {
  // Process first video feed
  if (videoRef.current && canvasRef.current && isStreaming) {
    const ctx = canvasRef.current.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Calculate scale to maintain aspect ratio
      const scale = Math.min(
        canvasRef.current.width / videoRef.current.videoWidth,
        canvasRef.current.height / videoRef.current.videoHeight
      );
      
      // Center the video in canvas
      const x = (canvasRef.current.width - videoRef.current.videoWidth * scale) / 2;
      const y = (canvasRef.current.height - videoRef.current.videoHeight * scale) / 2;

      // Draw video frame
      ctx.drawImage(
        videoRef.current,
        0, 0,
        videoRef.current.videoWidth,
        videoRef.current.videoHeight,
        x, y,
        videoRef.current.videoWidth * scale,
        videoRef.current.videoHeight * scale
      );

      // Draw ROI if exists and is being selected or completed
      if (roi1State.isSelecting && roi1State.current) {
        ctx.setLineDash([6]);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(
          roi1State.current.x,
          roi1State.current.y,
          roi1State.current.width,
          roi1State.current.height
        );
        ctx.strokeRect(
          roi1State.current.x,
          roi1State.current.y,
          roi1State.current.width,
          roi1State.current.height
        );
      } else if (!roi1State.isSelecting && roi1State.current) {
        // Draw completed ROI
        ctx.setLineDash([]);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(
          roi1State.current.x,
          roi1State.current.y,
          roi1State.current.width,
          roi1State.current.height
        );
        ctx.strokeRect(
          roi1State.current.x,
          roi1State.current.y,
          roi1State.current.width,
          roi1State.current.height
        );
      }
    }
  }

  // Process second video feed
  if (video2Ref.current && canvas2Ref.current && isStream2Active) {
    const ctx = canvas2Ref.current.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Calculate scale to maintain aspect ratio
      const scale = Math.min(
        canvas2Ref.current.width / video2Ref.current.videoWidth,
        canvas2Ref.current.height / video2Ref.current.videoHeight
      );
      
      // Center the video in canvas
      const x = (canvas2Ref.current.width - video2Ref.current.videoWidth * scale) / 2;
      const y = (canvas2Ref.current.height - video2Ref.current.videoHeight * scale) / 2;

      // Draw video frame
      ctx.drawImage(
        video2Ref.current,
        0, 0,
        video2Ref.current.videoWidth,
        video2Ref.current.videoHeight,
        x, y,
        video2Ref.current.videoWidth * scale,
        video2Ref.current.videoHeight * scale
      );

      // Draw ROI if exists and is being selected or completed
      if (roi2State.isSelecting && roi2State.current) {
        ctx.setLineDash([6]);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(
          roi2State.current.x,
          roi2State.current.y,
          roi2State.current.width,
          roi2State.current.height
        );
        ctx.strokeRect(
          roi2State.current.x,
          roi2State.current.y,
          roi2State.current.width,
          roi2State.current.height
        );
      } else if (!roi2State.isSelecting && roi2State.current) {
        // Draw completed ROI
        ctx.setLineDash([]);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(
          roi2State.current.x,
          roi2State.current.y,
          roi2State.current.width,
          roi2State.current.height
        );
        ctx.strokeRect(
          roi2State.current.x,
          roi2State.current.y,
          roi2State.current.width,
          roi2State.current.height
        );
      }
    }
  }

  // Continue animation if either stream is active
  if (isStreaming || isStream2Active) {
    const frameId = requestAnimationFrame(processFrame);
    setAnimationFrame(frameId);
  }
};
  // Effect for frame processing
  useEffect(() => {
    if (isStreaming || isStream2Active) {
      const frameId = requestAnimationFrame(processFrame);
      setAnimationFrame(frameId);
    }
  
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isStreaming, isStream2Active, roi1State, roi2State]); // Add ROI states as dependencies

  // Screenshot handler
  const captureScreenshot = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      setCapturedImage(imageData);
    }
  };

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
  
  return (
    <div className="min-h-screen bg-red-50 p-4">
      <div className="grid grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-8">
          {/* First Video Feed */}
          <Card>
            <CardHeader className="p-4">
            <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span>Depth Camera Feed</span>
              <Select 
                value={selectedCamera1 || "default"} 
                onValueChange={setSelectedCamera1}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" disabled>Select a camera</SelectItem>
                  {cameras.map((camera) => (
                    <SelectItem 
                      key={camera.deviceId} 
                      value={camera.deviceId}
                    >
                      {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleDeleteROI(true)}
              disabled={!roi1State.current}
            >
              <Trash2 className="h-4 w-4" /> 
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setRoi1State(prev => ({ ...prev, isSelecting: !prev.isSelecting }))}
              className={roi1State.isSelecting ? "bg-sky-100" : ""}
            >
              <Square className={roi1State.isSelecting ? "text-sky-600 h-4 w-4" : "text-gray-400 h-4 w-4"} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleStream}
              disabled={isLoading}
            >
              {isLoading ? (
                <Spinner className="h-4 w-4" />
              ) : isStreaming ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
          </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative aspect-video max-w-md mx-auto">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover bg-red-100"
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
              </div>
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="secondary"
                  onClick={captureScreenshot}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Capture Screenshot
                </Button>
              </div>
            </CardContent>
          </Card>
  
          {/* Second Video Feed */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span>Weld Camera Feed</span>
                  <Select 
                    value={selectedCamera2 || "default"} 
                    onValueChange={setSelectedCamera2}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default" disabled>Select a camera</SelectItem>
                      {cameras.map((camera) => (
                        <SelectItem 
                          key={camera.deviceId} 
                          value={camera.deviceId}
                        >
                          {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleDeleteROI(false)}
                  disabled={!roi2State.current}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setRoi2State(prev => ({ ...prev, isSelecting: !prev.isSelecting }))}
                  className={roi2State.isSelecting ? "bg-sky-100" : ""}
                >
                  <Square className={roi2State.isSelecting ? "text-sky-600 h-4 w-4" : "text-gray-400 h-4 w-4"} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleStream2}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : isStream2Active ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative aspect-video max-w-md mx-auto">
                <video
                  ref={video2Ref}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover bg-red-100"
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
              </div>
            </CardContent>
          </Card>
        </div>
  
        {/* Right Column - Analysis Outputs */}
        <div className="grid-cols-2 gap-4 space-y-4">
          {/* Joint Configuration */}
          <Card className="flex flex-col space-y-3 col-span-2">
            <CardContent className="p-2 flex-1">
              <CardTitle className="py-2 text-mm text-center">Joint Configuration</CardTitle>
              <CardDescription className="pb-3">Select the type of joint for analysis</CardDescription>
              <div className="grid grid-cols-2 gap-4">
                <Select value={jointType} onValueChange={setJointType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select joint type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jointTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-end">
                  <span className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium capitalize">
                      {jointTypes.find(t => t.id === jointType)?.name || jointType}
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weld Parameters */}
          <Card className="flex flex-col space-y-3 col-span-2">
            <CardContent className="p-2 flex-1">
              <CardTitle className="py-2 text-mm text-center">Weld Parameters</CardTitle>
              <CardDescription className='pb-3'>Configure welding parameters for analysis</CardDescription>
              <div className="grid grid-cols-2 gap-4">
                {weldParameters.map((param: WeldParameter) => (
                  <div key={param.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {param.name} {param.unit && `(${param.unit})`}
                    </label>
                    <Select
                      value={weldParams[param.id]}
                      onValueChange={(value: string) => 
                        setWeldParams((prev: Record<string, string>) => ({ ...prev, [param.id]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${param.name}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options.map((option: string) => (
                          <SelectItem key={option} value={option}>
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
        {/* Right Column - Analysis Outputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* ROI Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-0 pt-3 px-2">
              <CardTitle className="text-sm text-center">ROI Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="grid grid-cols-2 gap-2 h-full">
                <div className="h-full bg-red-100 rounded-lg overflow-hidden">
                  {roiAnalysis.roi1Image ? (
                    <img 
                      src={roiAnalysis.roi1Image} 
                      alt="ROI 1" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-sm text-red-500">No ROI selected</span>
                    </div>
                  )}
                </div>
                <div className="h-full bg-red-100 rounded-lg overflow-hidden">
                  {roiAnalysis.roi2Image ? (
                    <img 
                      src={roiAnalysis.roi2Image} 
                      alt="ROI 2" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-sm text-red-500">No ROI selected</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Canny Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-0 pt-3 px-2">
              <CardTitle className="text-sm text-center">Canny Edge Detection</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-red-100 rounded-lg"></div>
            </CardContent>
          </Card>
  
          {/* Joint Analysis */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-0 pt-3 px-2">
              <CardTitle className="text-sm text-center">Joint Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-red-100 rounded-lg"></div>
            </CardContent>
          </Card>
  
          {/* LOWESS Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-0 pt-3 px-2">
              <CardTitle className="text-sm text-center">LOWESS Visualization</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-red-100 rounded-lg"></div>
            </CardContent>
          </Card>
        </div>

      </div>
  
      {error && (
        <Alert variant="destructive" className="fixed bottom-4 right-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default VideoAnalysisApp;