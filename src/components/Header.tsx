import { TicketIcon, TrophyIcon, CloseIcon } from './Icons';

interface HeaderProps {
  completedCount?: number;
  isWinner?: boolean;
  onOpenPassport?: () => void;
  isPassportActive?: boolean;
}

export function Header({
  completedCount = 0,
  isWinner = false,
  onOpenPassport,
  isPassportActive = false,
}: HeaderProps) {
  if (!onOpenPassport) return null;

  return (
    <header className="ts-header" aria-label="Challenge navigation">
      <div className="ts-header__inner">
        <div className="ts-header__brand">
          <span className="ts-header__badge">INNOVATION SHOWCASE 2026</span>
        </div>
        <div className="ts-header__right">
          <button
            type="button"
            className={`ts-header__passport-btn ${isWinner ? 'ts-header__passport-btn--winner' : ''}`}
            onClick={onOpenPassport}
            title="View your challenge passport and booth progress"
          >
            <span className="ts-header__passport-icon">
              {isPassportActive ? <CloseIcon size={16} /> : isWinner ? <TrophyIcon size={16} /> : <TicketIcon size={16} />}
            </span>
            <span className="ts-header__passport-text ts-header__passport-text--full">
              {isPassportActive
                ? 'Close'
                : isWinner
                ? `Winner (${completedCount}/9)`
                : `Passport (${completedCount}/4)`}
            </span>
            <span className="ts-header__passport-text ts-header__passport-text--compact">
              {isPassportActive
                ? 'Close'
                : isWinner
                ? `Winner (${completedCount})`
                : `${completedCount}/4`}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
