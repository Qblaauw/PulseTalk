package com.pulsetalq.android.voice;

interface ITranscriptionCallback {
    void onStateChanged(int state, long elapsedMillis);
    void onResult(
        String transcript,
        long audioDurationMillis,
        long transcriptionDurationMillis,
        long modelLoadDurationMillis,
        long peakProcessBytes
    );
    void onError(String message, String retainedTranscript);
}
