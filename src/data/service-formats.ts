export type ServiceType = 'b_type' | 'a_type' | 'transition' | 'day_care' | 'life_care';

export type AttendanceOption = {
  value: string;
  label: string;
  color: string;
};

export type RoleConfig = {
  id: string;
  label: string;
  description: string;
  templates: {
    positive: string[];
    neutral: string[];
    concern: string[];
  };
};

export type AdditionalField = {
  id: string;
  label: string;
  type: 'radio' | 'text' | 'number';
  options?: { value: string; label: string }[];
};

export type ServiceFormat = {
  type: ServiceType;
  name: string;
  roles: RoleConfig[];
  attendanceOptions: AttendanceOption[];
  hasLunch: boolean;
  hasTransport: boolean;
  additionalFields?: AdditionalField[];
};

export const B_TYPE_FORMAT: ServiceFormat = {
  type: 'b_type',
  name: '就労継続支援B型',
  roles: [
    {
      id: 'work',
      label: '職業指導員',
      description: '作業態度・取り組みを評価',
      // 業務日誌Excelの「職業指導員」4チェック項目に1:1対応
      templates: {
        positive: [
          '積極的に取り組んでおられていた',
          '安定して取り組まれていた',
        ],
        neutral: [],
        concern: [
          '作業に集中しておられなかった',
          '作業意欲を感じなかった',
        ],
      },
    },
    {
      id: 'life',
      label: '生活支援員',
      description: '生活面・情緒面を評価',
      // 業務日誌Excelの「生活支援員」4チェック項目に1:1対応
      templates: {
        positive: [
          '安定してすごされていた',
          '落ち着いてすごされていた',
        ],
        neutral: [],
        concern: [
          '情緒的に不安定なご様子です',
          'いらいらとされていた',
        ],
      },
    },
  ],
  attendanceOptions: [
    { value: '○', label: '出席', color: 'emerald' },
    { value: '△', label: '遅刻・早退', color: 'amber' },
    { value: '●', label: '欠席', color: 'red' },
  ],
  hasLunch: true,
  hasTransport: true,
};

export const A_TYPE_FORMAT: ServiceFormat = {
  type: 'a_type',
  name: '就労継続支援A型',
  roles: [
    {
      id: 'work',
      label: '職業指導員',
      description: '勤務態度・業務遂行を評価',
      templates: {
        positive: [
          '勤務態度良好で、時間通りに業務を遂行された',
          '指示を正確に理解し、効率的に作業を進められた',
          '他のスタッフとの連携もスムーズだった',
        ],
        neutral: [
          '通常通りの勤務態度だった',
          '特に問題なく業務を遂行された',
        ],
        concern: [
          '遅刻・早退が見られた',
          '業務への集中が途切れがちだった',
          '指示の理解に時間がかかる場面があった',
        ],
      },
    },
    {
      id: 'life',
      label: '生活支援員',
      description: '生活面・体調面を評価',
      templates: {
        positive: [
          '体調も安定し、意欲的に通勤されていた',
          '生活リズムが安定していた',
        ],
        neutral: [
          '普段通りの様子で過ごされていた',
        ],
        concern: [
          '体調不良を訴える場面があった',
          '生活面での不安を口にされていた',
        ],
      },
    },
  ],
  attendanceOptions: [
    { value: '○', label: '出勤', color: 'emerald' },
    { value: '△', label: '遅刻・早退', color: 'amber' },
    { value: '●', label: '欠勤', color: 'red' },
  ],
  hasLunch: true,
  hasTransport: true,
  additionalFields: [
    {
      id: 'work_hours',
      label: '勤務時間（時間）',
      type: 'number',
    },
  ],
};

export const SERVICE_FORMATS: Record<ServiceType, ServiceFormat> = {
  b_type: B_TYPE_FORMAT,
  a_type: A_TYPE_FORMAT,
  transition: B_TYPE_FORMAT,
  day_care: B_TYPE_FORMAT,
  life_care: B_TYPE_FORMAT,
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  b_type: '就労継続支援B型',
  a_type: '就労継続支援A型',
  transition: '就労移行支援',
  day_care: '放課後等デイサービス',
  life_care: '生活介護',
};

export function getServiceFormat(type: string): ServiceFormat {
  return SERVICE_FORMATS[type as ServiceType] ?? B_TYPE_FORMAT;
}
