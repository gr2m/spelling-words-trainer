"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { Volume2, RotateCcw, Check, RefreshCw, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Phase = "practice" | "complete"

type WordItem = {
  id: number
  text: string
  incorrectAttempts: number
}

type SavedState = {
  words: { text: string; incorrectAttempts: number }[]
  queue: number[]
  masteredIds: number[]
  triesLeft: number
  reveal: boolean
  answer: string
  phase: Phase
}

const DEFAULT_WORDS = [
  "about",
  "above",
  "after",
  "again",
  "almost",
  "another",
  "answer",
  "are",
  "area",
  "around",
  "beautiful",
  "because",
  "before",
  "being",
  "best",
  "black",
  "body",
  "boy",
  "brothers",
  "bug",
  "can't",
  "car",
  "caught",
  "children",
  "city",
  "clock",
  "could",
  "crash",
  "crashed",
  "didn't",
  "don't",
  "door",
  "drink",
  "easy",
  "eating",
  "enough",
  "every",
  "favorite",
  "first",
  "float",
  "found",
  "friends",
  "girl",
  "have",
  "hear",
  "heard",
  "here",
  "horse",
  "house",
  "how",
  "however",
  "hurt",
  "idea",
  "it's",
  "joke",
  "jump",
  "junk",
  "kicked",
  "knew",
  "line",
  "listen",
  "little",
  "low",
  "made",
  "mail",
  "make",
  "many",
  "measure",
  "more",
  "name",
  "new",
  "nice",
  "off",
  "often",
  "once",
  "one",
  "order",
  "other",
  "our",
  "outside",
  "people",
  "phone",
  "piece",
  "played",
  "pretty",
  "questions",
  "rain",
  "really",
  "ride",
  "right",
  "said",
  "sale",
  "saw",
  "school",
  "second",
  "shook",
  "since",
  "sister",
  "skate",
  "slow",
  "small",
  "snap",
  "sometimes",
  "song",
  "soon",
  "sports",
  "stop",
  "sure",
  "talk",
  "tell",
  "than",
  "thank",
  "that's",
  "their",
  "them",
  "then",
  "there",
  "they",
  "they're",
  "thing",
  "those",
  "thought",
  "through",
  "to",
  "too",
  "trip",
  "truck",
  "two",
  "use",
  "usually",
  "very",
  "wanted",
  "was",
  "watch",
  "went",
  "were",
  "what",
  "when",
  "where",
  "who",
  "whole",
  "why",
  "will",
  "wind",
  "with",
  "won",
  "won't",
  "write",
  "writing",
  "young",
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Confetti function
function createConfetti() {
  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dda0dd", "#98d8c8"]
  const confettiCount = 50

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement("div")
    confetti.style.position = "fixed"
    confetti.style.left = Math.random() * 100 + "vw"
    confetti.style.top = "-10px"
    confetti.style.width = Math.random() * 10 + 5 + "px"
    confetti.style.height = Math.random() * 10 + 5 + "px"
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "0"
    confetti.style.pointerEvents = "none"
    confetti.style.zIndex = "9999"
    confetti.style.animation = `confetti-fall ${Math.random() * 2 + 2}s linear forwards`

    document.body.appendChild(confetti)

    // Remove confetti after animation
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti)
      }
    }, 4000)
  }
}

export default function Page() {
  const { toast } = useToast()

  const [phase, setPhase] = useState<Phase>("practice")
  const [initialized, setInitialized] = useState(false)
  const [ttsStatus, setTtsStatus] = useState<"checking" | "available" | "unavailable">("checking")
  const [ttsError, setTtsError] = useState<string>("")

  // Practice state
  const [words, setWords] = useState<WordItem[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [mastered, setMastered] = useState<Set<number>>(new Set())
  const [triesLeft, setTriesLeft] = useState(2)
  const [reveal, setReveal] = useState(false)
  const [answer, setAnswer] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Audio state (always use enhanced cloud voice; fall back to browser TTS if unavailable)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const total = words.length
  const remaining = queue.length
  const done = total - remaining
  const totalIncorrectAttempts = words.reduce((sum, word) => sum + word.incorrectAttempts, 0)

  const currentWord = useMemo(() => {
    if (!queue.length) return null
    const id = queue[0]
    return words.find((w) => w.id === id) ?? null
  }, [queue, words])

  // Storage
  const STORAGE_KEY = "spelling-trainer-v5"

  // Check TTS availability on mount
  useEffect(() => {
    const checkTTS = async () => {
      try {
        const response = await fetch("/api/tts", {
          method: "GET",
        })
        const data = await response.json()

        if (data.enabled) {
          setTtsStatus("available")
        } else {
          setTtsStatus("unavailable")
          setTtsError("ElevenLabs API key not configured. Using browser voice instead.")
        }
      } catch (error) {
        setTtsStatus("unavailable")
        setTtsError(
          `TTS check failed: ${error instanceof Error ? error.message : "Unknown error"}. Using browser voice instead.`,
        )
      }
    }

    checkTTS()
  }, [])

  // Add confetti CSS animation
  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `
      @keyframes confetti-fall {
        0% {
          transform: translateY(-10px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(360deg);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [])

  // Initialize: restore from storage or start fresh
  useEffect(() => {
    const restore = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) throw new Error("no saved")
        const saved = JSON.parse(raw) as SavedState
        if (!saved.words?.length) throw new Error("invalid")

        const savedWords = saved.words.map((w, i) => ({
          id: i + 1,
          text: w.text,
          incorrectAttempts: w.incorrectAttempts || 0,
        }))

        setWords(savedWords)
        setQueue(saved.queue || [])
        setMastered(new Set(saved.masteredIds || []))
        setTriesLeft(saved.triesLeft || 2)
        setReveal(saved.reveal || false)
        setAnswer(saved.answer || "")
        setPhase(saved.phase || "practice")
        setInitialized(true)

        // If we have a current word and we're in practice mode, announce it
        if (saved.phase === "practice" && saved.queue?.length > 0 && !saved.reveal) {
          setTimeout(() => {
            const currentId = saved.queue[0]
            const currentWord = savedWords.find((w) => w.id === currentId)
            if (currentWord) {
              void speakWithIntro(currentWord.text)
            }
          }, 500)
        }
      } catch {
        // Start fresh
        const items: WordItem[] = DEFAULT_WORDS.map((t, i) => ({
          id: i + 1,
          text: t,
          incorrectAttempts: 0,
        }))
        const shuffledIds = shuffle(items.map((w) => w.id))
        setWords(items)
        setQueue(shuffledIds)
        setMastered(new Set())
        setTriesLeft(2)
        setReveal(false)
        setAnswer("")
        setPhase("practice")
        setInitialized(true)
        // Announce the first word after a short delay
        setTimeout(() => {
          const firstWord = items.find((w) => w.id === shuffledIds[0])
          if (firstWord) {
            void speakWithIntro(firstWord.text)
          }
        }, 500)
      }
    }
    restore()
  }, [])

  // Save to localStorage whenever state changes (but only after initialization)
  useEffect(() => {
    if (!words.length || !initialized) return
    const payload: SavedState = {
      words: words.map((w) => ({ text: w.text, incorrectAttempts: w.incorrectAttempts })),
      queue: queue,
      masteredIds: Array.from(mastered),
      triesLeft: triesLeft,
      reveal: reveal,
      answer: answer,
      phase: phase,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [words, queue, mastered, triesLeft, reveal, answer, phase, initialized])

  // Focus input when a new active word appears and we are not revealing
  useEffect(() => {
    if (phase === "practice" && !reveal) {
      inputRef.current?.focus()
    }
  }, [phase, reveal])

  // Check for completion only after initialization
  useEffect(() => {
    if (initialized && phase === "practice" && queue.length === 0) {
      setPhase("complete")
    }
  }, [initialized, phase, queue.length])

  // ------- Speech helpers (Cloud first; local fallback) -------
  async function cloudSpeakOnce(text: string, cancelBefore = true): Promise<void> {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.preload = "auto"
      }
      const a = audioRef.current
      if (cancelBefore) {
        a.pause()
        a.currentTime = 0
        if (a.src) {
          URL.revokeObjectURL(a.src)
          a.src = ""
        }
      }

      console.log("Attempting ElevenLabs TTS for:", text)
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voiceId: "21m00Tcm4TlvDq8ikWAM" }), // Rachel
      })

      console.log("TTS Response status:", res.status)
      if (!res.ok) {
        const errorText = await res.text()
        console.error("TTS Error:", errorText)
        throw new Error(`TTS failed: ${res.status} ${errorText}`)
      }

      const buf = await res.arrayBuffer()
      const blob = new Blob([buf], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      a.src = url
      await a.play()
      await new Promise<void>((resolve) => {
        a.onended = () => {
          a.onended = null
          resolve()
        }
      })
      URL.revokeObjectURL(url)
      console.log("ElevenLabs TTS successful")
    } catch (error) {
      console.log("ElevenLabs TTS failed, falling back to browser TTS:", error)
      await localSpeakOnce(text, cancelBefore)
    }
  }

  function localSpeakOnce(text: string, cancelBefore = true): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.log("Browser TTS not available")
        return resolve()
      }
      try {
        console.log("Using browser TTS for:", text)
        const synth = window.speechSynthesis
        if (cancelBefore) synth.cancel()
        // Prefer en-US if available
        const all = synth.getVoices()
        const voice =
          all.find((v) => v.lang?.toLowerCase().startsWith("en-us")) ??
          all.find((v) => v.lang?.toLowerCase().startsWith("en-")) ??
          all[0]
        const u = new SpeechSynthesisUtterance(text)
        if (voice) u.voice = voice
        u.lang = voice?.lang ?? "en-US"
        u.rate = 0.95
        u.pitch = 1.0
        u.onend = () => resolve()
        u.onerror = () => resolve()
        synth.speak(u)
      } catch (error) {
        console.error("Browser TTS failed:", error)
        resolve()
      }
    })
  }

  async function speakWithIntro(word: string) {
    await cloudSpeakOnce("The next word is:")
    await new Promise((r) => setTimeout(r, 350))
    await cloudSpeakOnce(word, false)
  }
  async function speakWord(word: string) {
    await cloudSpeakOnce(word)
  }

  async function speakEncouragementCorrect() {
    const lines = ["Great job!", "Well done!", "Excellent!", "Nice work!", "Awesome spelling!"]
    await cloudSpeakOnce(pick(lines))
  }

  async function speakEncouragementTryAgain() {
    const lines = [
      "That's okay. Let's try again.",
      "Almost there. Give it another try.",
      "Good effort! Listen carefully and try once more.",
      "You can do it. Try again.",
    ]
    await cloudSpeakOnce(pick(lines))
  }

  async function speakEncouragementCopy(word: string) {
    await cloudSpeakOnce(`Let's copy the word, ${word}.`)
    await new Promise((r) => setTimeout(r, 250))
    await cloudSpeakOnce("You can try this word again later.")
  }

  // ------- Handlers -------
  function onSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!currentWord) return

    // Ignore empty or whitespace-only submissions
    if (!answer.trim()) return

    const guess = normalize(answer)
    const target = normalize(currentWord.text)

    if (guess === target) {
      // Correct - trigger confetti!
      createConfetti()

      const nextId = queue[1] // capture before state changes
      setMastered((prev) => new Set(prev).add(currentWord.id))
      setAnswer("")
      setTriesLeft(2)
      setReveal(false)
      setQueue((prev) => prev.slice(1))
      toast({ title: "Great job!", description: "You spelled it correctly." })

      // Say something nice, then announce next word (if any)
      ;(async () => {
        await speakEncouragementCorrect()
        if (typeof nextId === "number") {
          const next = words.find((w) => w.id === nextId)
          if (next) {
            await new Promise((r) => setTimeout(r, 250))
            await speakWithIntro(next.text)
          }
        }
      })()
    } else if (!reveal) {
      // Incorrect attempt
      // Increment incorrect attempts for this word
      setWords((prev) =>
        prev.map((w) => (w.id === currentWord.id ? { ...w, incorrectAttempts: w.incorrectAttempts + 1 } : w)),
      )

      if (triesLeft > 1) {
        setTriesLeft((t) => t - 1)
        toast({
          title: "Try again",
          description: `You typed "${answer.trim()}" but the word is different. Listen carefully and try once more.`,
        })
        void speakEncouragementTryAgain()
        inputRef.current?.focus()
      } else {
        // Reveal and keep in queue
        setReveal(true)
        setTriesLeft(0)
        toast({
          title: "Keep practicing",
          description: "Copy the word now. You'll see it again later.",
        })
        ;(async () => {
          await speakEncouragementCopy(currentWord.text)
        })()
      }
    }
  }

  function nextWord() {
    if (!currentWord) return
    setReveal(false)
    setAnswer("")
    setTriesLeft(2)
    setQueue((prev) => {
      if (!prev.length) return prev
      const [first, ...rest] = prev
      const newQueue = [...rest, first] // re-queue missed word to end
      if (newQueue.length === 0) {
        setPhase("complete")
      } else {
        const next = words.find((w) => w.id === newQueue[0])
        if (next) {
          setTimeout(() => {
            void speakWithIntro(next.text)
            inputRef.current?.focus()
          }, 200)
        }
      }
      return newQueue
    })
  }

  function resetProgress() {
    // Clear localStorage and start fresh
    localStorage.removeItem(STORAGE_KEY)

    const items: WordItem[] = DEFAULT_WORDS.map((t, i) => ({
      id: i + 1,
      text: t,
      incorrectAttempts: 0,
    }))
    const shuffledIds = shuffle(items.map((w) => w.id))
    setWords(items)
    setQueue(shuffledIds)
    setMastered(new Set())
    setTriesLeft(2)
    setReveal(false)
    setAnswer("")
    setPhase("practice")
    setTimeout(() => {
      const firstWord = items.find((w) => w.id === shuffledIds[0])
      if (firstWord) {
        void speakWithIntro(firstWord.text)
      }
    }, 250)
  }

  // Don't render anything until we've initialized
  if (!initialized) {
    return (
      <main className="container mx-auto max-w-3xl p-4 md:p-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="text-lg text-muted-foreground">Loading...</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-3xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spelling Words Trainer</h1>
          <p className="text-muted-foreground">
            Each word is announced like a teacher: {"'"}The next word is:{"'"} … then the word, once.
          </p>
        </div>
        <Button variant="outline" onClick={resetProgress} className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Reset
        </Button>
      </header>

      {ttsStatus === "unavailable" && ttsError && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Voice Notice:</strong> {ttsError}
          </AlertDescription>
        </Alert>
      )}

      {phase !== "complete" && (
        <div className="mb-6">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-xl">Progress</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Mastered: {done}</Badge>
                  <Badge>Remaining: {remaining}</Badge>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Mistakes: {totalIncorrectAttempts}
                  </Badge>
                  {ttsStatus === "available" && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Enhanced Voice
                    </Badge>
                  )}
                  {ttsStatus === "unavailable" && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      Browser Voice
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>Missed twice? Copy the word and you{"'"}ll see it again later.</CardDescription>
              <Progress value={total ? (done / total) * 100 : 0} />
            </CardHeader>
          </Card>
        </div>
      )}

      {phase === "practice" && currentWord && (
        <Card>
          <CardHeader>
            <CardTitle>Listen and type the word</CardTitle>
            <CardDescription>Press Enter to check. If correct, the next word will be announced.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={() => speakWord(currentWord.text)}
              >
                <Volume2 className="h-4 w-4" />
                Hear Word
              </Button>
              <Badge variant="outline" className={cn("font-mono", triesLeft === 0 && "text-red-600 border-red-600")}>
                Tries left: {triesLeft}
              </Badge>
              {currentWord.incorrectAttempts > 0 && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Mistakes on this word: {currentWord.incorrectAttempts}
                </Badge>
              )}
            </div>

            {!reveal && (
              <form onSubmit={onSubmit} className="grid gap-3">
                <Input
                  id="answer"
                  ref={inputRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the word you heard"
                  autoFocus
                  autoComplete="off"
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" className="gap-2">
                    <Check className="h-4 w-4" />
                    Check Answer
                  </Button>
                </div>
              </form>
            )}

            {reveal && (
              <div className="grid gap-4">
                <div className="rounded-md border border-dashed p-4 bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-2">Correct spelling</div>
                  <div className="text-2xl font-semibold tracking-wide text-center">{currentWord.text}</div>
                </div>
                <form onSubmit={onSubmit} className="grid gap-3">
                  <Input
                    id="answer"
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type the word you see above"
                    autoFocus
                    autoComplete="off"
                  />
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={nextWord} className="gap-2">
                      Next Word
                    </Button>
                  </div>
                </form>
                <div className="text-sm text-muted-foreground text-center">
                  Practice typing the word above. You'll try this word again later.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle>All done! Great work 🎉</CardTitle>
            <CardDescription>
              You{"'"}ve spelled all {total} word{total === 1 ? "" : "s"} correctly with {totalIncorrectAttempts} total
              mistake{totalIncorrectAttempts === 1 ? "" : "s"}. Keep practicing to stay sharp.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button className="gap-2" onClick={resetProgress}>
              <RotateCcw className="h-4 w-4" />
              Practice Again
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
