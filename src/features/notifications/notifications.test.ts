import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('notification rules live in the database', () => {
  it('nobody can forge a notification for someone else', async () => {
    // There is deliberately no insert policy: rows come only from triggers
    // running as definer. Without this, anyone could POST a notification
    // claiming to be from anyone.
    const schema = await readFile('supabase/schema.sql', 'utf8');
    expect(schema).toContain('create policy notifications_read on notifications');
    expect(schema).not.toContain('create policy notifications_insert');
  });

  it('you only ever read your own', async () => {
    const schema = await readFile('supabase/schema.sql', 'utf8');
    const policy = schema.match(/create policy notifications_read[\s\S]*?;/)?.[0];
    expect(policy).toContain('user_id = auth.uid()');
  });

  it('a switch turned off stops the row being written at all', async () => {
    // Filtering on read would leave the data there and the count wrong.
    const schema = await readFile('supabase/schema.sql', 'utf8');
    const fn = schema.match(/create or replace function notify\([\s\S]*?end \$\$;/)?.[0];
    expect(fn).toContain('wants_notification');
  });

  it('does not notify you about your own actions', async () => {
    const schema = await readFile('supabase/schema.sql', 'utf8');
    const fn = schema.match(/create or replace function notify\([\s\S]*?end \$\$;/)?.[0];
    expect(fn).toContain('p_user = p_actor');
  });

  it('covers every kind the app renders', async () => {
    const schema = await readFile('supabase/schema.sql', 'utf8');
    for (const kind of ['like', 'comment', 'follow', 'follow_request', 'follow_accepted']) {
      expect(schema).toContain(`'${kind}'`);
    }
  });
});
