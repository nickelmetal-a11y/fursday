import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const ACTION_ICONS = {
  approve_sitter: '✓',
  reject_sitter: '✕',
  suspend_sitter: '⏸',
  reinstate_sitter: '▶',
  toggle_top_sitter: '⭐',
  mark_payout_paid: '💳',
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    loadLogs();
  }, [filterAction]);

  const loadLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  const getActionLabel = (action) => {
    return {
      approve_sitter: 'Sitter Approved',
      reject_sitter: 'Sitter Rejected',
      suspend_sitter: 'Sitter Suspended',
      reinstate_sitter: 'Sitter Reinstated',
      toggle_top_sitter: 'Top Sitter Badge',
      mark_payout_paid: 'Payout Marked',
    }[action] || action;
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilterAction('all')}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: filterAction === 'all' ? '#FF6B35' : '#F0F0F0', color: filterAction === 'all' ? 'white' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          All Actions
        </button>
        {uniqueActions.map(action => (
          <button key={action} onClick={() => setFilterAction(action)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: filterAction === action ? '#FF6B35' : '#F0F0F0', color: filterAction === action ? 'white' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {getActionLabel(action)}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading audit logs...</div>}

      {!loading && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No audit logs found</div>
      )}

      {!loading && logs.map(log => (
        <div key={log.id} style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderLeft: `4px solid ${log.status === 'error' ? '#C62828' : '#2E7D32'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{ACTION_ICONS[log.action] || '•'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{getActionLabel(log.action)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {log.resource_type} {log.resource_id?.substring(0, 8)}... · {new Date(log.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: log.status === 'success' ? '#E8F5E9' : log.status === 'failed' ? '#FFF3E0' : '#FCEBEB', color: log.status === 'success' ? '#2E7D32' : log.status === 'failed' ? '#E65100' : '#C62828', fontWeight: 600 }}>
              {log.status}
            </div>
          </div>
          {log.reason && <div style={{ fontSize: 12, color: '#555', background: '#F8F8F8', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>📝 {log.reason}</div>}
          {log.error_message && <div style={{ fontSize: 12, color: '#C62828', background: '#FCEBEB', borderRadius: 8, padding: '6px 10px' }}>⚠️ {log.error_message}</div>}
        </div>
      ))}
    </div>
  );
}
