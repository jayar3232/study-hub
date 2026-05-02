import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BrainCircuit, CheckCircle2, Clock, Play, RotateCcw, Trophy, XCircle } from 'lucide-react';
import api from '../services/api';
import GameOverModal from './GameOverModal';

const getPercent = (value, total) => Math.round((value / Math.max(1, total)) * 100);

export function CodeQuizLogo({ compact = false }) {
  return (
    <div className={`${compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'} relative grid shrink-0 place-items-center overflow-hidden bg-slate-950 text-white shadow-xl shadow-violet-500/20 ring-1 ring-violet-300/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(139,92,246,0.58),transparent_34%),radial-gradient(circle_at_78%_74%,rgba(34,211,238,0.35),transparent_35%)]" />
      <BrainCircuit size={compact ? 25 : 31} className="relative z-10 text-violet-100 drop-shadow" />
    </div>
  );
}

export default function CodeQuizGame({ stats, onScoreSaved, onExit }) {
  const [session, setSession] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [seconds, setSeconds] = useState(10);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const questions = session?.questions || [];
  const currentQuestion = questions[questionIndex];
  const progress = getPercent(questionIndex, questions.length);
  const bestScore = stats?.codeQuizStats?.highScore || 0;

  const startQuiz = async () => {
    setBusy(true);
    setResult(null);
    setAnswers([]);
    setSelected('');
    setQuestionIndex(0);
    try {
      const res = await api.post('/games/code-quiz/start');
      setSession(res.data);
      setSeconds(res.data.secondsPerQuestion || 10);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not start Code Quiz');
    } finally {
      setBusy(false);
    }
  };

  const finishQuiz = async (nextAnswers) => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/games/code-quiz/${session.sessionId}/submit`, { answers: nextAnswers });
      setResult(res.data.result);
      setSession(null);
      onScoreSaved?.();
      toast.success('Code Quiz saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Code Quiz failed');
    } finally {
      setBusy(false);
    }
  };

  const answerQuestion = (answer) => {
    if (!currentQuestion || busy) return;
    const nextAnswers = [...answers, { challengeId: currentQuestion.challengeId, answer: answer || 'timeout' }];
    setAnswers(nextAnswers);
    setSelected('');

    if (questionIndex >= questions.length - 1) {
      finishQuiz(nextAnswers);
      return;
    }

    setQuestionIndex(index => index + 1);
    setSeconds(session?.secondsPerQuestion || 10);
  };

  const chooseAnswer = (option) => {
    if (selected || busy) return;
    setSelected(option);
    window.setTimeout(() => answerQuestion(option), 220);
  };

  useEffect(() => {
    if (!session || result || busy) return undefined;
    const timer = window.setInterval(() => {
      setSeconds(value => {
        if (value <= 1) {
          window.setTimeout(() => answerQuestion('timeout'), 0);
          return session.secondsPerQuestion || 10;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy, currentQuestion?.challengeId, result, session]);

  const answeredPreview = useMemo(() => answers.slice(-5), [answers]);

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-900/50 bg-slate-950 text-white shadow-2xl shadow-violet-500/10">
      <div className="relative overflow-hidden border-b border-white/10 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(139,92,246,0.24),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(34,211,238,0.2),transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <CodeQuizLogo />
            <div>
              <p className="text-xs font-black uppercase text-violet-200">Programming Quiz</p>
              <h2 className="text-2xl font-black tracking-normal">Code Quiz</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">Answer 10 random computer and programming questions. Each question has a 10-second timer.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startQuiz}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            {session ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
            {session ? 'Restart' : 'Start Quiz'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
          {currentQuestion ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-white/45">Question {questionIndex + 1} of {questions.length}</p>
                  <h3 className="mt-2 text-2xl font-black">{currentQuestion.title}</h3>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black ${seconds <= 3 ? 'bg-rose-400/20 text-rose-100' : 'bg-cyan-300/15 text-cyan-100'}`}>
                  <Clock size={17} />
                  {seconds}s
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-300" style={{ width: `${progress}%` }} />
              </div>

              <p className="mt-6 rounded-3xl bg-slate-900 p-5 text-xl font-black leading-8 text-white">
                {currentQuestion.brief}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(currentQuestion.options || []).map(option => {
                  const isSelected = selected === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={busy || Boolean(selected)}
                      onClick={() => chooseAnswer(option)}
                      className={`min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                        isSelected
                          ? 'border-cyan-200 bg-cyan-300/18 text-cyan-50'
                          : 'border-white/10 bg-white/[0.05] text-white hover:border-violet-200/60 hover:bg-violet-300/10'
                      } disabled:opacity-70`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <CodeQuizLogo />
                <h3 className="mt-4 text-3xl font-black">Ready for Code Quiz?</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">Questions are shuffled every run so players cannot rely on memorizing the same order.</p>
                <button
                  type="button"
                  onClick={startQuiz}
                  disabled={busy}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
                >
                  <Play size={17} fill="currentColor" />
                  Start Quiz
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="grid gap-4 md:grid-cols-2 xl:block xl:space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Trophy size={17} className="text-yellow-200" />
              Quiz Best
            </p>
            <p className="mt-2 text-3xl font-black">{bestScore}</p>
            <p className="mt-2 text-xs leading-5 text-white/45">Accuracy and streaks carry the score. Faster perfect runs gain a bonus.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm font-black text-white">Recent Answers</p>
            <div className="mt-3 space-y-2">
              {answeredPreview.length ? answeredPreview.map((answer, index) => (
                <div key={`${answer.challengeId}-${index}`} className="flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/70">
                  {answer.answer === 'timeout' ? <XCircle size={15} className="text-rose-300" /> : <CheckCircle2 size={15} className="text-cyan-200" />}
                  <span className="truncate">{answer.answer}</span>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs font-bold text-white/45">No answers yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <GameOverModal
        open={Boolean(result)}
        title="Quiz complete"
        score={result?.score || 0}
        detail={`${result?.correctCount || 0}/${result?.totalCount || 0} correct - ${result?.accuracy || 0}% accuracy.`}
        saving={busy}
        saved={Boolean(result)}
        onRetry={startQuiz}
        onExit={() => setResult(null)}
      />
    </section>
  );
}
