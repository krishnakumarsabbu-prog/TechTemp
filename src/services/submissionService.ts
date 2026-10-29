import type {
  Participant,
  Participation,
  QuizState,
  QuizResult,
  Submission,
} from '../types';
import { collectDeviceMetadata } from '../utils/deviceFingerprint';
import { generateParticipationKey } from '../utils/participation';
import { buildSubmission, validateSubmission } from '../utils/submission';
import {
  getPendingSubmissions,
  markSubmissionSynced,
  saveSubmissionRecord,
} from '../utils/storage';
import { saveBoothResultInFirestore } from './firebaseService';

export async function generateSubmission(
  participant: Participant,
  quizState: QuizState,
  result: QuizResult,
  boothsCompletedSoFar: number = 1,
): Promise<Submission> {
  const device = collectDeviceMetadata();
  const participationKey = await generateParticipationKey(participant);
  const participation: Participation = {
    deviceId: device.deviceId,
    participationKey,
    attemptNumber: boothsCompletedSoFar,
  };

  const submission = buildSubmission(participant, device, participation, quizState, result, boothsCompletedSoFar);
  if (!validateSubmission(submission)) {
    throw new Error('Generated submission failed validation.');
  }
  return submission;
}

/**
 * Syncs submission results solely to Firebase Firestore database
 */
const inFlightSyncs = new Map<string, Promise<boolean>>();

function syncSubmission(submission: Submission): Promise<boolean> {
  const syncKey = `${submission.participant.email.toLowerCase()}:${submission.submission.submissionId}`;
  const existingSync = inFlightSyncs.get(syncKey);
  if (existingSync) return existingSync;

  const sync = (async () => {
    try {
      const res = await saveBoothResultInFirestore(submission.participant, submission);
      if (res.success) {
        markSubmissionSynced(submission);
        console.log(`[Submission] ✓ Saved booth ${submission.booth?.boothNumber} result in Firebase for ${submission.participant.email}`);
        return true;
      }
      console.warn('[Submission] Failed to save result in Firebase:', res.error);
      return false;
    } catch (e) {
      console.warn('[Submission] Firebase Firestore error:', e);
      return false;
    }
  })();

  inFlightSyncs.set(syncKey, sync);
  void sync.then(() => {
    if (inFlightSyncs.get(syncKey) === sync) inFlightSyncs.delete(syncKey);
  });
  return sync;
}

export async function retryPendingSubmissions(email: string): Promise<void> {
  const pending = getPendingSubmissions(email);
  for (const submission of pending) {
    await syncSubmission(submission);
  }
}

export async function submitResult(
  participant: Participant,
  quizState: QuizState,
  result: QuizResult,
  boothsCompletedSoFar: number = 1,
  onSyncStatus?: (status: 'local-save-failed' | 'sync-pending' | 'synced' | 'sync-failed') => void,
): Promise<Submission> {
  // 1. Generate standard submission schema
  const submission = await generateSubmission(participant, quizState, result, boothsCompletedSoFar);

  // 2. Persist in local storage
  const savedLocally = saveSubmissionRecord(submission);
  onSyncStatus?.(savedLocally ? 'sync-pending' : 'local-save-failed');

  // The local pending queue is retained until Firestore acknowledges the write.
  syncSubmission(submission).then((synced) => {
    onSyncStatus?.(synced ? 'synced' : (savedLocally ? 'sync-pending' : 'sync-failed'));
  }).catch((err) => {
    console.warn('[Submission] Background sync error:', err);
    onSyncStatus?.(savedLocally ? 'sync-pending' : 'sync-failed');
  });

  return submission;
}
