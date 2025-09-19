import { Send, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface ForwardModalProps {
  isOpen: boolean;
  to: string;
  body: string;
  onToChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onForward: () => void;
  onClose: () => void;
  isForwarding?: boolean;
}

export function ForwardModal({
  isOpen,
  to,
  body,
  onToChange,
  onBodyChange,
  onForward,
  onClose,
  isForwarding = false,
}: ForwardModalProps) {
  if (!isOpen) return null;

  const isDisabled = isForwarding || !to.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border-border flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border">
        <div className="border-border flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Forward Message</h3>
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
          <Textarea
            placeholder="Add your message (optional)..."
            className="min-h-[120px]"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
          />
        </div>

        <div className="border-border flex items-center justify-between border-t p-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={onForward}
              disabled={isDisabled}
            >
              {isForwarding ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              {isForwarding ? 'Forwarding...' : 'Forward'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}