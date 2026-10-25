"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Search, Users, Shield, UserX, CheckCircle } from "lucide-react";
import { formatSystemDateTime } from "@/lib/utils";
import { Toast } from "@/components/ui/toast";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await fetchApi<any>("/admin/users");
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleAdmin(userId: string, currentStatus: boolean) {
    if (
      !confirm(
        `Are you sure you want to ${currentStatus ? "revoke" : "grant"} platform admin privileges for this user?`,
      )
    )
      return;

    try {
      await fetchApi(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_platform_admin: !currentStatus }),
      });
      loadUsers();
    } catch (err) {
      setActionError("Failed to update admin status. Please try again.");
    }
  }

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      {actionError && (
        <Toast
          message={actionError}
          tone="error"
          onClose={() => setActionError(null)}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Users
          </h1>
          <p className="text-slate-500">
            Manage user accounts and platform roles.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">User</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Joined</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  Loading users...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <span>No users found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {user.name || "No Name"}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_platform_admin ? (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                        Super Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Customer
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.is_verified ? (
                      <span className="text-green-600 flex items-center text-xs">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Unverified</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatSystemDateTime(user.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleAdmin(user.id, user.is_platform_admin)
                        }
                        className={`h-8 ${user.is_platform_admin ? "hover:bg-red-50 hover:text-red-700 border-red-200" : "hover:bg-indigo-50 hover:text-indigo-700"}`}
                      >
                        {user.is_platform_admin ? (
                          <>
                            <UserX className="h-3.5 w-3.5 mr-1.5 text-red-500" />{" "}
                            Revoke Admin
                          </>
                        ) : (
                          <>
                            <Shield className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />{" "}
                            Make Admin
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
