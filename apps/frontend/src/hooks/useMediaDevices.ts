// ============================================================================
// CHATVISTA - Media Devices Hook
// Hook for managing audio/video devices
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface MediaDevicesState {
  audioInputs: MediaDevice[];
  audioOutputs: MediaDevice[];
  videoInputs: MediaDevice[];
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;
}

interface MediaConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDevicesState>({
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
    selectedAudioInput: null,
    selectedAudioOutput: null,
    selectedVideoInput: null,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = deviceList
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
          kind: d.kind,
        }));

      const audioOutputs = deviceList
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 5)}`,
          kind: d.kind,
        }));

      const videoInputs = deviceList
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
          kind: d.kind,
        }));

      setDevices((prev) => ({
        ...prev,
        audioInputs,
        audioOutputs,
        videoInputs,
        selectedAudioInput: prev.selectedAudioInput || audioInputs[0]?.deviceId || null,
        selectedAudioOutput: prev.selectedAudioOutput || audioOutputs[0]?.deviceId || null,
        selectedVideoInput: prev.selectedVideoInput || videoInputs[0]?.deviceId || null,
      }));
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Failed to access media devices');
    }
  }, []);

  // Request permissions and enumerate devices on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Request permission to access devices
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        // Stop the temporary stream
        tempStream.getTracks().forEach((track) => track.stop());

        // Now enumerate devices (labels will be available)
        await enumerateDevices();
      } catch (err) {
        console.error('Failed to get media permissions:', err);
        setError('Camera or microphone access denied');
      }
    };

    init();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [enumerateDevices]);

  // Get media stream with selected devices
  const getMediaStream = useCallback(
    async (constraints?: MediaConstraints): Promise<MediaStream | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const defaultConstraints: MediaConstraints = {
          audio: devices.selectedAudioInput
            ? { deviceId: { exact: devices.selectedAudioInput } }
            : true,
          video: devices.selectedVideoInput
            ? {
                deviceId: { exact: devices.selectedVideoInput },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : true,
        };

        const finalConstraints = constraints || defaultConstraints;
        const newStream = await navigator.mediaDevices.getUserMedia(finalConstraints);

        // Stop previous stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        setStream(newStream);
        return newStream;
      } catch (err) {
        console.error('Failed to get media stream:', err);
        setError('Failed to access camera or microphone');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [devices.selectedAudioInput, devices.selectedVideoInput, stream]
  );

  // Select device
  const selectDevice = useCallback(
    async (kind: 'audioInput' | 'audioOutput' | 'videoInput', deviceId: string) => {
      const keyMap = {
        audioInput: 'selectedAudioInput',
        audioOutput: 'selectedAudioOutput',
        videoInput: 'selectedVideoInput',
      } as const;

      setDevices((prev) => ({
        ...prev,
        [keyMap[kind]]: deviceId,
      }));

      // If it's audio output, we just update the state
      // For audio/video input, we need to get a new stream
      if (kind !== 'audioOutput' && stream) {
        await getMediaStream();
      }
    },
    [getMediaStream, stream]
  );

  // Stop stream
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Toggle audio
  const toggleAudio = useCallback(
    (enabled?: boolean) => {
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = enabled !== undefined ? enabled : !track.enabled;
        });
      }
    },
    [stream]
  );

  // Toggle video
  const toggleVideo = useCallback(
    (enabled?: boolean) => {
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = enabled !== undefined ? enabled : !track.enabled;
        });
      }
    },
    [stream]
  );

  // Get screen share stream
  const getScreenShareStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: true,
      });

      return screenStream;
    } catch (err) {
      console.error('Failed to get screen share:', err);
      setError('Failed to start screen sharing');
      return null;
    }
  }, []);

  return {
    devices: {
      audioInputs: devices.audioInputs,
      audioOutputs: devices.audioOutputs,
      videoInputs: devices.videoInputs,
    },
    selectedDevices: {
      audioInput: devices.selectedAudioInput,
      audioOutput: devices.selectedAudioOutput,
      videoInput: devices.selectedVideoInput,
    },
    stream,
    error,
    isLoading,
    selectDevice,
    getMediaStream,
    stopStream,
    toggleAudio,
    toggleVideo,
    getScreenShareStream,
    enumerateDevices,
  };
}
