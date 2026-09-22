import { Class, CurriculumRequirement, Room, ScheduleEntry, Subject, Teacher, QualityMetrics, BASIC_SLOTS, DAYS } from './types';

// ═══════════════════════════════════════════════════════════════
// SCORING WEIGHTS — Soft constraint scoring for placement quality
// ═══════════════════════════════════════════════════════════════
const W = {
    // Bonuses (positive)
    CORE_SUBJECT_MORNING: 10,     // Core subjects (Math, Arab, Fr, En) placed in morning
    TEACHER_SAME_HALF_DAY: 15,    // Teacher stays in same half of the day
    ADJACENT_SLOT: 8,             // Lesson adjacent to existing lesson for same class
    COMPACT_BONUS: 5,             // No gaps created

    // Penalties (negative)
    DAY_LOAD_PER_HOUR: -12,       // Per hour already in the day for this class
    GAP_PENALTY: -25,             // Creates a gap in the class's daily schedule
    SAME_SUBJECT_IN_DAY: -30,     // Same subject appears again in the same day
    CONSECUTIVE_SAME_SUBJECT: -60,// Same subject in adjacent time slot
    TEACHER_SWITCH_HALF: -10,     // Teacher switches between morning and afternoon
    EXCEED_MAX_DAY_HOURS: -200,   // Class exceeds 7h in a single day
    TEACHER_EXCEED_MAX_WEEKLY: -500, // Teacher exceeds maxHoursPerWeek
};

// IDs of core/obligatory subjects that should be placed in the morning
const CORE_SUBJECT_IDS = [1, 2, 3, 4]; // Math, Arabe, Français, Anglais
const MAX_CLASS_HOURS_PER_DAY = 7;
const NUM_GENERATION_ATTEMPTS = 5; // Run multiple times, keep best result

function hoursToSlots(hours: number): number { return Math.round(hours * 2); }
function slotsToHours(slots: number): number { return slots * 0.5; }

// ═══════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════
interface Lesson {
    id: string;
    classId: number;
    subjectId: number;
    duration: number;
    assigned: boolean;
    group?: 1 | 2;
    week?: "A" | "B" | "all";
    pairId?: string; // Links Quinzaine A/B or Groupe 1/2 pairs
    pairType?: "quinzaine" | "groupe";
}

interface Placement {
    day: string;
    slotIndex: number;
    roomId: number;
    teacherId: number;
    score: number;
}


interface QuinzainePlacement {
    day: string;
    slotIndex: number;
    roomIdA: number;
    teacherIdA: number;
    roomIdB: number;
    teacherIdB: number;
    score: number;
}

interface GroupSwapPlacement {
    day: string;
    slotIndex: number;
    roomIdX: number;
    teacherIdX: number;
    roomIdY: number;
    teacherIdY: number;
    score: number;
}

interface GroupSoloPlacement {
    day: string;
    slotIndex: number;
    roomId: number;
    teacherId: number;
    score: number;
}

export interface SchedulerConfig {
    classes: Class[];
    subjects: Subject[];
    rooms: Room[];
    teachers: Teacher[];
    curriculum: CurriculumRequirement[];
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER ENGINE — Scoring-based constructive heuristic
// ═══════════════════════════════════════════════════════════════
export class SchedulerEngine {
    private config: SchedulerConfig;
    private allLessons: Lesson[] = [];

    constructor(config: SchedulerConfig) {
        this.config = config;
        this.buildLessons();
    }

    // ─── Step 1: Convert curriculum requirements into discrete lessons ───
    private buildLessons() {
        let counter = 0;

        for (const cls of this.config.classes) {
            const classReqs = this.config.curriculum.filter(c => c.level === cls.level);
            const quinzaineSessions: { subjectId: number; duration: number; session: any }[] = [];
            const groupeSessions: { subjectId: number; duration: number; session: any }[] = [];

            for (const req of classReqs) {
                for (const session of req.sessions) {
                    const durationHours = session.duration;
                    const totalHours = session.totalHours ?? durationHours;
                    const occurrences = Math.max(1, Math.round(totalHours / durationHours));
                    const durationSlots = hoursToSlots(durationHours);

                    if (session.type === "Quinzaine") {
                        for (let occ = 0; occ < occurrences; occ++) {
                            quinzaineSessions.push({ subjectId: req.subjectId, duration: durationSlots, session });
                        }
                    } else if (session.type === "Groupe") {
                        for (let occ = 0; occ < occurrences; occ++) {
                            groupeSessions.push({ subjectId: req.subjectId, duration: durationSlots, session });
                        }
                    } else {
                        for (let occ = 0; occ < occurrences; occ++) {
                            this.allLessons.push({
                                id: `L${counter++}`, classId: cls.id, subjectId: req.subjectId,
                                duration: durationSlots, assigned: false,
                                week: "all"
                            });
                        }
                    }
                }
            }

            // ─── Pair Quinzaine sessions (Week A / Week B - DIFFERENT subjects) ───
            const quinzaineByDuration: Record<number, typeof quinzaineSessions> = {};
            for (const q of quinzaineSessions) {
                if (!quinzaineByDuration[q.duration]) {
                    quinzaineByDuration[q.duration] = [];
                }
                quinzaineByDuration[q.duration].push(q);
            }

            for (const durationStr in quinzaineByDuration) {
                const duration = Number(durationStr);
                const items = quinzaineByDuration[duration];
                
                // Group items by subjectId to ensure we pair DIFFERENT subjects
                const itemsBySubject: Map<number, typeof items> = new Map();
                for (const item of items) {
                    if (!itemsBySubject.has(item.subjectId)) {
                        itemsBySubject.set(item.subjectId, []);
                    }
                    itemsBySubject.get(item.subjectId)!.push(item);
                }

                const subjectsList = Array.from(itemsBySubject.keys());

                while (true) {
                    // Sort subjects by remaining items count descending
                    subjectsList.sort((a, b) => itemsBySubject.get(b)!.length - itemsBySubject.get(a)!.length);
                    
                    if (subjectsList.length < 2 || itemsBySubject.get(subjectsList[1])!.length === 0) {
                        break;
                    }
                    
                    const subA = subjectsList[0];
                    const subB = subjectsList[1];
                    
                    const itemA = itemsBySubject.get(subA)!.pop()!;
                    const itemB = itemsBySubject.get(subB)!.pop()!;
                    
                    const pairId = `QP${counter}`;
                    
                    this.allLessons.push({
                        id: `L${counter++}`, classId: cls.id, subjectId: itemA.subjectId,
                        duration, assigned: false,
                        week: "A", pairId, pairType: "quinzaine"
                    });
                    this.allLessons.push({
                        id: `L${counter++}`, classId: cls.id, subjectId: itemB.subjectId,
                        duration, assigned: false,
                        week: "B", pairId, pairType: "quinzaine"
                    });
                }
                
                // Pair remaining items of the SAME subject with each other
                for (const subId of subjectsList) {
                    const remaining = itemsBySubject.get(subId) || [];
                    while (remaining.length >= 2) {
                        const itemA = remaining.pop()!;
                        const itemB = remaining.pop()!;
                        const pairId = `QP${counter}`;
                        
                        this.allLessons.push({
                            id: `L${counter++}`, classId: cls.id, subjectId: itemA.subjectId,
                            duration, assigned: false,
                            week: "A", pairId, pairType: "quinzaine"
                        });
                        this.allLessons.push({
                            id: `L${counter++}`, classId: cls.id, subjectId: itemB.subjectId,
                            duration, assigned: false,
                            week: "B", pairId, pairType: "quinzaine"
                        });
                    }
                }
                
                // Remaining odd items run in week A with week B empty
                for (const subId of subjectsList) {
                    const remaining = itemsBySubject.get(subId) || [];
                    while (remaining.length > 0) {
                        const item = remaining.pop()!;
                        this.allLessons.push({
                            id: `L${counter++}`, classId: cls.id, subjectId: item.subjectId,
                            duration, assigned: false,
                            week: "A"
                        });
                    }
                }
            }

            // ─── Pair Groupe sessions (Consecutive Swap G1/G2 - DIFFERENT subjects) ───
            // Group items by subjectId to ensure we pair DIFFERENT subjects
            const itemsBySubject: Map<number, typeof groupeSessions> = new Map();
            for (const item of groupeSessions) {
                if (!itemsBySubject.has(item.subjectId)) {
                    itemsBySubject.set(item.subjectId, []);
                }
                itemsBySubject.get(item.subjectId)!.push(item);
            }

            const subjectsList = Array.from(itemsBySubject.keys());

            while (true) {
                // Sort subjects by remaining items count descending
                subjectsList.sort((a, b) => itemsBySubject.get(b)!.length - itemsBySubject.get(a)!.length);
                
                if (subjectsList.length < 2 || itemsBySubject.get(subjectsList[1])!.length === 0) {
                    break;
                }
                
                const subA = subjectsList[0];
                const subB = subjectsList[1];
                
                const itemA = itemsBySubject.get(subA)!.pop()!;
                const itemB = itemsBySubject.get(subB)!.pop()!;
                
                const pairId = `GP_SWAP_${counter}`;
                
                // Group 1 and 2 for Subject A
                this.allLessons.push({
                    id: `L${counter++}`, classId: cls.id, subjectId: itemA.subjectId,
                    duration: itemA.duration, assigned: false, week: "all", group: 1, pairId, pairType: "groupe"
                });
                this.allLessons.push({
                    id: `L${counter++}`, classId: cls.id, subjectId: itemA.subjectId,
                    duration: itemA.duration, assigned: false, week: "all", group: 2, pairId, pairType: "groupe"
                });
                // Group 1 and 2 for Subject B
                this.allLessons.push({
                    id: `L${counter++}`, classId: cls.id, subjectId: itemB.subjectId,
                    duration: itemB.duration, assigned: false, week: "all", group: 1, pairId, pairType: "groupe"
                });
                this.allLessons.push({
                    id: `L${counter++}`, classId: cls.id, subjectId: itemB.subjectId,
                    duration: itemB.duration, assigned: false, week: "all", group: 2, pairId, pairType: "groupe"
                });
            }
            
            // Remaining items run as Solo consecutive groups (G1 then G2)
            for (const subId of subjectsList) {
                const remaining = itemsBySubject.get(subId) || [];
                while (remaining.length > 0) {
                    const item = remaining.pop()!;
                    const pairId = `GP_SOLO_${counter}`;
                    this.allLessons.push({
                        id: `L${counter++}`, classId: cls.id, subjectId: item.subjectId,
                        duration: item.duration, assigned: false, week: "all", group: 1, pairId, pairType: "groupe"
                    });
                    this.allLessons.push({
                        id: `L${counter++}`, classId: cls.id, subjectId: item.subjectId,
                        duration: item.duration, assigned: false, week: "all", group: 2, pairId, pairType: "groupe"
                    });
                }
            }
        }
    }

    // Sort lessons by placement difficulty (hardest first)
    private sortLessons(lessons: Lesson[]): Lesson[] {
        return [...lessons].sort((a, b) => {
            const subA = this.config.subjects.find(s => s.id === a.subjectId);
            const subB = this.config.subjects.find(s => s.id === b.subjectId);

            // Specialized subjects first (fewer rooms available)
            const specA = subA?.isSpecialized ? 1 : 0;
            const specB = subB?.isSpecialized ? 1 : 0;
            if (specA !== specB) return specB - specA;

            // Longer duration first (harder to fit)
            if (a.duration !== b.duration) return b.duration - a.duration;

            // Group/Quinzaine lessons first (more constrained)
            const pairedA = a.pairId ? 1 : 0;
            const pairedB = b.pairId ? 1 : 0;
            if (pairedA !== pairedB) return pairedB - pairedA;

            return 0;
        });
    }

    // Slightly shuffle lessons within same priority tier for multi-attempt diversity
    private shuffleLessons(lessons: Lesson[]): Lesson[] {
        const sorted = this.sortLessons(lessons);
        // Group by priority bucket, shuffle within each bucket
        const buckets: Map<string, Lesson[]> = new Map();
        for (const l of sorted) {
            const sub = this.config.subjects.find(s => s.id === l.subjectId);
            const key = `${sub?.isSpecialized ? 1 : 0}-${l.duration}-${l.pairId ? 1 : 0}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(l);
        }

        const result: Lesson[] = [];
        for (const [, bucket] of buckets) {
            // Fisher-Yates shuffle within bucket
            for (let i = bucket.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
            }
            result.push(...bucket);
        }
        return result;
    }

    // ─── Utility functions ───

    private isMorningSlot(slotIndex: number): boolean {
        return slotIndex <= 7; // 08:00 to 11:30
    }

    private crossesMidi(slotIndex: number, duration: number): boolean {
        const endIndex = slotIndex + duration - 1;
        // Midi break is between index 7 (11:30) and index 8 (13:00)
        return slotIndex <= 7 && endIndex >= 8;
    }

    // ─── Key generation for conflict maps ───
    private tKey(teacherId: number, day: string, slot: string, week: string) {
        return `T${teacherId}|${day}|${slot}|${week}`;
    }
    private rKey(roomId: number, day: string, slot: string, week: string) {
        return `R${roomId}|${day}|${slot}|${week}`;
    }
    private cKey(classId: number, day: string, slot: string, week: string, group?: 1 | 2) {
        return `C${classId}|${day}|${slot}|${week}${group ? '|G' + group : ''}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // SINGLE ATTEMPT — Runs one full scheduling pass
    // ═══════════════════════════════════════════════════════════════
    private runAttempt(lessons: Lesson[]): { schedule: ScheduleEntry[]; metrics: QualityMetrics } {
        // State for this attempt
        const schedule: ScheduleEntry[] = [];
        const warnings: string[] = [];
        let unassignedCount = 0;

        // Conflict tracking maps
        const teacherSlots = new Map<string, boolean>();
        const roomSlots = new Map<string, boolean>();
        const classSlots = new Map<string, boolean>();

        // Quality tracking (separated by week to allow correct scoring of Quinzaine)
        const classDayHours = new Map<string, number>();        // "classId-day-week" -> hours
        const classDaySubjectList = new Map<string, number[]>(); // "classId-day-week" -> ordered subjectIds
        const classDaySlotSet = new Map<string, Set<number>>();  // "classId-day-week" -> occupied slot indices
        const classSlotSubject = new Map<string, number>();      // "classId-day-slotIdx-week" -> subjectId
        const teacherDayHalves = new Map<string, Set<string>>(); // "teacherId-day-week" -> Set<"morning"|"afternoon">
        const teacherWeekHours = new Map<string, number>();      // "teacherId-week" -> total weekly hours
        // Hard constraint: a subject may appear at most once per day per class (week-agnostic for visual clarity)
        const classDaySubjects = new Map<string, Set<number>>(); // "classId-day" -> Set<subjectId>

        // ─── Hard constraint check: is a placement free of conflicts? ───
        function isAvailable(
            day: string, slotIdx: number, duration: number,
            classId: number, teacherId: number, roomId: number,
            week: string, group?: 1 | 2
        ): boolean {
            for (let i = 0; i < duration; i++) {
                const idx = slotIdx + i;
                if (idx >= BASIC_SLOTS.length) return false;

                const slot = BASIC_SLOTS[idx];
                const weeksToCheck = week === "all" ? ["all", "A", "B"] : ["all", week];

                for (const w of weeksToCheck) {
                    // Teacher conflict
                    if (teacherSlots.has(`T${teacherId}|${day}|${slot}|${w}`)) return false;
                    // Room conflict
                    if (roomSlots.has(`R${roomId}|${day}|${slot}|${w}`)) return false;

                    // Class conflict (accounting for groups)
                    if (!group) {
                        // Entire class: conflicts with anything for this class
                        if (classSlots.has(`C${classId}|${day}|${slot}|${w}`) ||
                            classSlots.has(`C${classId}|${day}|${slot}|${w}|G1`) ||
                            classSlots.has(`C${classId}|${day}|${slot}|${w}|G2`)) return false;
                    } else {
                        // Group: conflicts with entire class or same group
                        if (classSlots.has(`C${classId}|${day}|${slot}|${w}`)) return false;
                        if (classSlots.has(`C${classId}|${day}|${slot}|${w}|G${group}`)) return false;
                    }
                }
            }
            return true;
        }

        // ─── Mark a placement in all tracking structures ───
        const self = this;
        function markPlacement(
            day: string, slotIdx: number, duration: number,
            classId: number, teacherId: number, roomId: number,
            week: string, subjectId: number, group?: 1 | 2
        ) {
            for (let i = 0; i < duration; i++) {
                const slot = BASIC_SLOTS[slotIdx + i];
                const weeksToCheck = week === "all" ? ["all", "A", "B"] : ["all", week];
                for (const w of weeksToCheck) {
                    teacherSlots.set(self.tKey(teacherId, day, slot, w), true);
                    roomSlots.set(self.rKey(roomId, day, slot, w), true);
                    classSlots.set(self.cKey(classId, day, slot, w, group), true);
                }
            }

            const targetWeeks = week === "all" ? ["A", "B"] : [week];
            const durationHours = slotsToHours(duration);

            // Register subject for hard "once per day" constraint (week-agnostic)
            const cdKey = `${classId}-${day}`;
            const cdSubjects = classDaySubjects.get(cdKey) || new Set();
            cdSubjects.add(subjectId);
            classDaySubjects.set(cdKey, cdSubjects);

            for (const w of targetWeeks) {
                // Track class daily hours
                const dayKey = `${classId}-${day}-${w}`;
                classDayHours.set(dayKey, (classDayHours.get(dayKey) || 0) + durationHours);

                // Track subjects in day (ordered by slot for consecutive check)
                const subjects = classDaySubjectList.get(dayKey) || [];
                subjects.push(subjectId);
                classDaySubjectList.set(dayKey, subjects);

                // Track occupied slot indices
                const slots = classDaySlotSet.get(dayKey) || new Set();
                for (let i = 0; i < duration; i++) {
                    slots.add(slotIdx + i);
                    classSlotSubject.set(`${classId}-${day}-${slotIdx + i}-${w}`, subjectId);
                }
                classDaySlotSet.set(dayKey, slots);

                // Track teacher half-day usage
                const tdKey = `${teacherId}-${day}-${w}`;
                const halves = teacherDayHalves.get(tdKey) || new Set();
                for (let i = 0; i < duration; i++) {
                    halves.add(self.isMorningSlot(slotIdx + i) ? "morning" : "afternoon");
                }
                teacherDayHalves.set(tdKey, halves);

                // Track teacher weekly hours
                const twKey = `${teacherId}-${w}`;
                teacherWeekHours.set(twKey, (teacherWeekHours.get(twKey) || 0) + durationHours);
            }
        }

        // ─── Soft constraint scoring ───
        const scoreSlot = (
            lesson: Lesson, day: string, slotIdx: number, teacherId: number
        ): number => {
            const classId = lesson.classId;
            const subjectId = lesson.subjectId;
            const duration = lesson.duration;
            const durationHours = slotsToHours(duration);
            const week = lesson.week || "all";

            const scoreForWeek = (w: "A" | "B"): number => {
                let score = 0;
                const dayKey = `${classId}-${day}-${w}`;

                // 1. Day balance — penalize days with many hours for this class
                const currentDayHours = classDayHours.get(dayKey) || 0;
                score += currentDayHours * W.DAY_LOAD_PER_HOUR;

                // Hard penalty if exceeding max daily hours
                if (currentDayHours + durationHours > MAX_CLASS_HOURS_PER_DAY) {
                    score += W.EXCEED_MAX_DAY_HOURS;
                }

                // 2. Core subjects in the morning
                if (CORE_SUBJECT_IDS.includes(subjectId) && this.isMorningSlot(slotIdx)) {
                    score += W.CORE_SUBJECT_MORNING;
                }

                // 3. Same subject in same day — penalize repetition
                const daySubjects = classDaySubjectList.get(dayKey) || [];
                if (daySubjects.includes(subjectId)) {
                    score += W.SAME_SUBJECT_IN_DAY;
                }

                // 4. Consecutive same subject — check adjacent slots
                for (let i = 0; i < duration; i++) {
                    const idx = slotIdx + i;
                    // Check slot before
                    if (idx > 0) {
                        const prevSubject = classSlotSubject.get(`${classId}-${day}-${idx - 1}-${w}`);
                        if (prevSubject === subjectId) {
                            score += W.CONSECUTIVE_SAME_SUBJECT;
                            break; // Count once
                        }
                    }
                    // Check slot after
                    if (idx < BASIC_SLOTS.length - 1) {
                        const nextSubject = classSlotSubject.get(`${classId}-${day}-${idx + 1}-${w}`);
                        if (nextSubject === subjectId) {
                            score += W.CONSECUTIVE_SAME_SUBJECT;
                            break;
                        }
                    }
                }

                // 5. Teacher half-day preference — prefer same half on the same day
                const tdKey = `${teacherId}-${day}-${w}`;
                const currentHalf = this.isMorningSlot(slotIdx) ? "morning" : "afternoon";
                const teacherHalves = teacherDayHalves.get(tdKey);
                if (teacherHalves && teacherHalves.size > 0) {
                    if (teacherHalves.has(currentHalf)) {
                        score += W.TEACHER_SAME_HALF_DAY;
                    } else {
                        score += W.TEACHER_SWITCH_HALF;
                    }
                }

                // 6. Teacher weekly hours — penalize overloaded teachers
                const teacher = this.config.teachers.find(t => t.id === teacherId);
                const twKey = `${teacherId}-${w}`;
                const currentTeacherHours = teacherWeekHours.get(twKey) || 0;
                if (teacher && currentTeacherHours + durationHours > teacher.maxHoursPerWeek) {
                    score += W.TEACHER_EXCEED_MAX_WEEKLY;
                }

                // 7. Compactness — prefer adjacent to existing lessons, penalize gaps
                const occupiedSlots = classDaySlotSet.get(dayKey);
                if (occupiedSlots && occupiedSlots.size > 0) {
                    // Check if this placement is adjacent to an existing lesson
                    let isAdjacent = false;
                    if (occupiedSlots.has(slotIdx - 1) || occupiedSlots.has(slotIdx + duration)) {
                        isAdjacent = true;
                    }
                    if (isAdjacent) {
                        score += W.ADJACENT_SLOT;
                    }

                    // Check if placing here creates a gap
                    const allSlots = Array.from(occupiedSlots);
                    for (let i = 0; i < duration; i++) allSlots.push(slotIdx + i);
                    allSlots.sort((a, b) => a - b);

                    let hasGap = false;
                    for (let j = 1; j < allSlots.length; j++) {
                        const prev = allSlots[j - 1];
                        const curr = allSlots[j];
                        // Skip the midi break (slots 7->8)
                        if (prev === 7 && curr === 8) continue;
                        if (curr - prev > 1) { hasGap = true; break; }
                    }
                    score += hasGap ? W.GAP_PENALTY : W.COMPACT_BONUS;
                }

                return score;
            };

            if (week === "all") {
                return scoreForWeek("A") + scoreForWeek("B");
            } else {
                return scoreForWeek(week as "A" | "B");
            }
        };

        // ─── Find best placement for a single lesson ───
        const findBestPlacement = (lesson: Lesson): Placement | null => {
            const subject = this.config.subjects.find(s => s.id === lesson.subjectId);
            const validRooms = (subject?.isSpecialized && subject.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subject.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");
            const validTeachers = this.config.teachers.filter(t => t.subjectId === lesson.subjectId);
            const week = lesson.week || "all";

            let best: Placement | null = null;

            for (const day of DAYS) {
                if (subject?.dayOff === day) continue;
                // Hard constraint: same subject must not appear twice on the same day
                const daySubjectSet = classDaySubjects.get(`${lesson.classId}-${day}`);
                if (daySubjectSet?.has(lesson.subjectId)) continue;

                for (let slotIdx = 0; slotIdx <= BASIC_SLOTS.length - lesson.duration; slotIdx++) {
                    if (this.crossesMidi(slotIdx, lesson.duration)) continue;

                    for (const room of validRooms) {
                        for (const teacher of validTeachers) {
                            if (isAvailable(day, slotIdx, lesson.duration, lesson.classId, teacher.id, room.id, week, lesson.group)) {
                                const score = scoreSlot(lesson, day, slotIdx, teacher.id);
                                if (!best || score > best.score) {
                                    best = { day, slotIndex: slotIdx, roomId: room.id, teacherId: teacher.id, score };
                                }
                            }
                        }
                    }
                }
            }
            return best;
        };

        // ─── Find best placement for a Quinzaine A/B pair (SAME slot, DIFFERENT subjects) ───
        const findBestQuinzainePlacement = (lessonA: Lesson, lessonB: Lesson): QuinzainePlacement | null => {
            const subA = this.config.subjects.find(s => s.id === lessonA.subjectId);
            const subB = this.config.subjects.find(s => s.id === lessonB.subjectId);

            const validRoomsA = (subA?.isSpecialized && subA.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subA.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");
            const validRoomsB = (subB?.isSpecialized && subB.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subB.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");

            const validTeachersA = this.config.teachers.filter(t => t.subjectId === lessonA.subjectId);
            const validTeachersB = this.config.teachers.filter(t => t.subjectId === lessonB.subjectId);

            let best: QuinzainePlacement | null = null;

            for (const day of DAYS) {
                if (subA?.dayOff === day || subB?.dayOff === day) continue;
                // Hard constraint: neither subject must already appear on this day
                const daySubjectSet = classDaySubjects.get(`${lessonA.classId}-${day}`);
                if (daySubjectSet?.has(lessonA.subjectId) || daySubjectSet?.has(lessonB.subjectId)) continue;

                for (let slotIdx = 0; slotIdx <= BASIC_SLOTS.length - lessonA.duration; slotIdx++) {
                    if (this.crossesMidi(slotIdx, lessonA.duration)) continue;

                    for (const roomA of validRoomsA) {
                        for (const teacherA of validTeachersA) {
                            if (!isAvailable(day, slotIdx, lessonA.duration, lessonA.classId, teacherA.id, roomA.id, "A", lessonA.group)) {
                                continue;
                            }

                            for (const roomB of validRoomsB) {
                                for (const teacherB of validTeachersB) {
                                    if (!isAvailable(day, slotIdx, lessonB.duration, lessonB.classId, teacherB.id, roomB.id, "B", lessonB.group)) {
                                        continue;
                                    }

                                    const score = scoreSlot(lessonA, day, slotIdx, teacherA.id) + scoreSlot(lessonB, day, slotIdx, teacherB.id);
                                    if (!best || score > best.score) {
                                        best = {
                                            day, slotIndex: slotIdx,
                                            roomIdA: roomA.id, teacherIdA: teacherA.id,
                                            roomIdB: roomB.id, teacherIdB: teacherB.id,
                                            score
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return best;
        };

        const findBestGroupSwapPlacement = (
            lessonX1: Lesson, lessonX2: Lesson,
            lessonY1: Lesson, lessonY2: Lesson
        ): GroupSwapPlacement | null => {
            const subX = this.config.subjects.find(s => s.id === lessonX1.subjectId);
            const subY = this.config.subjects.find(s => s.id === lessonY1.subjectId);

            const validRoomsX = (subX?.isSpecialized && subX.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subX.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");
            const validRoomsY = (subY?.isSpecialized && subY.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subY.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");

            const validTeachersX = this.config.teachers.filter(t => t.subjectId === lessonX1.subjectId);
            const validTeachersY = this.config.teachers.filter(t => t.subjectId === lessonY1.subjectId);

            const dX = lessonX1.duration;
            const dY = lessonY1.duration;
            const maxD = Math.max(dX, dY);
            let best: GroupSwapPlacement | null = null;

            for (const day of DAYS) {
                if (subX?.dayOff === day || subY?.dayOff === day) continue;
                // Hard constraint: neither subject must already appear on this day
                const daySubjectSetSwap = classDaySubjects.get(`${lessonX1.classId}-${day}`);
                if (daySubjectSetSwap?.has(lessonX1.subjectId) || daySubjectSetSwap?.has(lessonY1.subjectId)) continue;

                // Must fit 2 * maxD slots in the day
                for (let slotIdx = 0; slotIdx <= BASIC_SLOTS.length - 2 * maxD; slotIdx++) {
                    if (this.crossesMidi(slotIdx, 2 * maxD)) continue;

                    for (const roomX of validRoomsX) {
                        for (const teacherX of validTeachersX) {
                            for (const roomY of validRoomsY) {
                                for (const teacherY of validTeachersY) {
                                    if (teacherX.id === teacherY.id) continue;
                                    if (roomX.id === roomY.id) continue;
                                    const startX1 = slotIdx + maxD - dX;
                                    const startY2 = slotIdx + maxD - dY;
                                    const startX2 = slotIdx + maxD;
                                    const startY1 = slotIdx + maxD;

                                    if (!isAvailable(day, startX1, dX, lessonX1.classId, teacherX.id, roomX.id, "all", 1)) continue;
                                    if (!isAvailable(day, startX2, dX, lessonX2.classId, teacherX.id, roomX.id, "all", 2)) continue;
                                    if (!isAvailable(day, startY2, dY, lessonY2.classId, teacherY.id, roomY.id, "all", 2)) continue;
                                    if (!isAvailable(day, startY1, dY, lessonY1.classId, teacherY.id, roomY.id, "all", 1)) continue;

                                    // All available! Calculate total score
                                    const score = scoreSlot(lessonX1, day, startX1, teacherX.id) +
                                                  scoreSlot(lessonX2, day, startX2, teacherX.id) +
                                                  scoreSlot(lessonY1, day, startY1, teacherY.id) +
                                                  scoreSlot(lessonY2, day, startY2, teacherY.id);

                                    if (!best || score > best.score) {
                                        best = {
                                            day, slotIndex: slotIdx,
                                            roomIdX: roomX.id, teacherIdX: teacherX.id,
                                            roomIdY: roomY.id, teacherIdY: teacherY.id,
                                            score
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return best;
        };

        const findBestGroupSoloPlacement = (
            lesson1: Lesson, lesson2: Lesson
        ): GroupSoloPlacement | null => {
            const subject = this.config.subjects.find(s => s.id === lesson1.subjectId);
            const validRooms = (subject?.isSpecialized && subject.specializedRoomType)
                ? this.config.rooms.filter(r => r.type === subject.specializedRoomType)
                : this.config.rooms.filter(r => r.type === "Normal");
            const validTeachers = this.config.teachers.filter(t => t.subjectId === lesson1.subjectId);

            const duration = lesson1.duration;
            let best: GroupSoloPlacement | null = null;

            for (const day of DAYS) {
                if (subject?.dayOff === day) continue;
                // Hard constraint: subject must not already appear on this day
                const daySubjectSetSolo = classDaySubjects.get(`${lesson1.classId}-${day}`);
                if (daySubjectSetSolo?.has(lesson1.subjectId)) continue;

                for (let slotIdx = 0; slotIdx <= BASIC_SLOTS.length - 2 * duration; slotIdx++) {
                    if (this.crossesMidi(slotIdx, 2 * duration)) continue;

                    for (const room of validRooms) {
                        for (const teacher of validTeachers) {
                            if (!isAvailable(day, slotIdx, duration, lesson1.classId, teacher.id, room.id, "all", 1)) continue;
                            if (!isAvailable(day, slotIdx + duration, duration, lesson2.classId, teacher.id, room.id, "all", 2)) continue;

                            // Calculate score
                            const score = scoreSlot(lesson1, day, slotIdx, teacher.id) +
                                          scoreSlot(lesson2, day, slotIdx + duration, teacher.id);

                            if (!best || score > best.score) {
                                best = {
                                    day, slotIndex: slotIdx,
                                    roomId: room.id, teacherId: teacher.id,
                                    score
                                };
                            }
                        }
                    }
                }
            }
            return best;
        };

        // ═══════════════════════════════════════════════════════
        // MAIN PLACEMENT LOOP
        // ═══════════════════════════════════════════════════════

        // 1. Group lessons by pair type
        const quinzainePairs = new Map<string, Lesson[]>();
        const groupePairs = new Map<string, Lesson[]>();
        const individualLessons: Lesson[] = [];

        for (const lesson of lessons) {
            if (lesson.pairType === "quinzaine" && lesson.pairId) {
                const pair = quinzainePairs.get(lesson.pairId) || [];
                pair.push(lesson);
                quinzainePairs.set(lesson.pairId, pair);
            } else if (lesson.pairType === "groupe" && lesson.pairId) {
                const pair = groupePairs.get(lesson.pairId) || [];
                pair.push(lesson);
                groupePairs.set(lesson.pairId, pair);
            } else {
                individualLessons.push(lesson);
            }
        }

        // 2. Place Quinzaine pairs (MUST be same slot)
        for (const [pairId, pair] of quinzainePairs) {
            if (pair.length !== 2) {
                warnings.push(`Paire Quinzaine ${pairId} invalide (${pair.length} leçons au lieu de 2)`);
                individualLessons.push(...pair);
                continue;
            }

            const [lessonA, lessonB] = pair[0].week === "A" ? [pair[0], pair[1]] : [pair[1], pair[0]];
            const placement = findBestQuinzainePlacement(lessonA, lessonB);

            if (placement) {
                // Place Lesson A
                markPlacement(placement.day, placement.slotIndex, lessonA.duration,
                    lessonA.classId, placement.teacherIdA, placement.roomIdA,
                    "A", lessonA.subjectId, lessonA.group);

                schedule.push({
                    classId: lessonA.classId, teacherId: placement.teacherIdA,
                    subjectId: lessonA.subjectId, roomId: placement.roomIdA,
                    day: placement.day, start: BASIC_SLOTS[placement.slotIndex],
                    duration: slotsToHours(lessonA.duration), week: "A", group: lessonA.group
                });
                lessonA.assigned = true;

                // Place Lesson B
                markPlacement(placement.day, placement.slotIndex, lessonB.duration,
                    lessonB.classId, placement.teacherIdB, placement.roomIdB,
                    "B", lessonB.subjectId, lessonB.group);

                schedule.push({
                    classId: lessonB.classId, teacherId: placement.teacherIdB,
                    subjectId: lessonB.subjectId, roomId: placement.roomIdB,
                    day: placement.day, start: BASIC_SLOTS[placement.slotIndex],
                    duration: slotsToHours(lessonB.duration), week: "B", group: lessonB.group
                });
                lessonB.assigned = true;
            } else {
                const subA = this.config.subjects.find(s => s.id === lessonA.subjectId);
                const subB = this.config.subjects.find(s => s.id === lessonB.subjectId);
                warnings.push(`Quinzaine impossible à placer ensemble → tentative individuelle : Classe ${lessonA.classId}, ${subA?.name || 'Matière ' + lessonA.subjectId} (Sem A) / ${subB?.name || 'Matière ' + lessonB.subjectId} (Sem B)`);
                individualLessons.push(lessonA, lessonB);
            }
        }

        // 3. Place Groupe pairs (TRY consecutive swap or consecutive solo)
        for (const [pairId, pair] of groupePairs) {
            if (pair.length === 4) {
                // Consecutive Swap Pair
                const subjectIds = Array.from(new Set(pair.map(l => l.subjectId)));
                if (subjectIds.length !== 2) {
                    individualLessons.push(...pair);
                    continue;
                }
                
                const subXId = subjectIds[0];
                const subYId = subjectIds[1];
                
                const lessonsX = pair.filter(l => l.subjectId === subXId);
                const lessonsY = pair.filter(l => l.subjectId === subYId);
                
                const lessonX1 = lessonsX.find(l => l.group === 1)!;
                const lessonX2 = lessonsX.find(l => l.group === 2)!;
                const lessonY1 = lessonsY.find(l => l.group === 1)!;
                const lessonY2 = lessonsY.find(l => l.group === 2)!;
                
                const placement = findBestGroupSwapPlacement(lessonX1, lessonX2, lessonY1, lessonY2);
                
                if (placement) {
                    const dX = lessonX1.duration;
                    const dY = lessonY1.duration;
                    const maxD = Math.max(dX, dY);
                    
                    const startX1 = placement.slotIndex + maxD - dX;
                    const startY2 = placement.slotIndex + maxD - dY;
                    const startX2 = placement.slotIndex + maxD;
                    const startY1 = placement.slotIndex + maxD;

                    // Slot 1: X G1 + Y G2
                    markPlacement(placement.day, startX1, dX,
                        lessonX1.classId, placement.teacherIdX, placement.roomIdX,
                        "all", lessonX1.subjectId, 1);
                    schedule.push({
                        classId: lessonX1.classId, teacherId: placement.teacherIdX,
                        subjectId: lessonX1.subjectId, roomId: placement.roomIdX,
                        day: placement.day, start: BASIC_SLOTS[startX1],
                        duration: slotsToHours(dX), week: "all", group: 1
                    });
                    lessonX1.assigned = true;

                    markPlacement(placement.day, startY2, dY,
                        lessonY2.classId, placement.teacherIdY, placement.roomIdY,
                        "all", lessonY2.subjectId, 2);
                    schedule.push({
                        classId: lessonY2.classId, teacherId: placement.teacherIdY,
                        subjectId: lessonY2.subjectId, roomId: placement.roomIdY,
                        day: placement.day, start: BASIC_SLOTS[startY2],
                        duration: slotsToHours(dY), week: "all", group: 2
                    });
                    lessonY2.assigned = true;

                    // Slot 2: X G2 + Y G1
                    markPlacement(placement.day, startX2, dX,
                        lessonX2.classId, placement.teacherIdX, placement.roomIdX,
                        "all", lessonX2.subjectId, 2);
                    schedule.push({
                        classId: lessonX2.classId, teacherId: placement.teacherIdX,
                        subjectId: lessonX2.subjectId, roomId: placement.roomIdX,
                        day: placement.day, start: BASIC_SLOTS[startX2],
                        duration: slotsToHours(dX), week: "all", group: 2
                    });
                    lessonX2.assigned = true;

                    markPlacement(placement.day, startY1, dY,
                        lessonY1.classId, placement.teacherIdY, placement.roomIdY,
                        "all", lessonY1.subjectId, 1);
                    schedule.push({
                        classId: lessonY1.classId, teacherId: placement.teacherIdY,
                        subjectId: lessonY1.subjectId, roomId: placement.roomIdY,
                        day: placement.day, start: BASIC_SLOTS[startY1],
                        duration: slotsToHours(dY), week: "all", group: 1
                    });
                    lessonY1.assigned = true;
                } else {
                    const subX = this.config.subjects.find(s => s.id === subXId);
                    const subY = this.config.subjects.find(s => s.id === subYId);
                    warnings.push(`Swap impossible à placer → tentative de groupes solo consécutifs : Classe ${lessonX1.classId}, ${subX?.name || 'Matière ' + subXId} / ${subY?.name || 'Matière ' + subYId}`);
                    
                    // Solo fallback pour X
                    const placementX = findBestGroupSoloPlacement(lessonX1, lessonX2);
                    if (placementX) {
                        const duration = lessonX1.duration;
                        markPlacement(placementX.day, placementX.slotIndex, duration,
                            lessonX1.classId, placementX.teacherId, placementX.roomId,
                            "all", lessonX1.subjectId, 1);
                        schedule.push({
                            classId: lessonX1.classId, teacherId: placementX.teacherId,
                            subjectId: lessonX1.subjectId, roomId: placementX.roomId,
                            day: placementX.day, start: BASIC_SLOTS[placementX.slotIndex],
                            duration: slotsToHours(duration), week: "all", group: 1
                        });
                        lessonX1.assigned = true;

                        markPlacement(placementX.day, placementX.slotIndex + duration, duration,
                            lessonX2.classId, placementX.teacherId, placementX.roomId,
                            "all", lessonX2.subjectId, 2);
                        schedule.push({
                            classId: lessonX2.classId, teacherId: placementX.teacherId,
                            subjectId: lessonX2.subjectId, roomId: placementX.roomId,
                            day: placementX.day, start: BASIC_SLOTS[placementX.slotIndex + duration],
                            duration: slotsToHours(duration), week: "all", group: 2
                        });
                        lessonX2.assigned = true;
                    } else {
                        warnings.push(`Groupe Solo consécutif impossible à placer pour ${subX?.name || 'Matière ' + subXId} → tentative individuelle`);
                        individualLessons.push(lessonX1, lessonX2);
                    }

                    // Solo fallback pour Y
                    const placementY = findBestGroupSoloPlacement(lessonY1, lessonY2);
                    if (placementY) {
                        const duration = lessonY1.duration;
                        markPlacement(placementY.day, placementY.slotIndex, duration,
                            lessonY1.classId, placementY.teacherId, placementY.roomId,
                            "all", lessonY1.subjectId, 1);
                        schedule.push({
                            classId: lessonY1.classId, teacherId: placementY.teacherId,
                            subjectId: lessonY1.subjectId, roomId: placementY.roomId,
                            day: placementY.day, start: BASIC_SLOTS[placementY.slotIndex],
                            duration: slotsToHours(duration), week: "all", group: 1
                        });
                        lessonY1.assigned = true;

                        markPlacement(placementY.day, placementY.slotIndex + duration, duration,
                            lessonY2.classId, placementY.teacherId, placementY.roomId,
                            "all", lessonY2.subjectId, 2);
                        schedule.push({
                            classId: lessonY2.classId, teacherId: placementY.teacherId,
                            subjectId: lessonY2.subjectId, roomId: placementY.roomId,
                            day: placementY.day, start: BASIC_SLOTS[placementY.slotIndex + duration],
                            duration: slotsToHours(duration), week: "all", group: 2
                        });
                        lessonY2.assigned = true;
                    } else {
                        warnings.push(`Groupe Solo consécutif impossible à placer pour ${subY?.name || 'Matière ' + subYId} → tentative individuelle`);
                        individualLessons.push(lessonY1, lessonY2);
                    }
                }
            } else if (pair.length === 2) {
                // Consecutive Solo Pair
                const lesson1 = pair.find(l => l.group === 1)!;
                const lesson2 = pair.find(l => l.group === 2)!;
                
                const placement = findBestGroupSoloPlacement(lesson1, lesson2);
                
                if (placement) {
                    const duration = lesson1.duration;
                    
                    // Slot 1 (T): X G1
                    markPlacement(placement.day, placement.slotIndex, duration,
                        lesson1.classId, placement.teacherId, placement.roomId,
                        "all", lesson1.subjectId, 1);
                    schedule.push({
                        classId: lesson1.classId, teacherId: placement.teacherId,
                        subjectId: lesson1.subjectId, roomId: placement.roomId,
                        day: placement.day, start: BASIC_SLOTS[placement.slotIndex],
                        duration: slotsToHours(duration), week: "all", group: 1
                    });
                    lesson1.assigned = true;

                    // Slot 2 (T+d): X G2
                    markPlacement(placement.day, placement.slotIndex + duration, duration,
                        lesson2.classId, placement.teacherId, placement.roomId,
                        "all", lesson2.subjectId, 2);
                    schedule.push({
                        classId: lesson2.classId, teacherId: placement.teacherId,
                        subjectId: lesson2.subjectId, roomId: placement.roomId,
                        day: placement.day, start: BASIC_SLOTS[placement.slotIndex + duration],
                        duration: slotsToHours(duration), week: "all", group: 2
                    });
                    lesson2.assigned = true;
                } else {
                    const sub = this.config.subjects.find(s => s.id === lesson1.subjectId);
                    warnings.push(`Impossible de placer le Groupe Solo consécutif : Classe ${lesson1.classId}, ${sub?.name || 'Matière ' + lesson1.subjectId} → tentative individuelle`);
                    individualLessons.push(lesson1, lesson2);
                }
            } else {
                warnings.push(`Paire Groupe ${pairId} de longueur invalide (${pair.length})`);
                individualLessons.push(...pair);
            }
        }

        // 4. Place individual lessons with scoring
        for (const lesson of individualLessons) {
            const placement = findBestPlacement(lesson);

            if (placement) {
                markPlacement(placement.day, placement.slotIndex, lesson.duration,
                    lesson.classId, placement.teacherId, placement.roomId,
                    lesson.week || "all", lesson.subjectId, lesson.group);

                schedule.push({
                    classId: lesson.classId, teacherId: placement.teacherId,
                    subjectId: lesson.subjectId, roomId: placement.roomId,
                    day: placement.day, start: BASIC_SLOTS[placement.slotIndex],
                    duration: slotsToHours(lesson.duration), week: lesson.week || "all", group: lesson.group
                });
                lesson.assigned = true;
            } else {
                const sub = this.config.subjects.find(s => s.id === lesson.subjectId);
                warnings.push(`Non placée : Classe ${lesson.classId}, ${sub?.name || 'Matière ' + lesson.subjectId}, ${slotsToHours(lesson.duration)}h` +
                    (lesson.group ? `, Groupe ${lesson.group}` : '') +
                    (lesson.week && lesson.week !== "all" ? `, Semaine ${lesson.week}` : ''));
                unassignedCount++;
            }
        }

        // ═══════════════════════════════════════════════════════
        // CALCULATE QUALITY METRICS
        // ═══════════════════════════════════════════════════════
        const totalLessons = lessons.length;

        // Day distribution (average over week A and week B)
        const dayDistribution: Record<string, number> = {};
        for (const day of DAYS) dayDistribution[day] = 0;
        for (const entry of schedule) {
            const weight = entry.week !== "all" ? 0.5 : 1.0;
            dayDistribution[entry.day] = (dayDistribution[entry.day] || 0) + entry.duration * weight;
        }
        // Round values
        for (const day of DAYS) {
            dayDistribution[day] = Math.round(dayDistribution[day] * 10) / 10;
        }

        // Teacher load (maximum load between week A and B)
        const teacherLoad = this.config.teachers.map(t => {
            const hoursA = teacherWeekHours.get(`${t.id}-A`) || 0;
            const hoursB = teacherWeekHours.get(`${t.id}-B`) || 0;
            const maxLoad = Math.max(hoursA, hoursB);
            return {
                id: t.id,
                name: t.name,
                hours: maxLoad,
                maxHours: t.maxHoursPerWeek
            };
        });

        // Add overload warnings
        for (const load of teacherLoad) {
            if (load.hours > load.maxHours) {
                warnings.push(`Enseignant surchargé : ${load.name} a ${load.hours}h de cours (max ${load.maxHours}h/semaine)`);
            }
        }

        // Teacher half-day respect
        let halfDayRespected = 0;
        let halfDayTotal = 0;
        for (const [, halves] of teacherDayHalves) {
            halfDayTotal++;
            if (halves.size <= 1) halfDayRespected++;
        }
        const teacherHalfDayRespect = halfDayTotal > 0 ? Math.round((halfDayRespected / halfDayTotal) * 100) : 100;

        // Count gaps
        let gapCount = 0;
        for (const [, slots] of classDaySlotSet) {
            if (slots.size < 2) continue;
            const sorted = Array.from(slots).sort((a, b) => a - b);
            for (let j = 1; j < sorted.length; j++) {
                const prev = sorted[j - 1];
                const curr = sorted[j];
                 if (prev === 7 && curr === 8) continue; // Midi break
                if (curr - prev > 1) gapCount++;
            }
        }

        // Quality score (0-100)
        const placedRatio = totalLessons > 0 ? (totalLessons - unassignedCount) / totalLessons : 1;
        let qualityScore = placedRatio * 50; // 50% for placement success

        // Day distribution evenness (20%)
        const dayValues = Object.values(dayDistribution);
        const avgDay = dayValues.reduce((a, b) => a + b, 0) / Math.max(1, dayValues.length);
        const dayVariance = avgDay > 0
            ? dayValues.reduce((sum, v) => sum + Math.pow(v - avgDay, 2), 0) / dayValues.length
            : 0;
        const dayEvenness = avgDay > 0 ? Math.max(0, 1 - Math.sqrt(dayVariance) / avgDay) : 1;
        qualityScore += dayEvenness * 20;

        // Teacher half-day (15%)
        qualityScore += (teacherHalfDayRespect / 100) * 15;

        // Gap-free (15%)
        const maxExpectedGaps = Math.max(1, schedule.length / 5);
        const gapFree = Math.max(0, 1 - gapCount / maxExpectedGaps);
        qualityScore += gapFree * 15;

        const metrics: QualityMetrics = {
            totalLessons,
            placedLessons: totalLessons - unassignedCount,
            unassignedCount,
            qualityScore: Math.round(Math.min(100, Math.max(0, qualityScore))),
            dayDistribution,
            teacherLoad: teacherLoad.filter(t => t.hours > 0),
            teacherHalfDayRespect,
            gapCount,
            warnings
        };

        return { schedule, metrics };
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API — Run multiple attempts, keep the best result
    // ═══════════════════════════════════════════════════════════════
    public generate(): { schedule: ScheduleEntry[]; metrics: QualityMetrics } {
        let bestResult: { schedule: ScheduleEntry[]; metrics: QualityMetrics } | null = null;

        for (let attempt = 0; attempt < NUM_GENERATION_ATTEMPTS; attempt++) {
            // Deep-clone lessons for each attempt (reset assigned state)
            const freshLessons: Lesson[] = this.allLessons.map(l => ({ ...l, assigned: false }));

            // First attempt uses sorted order, subsequent attempts use shuffled order
            const orderedLessons = attempt === 0
                ? this.sortLessons(freshLessons)
                : this.shuffleLessons(freshLessons);

            const result = this.runAttempt(orderedLessons);

            if (!bestResult || result.metrics.qualityScore > bestResult.metrics.qualityScore) {
                bestResult = result;
            }

            // Early exit if perfect score
            if (result.metrics.qualityScore >= 95 && result.metrics.unassignedCount === 0) {
                break;
            }
        }

        return bestResult!;
    }
}
