import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, X } from 'lucide-react';
import { useAiChat, useAiStatus } from '@/api/ai';
import { useEnabledPanels } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The staff assistant, available from every screen.
 *
 * It hides itself entirely unless the clinic has the AI panel switched on and
 * an API key configured — an unusable button is worse than no button.
 */
export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  const { data: panels } = useEnabledPanels();
  const panelEnabled = panels?.enabled?.includes('ai_assistant') ?? false;

  const { data: status } = useAiStatus();
  const { mutateAsync: sendMessage, isPending } = useAiChat();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  if (!panelEnabled || !status?.available) {
    return null;
  }

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isPending) return;

    setInput('');
    setMessages((current) => [...current, { role: 'user', content: question }]);

    try {
      const reply = await sendMessage({ message: question, conversationId });
      setConversationId(reply.conversationId);
      setMessages((current) => [...current, { role: 'assistant', content: reply.reply }]);
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: error.message || 'The assistant is unavailable right now.' },
      ]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open the assistant"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-700"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[32rem] w-[22rem] flex-col rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-teal-600 p-1.5">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Clinic Assistant</p>
            <p className="text-xs text-stone-500">Answers are suggestions, not clinical decisions</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-stone-500">
            <p>Ask me about a patient's history, a lab value, or how to do something here.</p>
            <div className="space-y-1.5">
              {[
                'Summarise what we know about patient PT-00001',
                'What does a raised ALT usually indicate?',
                'How do I reschedule an appointment?',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setInput(example)}
                  className="block w-full rounded-md border border-stone-200 px-3 py-2 text-left text-xs hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
              message.role === 'user'
                ? 'ml-auto bg-teal-600 text-white'
                : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100'
            )}
          >
            {message.content}
          </div>
        ))}

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-stone-200 p-3 dark:border-stone-700">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSend()}
            placeholder="Ask a question…"
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-stone-600 dark:bg-stone-800"
          />
          <Button size="icon" onClick={handleSend} disabled={isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
