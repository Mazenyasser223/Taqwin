import type { ChatHistoryItem, OnboardingAnswers, OnboardingStep } from './types';
import { formatAnswerText } from './formatAnswer';
import { getStepPresentation } from './stepPresentation';

export function buildChatHistory(
  steps: OnboardingStep[],
  stepIndex: number,
  answers: OnboardingAnswers,
): ChatHistoryItem[] {
  const items: ChatHistoryItem[] = [];
  for (let i = 0; i < stepIndex; i++) {
    const s = steps[i];
    if (getStepPresentation(s) !== 'chat') continue;
    if (s.type === 'generating' || s.type === 'summary') continue;

    const coachText =
      'chatMessage' in s && s.chatMessage
        ? s.chatMessage
        : s.type === 'likert'
          ? s.statement
          : s.title;

    items.push({
      id: `${s.id}-coach`,
      role: 'coach',
      text: coachText,
      imageUrl: 'chatImageUrl' in s ? s.chatImageUrl : undefined,
    });

    const userText = formatAnswerText(s, answers);
    if (userText) {
      items.push({ id: `${s.id}-user`, role: 'user', text: userText });
    }
  }
  return items;
}
