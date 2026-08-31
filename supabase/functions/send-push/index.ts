import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import webpush from 'npm:web-push@3.6.7'

const url = Deno.env.get('SUPABASE_URL')!
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>
const serviceKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!serviceKey) throw new Error('Supabase secret key is unavailable.')
const cronSecret = Deno.env.get('CRON_SECRET')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'
const db = createClient(url, serviceKey)

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== cronSecret) return new Response('Unauthorized', { status: 401 })

  const now = new Date()
  const staleLock = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  await db.from('notification_jobs')
    .update({ status: 'failed', locked_at: null, last_error: 'Delivery lock expired; retrying.' })
    .eq('status', 'processing')
    .lt('locked_at', staleLock)

  const { data: jobs, error } = await db.from('notification_jobs')
    .select('id,workspace_id,task_id,member_id,kind,attempts')
    .in('status', ['pending', 'failed'])
    .lte('deliver_at', now.toISOString())
    .lt('attempts', 3)
    .order('deliver_at')
    .limit(50)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const job of jobs ?? []) {
    const claimAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await db.from('notification_jobs')
      .update({ status: 'processing', locked_at: claimAt })
      .eq('id', job.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()
    if (claimError || !claimed) continue
    const [{ data: task }, { data: targets }, { data: workspace }, { data: subscriptions }, { data: recipient }] = await Promise.all([
      db.from('task_occurrences').select('id,workspace_id,state,due_at,action_name_snapshot,routine_name_snapshot,assignee_member_id,assignment_scope').eq('id', job.task_id).maybeSingle(),
      db.from('task_targets').select('entity_name_snapshot').eq('task_id', job.task_id),
      db.from('workspaces').select('name').eq('id', job.workspace_id).maybeSingle(),
      db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('member_id', job.member_id).is('disabled_at', null),
      db.from('workspace_members').select('id,workspace_id,status,user_id').eq('id', job.member_id).maybeSingle(),
    ])
    const scope = task?.assignment_scope || (task?.assignee_member_id ? 'member' : 'unassigned')
    const validRecipient = scope === 'member'
      ? task?.assignee_member_id === job.member_id
      : scope === 'everyone'
        ? recipient?.workspace_id === job.workspace_id && recipient?.status === 'active' && Boolean(recipient?.user_id)
        : false
    if (!task || task.state !== 'scheduled' || !validRecipient) {
      await db.from('notification_jobs').update({ status: 'cancelled', locked_at: null }).eq('id', job.id)
      continue
    }

    const targetNames = (targets ?? []).map((target) => target.entity_name_snapshot).join(', ')
    const payload = JSON.stringify({
      title: task.routine_name_snapshot || workspace?.name || 'House Care',
      body: targetNames ? `${task.action_name_snapshot}\n${targetNames}` : task.action_name_snapshot,
      tag: `task-${task.id}`,
      url: `/task/${task.id}`,
      taskId: task.id,
    })

    let delivered = 0
    let lastError = ''
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 * 60 * 24 })
        delivered += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        lastError = err instanceof Error ? err.message : String(err)
        if (statusCode === 404 || statusCode === 410) {
          await db.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('id', subscription.id)
        }
      }
    }

    if (delivered > 0) {
      await db.from('notification_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: job.attempts + 1, last_error: null, locked_at: null }).eq('id', job.id)
      await db.from('task_events').insert({
        workspace_id: job.workspace_id, task_id: job.task_id, event_type: 'NOTIFIED', event_at: new Date().toISOString(),
        metadata: { reminderKind: job.kind, deliveredDevices: delivered },
      })
      sent += 1
    } else {
      const message = lastError || 'No active push subscription for this recipient.'
      await db.from('notification_jobs').update({ status: 'failed', attempts: job.attempts + 1, last_error: message, locked_at: null }).eq('id', job.id)
      if (job.attempts + 1 >= 3) {
        await db.from('task_events').insert({
          workspace_id: job.workspace_id, task_id: job.task_id, event_type: 'NOTIFICATION_FAILED', event_at: new Date().toISOString(),
          metadata: { reminderKind: job.kind, error: message },
        })
      }
    }
  }

  return Response.json({ processed: jobs?.length ?? 0, sent })
})
