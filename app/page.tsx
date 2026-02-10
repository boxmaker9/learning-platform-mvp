export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">Learning Platform MVP</h1>
      <p className="text-sm text-slate-600">
        サブドメインまたはパスでテナントを識別し、学習コンテンツを管理します。
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        例: <span className="font-medium text-slate-700">/acme</span> にアクセスすると
        テナントUIが表示されます。
      </div>
    </main>
  )
}

