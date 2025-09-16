"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
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
  RefreshCw,
  Loader2,
  LogOut,
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Textarea } from "~/components/ui/textarea"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"
import { SyncPanel } from "~/components/SyncPanel"
import { handleSignOut } from "~/lib/auth"
import { api } from "~/trpc/react"

export default function GmailClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedThread, setSelectedThread] = useState<number | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSyncPanel, setShowSyncPanel] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>()
  const [currentPage, setCurrentPage] = useState(1)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Fetch Gmail data
  const { data: threadsData, isLoading: threadsLoading, refetch: refetchThreads } = api.gmail.getThreads.useQuery({
    page: currentPage,
    limit: 20,
    label: selectedLabel,
  })

  const { data: labelsData, isLoading: labelsLoading } = api.gmail.getLabels.useQuery()
  const { data: threadCounts, isLoading: countsLoading } = api.gmail.getThreadCounts.useQuery()

  const { data: threadMessages, isLoading: messagesLoading } = api.gmail.getThreadMessages.useQuery(
    { threadId: selectedThread! },
    { enabled: !!selectedThread }
  )

  // Sync functionality
  const triggerSyncMutation = api.sync.triggerSync.useMutation({
    onSuccess: () => {
      refetchThreads()
      setShowSyncPanel(false)
    },
  })

  const handleSyncEmails = () => {
    triggerSyncMutation.mutate()
  }

  const handleDraftWithAI = () => {
    setReplyText(
      "Hi there,\n\nThank you for your message. I'll review the details and get back to you shortly.\n\nBest regards,",
    )
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 24 * 7) {
      return d.toLocaleDateString([], { weekday: 'short' })
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Show loading state
  if (status === "loading" || threadsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading Gmail...</span>
        </div>
      </div>
    )
  }

  // Show error if not authenticated
  if (status === "unauthenticated") {
    return null
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

          <Button 
            onClick={handleSyncEmails} 
            className="w-full mb-4 bg-transparent" 
            variant="outline"
            disabled={triggerSyncMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {triggerSyncMutation.isPending ? "Syncing..." : "Sync Emails"}
          </Button>

          <Button onClick={() => setIsComposing(true)} className="w-full mb-6">
            Compose
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pb-4">
            {/* Default labels */}
            <div
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-accent ${
                !selectedLabel ? "bg-accent text-accent-foreground" : ""
              }`}
              onClick={() => setSelectedLabel(undefined)}
            >
              <span className="text-sm">Inbox</span>
              <Badge variant="secondary" className="text-xs">
                {threadsData?.total || 0}
              </Badge>
            </div>

            <div
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-accent ${
                selectedLabel === "STARRED" ? "bg-accent text-accent-foreground" : ""
              }`}
              onClick={() => setSelectedLabel("STARRED")}
            >
              <span className="text-sm">Starred</span>
              <Badge variant="secondary" className="text-xs">
                {threadCounts?.find(c => c.labelId === "STARRED")?.count || 0}
              </Badge>
            </div>

            {/* Gmail labels */}
            {labelsData?.map((label) => (
              <div
                key={label.id}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-accent ${
                  selectedLabel === label.labelId ? "bg-accent text-accent-foreground" : ""
                }`}
                onClick={() => setSelectedLabel(label.labelId)}
              >
                <span className="text-sm">{label.name}</span>
                  <Badge variant="secondary" className="text-xs">
                  {threadCounts?.find(c => c.labelId === label.labelId)?.count || 0}
                  </Badge>
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
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Thread List */}
          {!selectedThread && (
            <div className="flex-1 border-r border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {selectedLabel ? labelsData?.find(l => l.labelId === selectedLabel)?.name || selectedLabel : "Inbox"}
                  </h2>
                  <Badge variant="secondary">
                    {threadsData?.threads.filter((t) => t.isUnread).length} unread
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {threadsData?.threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThread(thread.id)}
                    className={`p-4 border-b border-border cursor-pointer hover:bg-accent ${
                      thread.isUnread ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        {thread.isStarred && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                        <div className={`w-2 h-2 rounded-full ${thread.isUnread ? "bg-primary" : "bg-transparent"}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm truncate ${thread.isUnread ? "font-semibold" : ""}`}>
                            {thread.latestMessage?.from || "Unknown"}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(thread.lastMessageDate)}</span>
                          </div>
                        </div>

                        <div className={`text-sm mb-1 ${thread.isUnread ? "font-medium" : ""}`}>
                          {thread.latestMessage?.subject || thread.snippet}
                        </div>

                        <div className="text-xs text-muted-foreground truncate">
                          {thread.snippet}
                        </div>

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
          {selectedThread && threadMessages && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
                      ←
                    </Button>
                    <h2 className="font-semibold">{threadMessages.thread?.snippet || "Thread"}</h2>
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
                  {threadMessages.messages.map((message, index) => (
                    <div key={message.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(message.from)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{message.from}</div>
                            <div className="text-xs text-muted-foreground">to {message.to}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(message.date)}</div>
                      </div>

                      <div className="text-sm leading-relaxed whitespace-pre-wrap mb-4">
                        {message.bodyS3Key ? (
                          <div className="text-muted-foreground">
                            [Email body stored in S3 - {message.bodyS3Key}]
                          </div>
                        ) : (
                          message.snippet
                        )}
                      </div>

                      {message.attachments.length > 0 && (
                        <div className="space-y-2">
                          <Separator />
                          <div className="text-xs text-muted-foreground mb-2">
                            {message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}
                          </div>
                          {message.attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center gap-2 p-2 border border-border rounded bg-muted/30"
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="text-sm flex-1">{attachment.filename}</span>
                              <span className="text-xs text-muted-foreground">{attachment.size} bytes</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {index === threadMessages.messages.length - 1 && (
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

      {/* Sync Panel Modal */}
      {showSyncPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Gmail Sync</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSyncPanel(false)}>
                ×
              </Button>
            </div>
            <div className="p-6 overflow-auto">
              <SyncPanel />
            </div>
          </div>
        </div>
      )}

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