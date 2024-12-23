"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Camera, Video, VideoOff } from 'lucide-react'
import { Button } from './ui/button'

interface CameraFeedProps {
  cameraIndex?: number;
}

export function CameraFeed({ cameraIndex = 0 }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isStreamActive, setIsStreamActive] = useState<boolean>(false)
  const [, setError] = useState<string>('')
  const [showControls, setShowControls] = useState<boolean>(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      
      // Set the device ID based on camera index
      if (videoDevices[cameraIndex]) {
        setSelectedDeviceId(videoDevices[cameraIndex].deviceId)
      }
      
      // Log camera information
      console.log('Available Cameras:')
      videoDevices.forEach((device, index) => {
        console.log(`Camera ${index}:`)
        console.log(`- Device ID: ${device.deviceId}`)
        console.log(`- Label: ${device.label || 'Label will be available after camera permission'}`)
        console.log('-------------------')
      })
    } catch (err) {
      console.error('Error getting camera devices:', err)
    }
  }

  useEffect(() => {
    getAvailableCameras()
  }, [cameraIndex])

  const startCamera = async (): Promise<void> => {
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsStreamActive(true)
        setError('')
      }
    } catch (err) {
      const errorMessage = 'Unable to access camera. Please check permissions.'
      setError(errorMessage)
      console.error('Error accessing camera:', err)
    }
  }

  const stopCamera = (): void => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()
      tracks.forEach((track: MediaStreamTrack) => track.stop())
      videoRef.current.srcObject = null
      setIsStreamActive(false)
    }
  }

  const handleMouseMove = (): void => {
    setShowControls(true)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout to hide controls after 2 seconds of no movement
    timeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2000)
  }

  const handleMouseLeave = (): void => {
    setShowControls(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return <div className="flex flex-col gap-4 mt-4">
    <div className="flex justify-between items-center">
      <h1>Camera Feed</h1>
      {availableCameras.length > 1 && (
        <select 
          className="p-2 rounded-md bg-slate-800 text-white border border-slate-700"
          value={cameraIndex}
          onChange={(e) => {
            stopCamera();
            const newIndex = parseInt(e.target.value);
            if (!isNaN(newIndex) && availableCameras[newIndex]) {
              setSelectedDeviceId(availableCameras[newIndex].deviceId);
            }
          }}
        >
          {availableCameras.map((camera, index) => (
            <option key={camera.deviceId} value={index}>
              Camera {index} {camera.label ? `(${camera.label})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-950 border border-white"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isStreamActive || showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${!isStreamActive ? 'bg-black/40' : ''}`}
      >
        <button
          onClick={isStreamActive ? stopCamera : startCamera}
          className="rounded-full bg-black/40 p-4 backdrop-blur-sm transition-all hover:bg-black/60"
          aria-label={isStreamActive ? "Stop Camera" : "Start Camera"}
        >
          {isStreamActive ? (
            <VideoOff className="h-8 w-8 text-white" />
          ) : (
            <Video className="h-8 w-8 text-white" />
          )}
        </button>
      </div>
    </div>

    <Button>
      <Camera className="h-4 w-4" />
      Capture
    </Button>
  </div>
}