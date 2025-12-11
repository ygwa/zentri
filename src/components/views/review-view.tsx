import { useState } from "react";
import { Sparkles, Check, X, RotateCcw, TrendingUp, Calendar, Target } from "lucide-react";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge";
import { CardType } from "@/types";

interface ReviewCard {
  id: string;
  type: CardType;
  title: string;
  content?: string;
  preview?: string;
  tags: string[];
  linksIn?: number;
  linksOut?: number;
  reviewScore?: number;
  lastReviewed?: Date;
  reviewCount?: number;
}

export function ReviewView() {
  const { cards, selectCard } = useAppStore();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0
  });
  const [sessionStartTime] = useState(Date.now());

  // 获取需要复习的卡片（模拟逻辑）
  const reviewCards = cards.filter(() => {
    // 简化的复习逻辑：随机选择一些卡片进行复习
    return Math.random() > 0.7;
  }) as unknown as ReviewCard[];

  const currentCard = reviewCards[currentCardIndex];

  const handleResponse = (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    // 更新会话统计
    setSessionStats(prev => ({
      ...prev,
      total: prev.total + 1,
      correct: quality === 'good' || quality === 'easy' ? prev.correct + 1 : prev.correct,
      incorrect: quality === 'again' ? prev.incorrect + 1 : prev.incorrect
    }));

    // 移动到下一张卡片
    if (currentCardIndex < reviewCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const handleSkip = () => {
    setSessionStats(prev => ({
      ...prev,
      total: prev.total + 1,
      skipped: prev.skipped + 1
    }));

    if (currentCardIndex < reviewCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60); // 分钟
  const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;

  if (reviewCards.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f4f4f5] animate-in fade-in duration-200">
        <div className="h-12 border-b border-zinc-200 flex items-center px-6 shrink-0 bg-white">
          <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
            <Sparkles size={14} className="text-zinc-500" /> Daily Review
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">All caught up!</h3>
            <p className="text-zinc-600 mb-4">No cards due for review today.</p>
            <p className="text-sm text-zinc-500">Great job maintaining your knowledge base.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f4f5] animate-in fade-in duration-200">
      <div className="h-12 border-b border-zinc-200 flex items-center px-6 shrink-0 bg-white">
        <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
          <Sparkles size={14} className="text-zinc-500" /> Daily Review
        </h2>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-emerald-500 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-[600px] flex flex-col gap-6 relative z-10">
          {/* 会话统计 */}
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
              <Target size={14} className="text-blue-600" />
              <span className="font-medium">{currentCardIndex + 1} / {reviewCards.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
              <TrendingUp size={14} className="text-emerald-600" />
              <span className="font-medium">{accuracy}% accuracy</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
              <Calendar size={14} className="text-purple-600" />
              <span className="font-medium">{sessionDuration}m</span>
            </div>
          </div>

          {/* 卡片 */}
          <div className="bg-white rounded-lg shadow-xl border border-zinc-300 min-h-[400px] flex flex-col relative animate-in slide-in-from-bottom-4 duration-300">
            <div className={`h-1 w-full rounded-t-lg ${currentCard?.type === 'permanent' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>

            <div className="p-8 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Badge color={currentCard?.type === 'permanent' ? 'blue' : 'orange'}>
                    {currentCard?.type?.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-sm">
                    {currentCard?.id}
                  </span>
                </div>
                <button
                  onClick={() => selectCard(currentCard?.id || '')}
                  className="text-zinc-400 hover:text-zinc-600 text-xs underline"
                >
                  Open full note
                </button>
              </div>

              <h2 className="text-2xl font-bold text-zinc-900 font-serif mb-6">
                {currentCard?.title || "Untitled"}
              </h2>

              {!showAnswer ? (
                <div className="flex-1 flex items-center justify-center">
                  <button
                    onClick={handleShowAnswer}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
                  >
                    Show Answer
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="prose prose-zinc max-w-none font-serif text-lg leading-relaxed text-zinc-700">
                    <p>{currentCard?.content || currentCard?.preview || "No content available."}</p>
                  </div>

                  {/* 标签 */}
                  {currentCard?.tags && currentCard.tags.length > 0 && (
                    <div className="flex gap-2 mt-6 flex-wrap">
                      {currentCard.tags.map(tag => (
                        <Badge key={tag} color="gray">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 响应按钮 */}
          {showAnswer && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleResponse('again')}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:bg-rose-200 transition-all">
                  <RotateCcw size={20} />
                </div>
                <span className="text-[10px] font-bold text-rose-600">AGAIN</span>
              </button>

              <button
                onClick={() => handleResponse('hard')}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-all">
                  <X size={20} />
                </div>
                <span className="text-[10px] font-bold text-orange-600">HARD</span>
              </button>

              <button
                onClick={() => handleResponse('good')}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-all">
                  <Check size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-600">GOOD</span>
              </button>

              <button
                onClick={() => handleResponse('easy')}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-200 transition-all">
                  <Check size={20} />
                </div>
                <span className="text-[10px] font-bold text-emerald-600">EASY</span>
              </button>
            </div>
          )}

          {/* 跳过按钮 */}
          <div className="flex justify-center">
            <button
              onClick={handleSkip}
              className="text-zinc-500 hover:text-zinc-700 text-sm underline"
            >
              Skip this card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
