import { Send, Sparkles, Paperclip, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface ComposeModalProps {
  isOpen: boolean;
  to: string;
  subject: string;
  body: string;
  onToChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onDraftWithAI: () => void;
  isSending?: boolean;
}

export function ComposeModal({
  isOpen,
  to,
  subject,
  body,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onSend,
  onClose,
  onDraftWithAI,
  isSending = false,
}: ComposeModalProps) {
  if (!isOpen) return null;

  const isDisabled = isSending || !to.trim() || !subject.trim() || !body.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border-border flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border">
        <div className="border-border flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">New Message</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="space-y-3 p-4">
          <Input
            placeholder="To (comma-separated emails)"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
          <Textarea
            placeholder="Compose your message..."
            className="min-h-[200px]"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
          />
        </div>

        <div className="border-border flex items-center justify-between border-t p-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={onSend}
              disabled={isDisabled}
            >
              {isSending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              {isSending ? 'Sending...' : 'Send'}
            </Button>
            <Button variant="outline" onClick={onDraftWithAI}>
              <Sparkles className="mr-1 h-3 w-3" />
              Draft with AI
            </Button>
          </div>

          <Button variant="ghost" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}