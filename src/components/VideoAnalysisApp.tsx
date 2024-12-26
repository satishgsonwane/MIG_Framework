"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Square, Play, Pause, Camera } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Spinner from "@/components/ui/spinner";

interface VideoAnalysisProps {
  onAnalysisComplete?: (data: any) => void;
}

interface JointType {
  id: string;
  name: string;
  description: string;
}
const jointTypes: JointType[] = [
  { id: 'butt', name: 'Butt Joint', description: 'End to end joint connection' },
  { id: 'lap', name: 'Lap Joint', description: 'Overlapping joint connection' },
  { id: 'tee', name: 'T Joint', description: 'Perpendicular joint connection' },
  { id: 'corner', name: 'Corner Joint', description: '90-degree angle joint' },
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
  const [isSelectingRoi1, setIsSelectingRoi1] = useState(false);
  const [isSelectingRoi2, setIsSelectingRoi2] = useState(false);
  const [roi1, setRoi1] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [roi2, setRoi2] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // Other states
  const [error, setError] = useState('');
  const [jointType, setJointType] = useState(jointTypes[0].id);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const roiStartRef = useRef<{ x: number; y: number } | null>(null);
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
  const startStream = async () => {
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

  const startStream2 = async () => {
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
    } catch (err) {
      setError('Unable to access second camera.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const stopStream2 = () => {
    if (video2Ref.current?.srcObject) {
      const tracks = (video2Ref.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      video2Ref.current.srcObject = null;
      setIsStream2Active(false);
    }
  };
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    if (!(isFirst ? isSelectingRoi1 : isSelectingRoi2)) return;
    
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    roiStartRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    if (!(isFirst ? isSelectingRoi1 : isSelectingRoi2) || !roiStartRef.current) return;
    
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const newRoi = {
      x: Math.min(roiStartRef.current.x, currentX),
      y: Math.min(roiStartRef.current.y, currentY),
      width: Math.abs(currentX - roiStartRef.current.x),
      height: Math.abs(currentY - roiStartRef.current.y)
    };

    if (isFirst) {
      setRoi1(newRoi);
    } else {
      setRoi2(newRoi);
    }
  };

  const handleCanvasMouseUp = (isFirst: boolean) => {
    if (isFirst) {
      setIsSelectingRoi1(false);
    } else {
      setIsSelectingRoi2(false);
    }
    roiStartRef.current = null;
  };
  const processFrame = () => {
    if (videoRef.current && canvasRef.current && isStreaming) {
      const ctx = canvasRef.current.getContext('2d', {
        alpha: false,
        desynchronized: true
      });
      
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const scale = Math.min(
          canvasRef.current.width / videoRef.current.videoWidth,
          canvasRef.current.height / videoRef.current.videoHeight
        );
        
        const x = (canvasRef.current.width - videoRef.current.videoWidth * scale) / 2;
        const y = (canvasRef.current.height - videoRef.current.videoHeight * scale) / 2;

        ctx.drawImage(
          videoRef.current,
          0, 0,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
          x, y,
          videoRef.current.videoWidth * scale,
          videoRef.current.videoHeight * scale
        );

        if (roi1.width && roi1.height) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.strokeRect(roi1.x, roi1.y, roi1.width, roi1.height);
        }
      }
    }

    if (video2Ref.current && canvas2Ref.current && isStream2Active) {
      const ctx = canvas2Ref.current.getContext('2d', {
        alpha: false,
        desynchronized: true
      });
      
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const scale = Math.min(
          canvas2Ref.current.width / video2Ref.current.videoWidth,
          canvas2Ref.current.height / video2Ref.current.videoHeight
        );
        
        const x = (canvas2Ref.current.width - video2Ref.current.videoWidth * scale) / 2;
        const y = (canvas2Ref.current.height - video2Ref.current.videoHeight * scale) / 2;

        ctx.drawImage(
          video2Ref.current,
          0, 0,
          video2Ref.current.videoWidth,
          video2Ref.current.videoHeight,
          x, y,
          video2Ref.current.videoWidth * scale,
          video2Ref.current.videoHeight * scale
        );

        if (roi2.width && roi2.height) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.strokeRect(roi2.x, roi2.y, roi2.width, roi2.height);
        }
      }
    }

    if (isStreaming || isStream2Active) {
      const frameId = requestAnimationFrame(processFrame);
      setAnimationFrame(frameId);
    }
  };

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
  }, [isStreaming, isStream2Active]);
  const captureScreenshot = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      setCapturedImage(imageData);
    }
  };
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
      stopStream();
      stopStream2();
    };

    cleanup();
    return () => cleanup();
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="grid grid-cols-2 gap-4 max-w-6xl mx-auto">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Joint Type Selector */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Joint Configuration</CardTitle>
              <CardDescription>Select the type of joint for analysis</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
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
                    <SelectTrigger className="w-48">
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
                    onClick={() => setIsSelectingRoi1(!isSelectingRoi1)}
                  >
                    <Square className={isSelectingRoi1 ? "text-sky-600 h-4 w-4" : "text-gray-400 h-4 w-4"} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={isStreaming ? stopStream : startStream}
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
                  className="absolute inset-0 w-full h-full object-cover bg-gray-100"
                  style={{ objectFit: 'cover' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  onMouseDown={(e) => handleCanvasMouseDown(e, true)}
                  onMouseMove={(e) => handleCanvasMouseMove(e, true)}
                  onMouseUp={() => handleCanvasMouseUp(true)}
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
                    <SelectTrigger className="w-48">
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
                    onClick={() => setIsSelectingRoi2(!isSelectingRoi2)}
                  >
                    <Square className={isSelectingRoi2 ? "text-sky-600 h-4 w-4" : "text-gray-400 h-4 w-4"} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={isStream2Active ? stopStream2 : startStream2}
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
                  className="absolute inset-0 w-full h-full object-cover bg-gray-100"
                  style={{ objectFit: 'cover' }}
                />
                <canvas
                  ref={canvas2Ref}
                  className="absolute inset-0 w-full h-full object-cover"
                  onMouseDown={(e) => handleCanvasMouseDown(e, false)}
                  onMouseMove={(e) => handleCanvasMouseMove(e, false)}
                  onMouseUp={() => handleCanvasMouseUp(false)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
  
        {/* Right Column - Analysis Outputs */}
        <div className="grid grid-cols-2 gap-4 h-[600px]">
          {/* ROI Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-2">
              <CardTitle className="text-sm text-center">ROI Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              {capturedImage ? (
                <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
                  <img 
                    src={capturedImage} 
                    alt="Captured screenshot" 
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm text-gray-500">No image captured</span>
                </div>
              )}
            </CardContent>
          </Card>
  
          {/* Canny Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-2">
              <CardTitle className="text-sm text-center">Canny Edge Detection</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-gray-100 rounded-lg"></div>
            </CardContent>
          </Card>
  
          {/* Joint Analysis */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-2">
              <CardTitle className="text-sm text-center">Joint Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-gray-100 rounded-lg"></div>
            </CardContent>
          </Card>
  
          {/* LOWESS Output */}
          <Card className="flex flex-col h-64">
            <CardHeader className="p-2">
              <CardTitle className="text-sm text-center">LOWESS Visualization</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              <div className="h-full bg-gray-100 rounded-lg"></div>
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