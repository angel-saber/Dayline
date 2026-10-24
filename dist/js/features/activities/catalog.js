// Shared definitions keep the prompts, review, validation, and saved reports aligned.
export const lifeDimensions = [
  ['work', 'Work'],
  ['health', 'Health'],
  ['learning', 'Learning'],
  ['relationships', 'Relationships'],
  ['spirituality', 'Spirituality'],
];
const field = (key, label, hint = '', optional = false) => ({ key, label, hint, optional });
export const activityCatalog = {
  untangle: {
    title: 'Untangle My Thoughts',
    description:
      'Clear some mental space: write freely, sort your thoughts, and choose one next step.',
    steps: [
      {
        title: 'Let it out',
        fields: [
          field(
            'thoughts',
            'What is taking up space in your mind?',
            'Write freely. You do not need to organize anything yet.',
          ),
        ],
      },
      {
        title: 'Give each thought a place',
        fields: [
          field(
            'act',
            'Act — what can you do something about?',
            'Move relevant thoughts from your brain dump here.',
            true,
          ),
          field(
            'ask',
            'Ask — what needs help or clarification?',
            'Include a person to ask, if you know.',
            true,
          ),
          field('later', 'Later — what can wait?', 'You can let these rest for now.', true),
        ],
      },
      {
        title: 'Choose one next step',
        fields: [
          field(
            'next',
            'What is one small action you will take next?',
            'Choose an action from Act, ask someone for help, or deliberately make space to rest.',
          ),
        ],
      },
    ],
  },
  'two-minute': {
    title: 'The Two-Minute Start',
    description:
      'Turn something you are avoiding into a tiny action, try it for two minutes, then choose what comes next.',
    steps: [
      {
        title: 'Name the resistance',
        fields: [
          field(
            'avoiding',
            'What have you been putting off?',
            'Describe the task without judging yourself.',
          ),
        ],
      },
      {
        title: 'Make it tiny',
        fields: [
          field(
            'action',
            'What could you do for just two minutes?',
            'Open the document, write one sentence, or put away three things. Starting is enough.',
          ),
        ],
      },
      { title: 'Try your tiny action', timer: true, fields: [] },
      {
        title: 'Notice what moved',
        fields: [
          field(
            'progress',
            'What did you do or notice?',
            'Even opening the task or learning what blocked you is useful.',
          ),
          field(
            'decision',
            'What will you do now?',
            'Continue, pause, ask for help, or schedule another small step.',
          ),
        ],
      },
    ],
  },
  compass: {
    title: 'Monthly Compass',
    description:
      'Choose a project in each life dimension, then one task per week to bring each project to completion in four weeks.',
    steps: lifeDimensions.map(([key, label]) => ({
      title: label,
      fields: [
        field(
          `${key}.project`,
          `${label}: what project will you finish in four weeks?`,
          key === 'spirituality'
            ? 'Choose a meaningful project connected to your values, faith, or sense of purpose.'
            : 'Choose a small, specific outcome that fits the time and energy you have.',
        ),
        ...[1, 2, 3, 4].map((week) =>
          field(
            `${key}.week${week}`,
            `Week ${week}: ${week === 4 ? 'what final task will finish this project?' : 'what one task will move this project forward?'}`,
            week === 1
              ? 'Start with a concrete first step.'
              : week === 4
                ? 'Make this the finishing step.'
                : 'Build on the previous week’s task.',
          ),
        ),
      ],
    })),
  },
};
export function activityFields(type) {
  return activityCatalog[type]?.steps?.flatMap((s) => s.fields) || [];
}
