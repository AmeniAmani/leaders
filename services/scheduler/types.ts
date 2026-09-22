export type Level = "1" | "2" | "3"; // 7eme, 8eme, 9eme

export interface Subject {
    id: number;
    name: string;
    isSpecialized: boolean; // Requires a specialized room (e.g., Info, Tech, Science)
    specializedRoomType?: string; // e.g., "Labo Info", "Atelier Tech"
    dayOff?: string;
}

export interface Room {
    id: number;
    name: string;
    type: string; // "Normal", "Labo Info", "Atelier Tech", "Labo Science"
    capacity?: number;
}

export interface Teacher {
    id: number;
    name: string;
    subjectId: number;
    maxHoursPerWeek: number; // usually constraints like 18 or 21h per week
}

export interface Class {
    id: number;
    name: string;
    level: Level;
}

export interface SessionRequirement {
    id: string;
    duration: number; // e.g., 1 or 2 hours per session
    type: "Entiere" | "Groupe" | "Quinzaine"; // Type de séance
    totalHours?: number; // Total hours for this session requirement
}

export interface CurriculumRequirement {
    id: number;
    level: Level;
    subjectId: number;
    sessions: SessionRequirement[];
}

export interface TimeSlot {
    day: string; // "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"
    start: string; // "08:00", ...
    end: string;
    duration: number; // In hours (e.g., 1, 2)
}

export interface ScheduleEntry {
    classId: number;
    teacherId: number;
    roomId: number;
    subjectId: number;
    day: string;
    start: string;
    duration: number;
    group?: 1 | 2;
    week?: "A" | "B" | "all";
}

export interface QualityMetrics {
    totalLessons: number;
    placedLessons: number;
    unassignedCount: number;
    qualityScore: number; // 0-100
    dayDistribution: Record<string, number>; // day -> total hours placed
    teacherLoad: { id: number; name: string; hours: number; maxHours: number }[];
    teacherHalfDayRespect: number; // percentage of (teacher, day) pairs where teacher stays in one half
    gapCount: number;
    warnings: string[];
}

/** Subject colors for UI rendering */
export const SUBJECT_COLORS: Record<number, { bg: string; text: string; border: string }> = {
    1: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' }, // Math - blue
    2: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }, // Arabe - amber
    3: { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' }, // Français - violet
    4: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }, // Anglais - pink
    5: { bg: '#cffafe', text: '#155e75', border: '#67e8f9' }, // Info - cyan
    6: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' }, // Tech - orange
    7: { bg: '#dcfce7', text: '#166534', border: '#86efac' }, // Physique - green
    8: { bg: '#f0fdf4', text: '#15803d', border: '#4ade80' }, // SVT - emerald
    9: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' }, // Sport - red
};

/** Fallback color for unknown subjects */
export const DEFAULT_SUBJECT_COLOR = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
// Simplified grid: Morning (8->12) and Afternoon (13->17) in 30-min slots.
export const BASIC_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];

/** Morning slot indices (0-7) */
export const MORNING_SLOT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
/** Afternoon slot indices (8-15) */
export const AFTERNOON_SLOT_INDICES = [8, 9, 10, 11, 12, 13, 14, 15];
