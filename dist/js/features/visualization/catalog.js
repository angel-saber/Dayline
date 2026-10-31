import { VISUALIZATION_QUOTES } from './quotes.js?v=221bd4f8c2b4';
export const VISUALIZATIONS = [
  [
    'good-day',
    'One Good Day',
    'Imagine reaching tonight feeling satisfied with your effort. Notice one thing you’re glad you did—not everything you finished. Picture yourself beginning it.',
    'Today, I’ll be glad I…',
  ],
  [
    'two-minutes',
    'The First Two Minutes',
    'Picture opening the document, putting on your shoes, or gathering your tools. Stay with those first two minutes rather than imagining the entire task.',
    'Choose your first tiny action.',
  ],
  [
    'steady-self',
    'Meet Your Steady Self',
    'Imagine yourself handling today with patience and determination. Watch how this version of you starts, responds to distractions, and returns after a break.',
    'Borrow one behavior.',
  ],
  [
    'obstacle',
    'The Obstacle Rehearsal',
    'Picture a likely interruption or moment of resistance. Rehearse a practical response, then see yourself returning to the task.',
    'If ___ happens, I’ll ___.',
  ],
  [
    'brick',
    'Lay One Brick',
    'Imagine your larger goal as a structure taking shape. Today’s work is one solid brick. Picture placing it carefully, without needing to build everything today.',
    'Name today’s brick.',
  ],
  [
    'stage',
    'Clear the Stage',
    'Imagine your responsibilities waiting backstage. Invite just one onto the stage; the others can wait their turn. Picture giving it your full attention.',
    'Choose what gets the stage first.',
  ],
  [
    'rough-version',
    'The Rough First Version',
    'Picture making an imperfect attempt: awkward sentences, a messy sketch, a short workout. Imagine letting it exist, then finding one useful thing to improve.',
    'Make the smallest rough version.',
  ],
  [
    'combo',
    'Build a Combo',
    'Picture completing one manageable action, then using that momentum for a second. Keep the sequence short enough to feel inviting.',
    'Choose a two-action combo.',
  ],
  [
    'next-move',
    'Your Next Move',
    'Imagine today as a chessboard. You don’t need to control every piece—just choose a move that improves your position or opens possibilities.',
    'Name one useful move.',
  ],
  [
    'energy',
    'Make Room for Energy',
    'Picture a day with both effort and replenishment: focused work, food, movement, connection, and rest. Imagine taking a break and returning with permission to begin again.',
    'Plan one restorative pause.',
  ],
  [
    'evidence',
    'Remember Your Evidence',
    'Recall a real moment when you started something difficult or followed through. Revisit what you actually did—not just how it turned out—and imagine using that behavior today.',
    'Repeat one proven action.',
  ],
  [
    'helps',
    'The Person It Helps',
    'Imagine someone benefiting from your effort: a collaborator, a friend, your household, or your future self. Picture the small, concrete difference your action could make.',
    'Choose one helpful contribution.',
  ],
  [
    'pressure',
    'Take the Pressure Off',
    'Picture setting down the expectation that today must prove your worth. Imagine working because something matters to you, with room to learn and adjust.',
    'Choose an achievable level of effort.',
  ],
  [
    'courage',
    'The Courageous Moment',
    'Picture the moment just before sending the email, asking for help, or beginning something unfamiliar. Rehearse taking the action while some uncertainty remains.',
    'Name one brave, manageable step.',
  ],
  [
    'again',
    'Begin Again',
    'Imagine a morning that starts late or a plan that goes sideways. Picture calmly choosing a new starting point instead of abandoning the day.',
    'From here, my next step is…',
  ],
  [
    'today-self',
    'Today’s Version of You',
    'Imagine the kind of person you want to be today. Choose one quality—curious, courageous, patient, playful, or your own. Picture an ordinary moment ahead and watch yourself express that quality through one small action.',
    'Today, I’ll practice being ___ by ___.',
  ],
  [
    'glad-to-be',
    'A Person You’d Be Glad to Be',
    'Imagine looking back tonight and feeling glad about how you showed up. Notice how you treated someone, cared for yourself, or approached something that mattered. Rehearse one choice that would make that version of today feel real.',
    'I’d be glad to be someone who ___ today. My first choice is ___.',
  ],
  [
    'value-in-motion',
    'A Value in Motion',
    'Choose a value you want to live today: kindness, honesty, creativity, diligence, or something personal. Imagine a scene where you could act on it. Watch what you say, what you do, and the small choice that makes the value visible.',
    'I’ll put ___ into practice when I ___.',
  ],
  [
    'future-self-moment',
    'Your Future Self, in One Small Moment',
    'Picture a version of yourself you would like to grow into. Bring them into one moment of your actual day, with the time and energy you have. Imagine how they begin, ask for help, or adapt. Borrow one achievable behavior for today.',
    'One behavior I can borrow today is ___. I’ll try it when ___.',
  ],
  [
    'on-your-side',
    'Be on Your Own Side',
    'Imagine being someone who supports themselves through a demanding day. Picture a moment of frustration and rehearse the words, breath, or movement that would help you respond with care. Then see yourself taking a manageable next step.',
    'When I need support today, I’ll ___, then ___.',
  ],
  [
    'admired-quality',
    'Make an Admired Quality Your Own',
    'Think of someone whose way of living you admire. Choose one quality rather than their achievements or circumstances. Imagine expressing that quality in your own way during a moment today. Picture the specific action you could take.',
    'I admire ___. Today, I can express it by ___.',
  ],
].map(([id, title, guidance, prompt]) => ({
  id,
  title,
  guidance,
  prompt,
  quote: VISUALIZATION_QUOTES[id],
}));

export function rollVisualization(previous, random = Math.random) {
  const choices = VISUALIZATIONS.filter((exercise) => exercise.id !== previous);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}
