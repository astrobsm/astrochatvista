// ============================================================================
// CHATVISTA - Pre-Join Screen (Waiting Room)
// Screen shown before joining a meeting with device preview
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Volume2,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMediaDevices } from '@/hooks/useMediaDevices';

interface PreJoinScreenProps {
  meetingTitle: string;
  onJoin: (options: { audioEnabled: boolean; videoEnabled: boolean }) => void;
  isJoining?: boolean;
  error?: string | null;
}

export function PreJoinScreen({
  meetingTitle,
  onJoin,
  isJoining = false,
  error,
}: PreJoinScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);

  const {
    devices,
    selectedDevices,
    stream,
    error: deviceError,
    isLoading: devicesLoading,
    selectDevice,
    getMediaStream,
    stopStream,
  } = useMediaDevices();

  // Helper functions for device selection
  const selectCamera = (deviceId: string) => selectDevice('videoInput', deviceId);
  const selectMicrophone = (deviceId: string) => selectDevice('audioInput', deviceId);
  const selectSpeaker = (deviceId: string) => selectDevice('audioOutput', deviceId);

  // Start video preview on mount
  useEffect(() => {
    let isMounted = true;
    
    const initPreview = async () => {
      try {
        setMediaError(null);
        const mediaStream = await getMediaStream({ video: true, audio: true });
        if (isMounted) {
          if (mediaStream) {
            setMediaReady(true);
          } else {
            setMediaError('Could not access camera or microphone');
          }
        }
      } catch (err) {
        console.error('Failed to start media preview:', err);
        if (isMounted) {
          setMediaError('Camera or microphone access denied. Please allow access and try again.');
        }
      }
    };
    
    initPreview();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      stopStream();
    };
  }, []);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure video plays
      videoRef.current.play().catch((err) => {
        console.log('Preview video play failed:', err);
      });
    }
  }, [stream]);

  const handleToggleVideo = async () => {
    if (videoEnabled) {
      // Turn off video - disable track
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setVideoEnabled(false);
    } else {
      // Turn on video - enable or get new stream
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          videoTracks.forEach((track) => {
            track.enabled = true;
          });
        } else {
          // Get a fresh stream with video
          await getMediaStream({ video: true, audio: audioEnabled });
        }
      } else {
        await getMediaStream({ video: true, audio: audioEnabled });
      }
      setVideoEnabled(true);
    }
  };

  const handleToggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !audioEnabled;
      });
    }
    setAudioEnabled(!audioEnabled);
  };

  const handleJoin = () => {
    onJoin({ audioEnabled, videoEnabled });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Ready to join?</h1>
          <p className="text-gray-400">{meetingTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Video preview */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-gray-800 rounded-2xl overflow-hidden">
              {/* Always render video element, just hide it when video is off */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${!videoEnabled || !stream ? 'hidden' : ''}`}
              />
              {(!videoEnabled || !stream) && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {mediaError || deviceError ? (
                    <>
                      <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                      <p className="text-red-400 text-center px-4">{mediaError || deviceError}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        Try Again
                      </button>
                    </>
                  ) : devicesLoading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                      <p className="text-gray-400">Setting up camera...</p>
                    </>
                  ) : stream && !videoEnabled ? (
                    <>
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white mb-4">
                        Y
                      </div>
                      <p className="text-gray-400">Camera is off</p>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white mb-4">
                        Y
                      </div>
                      <p className="text-gray-400">Loading camera...</p>
                    </>
                  )}
                </div>
              )}

              {/* Audio indicator */}
              {!audioEnabled && (
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500/80 rounded-full flex items-center gap-2 text-white text-sm">
                  <MicOff className="w-4 h-4" />
                  Muted
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggleAudio}
                className={`p-4 rounded-full transition-colors ${
                  audioEnabled
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {audioEnabled ? (
                  <Mic className="w-6 h-6" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={handleToggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  videoEnabled
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {videoEnabled ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <VideoOff className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-4 rounded-full transition-colors ${
                  showSettings
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            {showSettings ? (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">Device Settings</h3>

                {/* Camera */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Camera
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDevices.videoInput || ''}
                      onChange={(e) => selectCamera(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {devices.videoInputs.map((device: { deviceId: string; label: string }) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Microphone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Microphone
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDevices.audioInput || ''}
                      onChange={(e) => selectMicrophone(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {devices.audioInputs.map((device: { deviceId: string; label: string }) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Speaker */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Speaker
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDevices.audioOutput || ''}
                      onChange={(e) => selectSpeaker(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {devices.audioOutputs.map((device: { deviceId: string; label: string }) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  Test Audio
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Joining "{meetingTitle}"
                  </h3>

                  <div className="space-y-3 text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${audioEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span>Microphone {audioEnabled ? 'on' : 'off'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${videoEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span>Camera {videoEnabled ? 'on' : 'off'}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mt-8">
                  <Button
                    onClick={handleJoin}
                    isLoading={isJoining}
                    fullWidth
                    size="lg"
                  >
                    Join Meeting
                  </Button>

                  <p className="text-center text-sm text-gray-500">
                    By joining, you agree to our meeting guidelines
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
