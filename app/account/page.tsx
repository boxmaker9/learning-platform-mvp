import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type MembershipRow = {
  role: "admin" | "student"
  organization?: { slug: string | null; name: string | null }[]
}

export default async function AccountPage() {
  const supabase = createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
          <CardDescription>ログインが必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-primary-600 hover:underline" href="/login">
            ログインへ
          </Link>
        </CardContent>
      </Card>
    )
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(slug, name)")
    .eq("user_id", userData.user.id)

  const rows = (memberships ?? []) as MembershipRow[]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
          <CardDescription>ログイン中のユーザー情報です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-900">Email:</span> {userData.user.email}
          </div>
          <div>
            <span className="font-medium text-slate-900">User ID:</span> {userData.user.id}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>所属テナント</CardTitle>
          <CardDescription>参加しているテナントとロールです。</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={`${row.role}-${row.organization?.[0]?.slug ?? index}`}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {row.organization?.[0]?.name ?? "テナント名不明"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.organization?.[0]?.slug ?? "-"}
                    </p>
                  </div>
                  <Badge variant="secondary">{row.role}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">所属テナントはありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

