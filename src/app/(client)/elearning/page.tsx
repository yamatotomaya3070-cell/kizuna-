import { courses } from "@/data/mock";

export default function ELearningPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">eラーニング</h2>
        <p className="text-sm text-slate-500 mt-1">研修コース一覧</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{course.thumbnail}</span>
              <div>
                <span className="text-xs font-medium text-blue-900 bg-white px-2 py-0.5 rounded-full">
                  {course.category}
                </span>
                <p className="text-sm text-slate-500 mt-0.5">{course.duration}</p>
              </div>
            </div>
            <h3 className="font-semibold text-slate-800 leading-snug">
              {course.title}
            </h3>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>進捗</span>
                <span>{course.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-900 h-2 rounded-full transition-all"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
            <button
              className={`mt-auto text-sm font-medium py-2 px-4 rounded-lg transition-colors ${
                course.progress === 100
                  ? "bg-white text-blue-900 cursor-default"
                  : "bg-blue-900 text-white hover:bg-blue-900"
              }`}
            >
              {course.progress === 100
                ? "✓ 完了"
                : course.progress > 0
                  ? "続きから受講"
                  : "受講開始"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
