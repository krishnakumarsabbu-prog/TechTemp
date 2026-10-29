import { useMemo, useState, useCallback } from 'react';
import type { Participant, BoothResult, BoothConfig } from '../types';
import { BOOTHS, MAX_BOOTHS_PER_PARTICIPANT, REQUIRED_BOOTHS_TO_WIN, TOTAL_BOOTHS } from '../data/boothsConfig';
import { Button } from '../components/Button';
import { QRScannerModal } from '../components/QRScannerModal';
import { parseBoothFromScan, playErrorSound } from '../utils/qrHelper';
import {
  getBoothIcon,
  AlertCircleIcon,
} from '../components/Icons';

import { MobileNav } from '../components/MobileNav';

interface PassportProps {
  participant: Participant | null;
  boothResults: Record<string, BoothResult>;
  hasReachedBoothLimit: boolean;
  onBackToCurrent?: () => void;
  hasActiveQuiz?: boolean;
  onLaunchBooth?: (booth: BoothConfig) => void;
  onOpenUrl?: (url: string) => void;
  onEditProfile?: () => void;
  onGoHome?: () => void;
}

export function Passport({
  participant,
  boothResults,
  hasReachedBoothLimit,
  onBackToCurrent,
  hasActiveQuiz,
  onLaunchBooth,
  onOpenUrl,
  onEditProfile,
  onGoHome,
}: PassportProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanTargetBooth, setScanTargetBooth] = useState<BoothConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const completedList = useMemo(() => Object.values(boothResults), [boothResults]);
  const completedCount = completedList.length;
  const isWinner = completedCount >= REQUIRED_BOOTHS_TO_WIN;
  const remainingToWin = Math.max(0, REQUIRED_BOOTHS_TO_WIN - completedCount);

  // Overall statistics
  const stats = useMemo(() => {
    let totalScore = 0;
    let totalQuestions = 0;
    let totalTime = 0;
    completedList.forEach((r) => {
      totalScore += r.score;
      totalQuestions += r.totalQuestions;
      totalTime += r.timeTakenSeconds;
    });

    const accuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const avgTime = completedCount > 0 ? Math.round(totalTime / completedCount) : 0;

    return { totalScore, totalQuestions, accuracy, avgTime, totalTime };
  }, [completedList, completedCount]);

  const progressPercentage = Math.min(100, Math.round((completedCount / REQUIRED_BOOTHS_TO_WIN) * 100));

  const handleOpenScanner = useCallback((target?: BoothConfig | null) => {
    setScanTargetBooth(target || null);
    setIsScannerOpen(true);
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const { booth, externalUrl } = parseBoothFromScan(decodedText);

    if (scanTargetBooth && booth && booth.id !== scanTargetBooth.id) {
      playErrorSound();
      setToastMessage(
        `Wrong Booth! You selected Booth ${scanTargetBooth.number} (${scanTargetBooth.title}), but scanned Booth ${booth.number} (${booth.title}). Please scan the QR code for Booth ${scanTargetBooth.number} to play.`
      );
      setTimeout(() => setToastMessage(null), 6000);
      return;
    }

    setIsScannerOpen(false);

    if (booth) {
      if (onLaunchBooth) {
        onLaunchBooth(booth);
      }
    } else if (externalUrl) {
      if (onOpenUrl) {
        onOpenUrl(externalUrl);
      } else {
        window.location.href = externalUrl;
      }
    } else {
      setToastMessage(
        `Scanned: "${decodedText.length > 40 ? decodedText.slice(0, 40) + '...' : decodedText}". Not recognized as a summit booth challenge.`
      );
      setTimeout(() => setToastMessage(null), 4500);
    }
  }, [scanTargetBooth, onLaunchBooth, onOpenUrl]);

  return (
    <div className="ts-page ts-page--passport">
      <div className="ts-page__container ts-page__container--wide">
        {/* 1. Profile header row (no card) */}
        <div className="ts-passport-profile-header">
          <div className="ts-passport-avatar" aria-hidden="true">
            {participant?.name ? participant.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div className="ts-passport-user-info">
            <span className="ts-passport-badge-tag">OFFICIAL SUMMIT PASSPORT</span>
            <h1 className="ts-passport-user-name">
              {participant ? participant.name : 'Summit Attendee'}
            </h1>
            {participant && (
              <span className="ts-passport-user-email">{participant.email || participant.entId}</span>
            )}
          </div>
          {onEditProfile && (
            <button
              type="button"
              className="ts-passport-edit-btn"
              onClick={onEditProfile}
              title="Update registration details"
            >
              <span>Edit</span>
            </button>
          )}
        </div>

        {/* 2. Challenge progress card */}
        <div className={`ts-qualification-banner ${isWinner ? 'ts-qualification-banner--winner' : 'ts-qualification-banner--progress'}`}>
          <div className="ts-qualification-top-row">
            <h2 className="ts-qualification-title">
              {isWinner ? 'Summit Prize Qualifier & Winner!' : 'Challenge in progress'}
            </h2>
            <span className="ts-qualification-pill">
              {isWinner ? 'Winner' : `${completedCount} of ${REQUIRED_BOOTHS_TO_WIN} to win`}
            </span>
          </div>

          <p className="ts-qualification-desc">
            {isWinner
              ? `Incredible achievement! You have completed ${completedCount} booth quizzes. Present this pass at the Summit helpdesk for your prize!`
              : `Complete ${remainingToWin} more booth ${remainingToWin === 1 ? 'quiz' : 'quizzes'} to unlock official prize qualification.`}
          </p>

          <div className="ts-passport-progress-bar-wrap">
            <div className="ts-passport-progress-bar">
              <div
                className="ts-passport-progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="ts-passport-progress-labels">
              <span>{completedCount} played</span>
              <span>Goal: {REQUIRED_BOOTHS_TO_WIN} quizzes</span>
              <span>Max: {TOTAL_BOOTHS} booths</span>
            </div>
          </div>
        </div>

        {/* 3. Stats: ONE .glass card with a 2x2 grid & hairline dividers */}
        <div className="ts-passport-stats-grid">
          <div className="ts-stat-cell ts-stat-cell--tl">
            <span className="ts-stat-card__number">{completedCount}/{TOTAL_BOOTHS}</span>
            <span className="ts-stat-card__label">BOOTHS PLAYED</span>
          </div>
          <div className="ts-stat-cell ts-stat-cell--tr">
            <span className="ts-stat-card__number">{stats.totalScore}/{stats.totalQuestions}</span>
            <span className="ts-stat-card__label">TOTAL SCORE</span>
          </div>
          <div className="ts-stat-cell ts-stat-cell--bl">
            <span className="ts-stat-card__number">{stats.accuracy}%</span>
            <span className="ts-stat-card__label">ACCURACY</span>
          </div>
          <div className="ts-stat-cell ts-stat-cell--br">
            <span className="ts-stat-card__number">{stats.avgTime}s</span>
            <span className="ts-stat-card__label">AVG TIME / BOOTH</span>
          </div>
        </div>

        {/* 4. Booth status section */}
        <div className="ts-booths-matrix-section">
          <div className="ts-matrix-header" id="booth-status">
            <div>
              <h2 className="ts-matrix-title">Booth status</h2>
              <span className="ts-matrix-subtitle">Choose up to {MAX_BOOTHS_PER_PARTICIPANT} of {TOTAL_BOOTHS} booths</span>
            </div>
            <button
              type="button"
              className="ts-passport-scan-qr-btn"
              onClick={() => handleOpenScanner(null)}
              title="Open camera to scan any booth QR code"
              disabled={hasReachedBoothLimit}
            >
              <span>{hasReachedBoothLimit ? 'Limit reached' : 'Scan QR'}</span>
            </button>
          </div>

          {hasReachedBoothLimit && (
            <p className="ts-matrix-subtitle" role="status">
              You have completed the maximum of {MAX_BOOTHS_PER_PARTICIPANT} booth quizzes.
            </p>
          )}

          {/* 5. Booth rows */}
          <div className="ts-booths-grid">
            {BOOTHS.map((booth) => {
              const res = boothResults[booth.id];
              const isCompleted = Boolean(res);

              return (
                <div
                  key={booth.id}
                  className={`ts-booth-card ${isCompleted ? 'ts-booth-card--completed' : 'ts-booth-card--pending'}`}
                  onClick={() => {
                    if (!isCompleted && !hasReachedBoothLimit) {
                      handleOpenScanner(booth);
                    }
                  }}
                  role={!isCompleted && !hasReachedBoothLimit ? 'button' : undefined}
                  tabIndex={!isCompleted && !hasReachedBoothLimit ? 0 : undefined}
                >
                  <div className="ts-booth-card__icon" aria-hidden="true">
                    {getBoothIcon(booth.number, 22)}
                  </div>
                  <div className="ts-booth-card__content">
                    <div className="ts-booth-card__header-line">
                      <span className="ts-booth-card__number">BOOTH {booth.number}</span>
                      <span className={`ts-booth-card__status-pill ${isCompleted ? 'ts-pill-done' : 'ts-pill-todo'}`}>
                        {isCompleted ? 'Completed' : 'Awaiting'}
                      </span>
                    </div>
                    <h3 className="ts-booth-card__title">{booth.title}</h3>
                    {isCompleted && res ? (
                      <div className="ts-booth-card__stats-line">
                        {res.score} / {res.totalQuestions} ({res.percentage}%) · {res.timeTakenSeconds}s
                      </div>
                    ) : (
                      <p className="ts-booth-card__desc">{booth.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Back / Navigation button */}
        {hasActiveQuiz && onBackToCurrent && (
          <div className="ts-passport-actions">
            <Button onClick={onBackToCurrent} fullWidth>
              RETURN TO CURRENT QUIZ
            </Button>
          </div>
        )}

        {/* Live Camera QR Scanner Modal */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          targetBooth={scanTargetBooth}
        />

        {/* Toast feedback */}
        {toastMessage && (
          <div className="ts-scanner-toast ts-scanner-toast--error" role="alert">
            <span><AlertCircleIcon size={18} /></span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Floating Mobile Nav */}
        <MobileNav
          activeItem="passport"
          onHome={onGoHome}
          onBooths={() => document.getElementById('booth-status')?.scrollIntoView({ behavior: 'smooth' })}
          onPassport={() => handleOpenScanner(null)}
          onFaqs={onGoHome}
          onProfile={onEditProfile}
        />
      </div>
    </div>
  );
}
