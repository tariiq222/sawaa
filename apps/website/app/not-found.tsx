import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-7xl font-bold text-teal-600">404</h1>
        <h2 className="text-xl font-semibold text-gray-900">
          الصفحة غير موجودة
        </h2>
        <p className="max-w-sm text-sm text-gray-500">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
