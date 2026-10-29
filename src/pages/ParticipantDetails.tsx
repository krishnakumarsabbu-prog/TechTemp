import { useState } from 'react';
import type { Participant, BoothConfig, BoothResult } from '../types';
import { Button } from '../components/Button';
import {
  fetchParticipantFromFirestore,
  saveParticipantRegistrationInFirestore,
} from '../services/firebaseService';
import { getBoothIcon } from '../components/Icons';

interface ParticipantDetailsProps {
  initialData: Partial<Participant> | null;
  targetBooth?: BoothConfig | null;
  onContinue: (participant: Participant, restoredResults?: Record<string, BoothResult>) => void;
  onBack?: () => void;
}

interface FormErrors {
  name?: string;
  email?: string;
}

export function ParticipantDetails({
  initialData,
  targetBooth,
  onContinue,
  onBack,
}: ParticipantDetailsProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [email, setEmail] = useState(initialData?.email ?? (initialData as any)?.entId ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const e: FormErrors = {};
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      e.name = 'Please enter your full name.';
    } else if (cleanName.length < 2) {
      e.name = 'Name must be at least 2 characters.';
    }

    if (!cleanEmail) {
      e.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      e.email = 'Please enter a valid email address.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const existing = await fetchParticipantFromFirestore(cleanEmail);
      if (existing.error) {
        console.warn('[Registration] Unable to check existing attendee:', existing.error);
        setSubmitError('We could not check your passport right now. Please check your connection and try again.');
        return;
      }

      const participant: Participant = {
        name: cleanName || existing.participant?.name || '',
        email: cleanEmail,
        role: 'Summit Attendee',
      };

      // Reuse the existing record and restore its booth results across browsers.
      // Only new participants need the separate registration write.
      if (existing.exists) {
        onContinue(participant, existing.boothResults ?? {});
        return;
      }

      const saveRes = await saveParticipantRegistrationInFirestore(participant);
      if (!saveRes.success) {
        console.warn('[Registration] Unable to save attendee:', saveRes.error);
        setSubmitError('We could not save your registration right now. Please check your connection and try again.');
        return;
      }

      onContinue(participant);
    } catch (error) {
      console.warn('[Registration] Attendee registration failed:', error);
      setSubmitError('We could not save your registration right now. Please check your connection and try again.');
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ts-page ts-page--participant">
      <div className="ts-page__container">
        {targetBooth && (
          <div className="ts-participant-booth-pill">
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getBoothIcon(targetBooth.number, 18)}</span>
            <span>Booth {targetBooth.number}: <strong>{targetBooth.title}</strong></span>
          </div>
        )}

        <h1 className="ts-page__title ts-page__title--sm">PARTICIPANT REGISTRATION</h1>
        <p className="ts-page__description">
          Enter your name and email to initialize your Summit Challenge Passport.
        </p>

        <form className="ts-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="ts-field">
            <label htmlFor="name" className="ts-field__label">
              Full Name <span className="ts-field__required">*</span>
            </label>
            <input
              id="name"
              type="text"
              className={`ts-field__input ${errors.name ? 'ts-field__input--error' : ''}`}
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              autoComplete="name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {errors.name && <span className="ts-field__error" role="alert">{errors.name}</span>}
          </div>

          {/* Email Address */}
          <div className="ts-field">
            <label htmlFor="email" className="ts-field__label">
              Email Address <span className="ts-field__required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`ts-field__input ${errors.email ? 'ts-field__input--error' : ''}`}
              placeholder="e.g. alex.morgan@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
            />
            {errors.email && <span className="ts-field__error" role="alert">{errors.email}</span>}
          </div>

          {submitError && <p className="ts-field__error" role="alert">{submitError}</p>}

          {/* Actions */}
          <div className="ts-form__actions">
            {onBack && (
              <Button type="button" variant="secondary" onClick={onBack} disabled={isSubmitting}>
                ← BACK
              </Button>
            )}
            <Button type="submit" fullWidth={!onBack} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="ts-loading-btn-content">
                  <span className="ts-spinner-icon" aria-hidden="true" />
                  <span>PREPARING PASSPORT…</span>
                </span>
              ) : (
                'REGISTER & CONTINUE →'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
