"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiFilter, FiEye, FiClock, FiUser, FiActivity } from 'react-icons/fi';
import api from '@/lib/api';

interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetUserId: string | null;
  details: any;
  createdAt: string;
  admin: { id: string; firstName: string; telegramUsername: string | null };
  targetUser: { id: string; firstName: string; telegramUsername: string | null } | null;
}

export default function SystemLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/logs?page=${page}&limit=20&search=${search}&action=${actionFilter}`);
      setLogs(res.data.logs);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
      } else {
        alert('Failed to fetch logs: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('APPROVE')) return 'bg-green-500/20 text-green-400';
    if (action.includes('REJECT')) return 'bg-red-500/20 text-red-400';
    if (action.includes('BAN') || action.includes('SUSPEND') || action.includes('DEMOTE') || action.includes('DELETE')) return 'bg-red-500/20 text-red-400';
    if (action.includes('EDIT') || action.includes('UPDATE')) return 'bg-blue-500/20 text-blue-400';
    if (action.includes('CREATE') || action.includes('PROMOTE') || action.includes('ASSIGN')) return 'bg-purple-500/20 text-purple-400';
    return 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D4AF37] to-yellow-200 bg-clip-text text-transparent">
            System Logs
          </h1>
          <p className="text-gray-400 mt-1">Audit trail of all administrative actions</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#1A1D24] p-4 rounded-xl border border-gray-800 mb-6 flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by admin name, target user, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F1115] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </form>
        
        <div className="flex items-center gap-2">
          <FiFilter className="text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-[#0F1115] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="">All Actions</option>
            <option value="APPROVE_DEPOSIT">Approve Deposit</option>
            <option value="REJECT_DEPOSIT">Reject Deposit</option>
            <option value="APPROVE_WITHDRAWAL">Approve Withdrawal</option>
            <option value="REJECT_WITHDRAWAL">Reject Withdrawal</option>
            <option value="EDIT_USER">Edit User</option>
            <option value="EDIT_AGENT">Edit Agent</option>
            <option value="PROMOTE_TO_AGENT">Promote Agent</option>
            <option value="DEMOTE_FROM_AGENT">Demote Agent</option>
            <option value="PROMOTE_TO_STAFF">Promote Staff</option>
            <option value="DEMOTE_FROM_STAFF">Demote Staff</option>
            <option value="ASSIGN_AGENTS_TO_STAFF">Assign Agents</option>
            <option value="UPDATE_SETTINGS">Update Settings</option>
            <option value="BAN_USER">Ban User</option>
            <option value="UNBAN_USER">Unban User</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#1A1D24] rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F1115] text-gray-400 text-sm border-b border-gray-800">
                <th className="p-4 font-medium"><div className="flex items-center gap-2"><FiClock /> Timestamp</div></th>
                <th className="p-4 font-medium"><div className="flex items-center gap-2"><FiUser /> Admin</div></th>
                <th className="p-4 font-medium"><div className="flex items-center gap-2"><FiActivity /> Action</div></th>
                <th className="p-4 font-medium"><div className="flex items-center gap-2"><FiUser /> Target User</div></th>
                <th className="p-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No logs found matching criteria</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-[#2A2D35] transition-colors">
                    <td className="p-4 text-gray-300">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white">{log.admin.firstName}</div>
                      <div className="text-xs text-gray-500">@{log.admin.telegramUsername || 'unknown'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {log.targetUser ? (
                        <>
                          <div className="font-medium text-gray-300">{log.targetUser.firstName}</div>
                          <div className="text-xs text-gray-500">@{log.targetUser.telegramUsername || 'unknown'}</div>
                        </>
                      ) : (
                        <span className="text-gray-500 italic">System</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[#D4AF37] hover:text-yellow-200 transition-colors inline-flex items-center gap-1 bg-[#D4AF37]/10 px-3 py-1.5 rounded-lg"
                      >
                        <FiEye /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex justify-between items-center bg-[#0F1115]">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-[#2A2D35] text-white rounded-lg disabled:opacity-50 hover:bg-[#3A3D45] transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-400">Page {page} of {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-[#2A2D35] text-white rounded-lg disabled:opacity-50 hover:bg-[#3A3D45] transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1D24] border border-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Log Details</h2>
                <p className="text-sm text-gray-400">ID: {selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Action</div>
                  <div className={`text-sm font-medium ${getActionBadgeColor(selectedLog.action).split(' ')[1]}`}>
                    {selectedLog.action}
                  </div>
                </div>
                <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Timestamp</div>
                  <div className="text-sm text-gray-300">{new Date(selectedLog.createdAt).toLocaleString()}</div>
                </div>
                <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Admin</div>
                  <div className="text-sm text-gray-300">{selectedLog.admin.firstName}</div>
                </div>
                <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Target</div>
                  <div className="text-sm text-gray-300">{selectedLog.targetUser?.firstName || 'System'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-300 mb-2">Payload / Changes</div>
                <div className="bg-[#0F1115] p-4 rounded-lg border border-gray-800 overflow-auto max-h-[300px]">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                    {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : 'No additional details provided.'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
