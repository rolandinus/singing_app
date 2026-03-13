import AudioRecorderPolyfill from 'audio-recorder-polyfill';
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const webWindow = window as Window & typeof globalThis & {
    MediaRecorder?: typeof MediaRecorder;
  };

  if (!webWindow.MediaRecorder) {
    webWindow.MediaRecorder = AudioRecorderPolyfill as unknown as typeof MediaRecorder;
  }
}
