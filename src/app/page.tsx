"use client"

import { useState } from "react"
import {
  Search,
  Menu,
  Settings,
  Archive,
  Trash2,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Download,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Textarea } from "~/components/ui/textarea"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"

// Mock data
const mockLabels = [
  { name: "Inbox", count: 12, active: true },
  { name: "Starred", count: 3, active: false },
  { name: "Sent", count: 0, active: false },
  { name: "Drafts", count: 2, active: false },
  { name: "Archive", count: 0, active: false },
  { name: "Spam", count: 1, active: false },
  { name: "Trash", count: 0, active: false },
]

const mockThreads = [
  {
    id: "1",
    subject: "Project Update - Q4 Planning",
    participants: ["Sarah Chen", "Mike Johnson"],
    preview: "Hi team, I wanted to share the latest updates on our Q4 planning initiative...",
    time: "2:30 PM",
    unread: true,
    starred: false,
    hasAttachment: true,
    messageCount: 3,
  },
  {
    id: "2",
    subject: "Meeting Notes - Design Review",
    participants: ["Alex Rivera"],
    preview: "Thanks for the productive meeting today. Here are the key takeaways...",
    time: "11:45 AM",
    unread: true,
    starred: true,
    hasAttachment: false,
    messageCount: 1,
  },
  {
    id: "3",
    subject: "Invoice #INV-2024-001",
    participants: ["Billing Team"],
    preview: "Your monthly subscription invoice is ready for review...",
    time: "Yesterday",
    unread: false,
    starred: false,
    hasAttachment: true,
    messageCount: 1,
  },
  {
    id: "4",
    subject: "Welcome to the team!",
    participants: ["HR Department", "John Smith"],
    preview: "We are excited to welcome you to our growing team...",
    time: "Dec 8",
    unread: false,
    starred: false,
    hasAttachment: false,
    messageCount: 5,
  },
]

const mockThread = {
  id: "1",
  subject: "Project Update - Q4 Planning",
  messages: [
    {
      id: "m1",
      from: { name: "Sarah Chen", email: "sarah@company.com", avatar: "/diverse-woman-portrait.png" },
      to: ["team@company.com"],
      time: "2024-12-09 10:30 AM",
      content: `Hi team,

I wanted to share the latest updates on our Q4 planning initiative. We've made significant progress on several fronts:

1. **Budget Allocation**: Finance has approved the additional resources for the mobile app development
2. **Timeline**: We're on track to complete Phase 1 by end of December
3. **Team Expansion**: Two new developers will be joining us next week

Please review the attached documents and let me know if you have any questions.

Best regards,
Sarah`,
      attachments: [
        { name: "Q4-Budget-Plan.pdf", size: "2.3 MB", type: "pdf" },
        { name: "Timeline-Overview.xlsx", size: "1.1 MB", type: "excel" },
      ],
    },
    {
      id: "m2",
      from: { name: "Mike Johnson", email: "mike@company.com", avatar: "/thoughtful-man.png" },
      to: ["sarah@company.com", "team@company.com"],
      time: "2024-12-09 1:15 PM",
      content: `Sarah,

Thanks for the comprehensive update! This looks great.

I have a few questions about the timeline:
- Are we accounting for the holiday break in December?
- Do we need to adjust any milestones based on the new team members' onboarding?

I'll review the budget document and get back to you by tomorrow.

Mike`,
      attachments: [],
    },
    {
      id: "m3",
      from: { name: "Sarah Chen", email: "sarah@company.com", avatar: "/diverse-woman-portrait.png" },
      to: ["mike@company.com", "team@company.com"],
      time: "2024-12-09 2:30 PM",
      content: `Mike,

Great questions! Yes, we've factored in the holiday break. The timeline includes a 2-week buffer for onboarding and holiday coverage.

I've updated the timeline document to reflect these considerations. Let's discuss this further in tomorrow's standup.

Sarah`,
      attachments: [{ name: "Updated-Timeline.xlsx", size: "1.2 MB", type: "excel" }],
    },
  ],
}

export default function GmailClient() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const handleSyncEmails = () => {
    // Mock sync function
    console.log("Syncing emails...")
  }

  const handleDraftWithAI = () => {
    setReplyText(
      "Hi there,\n\nThank you for your message. I'll review the details and get back to you shortly.\n\nBest regards,",
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">G</span>
            </div>
            <span className="font-semibold text-lg">Gmail</span>
          </div>

          <Button onClick={handleSyncEmails} className="w-full mb-4 bg-transparent" variant="outline">
            Sync Emails
          </Button>

          <Button onClick={() => setIsComposing(true)} className="w-full mb-6">
            Compose
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pb-4">
            {mockLabels.map((label) => (
              <div
                key={label.name}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-accent ${
                  label.active ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span className="text-sm">{label.name}</span>
                {label.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {label.count}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mail"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Thread List */}
          {!selectedThread && (
            <div className="flex-1 border-r border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Inbox</h2>
                  <Badge variant="secondary">{mockThreads.filter((t) => t.unread).length} unread</Badge>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {mockThreads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThread(thread.id)}
                    className={`p-4 border-b border-border cursor-pointer hover:bg-accent ${
                      thread.unread ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        {thread.starred && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                        <div className={`w-2 h-2 rounded-full ${thread.unread ? "bg-primary" : "bg-transparent"}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm truncate ${thread.unread ? "font-semibold" : ""}`}>
                            {thread.participants.join(", ")}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {thread.hasAttachment && <Paperclip className="h-3 w-3" />}
                            <span>{thread.time}</span>
                          </div>
                        </div>

                        <div className={`text-sm mb-1 ${thread.unread ? "font-medium" : ""}`}>{thread.subject}</div>

                        <div className="text-xs text-muted-foreground truncate">{thread.preview}</div>

                        {thread.messageCount > 1 && (
                          <Badge variant="outline" className="text-xs mt-2">
                            {thread.messageCount} messages
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          {/* Thread View */}
          {selectedThread && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
                      ←
                    </Button>
                    <h2 className="font-semibold">{mockThread.subject}</h2>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Star className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {mockThread.messages.map((message, index) => (
                    <div key={message.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.from.avatar || "/placeholder.svg"} />
                            <AvatarFallback>
                              {message.from.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{message.from.name}</div>
                            <div className="text-xs text-muted-foreground">to {message.to.join(", ")}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{message.time}</div>
                      </div>

                      <div className="text-sm leading-relaxed whitespace-pre-wrap mb-4">{message.content}</div>

                      {message.attachments.length > 0 && (
                        <div className="space-y-2">
                          <Separator />
                          <div className="text-xs text-muted-foreground mb-2">
                            {message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}
                          </div>
                          {message.attachments.map((attachment, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2 border border-border rounded bg-muted/30"
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="text-sm flex-1">{attachment.name}</span>
                              <span className="text-xs text-muted-foreground">{attachment.size}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {index === mockThread.messages.length - 1 && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                          <Button variant="outline" size="sm">
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <Button variant="outline" size="sm">
                            <ReplyAll className="h-3 w-3 mr-1" />
                            Reply All
                          </Button>
                          <Button variant="outline" size="sm">
                            <Forward className="h-3 w-3 mr-1" />
                            Forward
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Reply Box */}
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>You</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">Reply to thread</span>
                    </div>

                    <Textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[120px] mb-3"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button size="sm">
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDraftWithAI}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Draft with AI
                        </Button>
                      </div>

                      <Button variant="ghost" size="icon">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">New Message</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsComposing(false)}>
                ×
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <Input placeholder="To" />
              <Input placeholder="Subject" />
              <Textarea placeholder="Compose your message..." className="min-h-[200px]" />
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button>
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </Button>
                <Button variant="outline" onClick={handleDraftWithAI}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Draft with AI
                </Button>
              </div>

              <Button variant="ghost" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
