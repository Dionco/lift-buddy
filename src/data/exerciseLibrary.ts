import { Exercise } from '@/types/training';

// free-exercise-db image base URL (Unlicense / public domain).
// Exercises with no matching entry in the dataset (e.g. Seal Row, Pendlay Row)
// simply omit imageUrl.
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const img = (path: string): string => IMG_BASE + path;

export const EXERCISES: Record<string, Exercise> = {
  // ─── Main lifts ────────────────────────────────────────────────────────────
  squat: {
    id: 'squat', name: 'Squat',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Adductors', 'Spinal Erectors'],
    isMainLift: true, imageUrl: img('Barbell_Squat/0.jpg'),
  },
  bench: {
    id: 'bench', name: 'Bench Press',
    primaryMuscles: ['Chest', 'Front Delts', 'Triceps'],
    isMainLift: true, imageUrl: img('Barbell_Bench_Press_-_Medium_Grip/0.jpg'),
  },
  deadlift: {
    id: 'deadlift', name: 'Deadlift',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Spinal Erectors'],
    secondaryMuscles: ['Lats', 'Upper Back', 'Traps', 'Forearms'],
    isMainLift: true, imageUrl: img('Barbell_Deadlift/0.jpg'),
  },

  // ─── Squat variations ──────────────────────────────────────────────────────
  pausedSquat: {
    id: 'pausedSquat', name: 'Paused Squat',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Adductors', 'Spinal Erectors'],
    isMainLift: false, relatedTo: 'Squat',
  },
  tempoSquat: {
    id: 'tempoSquat', name: 'Tempo Squat',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Adductors', 'Spinal Erectors'],
    isMainLift: false, relatedTo: 'Squat',
  },
  ssbSquat: {
    id: 'ssbSquat', name: 'SSB Squat',
    primaryMuscles: ['Quads', 'Glutes', 'Spinal Erectors'], secondaryMuscles: ['Adductors'],
    isMainLift: false, relatedTo: 'Squat',
  },
  frontSquat: {
    id: 'frontSquat', name: 'Front Squat',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Core', 'Spinal Erectors'],
    isMainLift: false, relatedTo: 'Squat', imageUrl: img('Front_Barbell_Squat/0.jpg'),
  },

  // ─── Bench variations ──────────────────────────────────────────────────────
  closeGripBench: {
    id: 'closeGripBench', name: 'Close-Grip Bench',
    primaryMuscles: ['Triceps', 'Chest', 'Front Delts'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Close-Grip_Barbell_Bench_Press/0.jpg'),
  },
  pausedBench: {
    id: 'pausedBench', name: 'Paused Bench',
    primaryMuscles: ['Chest', 'Front Delts', 'Triceps'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Bench_Press_-_Powerlifting/0.jpg'),
  },
  inclineBench: {
    id: 'inclineBench', name: 'Incline Bench',
    primaryMuscles: ['Chest', 'Front Delts'], secondaryMuscles: ['Triceps'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg'),
  },
  wideGripBench: {
    id: 'wideGripBench', name: 'Wide-Grip Bench',
    primaryMuscles: ['Chest', 'Front Delts'], secondaryMuscles: ['Triceps'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Wide-Grip_Barbell_Bench_Press/0.jpg'),
  },
  declineBench: {
    id: 'declineBench', name: 'Decline Bench Press',
    primaryMuscles: ['Chest', 'Triceps'], secondaryMuscles: ['Front Delts'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Decline_Barbell_Bench_Press/0.jpg'),
  },
  dbBench: {
    id: 'dbBench', name: 'DB Bench Press',
    primaryMuscles: ['Chest', 'Front Delts', 'Triceps'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Dumbbell_Bench_Press/0.jpg'),
  },
  dbInclineBench: {
    id: 'dbInclineBench', name: 'DB Incline Bench',
    primaryMuscles: ['Chest', 'Front Delts'], secondaryMuscles: ['Triceps'],
    isMainLift: false, relatedTo: 'Bench Press', imageUrl: img('Incline_Dumbbell_Press/0.jpg'),
  },

  // ─── Deadlift variations ───────────────────────────────────────────────────
  sumoDeadlift: {
    id: 'sumoDeadlift', name: 'Sumo Deadlift',
    primaryMuscles: ['Glutes', 'Quads', 'Adductors', 'Spinal Erectors'],
    secondaryMuscles: ['Hamstrings', 'Traps'],
    isMainLift: false, relatedTo: 'Deadlift', imageUrl: img('Sumo_Deadlift/0.jpg'),
  },
  deficitDeadlift: {
    id: 'deficitDeadlift', name: 'Deficit Deadlift',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Quads', 'Spinal Erectors'],
    secondaryMuscles: ['Lats', 'Traps'],
    isMainLift: false, relatedTo: 'Deadlift', imageUrl: img('Deficit_Deadlift/0.jpg'),
  },
  rdl: {
    id: 'rdl', name: 'Romanian Deadlift',
    primaryMuscles: ['Hamstrings', 'Glutes'], secondaryMuscles: ['Spinal Erectors', 'Forearms'],
    isMainLift: false, relatedTo: 'Deadlift', imageUrl: img('Romanian_Deadlift/0.jpg'),
  },
  pausedDeadlift: {
    id: 'pausedDeadlift', name: 'Paused Deadlift',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Spinal Erectors'],
    secondaryMuscles: ['Lats', 'Upper Back', 'Traps', 'Forearms'],
    isMainLift: false, relatedTo: 'Deadlift',
  },
  goodMorning: {
    id: 'goodMorning', name: 'Good Morning',
    primaryMuscles: ['Hamstrings', 'Glutes', 'Spinal Erectors'], secondaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Good_Morning/0.jpg'),
  },

  // ─── Lower-body accessories ────────────────────────────────────────────────
  legPress: {
    id: 'legPress', name: 'Leg Press',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Adductors'],
    isMainLift: false, imageUrl: img('Leg_Press/0.jpg'),
  },
  hackSquat: {
    id: 'hackSquat', name: 'Hack Squat',
    primaryMuscles: ['Quads'], secondaryMuscles: ['Glutes', 'Hamstrings'],
    isMainLift: false, imageUrl: img('Hack_Squat/0.jpg'),
  },
  bulgarianSplitSquat: {
    id: 'bulgarianSplitSquat', name: 'Bulgarian Split Squat',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Adductors'],
    isMainLift: false, imageUrl: img('Split_Squat_with_Dumbbells/0.jpg'),
  },
  walkingLunge: {
    id: 'walkingLunge', name: 'Walking Lunge',
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Adductors'],
    isMainLift: false, imageUrl: img('Dumbbell_Lunges/0.jpg'),
  },
  legExtension: {
    id: 'legExtension', name: 'Leg Extension',
    primaryMuscles: ['Quads'],
    isMainLift: false, imageUrl: img('Leg_Extensions/0.jpg'),
  },
  hipThrust: {
    id: 'hipThrust', name: 'Hip Thrust',
    primaryMuscles: ['Glutes'], secondaryMuscles: ['Hamstrings'],
    isMainLift: false, imageUrl: img('Barbell_Hip_Thrust/0.jpg'),
  },
  legCurl: {
    id: 'legcurl', name: 'Lying Leg Curl',
    primaryMuscles: ['Hamstrings'],
    isMainLift: false, imageUrl: img('Lying_Leg_Curls/0.jpg'),
  },
  seatedLegCurl: {
    id: 'seatedLegCurl', name: 'Seated Leg Curl',
    primaryMuscles: ['Hamstrings'],
    isMainLift: false, imageUrl: img('Seated_Leg_Curl/0.jpg'),
  },
  ghr: {
    id: 'ghr', name: 'Glute-Ham Raise',
    primaryMuscles: ['Hamstrings', 'Glutes'], secondaryMuscles: ['Calves'],
    isMainLift: false, imageUrl: img('Glute_Ham_Raise/0.jpg'),
  },
  calfRaise: {
    id: 'calfraise', name: 'Calf Raise',
    primaryMuscles: ['Calves'],
    isMainLift: false, imageUrl: img('Standing_Calf_Raises/0.jpg'),
  },
  standingCalfRaise: {
    id: 'standingCalfRaise', name: 'Standing Calf Raise',
    primaryMuscles: ['Calves'],
    isMainLift: false, imageUrl: img('Standing_Calf_Raises/0.jpg'),
  },
  seatedCalfRaise: {
    id: 'seatedCalfRaise', name: 'Seated Calf Raise',
    primaryMuscles: ['Calves'],
    isMainLift: false, imageUrl: img('Seated_Calf_Raise/0.jpg'),
  },

  // ─── Upper push (chest / shoulders / triceps) ──────────────────────────────
  overheadPress: {
    id: 'ohp', name: 'Overhead Press',
    primaryMuscles: ['Front Delts', 'Triceps'],
    secondaryMuscles: ['Side Delts', 'Upper Back', 'Core'],
    isMainLift: false, imageUrl: img('Barbell_Shoulder_Press/0.jpg'),
  },
  dbSeatedOhp: {
    id: 'dbSeatedOhp', name: 'DB Seated Overhead Press',
    primaryMuscles: ['Front Delts', 'Triceps'], secondaryMuscles: ['Side Delts'],
    isMainLift: false, imageUrl: img('Seated_Dumbbell_Press/0.jpg'),
  },
  machineOhp: {
    id: 'machineOhp', name: 'Machine Shoulder Press',
    primaryMuscles: ['Front Delts', 'Triceps'], secondaryMuscles: ['Side Delts'],
    isMainLift: false, imageUrl: img('Leverage_Shoulder_Press/0.jpg'),
  },
  arnoldPress: {
    id: 'arnoldPress', name: 'Arnold Press',
    primaryMuscles: ['Front Delts', 'Side Delts'], secondaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('Kettlebell_Arnold_Press/0.jpg'),
  },
  lateralRaise: {
    id: 'latraise', name: 'DB Lateral Raise',
    primaryMuscles: ['Side Delts'],
    isMainLift: false, imageUrl: img('Side_Lateral_Raise/0.jpg'),
  },
  cableLatRaise: {
    id: 'cableLatRaise', name: 'Cable Lateral Raise',
    primaryMuscles: ['Side Delts'],
    isMainLift: false,
  },
  frontRaise: {
    id: 'frontRaise', name: 'DB Front Raise',
    primaryMuscles: ['Front Delts'],
    isMainLift: false, imageUrl: img('Front_Two-Dumbbell_Raise/0.jpg'),
  },
  dips: {
    id: 'dips', name: 'Dips',
    primaryMuscles: ['Triceps', 'Chest', 'Front Delts'],
    isMainLift: false, imageUrl: img('Dips_-_Triceps_Version/0.jpg'),
  },
  pushUp: {
    id: 'pushUp', name: 'Push-Up',
    primaryMuscles: ['Chest', 'Front Delts', 'Triceps'], secondaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Pushups/0.jpg'),
  },
  machineChestPress: {
    id: 'machineChestPress', name: 'Machine Chest Press',
    primaryMuscles: ['Chest', 'Front Delts', 'Triceps'],
    isMainLift: false, imageUrl: img('Machine_Bench_Press/0.jpg'),
  },
  pecDeck: {
    id: 'pecDeck', name: 'Pec Deck',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Front Delts'],
    isMainLift: false, imageUrl: img('Butterfly/0.jpg'),
  },
  cableFly: {
    id: 'cableFly', name: 'Cable Fly',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Front Delts'],
    isMainLift: false, imageUrl: img('Cable_Crossover/0.jpg'),
  },
  dbFly: {
    id: 'dbFly', name: 'DB Fly',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Front Delts'],
    isMainLift: false, imageUrl: img('Dumbbell_Flyes/0.jpg'),
  },
  skullCrushers: {
    id: 'skullCrushers', name: 'Skull Crushers',
    primaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('EZ-Bar_Skullcrusher/0.jpg'),
  },
  ohcTricepsExt: {
    id: 'ohcTricepsExt', name: 'Overhead Cable Triceps Extension',
    primaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('Cable_Rope_Overhead_Triceps_Extension/0.jpg'),
  },
  cableTricepPushdown: {
    id: 'cableTricepPushdown', name: 'Cable Triceps Pushdown',
    primaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('Triceps_Pushdown/0.jpg'),
  },
  ropeTricepPushdown: {
    id: 'ropeTricepPushdown', name: 'Rope Triceps Pushdown',
    primaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('Triceps_Pushdown_-_Rope_Attachment/0.jpg'),
  },
  dbTricepExt: {
    id: 'dbTricepExt', name: 'DB Triceps Extension',
    primaryMuscles: ['Triceps'],
    isMainLift: false, imageUrl: img('Standing_Dumbbell_Triceps_Extension/0.jpg'),
  },

  // ─── Upper pull (back / biceps) ────────────────────────────────────────────
  barbellRow: {
    id: 'row', name: 'Barbell Row',
    primaryMuscles: ['Lats', 'Upper Back', 'Rear Delts'], secondaryMuscles: ['Biceps', 'Spinal Erectors'],
    isMainLift: false, imageUrl: img('Bent_Over_Barbell_Row/0.jpg'),
  },
  pendlayRow: {
    id: 'pendlayRow', name: 'Pendlay Row',
    primaryMuscles: ['Lats', 'Upper Back', 'Rear Delts'], secondaryMuscles: ['Biceps', 'Spinal Erectors'],
    isMainLift: false,
  },
  sealRow: {
    id: 'sealRow', name: 'Seal Row',
    primaryMuscles: ['Lats', 'Upper Back'], secondaryMuscles: ['Rear Delts', 'Biceps'],
    isMainLift: false,
  },
  tBarRow: {
    id: 'tBarRow', name: 'T-Bar Row',
    primaryMuscles: ['Upper Back', 'Lats'], secondaryMuscles: ['Biceps', 'Rear Delts'],
    isMainLift: false, imageUrl: img('Lying_T-Bar_Row/0.jpg'),
  },
  seatedCableRow: {
    id: 'seatedCableRow', name: 'Seated Cable Row',
    primaryMuscles: ['Upper Back', 'Lats'], secondaryMuscles: ['Biceps', 'Rear Delts'],
    isMainLift: false, imageUrl: img('Seated_Cable_Rows/0.jpg'),
  },
  oneArmDbRow: {
    id: 'oneArmDbRow', name: 'One-Arm DB Row',
    primaryMuscles: ['Lats', 'Upper Back'], secondaryMuscles: ['Biceps', 'Rear Delts'],
    isMainLift: false, imageUrl: img('One-Arm_Dumbbell_Row/0.jpg'),
  },
  latPulldown: {
    id: 'latPulldown', name: 'Lat Pulldown',
    primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps', 'Upper Back', 'Rear Delts'],
    isMainLift: false, imageUrl: img('Wide-Grip_Lat_Pulldown/0.jpg'),
  },
  singleArmLatPulldown: {
    id: 'singleArmLatPulldown', name: 'Single-Arm Lat Pulldown',
    primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps', 'Upper Back'],
    isMainLift: false, imageUrl: img('One_Arm_Lat_Pulldown/0.jpg'),
  },
  pullUp: {
    id: 'pullup', name: 'Pull-ups',
    primaryMuscles: ['Lats', 'Upper Back'], secondaryMuscles: ['Biceps', 'Rear Delts', 'Forearms'],
    isMainLift: false, imageUrl: img('Pullups/0.jpg'),
  },
  chinUp: {
    id: 'chinUp', name: 'Chin-Up',
    primaryMuscles: ['Lats', 'Biceps'], secondaryMuscles: ['Upper Back', 'Forearms'],
    isMainLift: false, imageUrl: img('Chin-Up/0.jpg'),
  },
  facePull: {
    id: 'facePull', name: 'Face Pull',
    primaryMuscles: ['Rear Delts', 'Upper Back'], secondaryMuscles: ['Traps'],
    isMainLift: false, imageUrl: img('Face_Pull/0.jpg'),
  },
  reverseFly: {
    id: 'reverseFly', name: 'Reverse Fly',
    primaryMuscles: ['Rear Delts'], secondaryMuscles: ['Upper Back'],
    isMainLift: false, imageUrl: img('Reverse_Flyes/0.jpg'),
  },
  barbellShrug: {
    id: 'barbellShrug', name: 'Barbell Shrug',
    primaryMuscles: ['Traps'],
    isMainLift: false, imageUrl: img('Barbell_Shrug/0.jpg'),
  },
  dbShrug: {
    id: 'dbShrug', name: 'DB Shrug',
    primaryMuscles: ['Traps'],
    isMainLift: false, imageUrl: img('Dumbbell_Shrug/0.jpg'),
  },
  bicepCurl: {
    id: 'curl', name: 'Bicep Curl',
    primaryMuscles: ['Biceps'], secondaryMuscles: ['Forearms'],
    isMainLift: false, imageUrl: img('Barbell_Curl/0.jpg'),
  },
  hammerCurl: {
    id: 'hammerCurl', name: 'Hammer Curl',
    primaryMuscles: ['Biceps'], secondaryMuscles: ['Forearms'],
    isMainLift: false, imageUrl: img('Hammer_Curls/0.jpg'),
  },
  preacherCurl: {
    id: 'preacherCurl', name: 'Preacher Curl',
    primaryMuscles: ['Biceps'],
    isMainLift: false, imageUrl: img('Preacher_Curl/0.jpg'),
  },
  inclineDbCurl: {
    id: 'inclineDbCurl', name: 'Incline DB Curl',
    primaryMuscles: ['Biceps'],
    isMainLift: false, imageUrl: img('Incline_Dumbbell_Curl/0.jpg'),
  },
  cableCurl: {
    id: 'cableCurl', name: 'Cable Curl',
    primaryMuscles: ['Biceps'],
    isMainLift: false, imageUrl: img('Standing_Biceps_Cable_Curl/0.jpg'),
  },

  // ─── Core ──────────────────────────────────────────────────────────────────
  plank: {
    id: 'plank', name: 'Plank',
    primaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Plank/0.jpg'),
  },
  abWheel: {
    id: 'abWheel', name: 'Ab Wheel',
    primaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Ab_Roller/0.jpg'),
  },
  cableCrunch: {
    id: 'cableCrunch', name: 'Cable Crunch',
    primaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Cable_Crunch/0.jpg'),
  },
  hangingLegRaise: {
    id: 'hangingLegRaise', name: 'Hanging Leg Raise',
    primaryMuscles: ['Core'], secondaryMuscles: ['Forearms'],
    isMainLift: false, imageUrl: img('Hanging_Leg_Raise/0.jpg'),
  },
  pallofPress: {
    id: 'pallofPress', name: 'Pallof Press',
    primaryMuscles: ['Core'],
    isMainLift: false, imageUrl: img('Pallof_Press/0.jpg'),
  },
};
