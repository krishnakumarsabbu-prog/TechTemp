import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  collectionGroup,
  getDocs,
} from 'firebase/firestore';
import type { Participant, BoothResult, Submission } from '../types';

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaweGLFMHeReP5GlqXOUA5Gro5ZahFqVE",
  authDomain: "innovation-showcase-2026.firebaseapp.com",
  projectId: "innovation-showcase-2026",
  storageBucket: "innovation-showcase-2026.firebasestorage.app",
  messagingSenderId: "577856466009",
  appId: "1:577856466009:web:7fe373b4d1771de3655548",
};

// Initialize Firebase singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export interface ParticipantFetchResult {
  exists: boolean;
  participant?: Participant;
  summary?: any;
  boothResults?: Record<string, BoothResult>;
  error?: string;
}

export function getParticipantDocKey(p: Partial<Participant> | string): string {
  if (typeof p === 'string') {
    return p.trim().toLowerCase();
  }
  return (p.email || p.entId || 'UNKNOWN').trim().toLowerCase();
}

/**
 * Saves one canonical record for this participant and booth.
 * The booth record contains the submission and answers; passport totals are
 * derived from these records when fetched instead of being written separately.
 */
export async function saveBoothResultInFirestore(
  participant: Participant,
  submission: Submission,
): Promise<{ success: boolean; error?: string }> {
  const docKey = getParticipantDocKey(participant);
  if (!docKey || docKey === 'unknown') {
    return { success: false, error: 'Invalid participant email' };
  }

  const boothNumber = submission.booth?.boothNumber || 1;
  const now = submission.submission?.completedAt || new Date().toISOString();

  try {
    const boothDocRef = doc(db, 'participants', docKey, 'booths', `booth-${boothNumber}`);
    const boothData = {
      ...submission,
      savedAt: now,
    };
    await setDoc(boothDocRef, boothData);

    console.log(`[Firestore] ✓ Saved booth ${boothNumber} result for ${docKey}`);
    return { success: true };
  } catch (err: any) {
    console.warn(`[Firestore] Error saving booth result for ${docKey}:`, err);
    return { success: false, error: err.message };
  }
}

export async function saveParticipantRegistrationInFirestore(
  participant: Participant,
): Promise<{ success: boolean; error?: string }> {
  const docKey = getParticipantDocKey(participant);
  if (!docKey || docKey === 'unknown') {
    return { success: false, error: 'Invalid participant email' };
  }

  try {
    await setDoc(
      doc(db, 'participants', docKey),
      { ...participant, registeredAt: new Date().toISOString() },
      { merge: true },
    );
    return { success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Firestore] Error saving participant registration for ${docKey}:`, err);
    return { success: false, error };
  }
}

/**
 * Fetches participant details and all completed booth records from Firestore.
 * Executed when participant inputs their email or accesses via URL param.
 */
export async function fetchParticipantFromFirestore(identifier: string): Promise<ParticipantFetchResult> {
  const cleanId = (identifier || '').trim().toLowerCase();
  if (!cleanId) return { exists: false };

  try {
    const docKeys = [cleanId];
    if (!cleanId.includes('@') && cleanId.toUpperCase() !== cleanId) {
      docKeys.push(cleanId.toUpperCase());
    }

    // New records have no parent participant document: each completed booth is
    // the canonical record. Check those first, then fall back to old parent docs.
    for (const docKey of docKeys) {
      const participantRef = doc(db, 'participants', docKey);
      const [boothsSnap, participantSnap] = await Promise.all([
        getDocs(collection(participantRef, 'booths')),
        getDoc(participantRef),
      ]);

      if (!boothsSnap.empty) {
        const firstBoothData = boothsSnap.docs[0].data();
        const participantData = firstBoothData.participant || {};
        const participant: Participant = {
          name: participantData.name || '',
          email: participantData.email || cleanId,
          role: participantData.role || 'Summit Attendee',
        };
        const boothResults: Record<string, BoothResult> = {};

        boothsSnap.forEach((boothDoc: any) => {
          const boothData = boothDoc.data();
          const boothNumber = boothData.booth?.boothNumber || Number(boothDoc.id.match(/\d+/)?.[0]) || 1;
          const boothId = boothData.booth?.boothId || `booth-${boothNumber}`;
          const quiz = boothData.quiz || {};

          boothResults[boothId] = {
            boothId,
            boothNumber,
            boothTitle: boothData.booth?.boothTitle || `Booth ${boothNumber}`,
            topicId: boothData.booth?.topicId,
            topicTitle: boothData.booth?.topicTitle || 'Standard Topic',
            score: quiz.score ?? 0,
            totalQuestions: quiz.totalQuestions ?? 0,
            percentage: quiz.percentage ?? 0,
            correctAnswers: quiz.correctAnswers ?? quiz.score ?? 0,
            incorrectAnswers: quiz.incorrectAnswers ?? Math.max(0, (quiz.totalQuestions ?? 0) - (quiz.score ?? 0)),
            unansweredAnswers: quiz.unansweredAnswers ?? 0,
            timeTakenSeconds: quiz.timeTakenSeconds ?? 0,
            completedAt: boothData.submission?.completedAt || boothData.savedAt || new Date().toISOString(),
            answers: boothData.answers || [],
          };
        });

        return { exists: true, participant, boothResults };
      }

      // Compatibility for existing registrations and records made by the old schema.
      if (participantSnap.exists()) {
        const data = participantSnap.data();
        const participant: Participant = {
          name: data.name || '',
          email: data.email || cleanId,
          role: data.role || 'Summit Attendee',
        };
        const boothResults: Record<string, BoothResult> = {};
        const summaryTests = Array.isArray(data.tests) ? data.tests : [];

        for (const test of summaryTests) {
          const boothNumber = test.boothNumber || Number(String(test.boothId || '').match(/\d+/)?.[0]) || 1;
          const boothId = test.boothId || `booth-${boothNumber}`;
          boothResults[boothId] = {
            boothId,
            boothNumber,
            boothTitle: test.boothTitle || `Booth ${boothNumber}`,
            topicTitle: test.topicTitle || 'Standard Topic',
            score: test.score ?? 0,
            totalQuestions: test.totalQuestions ?? 0,
            percentage: test.percentage ?? 0,
            correctAnswers: test.correctAnswers ?? test.score ?? 0,
            incorrectAnswers: test.incorrectAnswers ?? Math.max(0, (test.totalQuestions ?? 0) - (test.score ?? 0)),
            unansweredAnswers: test.unansweredAnswers ?? 0,
            timeTakenSeconds: test.timeTakenSeconds ?? 0,
            completedAt: test.completedAt || data.lastUpdated || new Date().toISOString(),
            answers: [],
          };
        }

        return { exists: true, participant, summary: data, boothResults };
      }
    }

    return { exists: false };
  } catch (err: any) {
    console.warn(`[Firestore] Error fetching participant ${cleanId}:`, err);
    return { exists: false, error: err.message };
  }
}

/**
 * Tests connection to Firestore database
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; message: string; projectId: string }> {
  try {
    const pingRef = doc(db, '_connection_test', 'ping');
    await setDoc(pingRef, { timestamp: new Date().toISOString() });
    return {
      success: true,
      message: `Successfully connected to Firestore Project: ${firebaseConfig.projectId}`,
      projectId: firebaseConfig.projectId,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Firestore: ${err.message}`,
      projectId: firebaseConfig.projectId,
    };
  }
}

/**
 * Fetches all participants from Firestore for admin analytics & dashboard sync
 */
export async function fetchAllParticipants(): Promise<Record<string, unknown>[]> {
  try {
    const [participantsSnap, boothsSnap] = await Promise.all([
      getDocs(collection(db, 'participants')),
      getDocs(collectionGroup(db, 'booths')),
    ]);
    const participants = new Map<string, Record<string, unknown>>();
    participantsSnap.forEach((participantDoc: any) => {
      const participant = participantDoc.data();
      const email = String(participant.email || participantDoc.id).trim().toLowerCase();
      if (email) participants.set(email, participant);
    });
    boothsSnap.forEach((boothDoc: any) => {
      const data = boothDoc.data();
      const participant = data.participant || {};
      const email = String(participant.email || '').trim().toLowerCase();
      if (email && !participants.has(email)) {
        participants.set(email, participant as Record<string, unknown>);
      }
    });
    return [...participants.values()];
  } catch (err) {
    console.warn('[Firestore] Error fetching all participants:', err);
    throw err;
  }
}

/**
 * Fetches all submissions from Firestore for admin analytics & dashboard sync
 */
export async function fetchAllSubmissions(): Promise<Record<string, unknown>[]> {
  try {
    const [boothResultsSnap, legacySubmissionsSnap] = await Promise.all([
      getDocs(collectionGroup(db, 'booths')),
      getDocs(collection(db, 'submissions')),
    ]);
    const submissions = new Map<string, Record<string, unknown>>();

    // Older versions wrote the same attempt into both collections. Deduplicate
    // those while including booth-only records written by the current schema.
    boothResultsSnap.forEach((submissionDoc: any) => {
      const data = submissionDoc.data();
      const id = data.submission?.submissionId || submissionDoc.ref.path;
      submissions.set(id, data);
    });
    legacySubmissionsSnap.forEach((submissionDoc: any) => {
      const data = submissionDoc.data();
      const id = data.submission?.submissionId || submissionDoc.id;
      submissions.set(id, data);
    });

    return [...submissions.values()];
  } catch (err) {
    console.warn('[Firestore] Error fetching all submissions:', err);
    throw err;
  }
}
