import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatDate } from '@/utils/formatters';

interface AuditLog {
  id: string;
  module: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by: string; // uuid
  // We might want to join with users table to get name, but let's keep it simple first
}

export const AuditLogViewer: React.FC<{ caseId: string }> = ({ caseId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!caseId) return;
      
      const { data, error } = await supabase
        .from('case_audit_logs')
        .select('*')
        .eq('case_id', caseId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error("Error fetching audit logs:", error);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [caseId]);

  if (loading) return <div className="text-sm text-gray-500">Loading audit trail...</div>;
  if (logs.length === 0) return <div className="text-sm text-gray-500 italic">No audit history found.</div>;

  return (
    <div className="mt-8 bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900">Audit Trail</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Old Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(log.changed_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {log.module}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {log.field_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 line-through">
                  {log.old_value || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  {log.new_value || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.changed_by?.substring(0, 8)}... 
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
