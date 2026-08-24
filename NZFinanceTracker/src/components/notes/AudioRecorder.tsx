import { AlertCircle, Loader2, Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import type { TranscriptionStatus } from "../../types";

interface AudioRecorderProps {
  existingAudioUrl: string | null;
  pendingBlob: Blob | null;
  onRecorded: (blob: Blob) => void;
  transcript: string | null;
  transcriptionStatus: TranscriptionStatus;
  onRetryTranscription?: () => void;
}

export function AudioRecorder({
  existingAudioUrl,
  pendingBlob,
  onRecorded,
  transcript,
  transcriptionStatus,
  onRetryTranscription,
}: AudioRecorderProps) {
  const { isRecording, isSupported, error, start, stop } = useAudioRecorder();
  const pendingUrl = useMemo(() => (pendingBlob ? URL.createObjectURL(pendingBlob) : null), [pendingBlob]);

  useEffect(() => {
    return () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [pendingUrl]);

  const playbackUrl = pendingUrl ?? existingAudioUrl;
  const hasAudio = playbackUrl !== null;

  const handleToggleRecording = async () => {
    if (isRecording) {
      const blob = await stop();
      if (blob) onRecorded(blob);
    } else {
      await start();
    }
  };

  const buttonLabel = useMemo(() => {
    if (isRecording) return "Stop recording";
    return hasAudio ? "Re-record" : "Record a voice note";
  }, [isRecording, hasAudio]);

  if (!isSupported) {
    return <p className="text-xs text-slate-400">Voice recording isn't supported in this browser.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleRecording}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            isRecording
              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
              : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {isRecording ? <Square className="h-4 w-4" /> : hasAudio ? <RotateCcw className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {buttonLabel}
        </button>
        {isRecording && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
            Recording…
          </span>
        )}
      </div>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      {hasAudio && playbackUrl && (
        <audio controls src={playbackUrl} className="h-9 w-full max-w-sm" />
      )}

      {transcriptionStatus === "pending" && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Transcribing…
        </p>
      )}
      {transcriptionStatus === "failed" && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Transcription failed.</span>
          {onRetryTranscription && (
            <button type="button" onClick={onRetryTranscription} className="font-medium underline">
              Retry
            </button>
          )}
        </div>
      )}
      {transcriptionStatus === "done" && transcript && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {transcript}
        </p>
      )}
    </div>
  );
}
