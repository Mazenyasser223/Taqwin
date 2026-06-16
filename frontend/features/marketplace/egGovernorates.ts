export interface EgyptGovernorate {
  id: string;
  en: string;
  ar: string;
}

export const EGYPT_GOVERNORATES: EgyptGovernorate[] = [
  { id: 'cairo', en: 'Cairo', ar: 'القاهرة' },
  { id: 'giza', en: 'Giza', ar: 'الجيزة' },
  { id: 'alexandria', en: 'Alexandria', ar: 'الإسكندرية' },
  { id: 'dakahlia', en: 'Dakahlia', ar: 'الدقهلية' },
  { id: 'red-sea', en: 'Red Sea', ar: 'البحر الأحمر' },
  { id: 'beheira', en: 'Beheira', ar: 'البحيرة' },
  { id: 'fayoum', en: 'Fayoum', ar: 'الفيوم' },
  { id: 'gharbia', en: 'Gharbia', ar: 'الغربية' },
  { id: 'ismailia', en: 'Ismailia', ar: 'الإسماعيلية' },
  { id: 'menofia', en: 'Monufia', ar: 'المنوفية' },
  { id: 'minya', en: 'Minya', ar: 'المنيا' },
  { id: 'qaliubiya', en: 'Qalyubia', ar: 'القليوبية' },
  { id: 'new-valley', en: 'New Valley', ar: 'الوادي الجديد' },
  { id: 'suez', en: 'Suez', ar: 'السويس' },
  { id: 'aswan', en: 'Aswan', ar: 'أسوان' },
  { id: 'assiut', en: 'Assiut', ar: 'أسيوط' },
  { id: 'beni-suef', en: 'Beni Suef', ar: 'بني سويف' },
  { id: 'port-said', en: 'Port Said', ar: 'بورسعيد' },
  { id: 'damietta', en: 'Damietta', ar: 'دمياط' },
  { id: 'sharkia', en: 'Sharqia', ar: 'الشرقية' },
  { id: 'south-sinai', en: 'South Sinai', ar: 'جنوب سيناء' },
  { id: 'kafr-el-sheikh', en: 'Kafr El Sheikh', ar: 'كفر الشيخ' },
  { id: 'matrouh', en: 'Matrouh', ar: 'مطروح' },
  { id: 'luxor', en: 'Luxor', ar: 'الأقصر' },
  { id: 'qena', en: 'Qena', ar: 'قنا' },
  { id: 'north-sinai', en: 'North Sinai', ar: 'شمال سيناء' },
  { id: 'sohag', en: 'Sohag', ar: 'سوهاج' },
];

export function governorateLabel(gov: EgyptGovernorate, language: string): string {
  return language === 'ar' ? gov.ar : gov.en;
}
