"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Square, Play, Pause } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VideoAnalysisProps {
  onAnalysisComplete?: (data: any) => void;
}

const VideoAnalysisApp: React.FC<VideoAnalysisProps> = ({ onAnalysisComplete }) => {
  // States for camera devices
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera1, setSelectedCamera1] = useState<string>("default");
  const [selectedCamera2, setSelectedCamera2] = useState<string>("default");
  
  // Existing states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStream2Active, setIsStream2Active] = useState(false);
  const [isSelectingRoi1, setIsSelectingRoi1] = useState(false);
  const [isSelectingRoi2, setIsSelectingRoi2] = useState(false);
  const [roi1, setRoi1] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [roi2, setRoi2] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [error, setError] = useState('');
  const [jointType, setJointType] = useState('type1');
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const roiStartRef = useRef<{ x: number; y: number } | null>(null);
  // Get available cameras
// Get available cameras
useEffect(() => {
  const getCameras = async () => {
    try {
      // First request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Then enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Available cameras:', videoDevices); // Debug log
      
      setCameras(videoDevices);
      
      // Set default cameras if available
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

  // Add listener for device changes
  navigator.mediaDevices.addEventListener('devicechange', getCameras);

  // Cleanup
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', getCameras);
  };
}, []);

  // Stream control functions
  const startStream = async () => {
    if (!selectedCamera1 || selectedCamera1 === "default") {
      setError('Please select a camera first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: selectedCamera1,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
      setIsStreaming(true);
      setError('');
    } catch (err) {
      setError('Unable to access first camera. Please check permissions.');
    }
  };

  const startStream2 = async () => {
    if (!selectedCamera2 || selectedCamera2 === "default") {
      setError('Please select a camera first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: selectedCamera2,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (video2Ref.current) {
        video2Ref.current.srcObject = stream;
        video2Ref.current.onloadedmetadata = () => {
          video2Ref.current?.play();
        };
      }
      setIsStream2Active(true);
    } catch (err) {
      setError('Unable to access second camera.');
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
  // ROI handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    if (!(isFirst ? isSelectingRoi1 : isSelectingRoi2)) return;
    
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    roiStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isFirst: boolean) => {
    if (!(isFirst ? isSelectingRoi1 : isSelectingRoi2) || !roiStartRef.current) return;
    
    const canvas = isFirst ? canvasRef.current : canvas2Ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

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

  // Frame processing
  const processFrame = () => {
    // Process first video
    if (videoRef.current && canvasRef.current && isStreaming) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = 1920;
        canvasRef.current.height = 1080;
        ctx.drawImage(videoRef.current, 0, 0);
        if (roi1.width && roi1.height) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.strokeRect(roi1.x, roi1.y, roi1.width, roi1.height);
        }
      }
    }

    // Process second video
    if (video2Ref.current && canvas2Ref.current && isStream2Active) {
      const ctx = canvas2Ref.current.getContext('2d');
      if (ctx) {
        canvas2Ref.current.width = 1920;
        canvas2Ref.current.height = 1080;
        ctx.drawImage(video2Ref.current, 0, 0);
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

  useEffect(() => {
    return () => {
      stopStream();
      stopStream2();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="grid grid-cols-2 gap-4 max-w-6xl mx-auto">
        {/* Left Column */}
        <div className="space-y-8">
          {/* First Video Feed */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span>Camera Feed 1</span>
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
                          value={camera.deviceId || `camera-${Math.random()}`}
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
                  >
                    {isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  onMouseDown={(e) => handleCanvasMouseDown(e, true)}
                  onMouseMove={(e) => handleCanvasMouseMove(e, true)}
                  onMouseUp={() => handleCanvasMouseUp(true)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Second Video Feed */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span>Camera Feed 2</span>
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
                          value={camera.deviceId || `camera-${Math.random()}`}
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
                  >
                    {isStream2Active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
        <div className="grid grid-rows-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* ROI Output */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle>ROI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg max-w-md mx-auto"></div>
              </CardContent>
            </Card>

            {/* Canny Output */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle>Canny Edge Detection</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg"></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Joint Analysis */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle>Joint Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg"></div>
              </CardContent>
            </Card>

            {/* LOWESS Output */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle>LOWESS Visualization</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg"></div>
              </CardContent>
            </Card>
          </div>
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