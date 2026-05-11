"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  User,
  Bell,
  Shield,
  Palette,
  CreditCard,
  Download,
  Trash2,
  Key,
  Smartphone,
  Globe,
  Moon,
  Sun,
  Monitor,
  Zap,
  CheckCircle2,
  Camera,
  Loader2,
} from "lucide-react"
import { useAuthUser } from "@/lib/use-auth-user"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { toast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { user, loading, displayName, email, initials, avatarUrl } = useAuthUser()
  const { theme, setTheme } = useTheme()

  // Profile form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [university, setUniversity] = useState("")
  const [major, setMajor] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  // Notification & preference state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [studyReminders, setStudyReminders] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [language, setLanguage] = useState("en")
  const [autoGrade, setAutoGrade] = useState(true)
  const [showHints, setShowHints] = useState(true)

  // Populate form fields from real user data once loaded
  useEffect(() => {
    if (!user) return

    const meta = (user.user_metadata ?? {}) as Record<string, string>

    const first = meta.first_name ?? ""
    const last = meta.last_name ?? ""
    const fullName = meta.full_name ?? meta.display_name ?? meta.name ?? ""

    if (first || last) {
      setFirstName(first)
      setLastName(last)
    } else if (fullName) {
      const parts = fullName.trim().split(/\s+/)
      setFirstName(parts[0] ?? "")
      setLastName(parts.slice(1).join(" "))
    }

    setUserEmail(user.email ?? "")
    setUniversity(meta.university ?? "")
    setMajor(meta.major ?? "")
  }, [user])

  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({
        email: userEmail !== user?.email ? userEmail : undefined,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          university,
          major,
        },
      })

      if (error) throw error

      toast({ title: "Profile updated", description: "Your profile has been saved." })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to save profile",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match" })
      return
    }
    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Password must be at least 8 characters" })
      return
    }
    setSavingPassword(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({ title: "Password updated", description: "Your password has been changed." })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update password",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and application settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                {loading ? (
                  <Skeleton className="h-24 w-24 rounded-full" />
                ) : (
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl ?? undefined} alt={displayName ?? "Profile"} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="gap-2" disabled>
                    <Camera className="h-4 w-4" />
                    Change Photo
                  </Button>
                  <p className="text-sm text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`space-y-2 ${i === 4 ? "md:col-span-2" : ""}`}>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="university">University</Label>
                    <Input
                      id="university"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="e.g. MIT"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="e.g. Chemical Engineering"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={loading || savingProfile}>
                  {savingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure which emails you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates about your activity</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">Get a weekly summary of your progress</p>
                </div>
                <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Study Reminders</Label>
                  <p className="text-sm text-muted-foreground">Receive reminders to practice</p>
                </div>
                <Switch checked={studyReminders} onCheckedChange={setStudyReminders} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Push Notifications</CardTitle>
              <CardDescription>Manage browser and mobile push notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications on your devices</p>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how ExamProfile looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "light", icon: Sun, label: "Light" },
                    { value: "dark", icon: Moon, label: "Dark" },
                    { value: "system", icon: Monitor, label: "System" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        theme === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <option.icon
                        className={`h-6 w-6 ${
                          theme === option.value ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          theme === option.value ? "text-primary" : ""
                        }`}
                      >
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="language">Language</Label>
                  <p className="text-sm text-muted-foreground">Select your preferred language</p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[180px]">
                    <Globe className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Study Preferences</CardTitle>
              <CardDescription>Customize your exam experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-grade answers</Label>
                  <p className="text-sm text-muted-foreground">Automatically grade your responses using AI</p>
                </div>
                <Switch checked={autoGrade} onCheckedChange={setAutoGrade} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show hints</Label>
                  <p className="text-sm text-muted-foreground">Display hints when you get stuck</p>
                </div>
                <Switch checked={showHints} onCheckedChange={setShowHints} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUpdatePassword} disabled={savingPassword}>
                  {savingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Smartphone className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">Two-factor authentication is not enabled</p>
                    <p className="text-sm text-muted-foreground">Protect your account with 2FA</p>
                  </div>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">Download all your data</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and data</p>
                </div>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="glass-card border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Pro Plan
                  </CardTitle>
                  <CardDescription>Your current subscription</CardDescription>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$19</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Unlimited exam generation",
                    "AI-powered grading",
                    "Advanced analytics",
                    "Priority support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Next billing date: April 15, 2026</span>
                  <Button variant="outline" size="sm">Manage Subscription</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-background">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Visa ending in 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2027</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">Update</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View and download past invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { date: "Mar 15, 2026", amount: "$19.00", status: "Paid" },
                  { date: "Feb 15, 2026", amount: "$19.00", status: "Paid" },
                  { date: "Jan 15, 2026", amount: "$19.00", status: "Paid" },
                ].map((invoice, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{invoice.date}</span>
                      <span className="text-sm text-muted-foreground">{invoice.amount}</span>
                      <Badge variant="outline" className="text-green-500 border-green-500/30">{invoice.status}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
