const MUSCLE_WIKI_CDN = 'https://media.musclewiki.com';

/** Map Taqwin muscle zones → MuscleWiki primary_muscles labels in DB */
const MUSCLE_ZONE_TO_LABELS = {
  chest: ['Chest', 'Upper Pectoralis', 'Mid and Lower Chest'],
  back: ['Lats', 'Mid back', 'Lower back', 'Traps', 'Lower Traps', 'Traps (mid-back)', 'Upper Traps'],
  shoulders: [
    'Shoulders',
    'Anterior Deltoid',
    'Lateral Deltoid',
    'Posterior Deltoid',
    'Front Shoulders',
    'Rear Shoulders',
  ],
  biceps: ['Biceps', 'Long Head Bicep', 'Short Head Bicep'],
  triceps: ['Triceps', 'Long Head Tricep'],
  forearms: ['Forearms', 'Wrist Extensors', 'Wrist Flexors'],
  abs: ['Abdominals', 'Upper Abdominals', 'Lower Abdominals', 'Obliques'],
  quads: ['Quads', 'Rectus Femoris', 'Inner Quadriceps', 'Outer Quadricep'],
  hamstrings: ['Hamstrings', 'Lateral Hamstrings', 'Medial Hamstrings'],
  calves: ['Calves', 'Gastrocnemius', 'Soleus', 'Tibialis'],
  glutes: ['Glutes', 'Gluteus Maximus', 'Gluteus Medius'],
};

function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/media/')) return `${MUSCLE_WIKI_CDN}${url}`;
  if (url.startsWith('/uploads/')) return `${MUSCLE_WIKI_CDN}${url}`;
  return url;
}

function pickThumbnail(exercise) {
  const thumb = resolveMediaUrl(exercise.thumbnailUrl);
  if (thumb && !thumb.endsWith('.mp4')) return thumb;
  const videos = Array.isArray(exercise.videos) ? exercise.videos : [];
  const front = videos.find((v) => v && v.angle === 'front' && v.url);
  if (front?.url) {
    const u = resolveMediaUrl(front.url);
    if (u && !u.endsWith('.mp4')) return u;
    return u?.replace(/\.mp4$/i, '.jpg') ?? null;
  }
  return thumb;
}

function pickVideoUrl(exercise) {
  const videos = Array.isArray(exercise.videos) ? exercise.videos : [];
  const front = videos.find((v) => v && v.angle === 'front');
  const pick = front || videos[0];
  if (!pick) return null;
  return resolveMediaUrl(pick.localUrl || pick.url);
}

function toNum(v) {
  if (v == null) return v;
  return typeof v === 'bigint' ? Number(v) : v;
}

function normalizeExercise(row, locale = 'en') {
  const primaryMuscles = Array.isArray(row.primaryMuscles ?? row.primary_muscles)
    ? (row.primaryMuscles ?? row.primary_muscles)
    : [];
  const secondaryMuscles = Array.isArray(row.secondaryMuscles ?? row.secondary_muscles)
    ? (row.secondaryMuscles ?? row.secondary_muscles)
    : [];
  const steps = Array.isArray(row.steps) ? row.steps : [];
  const videosRaw = row.videos;
  const videos = Array.isArray(videosRaw)
    ? videosRaw.map((v) => ({
        ...v,
        url: resolveMediaUrl(v?.localUrl || v?.url),
      }))
    : [];

  const thumbSource = row.thumbnailUrl ?? row.thumbnail_url;
  const name = row.name;
  const nameAr = row.nameAr ?? row.name_ar ?? null;
  const isAr = locale === 'ar';

  return {
    id: row.id,
    musclewikiId: toNum(row.musclewikiId ?? row.musclewiki_id),
    slug: row.slug,
    name,
    nameAr,
    displayName: isAr && nameAr ? nameAr : name,
    category: row.category,
    difficulty: row.difficulty,
    force: row.force,
    mechanic: row.mechanic,
    grips: row.grips,
    primaryMuscles,
    secondaryMuscles,
    steps,
    videos,
    thumbnailUrl: pickThumbnail({ ...row, thumbnailUrl: thumbSource, videos: videosRaw }),
    videoUrl: pickVideoUrl({ ...row, videos: videosRaw }),
    longDescription: row.longDescription ?? row.long_description,
    source: row.source,
  };
}

function muscleLabelsForZone(zone) {
  if (!zone) return null;
  return MUSCLE_ZONE_TO_LABELS[zone] ?? null;
}

module.exports = {
  MUSCLE_ZONE_TO_LABELS,
  muscleLabelsForZone,
  normalizeExercise,
  resolveMediaUrl,
};
