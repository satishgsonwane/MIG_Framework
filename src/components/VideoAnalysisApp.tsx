"use client" 
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, Play, Pause, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VideoAnalysisProps {
  onAnalysisComplete?: (data: any) => void;
}

const VideoAnalysisApp: React.FC<VideoAnalysisProps> = ({ onAnalysisComplete }) => {
  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState('raw');
  const [roi, setRoi] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isSelectingRoi, setIsSelectingRoi] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roiStartRef = useRef<{ x: number; y: number } | null>(null);

  // Start video stream
  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          setError('');
        };
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
    }
  };

  // Stop video stream
  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      setIsStreaming(false);
      setAnimationFrame(null);
    }
  };

  // ROI selection handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingRoi) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    roiStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingRoi || !roiStartRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setRoi({
      x: Math.min(roiStartRef.current.x, currentX),
      y: Math.min(roiStartRef.current.y, currentY),
      width: Math.abs(currentX - roiStartRef.current.x),
      height: Math.abs(currentY - roiStartRef.current.y)
    });
  };

  const handleCanvasMouseUp = () => {
    setIsSelectingRoi(false);
    roiStartRef.current = null;
  };

  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

const processFrame = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !canvas || !isStreaming) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size to match video dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current video frame
  ctx.drawImage(video, 0, 0);

  // Draw ROI if exists
  if (roi.width && roi.height) {
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
  }

  // Process frame based on active tab
  switch (activeTab) {
    case 'edges':
      // Edge detection processing
      break;
    case 'joints':
      // Joint detection
      break;
    case 'lowess':
      // LOWESS visualization
      break;
  }

  // Continue the animation loop
  const frameId = requestAnimationFrame(processFrame);
  setAnimationFrame(frameId);
};

  // Start processing when streaming
  useEffect(() => {
    if (isStreaming) {
      const frameId = requestAnimationFrame(processFrame);
      setAnimationFrame(frameId);
    }
  
    // Cleanup function
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isStreaming, activeTab]);

  return (
    <div className="flex h-screen bg-gray-900 text-white p-4 gap-4">
      {/* Video Analysis Section */}
      <div className="w-1/5 ">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Video Analysis</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsSelectingRoi(!isSelectingRoi)}
                >
                  <Square className={isSelectingRoi ? "text-cyan-400" : "text-gray-400"} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={isStreaming ? stopStream : startStream}
                >
                  {isStreaming ? <Pause /> : <Play />}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted // Add muted attribute to ensure autoplay works
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </CardContent>
        </Card>
      </div>

      {/* Controls Section */}
      <div className="w-80">
        <Card className="h-full bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Analysis Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="edges">Edges</TabsTrigger>
                <TabsTrigger value="joints">Joints</TabsTrigger>
                <TabsTrigger value="lowess">LOWESS</TabsTrigger>
              </TabsList>
              <TabsContent value="raw">
                <p className="text-sm text-gray-400">
                  Raw video feed without processing.
                </p>
              </TabsContent>
              <TabsContent value="edges">
                <p className="text-sm text-gray-400">
                  Canny edge detection visualization.
                </p>
              </TabsContent>
              <TabsContent value="joints">
                <p className="text-sm text-gray-400">
                  Joint detection and classification.
                </p>
              </TabsContent>
              <TabsContent value="lowess">
                <p className="text-sm text-gray-400">
                  LOWESS fit visualization.
                </p>
              </TabsContent>
            </Tabs>

            {roi.width > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Selected ROI</h3>
                <p className="text-sm text-gray-400">
                  Position: ({roi.x.toFixed(0)}, {roi.y.toFixed(0)})<br />
                  Size: {roi.width.toFixed(0)} × {roi.height.toFixed(0)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VideoAnalysisApp;