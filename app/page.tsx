export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">Learning Platform MVP</h1>
      <p className="text-sm text-cream-800">
        サブドメインまたはパスでテナントを識別し、学習コンテンツを管理します。
      </p>
      <div className="rounded-lg border border-cream-300 bg-cream-50 p-4 text-sm text-cream-700">
        例: <span className="font-medium text-cream-900">/acme</span> にアクセスすると
        テナントUIが表示されます。
      </div>
    </main>
  )
}

