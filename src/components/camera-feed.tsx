"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Camera, Video, VideoOff } from 'lucide-react'
import { Button } from './ui/button'


export function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isStreamActive, setIsStreamActive] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [showControls, setShowControls] = useState<boolean>(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startCamera = async (): Promise<void> => {
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsStreamActive(true)
        setError('')
        // onStreamStart?.()
      }
    } catch (err) {
      const errorMessage = 'Unable to access camera. Please check permissions.'
      setError(errorMessage)
      // onError?.(errorMessage)
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
      // onStreamStop?.()
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
    <h1>Camera Feed</h1>
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