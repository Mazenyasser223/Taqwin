import { describe, it, expect } from 'vitest';
import {
  inferLegacySource,
  mapDashboardPlanSource,
  isBoilerplateCoachNotes,
} from '../src/lib/plans/planLegacySource.js';

describe('planLegacySource', () => {
  it('maps Claude explainability to ai legacy + ai dashboard', () => {
    const explain = 'خطة أسبوعية مخصصة بالذكاء الاصطناعي (Claude) من ملفك، RAG، والكتب التدريبية.';
    expect(inferLegacySource({ explainabilityText: explain })).toBe('ai');
    expect(mapDashboardPlanSource('onboarding', explain)).toBe('ai');
  });

  it('maps rules explainability to fallback legacy + rules dashboard', () => {
    const explain = 'خطة أسبوعية من ملفك (تمارين ووجبات)';
    expect(inferLegacySource({ explainabilityText: explain })).toBe('fallback');
    expect(mapDashboardPlanSource('onboarding', explain)).toBe('rules');
  });

  it('detects boilerplate coach notes', () => {
    expect(
      isBoilerplateCoachNotes(
        'Safe baseline plan generated automatically. Open the chat coach for personalized adjustments.'
      )
    ).toBe(true);
  });
});
