#!/usr/bin/env python3
"""Inject useI18n and replace common UI strings."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "features/nutrition/NutritionLibrary.tsx",
        [
            ("import type { FoodItem } from '../../types';", "import type { FoodItem } from '../../types';\nimport { useI18n } from '../../lib/i18n/useI18n';"),
            ("const { shouldSimplify } = useMotionPrefs();", "const { shouldSimplify } = useMotionPrefs();\n  const { t } = useI18n();"),
            ("Healthy <span className=\"text-accent italic\">Eating</span>", "{t('nutrition.titleMain')} <span className=\"text-accent italic\">{t('nutrition.titleAccent')}</span>"),
            ("Track every meal. Search the database, log a serving, watch your daily totals update live.", "{t('nutrition.subtitleLong')}"),
            ('placeholder="Search for food..."', 'placeholder={t(\'nutrition.searchPlaceholder\')}'),
            (">Food List<", ">{t('nutrition.foodList')}<"),
            ("Loading foods…", "{t('nutrition.loading')}"),
            ('No foods match "{searchQuery}".', "{t('nutrition.noFoods', { query: searchQuery })}"),
            (">Cancel<", ">{t('common.cancel')}<"),
        ],
    ),
    (
        "features/profile/ProfilePage.tsx",
        [
            ("import { ImageUploader }", "import { ImageUploader } from '../../components/shared/ImageUploader';\nimport { useI18n } from '../../lib/i18n/useI18n'"),
            ("export const ProfilePage", "export const ProfilePage"),
            ("const { user, refreshUser } = useAuthStore();", "const { user, refreshUser } = useAuthStore();\n  const { t } = useI18n();"),
            ("setMessage('Profile saved.');", "setMessage(t('profile.saved'));"),
            (">Your profile<", ">{t('profile.titleLower')}<"),
            (">Signed in as <", ">{t('profile.signedIn')} <"),
            ("· role{' '}", "· {t('profile.role')}{' '}"),
            (">Public<", ">{t('profile.public')}<"),
            (">Display name<", ">{t('profile.displayName')}<"),
            ("'Saving…' : 'Save profile'", "t('profile.saving') : t('profile.saveProfile')"),
        ],
    ),
    (
        "features/community/CommunityFeed.tsx",
        [
            ("import { useAuthStore }", "import { useAuthStore } from '../../store/useAuthStore';\nimport { useI18n } from '../../lib/i18n/useI18n'"),
            ("const { user } = useAuthStore();", "const { user } = useAuthStore();\n  const { t } = useI18n();"),
            (">Community<", ">{t('community.title')}<"),
            ("Share progress, comment, and stay connected.", "{t('community.subtitleLong')}"),
            ("New Post", "{t('community.newPost')}"),
            ("Loading feed…", "{t('community.loading')}"),
            ("Nothing posted yet. Be the first to share progress!", "{t('community.empty')}"),
            ("No comments yet.", "{t('community.noComments')}"),
            (">Cancel<", ">{t('common.cancel')}<"),
        ],
    ),
    (
        "features/ai-chat/ChatAssistant.tsx",
        [
            ("import { useAuthStore }", "import { useAuthStore } from '../../store/useAuthStore';\nimport { useI18n } from '../../lib/i18n/useI18n'"),
            ("const { shouldSimplify } = useMotionPrefs();", "const { shouldSimplify } = useMotionPrefs();\n  const { t } = useI18n();"),
        ],
    ),
    (
        "features/trainers/TrainerList.tsx",
        [
            ("import type {", "import { useI18n } from '../../lib/i18n/useI18n';\nimport type {"),
            ("export const TrainerList", "export const TrainerList"),
        ],
    ),
]

# Simpler global replacements per file glob
GLOBAL_STRINGS = [
    ("Loading trainers…", "{t('trainers.loading')}"),
    ("No coaches yet.", "{t('trainers.empty')}"),
    ("Loading clients…", "{t('clients.loading')}"),
    ("No bookings on file.", "{t('clients.noBookings')}"),
    ("Loading gyms…", "{t('gyms.loading')}"),
    ("No partner gyms yet. Check back soon.", "{t('gyms.empty')}"),
    ("Loading products…", "{t('shop.loading')}"),
    ("No products yet.", "{t('shop.empty')}"),
    ("Loading orders…", "{t('orders.loading')}"),
    ("Loading members…", "{t('members.loading')}"),
    ("No members match your filters.", "{t('members.empty')}"),
    ("Loading gym dashboard…", "{t('gymDash.loading')}"),
    ("No gym set up yet", "{t('gymDash.noGym')}"),
    ("Loading dashboard…", "{t('dashboard.loading')}"),
    ("Loading your progress…", "{t('onboarding.loading')}"),
    (">Cancel<", ">{t('common.cancel')}<"),
    (">Retry<", ">{t('common.retry')}<"),
    (">Back<", ">{t('common.back')}<"),
]


def ensure_i18n_hook(text: str, component_marker: str) -> str:
    if "useI18n" in text and "const { t }" in text:
        return text
    if "from '../../lib/i18n/useI18n'" not in text and "from \"../../lib/i18n/useI18n\"" not in text:
        if "import React" in text:
            text = text.replace("import React", "import React", 1)
            idx = text.find("\n", text.find("import React"))
            text = text[: idx + 1] + "import { useI18n } from '../../lib/i18n/useI18n';\n" + text[idx + 1 :]
        elif "import { useEffect" in text:
            idx = text.find("\n", text.find("import { useEffect"))
            text = text[: idx + 1] + "import { useI18n } from '../../lib/i18n/useI18n';\n" + text[idx + 1 :]
    # inject t after first useState or useAuthStore line in component
    if "const { t } = useI18n()" not in text:
        for anchor in [
            "const { user, logout } = useAuthStore();",
            "const { user } = useAuthStore();",
            "const { shouldSimplify } = useMotionPrefs();",
            "const [loading, setLoading]",
            "const [activeFilter",
        ]:
            if anchor in text:
                text = text.replace(anchor, anchor + "\n  const { t } = useI18n();", 1)
                break
    return text


def main() -> None:
    feature_files = list((ROOT / "features").rglob("*.tsx")) + list((ROOT / "components").rglob("*.tsx"))
    for path in feature_files:
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        if "settings/" in rel or "lib/i18n" in rel:
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in GLOBAL_STRINGS:
            if old in text and "{t(" not in text.split(old)[0][-20:]:
                text = text.replace(old, new)
        if any(g[0] in original for g in GLOBAL_STRINGS):
            text = ensure_i18n_hook(text, "export const")
        for file_rel, reps in REPLACEMENTS:
            if rel == file_rel:
                for old, new in reps:
                    text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"updated {rel}")


if __name__ == "__main__":
    main()
