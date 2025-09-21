"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { ArrowLeft, Send, Bot } from "lucide-react";
import { api } from "~/trpc/react";

export default function ComposePage() {
  const router = useRouter();

  // Compose state
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Mutations
  const sendEmailMutation = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      router.push("/inbox");
    },
  });

  const handleSend = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      return;
    }

    sendEmailMutation.mutate({
      to: to.split(",").map((email) => email.trim()),
      subject,
      body,
    });
  };

  const handleBack = () => {
    router.push("/inbox");
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-border border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Compose New Email</h1>
        </div>
      </div>

      {/* Compose Form */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-4">
            {/* To Field */}
            <div>
              <label htmlFor="to" className="mb-2 block text-sm font-medium">
                To
              </label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Subject Field */}
            <div>
              <label
                htmlFor="subject"
                className="mb-2 block text-sm font-medium"
              >
                Subject
              </label>
              <Input
                id="subject"
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Body Field */}
            <div>
              <label htmlFor="body" className="mb-2 block text-sm font-medium">
                Message
              </label>
              <Textarea
                id="body"
                placeholder="Write your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[300px] w-full resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={
                  sendEmailMutation.isPending ||
                  !to.trim() ||
                  !subject.trim() ||
                  !body.trim()
                }
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {sendEmailMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
