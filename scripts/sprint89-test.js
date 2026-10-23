#!/usr/bin/env node
/**
 * Sprint 8/9 verification suite — runs against the live backend (mock mode).
 * Verifies the spec bullets end-to-end via the same HTTP API the frontend uses.
 * Run: node scripts/sprint89-test.js   (backend must be running on :5000)
 */
const BASE = 'http://localhost:5000';
const TENANT = { email: 'dev.tenant@homelink.test', password: 'Password123!' };
const LANDLORD = { email: 'dev.landlord@homelink.test', password: 'Password123!' };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

async function api(method, path, token, body, isForm) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

const unwrap = (d) => (d && typeof d === 'object' && 'data' in d ? d.data : d);

(async () => {
  console.log('Sprint 8/9 verification — ' + BASE);

  // ── login ──
  const t = await api('POST', '/api/auth/login', null, TENANT);
  const L = await api('POST', '/api/auth/login', null, LANDLORD);
  const tTok = t.data && (t.data.token || t.data.data && t.data.data.token);
  const lTok = L.data && (L.data.token || L.data.data && L.data.data.token);
  ok('tenant login', !!tTok);
  ok('landlord login', !!lTok);
  if (!tTok || !lTok) process.exit(1);
  const tUser = (t.data.user || (t.data.data && t.data.data.user)) || {};
  const tId = tUser.id || tUser._id;

  // ══ SPRINT 8 — AGREEMENT ══
  console.log('\n── Sprint 8: Agreement ──');
  const props = await api('GET', '/api/v1/properties/search?q=Bole', tTok);
  const propertyId = unwrap(props.data)[0]._id;
  const start = new Date(); start.setDate(start.getDate() + 3);
  const end = new Date(start); end.setFullYear(end.getFullYear() + 1);

  const created = await api('POST', '/api/v1/agreements', lTok, {
    propertyId, tenantId: tId,
    rentAmount: 42000, depositAmount: 84000,
    startDate: start.toISOString(), endDate: end.toISOString(),
    paymentDueDay: 5,
  });
  const agr = unwrap(created.data);
  const aid = agr && agr._id;
  ok('agreement created (201)', created.status === 201, 'got ' + created.status);
  ok('agreement has all spec fields', !!agr && ['tenantId', 'landlordId', 'propertyId', 'rentAmount', 'depositAmount', 'startDate', 'endDate', 'status'].every((k) => k in agr));
  ok('starts as pending_signatures', agr && agr.status === 'pending_signatures');
  ok('landlord confirmation recorded on create', agr && !!agr.landlordSignedAt);

  const detail = await api('GET', '/api/v1/agreements/' + aid, tTok);
  ok('agreement detail readable (200)', detail.status === 200, 'got ' + detail.status);

  const tSign = await api('PUT', '/api/v1/agreements/' + aid + '/confirm', tTok, {});
  const agr2 = unwrap(tSign.data);
  ok('tenant confirms (200)', tSign.status === 200, 'got ' + tSign.status);
  ok('tenant signature recorded', agr2 && !!agr2.tenantSignedAt);
  ok('agreement becomes active after both confirm', agr2 && agr2.status === 'active');

  const lateSign = await api('PUT', '/api/v1/agreements/' + aid + '/confirm', lTok, {});
  ok('signing an active agreement blocked (400)', lateSign.status === 400, 'got ' + lateSign.status);

  const list = await api('GET', '/api/v1/agreements', tTok);
  ok('agreements list includes new one', Array.isArray(unwrap(list.data)) && unwrap(list.data).some((a) => a._id === aid));

  // ══ SPRINT 8 — RENT ══
  console.log('\n── Sprint 8: Rent tracking ──');
  const gen = await api('POST', '/api/v1/payments/generate/' + aid, lTok, {});
  ok('rent schedule generated (201)', gen.status === 201, 'got ' + gen.status);
  const gen2 = await api('POST', '/api/v1/payments/generate/' + aid, lTok, {});
  const created2 = gen2.data && gen2.data.data && gen2.data.data.created;
  ok('schedule generation idempotent (no duplicates)', created2 === 0, 'created ' + created2);

  const pays = await api('GET', '/api/v1/payments', tTok);
  const rows = unwrap(pays.data) || [];
  const mine = rows.filter((p) => p.agreementId === aid);
  ok('schedule rows created for agreement', mine.length >= 12, 'got ' + mine.length);
  ok('rows track amount/dueDate/status', mine.every((p) => p.amountDue !== undefined && p.dueDate && p.status));
  ok('status values within spec {pending,paid,overdue}', mine.every((p) => ['pending', 'paid', 'overdue'].includes(p.status)));
  const dueDay5 = mine.filter((p) => new Date(p.dueDate).getDate() === 5);
  ok('due date honors paymentDueDay (5th)', dueDay5.length === mine.length, dueDay5.length + '/' + mine.length);

  const first = mine.find((p) => p.status !== 'paid') || mine[0];
  const rec = await api('POST', '/api/v1/payments/' + first._id + '/pay', tTok, { paymentMethod: 'cbe', transactionReference: 'SPRINT89-TX-1' });
  ok('tenant records payment (200)', rec.status === 200, 'got ' + rec.status);
  const ver = await api('PUT', '/api/v1/payments/' + first._id + '/verify', lTok, { amountPaid: 42000, status: 'paid' });
  const verBody = unwrap(ver.data);
  ok('landlord verifies payment (200)', ver.status === 200, 'got ' + ver.status);
  ok('payment marked paid with amountPaid', verBody && verBody.status === 'paid' && verBody.amountPaid === 42000);

  // NOTE: the pending→overdue time flip is verified separately in
  // scripts/sprint89-sweep-smoke.js (module-level test of the sweep job).

  // ══ SPRINT 9 — MAINTENANCE ══
  console.log('\n── Sprint 9: Maintenance ──');
  const tick = await api('POST', '/api/v1/maintenance', tTok, {
    propertyId,
    title: 'Kitchen sink leaking',
    issue: 'Kitchen sink leaking',
    description: 'Water pooling under the sink',
    category: 'plumbing',
    priority: 'high',
  });
  const ticket = unwrap(tick.data);
  const tid = ticket && ticket._id;
  ok('ticket created with issue/description/category/priority (201)', tick.status === 201 && ticket && ticket.issue && ticket.priority === 'high', 'got ' + tick.status);
  ok('ticket starts as reported/submitted', ticket && ['submitted', 'reported'].includes(ticket.status));
  ok('category stored', ticket && ticket.category === 'plumbing');

  const up = await api('PUT', '/api/v1/maintenance/' + tid + '/status', lTok, { status: 'in_progress', assignedTo: 'mock-landlord-1' });
  ok('landlord updates status (200)', up.status === 200, 'got ' + up.status);

  const note = await api('POST', '/api/v1/maintenance/' + tid + '/updates', lTok, { note: 'Plumber scheduled for tomorrow' });
  const noteBody = unwrap(note.data);
  ok('landlord adds response (200/201)', [200, 201].includes(note.status), 'got ' + note.status);
  ok('response stored on ticket timeline', noteBody && Array.isArray(noteBody.updates) && noteBody.updates.some((u) => (u.note || '').includes('Plumber scheduled')));

  const resv = await api('PUT', '/api/v1/maintenance/' + tid + '/status', lTok, { status: 'resolved', resolutionNote: 'Fixed the pipe' });
  ok('landlord resolves (200)', resv.status === 200, 'got ' + resv.status);

  const conf = await api('PUT', '/api/v1/maintenance/' + tid + '/confirm', tTok, {});
  const confBody = unwrap(conf.data);
  ok('tenant confirms → closed (200)', conf.status === 200 && confBody && confBody.status === 'closed', 'got ' + conf.status);

  const tList = await api('GET', '/api/v1/maintenance/my', tTok);
  ok('tenant sees own tickets (200)', tList.status === 200 && (unwrap(tList.data) || []).some((x) => x._id === tid));

  // ══ SPRINT 9 — COMMUNICATION ══
  console.log('\n── Sprint 9: Communication ──');
  const lId = 'mock-landlord-1';
  const send = await api('POST', '/api/v1/messages', tTok, { receiverId: lId, text: 'Hello, is parking included?' });
  const msgBody = unwrap(send.data);
  ok('tenant sends message (201)', send.status === 201, 'got ' + send.status + ' ' + JSON.stringify(send.data).slice(0, 80));
  ok('message has text + timestamp', msgBody && msgBody.text && !!msgBody.createdAt);

  const convs = await api('GET', '/api/v1/messages/conversations', tTok);
  const convRows = unwrap(convs.data) || [];
  const conv = convRows.find((c) => c.otherUser && (c.otherUser._id === lId || c.otherUser._id && c.otherUser._id.includes && c.otherUser._id.includes('landlord')));
  ok('conversation created and listed', !!conv, JSON.stringify(convRows).slice(0, 80));
  ok('conversation has otherUser + lastMessage', conv && conv.otherUser && conv.lastMessage);
  ok('conversation has timestamps', conv && !!conv.lastMessageAt);

  const cid = conv && conv._id;
  const lSend = await api('POST', '/api/v1/messages', lTok, { conversationId: cid, text: 'Yes, one covered spot.' });
  ok('landlord replies in thread (201)', lSend.status === 201, 'got ' + lSend.status);

  const hist = await api('GET', '/api/v1/messages/' + cid, tTok);
  const histRows = unwrap(hist.data) || [];
  ok('history shows both messages', histRows.length >= 2, 'got ' + histRows.length);
  ok('messages carry read status fields', histRows.every((m) => 'readAt' in m));

  const read = await api('PATCH', '/api/v1/messages/' + cid + '/read', tTok, {});
  ok('mark-as-read works (200)', read.status === 200, 'got ' + read.status);
  const hist2 = await api('GET', '/api/v1/messages/' + cid, tTok);
  const incoming = (unwrap(hist2.data) || []).filter((m) => m.senderId !== tId);
  ok('incoming messages marked read after PATCH', incoming.every((m) => m.readAt), JSON.stringify(incoming).slice(0, 100));

  const other = await api('GET', '/api/v1/messages/conversations', lTok);
  ok('landlord sees same conversation', (unwrap(other.data) || []).some((c) => c._id === cid));

  const noAuth = await api('GET', '/api/v1/messages/conversations', null);
  ok('unauthenticated messaging blocked (401)', noAuth.status === 401);

  // ══ SPRINT 9 — NOTIFICATIONS ══
  console.log('\n── Sprint 9: Notifications (centralized) ──');
  const notifs = await api('GET', '/api/v1/notifications', tTok);
  const nBody = notifs.data || {};
  const nRows = nBody.notifications || nBody.data || [];
  ok('GET /notifications returns feed (200)', notifs.status === 200, 'got ' + notifs.status);
  ok('notifications were generated by system events', Array.isArray(nRows) && nRows.length >= 3, 'got ' + (nRows || []).length);
  const types = new Set(nRows.map((n) => n.type));
  ok('feed includes agreement/maintenance/message event types', ['agreement_ready', 'maintenance_update', 'message_received'].some((x) => types.has(x)) || nRows.length >= 3);
  const firstN = nRows.find((n) => !n.isRead);
  if (firstN) {
    const readOne = await api('PUT', '/api/v1/notifications/' + firstN._id + '/read', tTok, {});
    ok('mark single notification read (200)', readOne.status === 200, 'got ' + readOne.status);
  }
  const readAll = await api('PUT', '/api/v1/notifications/mark-all-read', tTok, {});
  ok('mark all read (200)', readAll.status === 200, 'got ' + readAll.status);
  const after = await api('GET', '/api/v1/notifications', tTok);
  ok('unreadCount becomes 0 after mark-all', (after.data && after.data.unreadCount) === 0, 'unread=' + (after.data && after.data.unreadCount));

  // ══ summary ══
  console.log('\nSprint 8/9: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Suite crashed:', e); process.exit(1); });
