// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit } from '@devvit/public-api';

Devvit.configure({ redditAPI: true, redis: true, });

Devvit.addSettings([
  {
    type: 'string',
    name: 'ifBefore',
    label: 'when changed from (template id)',
    helpText: 'leave empty for any',
  },
  {
    type: 'string',
    name: 'ifAfter',
    label: 'when changed to (template id)',
    helpText: 'leave empty for any',
  },
  {
    type: 'select',
    name: 'Then',
    label: 'then do?',
    options: [
      { label: 'Remove', value: 'remove' },
      { label: 'Report', value: 'report' },
      { label: 'Ban and remove', value: 'ban' },
    ]
  },
  {
    type: 'string',
    name: 'reportReason',
    label: 'if i report, what reason?',
    defaultValue: 'inappropriate flairchange',
  },
  {
    type: 'string',
    name: 'removeReason',
    label: 'if i remove, what reason?',
    defaultValue: 'please do not change flairs like that',
  }, {
    type: 'string',
    name: 'banReason',
    label: 'if i ban, what reason to send to the user?',
    defaultValue: 'please do not change flairs like that',
  },
  {
    type: 'number',
    name: 'banLength',
    label: 'if i ban, how many days?',
    onValidate({ value }) {
      if (value === undefined) return;
      if (value > 0 && value < 1000) {
        return;
      } else {
        return 'number must be between 1 and 999';
      }
    }
  },
]);

async function yourFunction(oldFlair: string, newFlair: string, username: string, subredditName: string, context: any, postId: string): Promise<void> {
  const reportReason = await context.settings.get('reportReason'), removeReason = await context.settings.get('removeReason');
  const duration = await context.settings.get('banLength'), banReason = await context.settings.get('banReason');
  const ifBefore = await context.settings.get('ifBefore'), ifAfter = await context.settings.get('ifAfter');
  const then = String(await context.settings.get('Then')), post = await context.reddit.getPostById(postId);
  console.log('before =', ifBefore === oldFlair, '; after =', ifAfter === newFlair);
  if ((ifBefore === oldFlair || ifBefore === '') && (ifAfter === newFlair || ifAfter === '')) {
    console.log('then =', then);
    switch (then) {
      case 'report': {
        const reason = reportReason;
        await context.reddit.report(post, { reason });
      }
        break;
      case 'ban':
        {
          const message = banReason;// too worrries to test this
          await context.reddit.banUser({ subredditName, username, duration, message, context: postId });
        }
      case 'remove': {
        const text = removeReason;
        post.addComment({ text });
        post.remove();
      }
        break;
    }
  }
}

Devvit.addTrigger({
  events: ['PostSubmit', 'PostFlairUpdate'],
  async onEvent(event, context) {
    const postId = event.post?.id; // You may need to adjust this based on the actual event payload structure
    if (postId === undefined) return;

    // Retrieve old flair from Redis
    const oldFlair = await context.redis.get(`flair:${postId}`);

    // Get new flair from the event (assuming event.flair or similar)
    const newFlair = event.post?.linkFlair?.templateId; // Adjust as needed based on event structure
    console.log('---'); console.log('newFlair', newFlair, 'oldFlair', oldFlair);

    // Store new flair in Redis
    if (newFlair === undefined) return;
    await context.redis.set(`flair:${postId}`, newFlair);
    if (oldFlair === undefined) return;
    if (event.author?.name === undefined) return;
    if (context.subredditName === undefined) return;
    console.log('yourFunction');
    // Call your function with the required parameters
    await yourFunction(oldFlair, newFlair, event.author.name, context.subredditName, context, postId);
    // const post = await context.reddit.getPostById(postId);
  },
});

export default Devvit;
