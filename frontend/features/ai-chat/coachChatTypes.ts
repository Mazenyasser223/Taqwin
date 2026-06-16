import type { AiFoodDisambiguationCandidate, AiToolCall } from '../../services/aiService';

export interface CoachChatMessage {
  role: 'ai' | 'user';
  text: string;
  confirmationRequired?: boolean;
  confirmationPreview?: string | null;
  disambiguationRequired?: boolean;
  disambiguationKind?: 'food';
  candidates?: AiFoodDisambiguationCandidate[];
  disambiguationQuery?: string;
  /** When true, candidates are shown read-only (pending expired). */
  disambiguationExpired?: boolean;
  actionId?: string | null;
  /** High-impact tools — step-up after idle pending. */
  stepUpEligible?: boolean;
  stepUpRequired?: boolean;
  stepUpPhrase?: string | null;
  stepUpMethods?: Array<'phrase' | 'password'>;
  stepUpIdleMs?: number;
  pendingCreatedAt?: string | null;
  stepUpStaleAt?: string | null;
  /** Inline error from failed step-up confirm (cleared on retry). */
  stepUpConfirmError?: string | null;
  toolCalls?: AiToolCall[];
}

export interface CoachStepUpPayload {
  confirmationPhrase?: string;
  password?: string;
}

export interface CoachActionErrorDetails {
  error?: string;
  code?: string | null;
  stepUpEligible?: boolean;
  stepUpRequired?: boolean;
  stepUpPhrase?: string | null;
  stepUpMethods?: Array<'phrase' | 'password'>;
  stepUpIdleMs?: number;
  pendingCreatedAt?: string | null;
  stepUpStaleAt?: string | null;
}
