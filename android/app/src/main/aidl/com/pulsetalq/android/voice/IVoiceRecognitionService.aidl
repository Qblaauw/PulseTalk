package com.pulsetalq.android.voice;

import com.pulsetalq.android.voice.ITranscriptionCallback;

interface IVoiceRecognitionService {
    void startRecording(String requestId, ITranscriptionCallback callback);
    void stopRecording(String requestId);
    void cancelRecording(String requestId);
    int getStatus();
}
